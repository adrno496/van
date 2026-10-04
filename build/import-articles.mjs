#!/usr/bin/env node
// Range dans content/ les articles exportés depuis le Planner (Carnet › Blog à partager › « Fichier pour le site »).
//   node build/import-articles.mjs <atlas-van-articles.json> [--content <dossier>] [--voyage <slug>] [--dry-run] [--force] [--update-published]
//
// Un fichier par article dans content/articles/, les photographies dans content/media/carnet/.
// - Nouvel article : toujours « private » et « draft », quoi que dise le fichier. La publication est un geste séparé, fait à la main.
// - Réimport (même note du carnet, reconnue par son identifiant) : le brouillon est mis à jour si le carnet a changé,
//   sauf si le fichier a été modifié à la main depuis l'import (il n'est alors jamais écrasé sans --force),
//   et sauf s'il est publié (il faut --update-published ; il reste alors publié, c'est un choix explicite).
// - Photographies : type réel vérifié (JPEG, PNG, WebP), métadonnées retirées (EXIF dont GPS, XMP, IPTC), nom de fichier sûr.
// Rien n'est écrit avant que tout le fichier ait été contrôlé ; --dry-run n'écrit rien du tout.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { SLUG, hasGpsPosition, imageSize, roundCoord } from './content.mjs';
import { sniff, stripMetadata } from './media.mjs';
import { catalogue } from './planner.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2), opt = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
const VALUED = ['--content', '--voyage'];
const source = args.find((a, i) => !a.startsWith('--') && !VALUED.includes(args[i - 1]));
const contentDir = path.resolve(opt('--content', path.join(ROOT, 'content')));
const force = args.includes('--force'), updatePublished = args.includes('--update-published'), dry = args.includes('--dry-run'), voyageOpt = opt('--voyage', null);
const stop = (m) => { console.error('Import refusé : ' + m); process.exit(1); };
const sha = (v) => crypto.createHash('sha256').update(typeof v === 'string' || Buffer.isBuffer(v) ? v : JSON.stringify(v)).digest('hex');
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g;
const clean = (v, max) => (typeof v === 'string' ? v.replace(CONTROL, '').slice(0, max) : '');
const MAX_PHOTO = 8 * 1024 * 1024, MAX_PHOTOS = 12;

if (!source) stop('indiquer le fichier exporté depuis le Planner');
let data;
try { data = JSON.parse(fs.readFileSync(source, 'utf8')); } catch { stop('fichier illisible'); }
if (!data || data.type !== 'atlas-van-articles' || ![1, 2].includes(data.version) || !Array.isArray(data.articles) || data.articles.length > 1000) stop('ce fichier n’est pas un export d’articles Atlas Van (versions 1 ou 2)');

const inside = (...p) => { const f = path.resolve(contentDir, ...p); if (!f.startsWith(contentDir + path.sep)) stop('chemin hors du dossier content/ : ' + p.join('/')); return f; };
const readJson = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };

// Ce qui vient du carnet ; le reste (visibilité, statut, voyage, carte, date de mise à jour) appartient au propriétaire.
// L'empreinte de ces champs, prise à l'import, permet de savoir ensuite si le fichier a été retouché à la main.
const imported = (j) => ({ title: j.title || '', date: j.date || '', excerpt: j.excerpt || '', placeId: j.placeId ?? null, place: j.place ?? null, text: j.text || '',
  images: [j.cover, ...(j.photos || [])].filter(Boolean).map((m) => ({ src: m.src, alt: m.alt || '', caption: m.caption || '' })) });

// Articles déjà rangés, par identifiant de note.
const articlesDir = inside('articles'), existing = new Map(), takenSlugs = new Set();
if (fs.existsSync(articlesDir)) for (const name of fs.readdirSync(articlesDir).filter((f) => f.endsWith('.json'))) {
  const j = readJson(path.join(articlesDir, name)); takenSlugs.add(name.replace(/\.json$/, ''));
  if (j && j.source && j.source.kind === 'carnet' && typeof j.source.id === 'string') existing.set(j.source.id, { file: name, json: j });
}
// Voyages connus, pour rattacher un récit (option --voyage, ou voyage en cours de content/site.json selon la date).
const voyages = new Map();
if (fs.existsSync(inside('voyages'))) for (const name of fs.readdirSync(inside('voyages')).filter((f) => f.endsWith('.json'))) { const v = readJson(inside('voyages', name)); if (v && typeof v.slug === 'string') voyages.set(v.slug, v); }
if (voyageOpt && !voyages.has(voyageOpt)) stop(`voyage inconnu « ${voyageOpt} » (content/voyages/)`);
const site = fs.existsSync(inside('site.json')) ? readJson(inside('site.json')) || {} : {};
const current = typeof site.currentVoyage === 'string' ? voyages.get(site.currentVoyage) : null;
const voyageFor = (date) => (voyageOpt ? voyageOpt : current && (!current.dateStart || date >= current.dateStart) && (!current.dateEnd || date <= current.dateEnd) ? current.slug : null);

// Lieux et pays connus de l'Atlas (version personnelle, la plus complète) : un identifiant inconnu n'est pas repris.
const atlas = catalogue('personal').app, ATLAS_IDS = new Set(atlas.lieux.map((L) => L.i)), ATLAS_COUNTRIES = new Set(atlas.lieux.map((L) => L.p));
const PHOTO = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/, DAY = /^\d{4}-\d{2}-\d{2}$/, ID = /^[A-Za-z0-9_-]{1,64}$/;
const plan = [], report = { created: [], updated: [], unchanged: [], edited: [], published: [] }, warnings = [];
const seenIds = new Set();
for (const [i, a] of data.articles.entries()) {
  const where = `article ${i + 1}`;
  if (!a || typeof a !== 'object' || typeof a.title !== 'string' || !a.title.trim() || typeof a.text !== 'string' || !DAY.test(a.date || '') || Number.isNaN(Date.parse(a.date))) stop(`${where} : titre, texte ou date invalide`);
  // Identifiant stable : celui de la note (version 2) ; à défaut (version 1), une empreinte de la date et du titre.
  const id = typeof a.id === 'string' && ID.test(a.id) ? a.id : 'v1-' + sha(a.date + '\n' + a.title).slice(0, 24);
  if (seenIds.has(id)) stop(`${where} : la même note figure deux fois dans le fichier`);
  seenIds.add(id);
  const prior = existing.get(id);
  let slug = prior ? prior.json.slug : `${a.date}-${typeof a.slug === 'string' && SLUG.test(a.slug) && a.slug.length <= 70 ? a.slug : 'article'}`.slice(0, 80).replace(/-+$/, '');
  if (!prior) { const base = slug; for (let n = 2; takenSlugs.has(slug); n++) slug = `${base.slice(0, 76)}-${n}`; takenSlugs.add(slug); }
  if (!SLUG.test(slug)) stop(`${where} : adresse impossible à construire`);

  const photos = Array.isArray(a.photos) ? a.photos : [];
  if (photos.length > MAX_PHOTOS) stop(`${where} : ${MAX_PHOTOS} photographies au plus`);
  const files = photos.map((ph, n) => {
    const m = PHOTO.exec(ph && typeof ph.src === 'string' ? ph.src : '');
    if (!m || ph.src.length > MAX_PHOTO * 1.4) stop(`${where}, photographie ${n + 1} : format refusé (JPEG, PNG ou WebP en data:, ${MAX_PHOTO / 1048576} Mo au plus)`);
    const raw = Buffer.from(m[2], 'base64'), type = sniff(raw);
    if (!type) stop(`${where}, photographie ${n + 1} : le contenu n’est pas une image JPEG, PNG ou WebP`);
    if (type !== m[1]) stop(`${where}, photographie ${n + 1} : annoncée ${m[1]}, contenu ${type}`);
    let bytes;
    try { bytes = stripMetadata(raw, type); } catch (e) { stop(`${where}, photographie ${n + 1} : ${e.message}`); }
    if (!imageSize(bytes)) stop(`${where}, photographie ${n + 1} : image illisible`);
    if (hasGpsPosition(bytes)) stop(`${where}, photographie ${n + 1} : position GPS impossible à retirer`);
    if (raw.length !== bytes.length) warnings.push(`${slug} : métadonnées retirées de la photographie ${n + 1} (${raw.length - bytes.length} octets)`);
    // Nom sûr et déterminé par le contenu : jamais tiré du fichier d'origine, jamais d'écrasement d'une autre image.
    return { rel: `carnet/${slug}-${n + 1}-${sha(bytes).slice(0, 10)}.${type === 'jpeg' ? 'jpg' : type}`, bytes, caption: clean(ph.caption, 300) };
  });
  if (files.length) warnings.push(`${slug} : ${files.length} photographie(s) sans texte alternatif (« alt ») — à écrire avant publication`);
  if (/<\s*script|javascript:/i.test(a.text)) warnings.push(`${slug} : le texte contient du code (« <script » ou « javascript: ») ; il sera affiché comme du texte, jamais exécuté`);

  const placeId = Number.isInteger(a.placeId) && ATLAS_IDS.has(a.placeId) ? a.placeId : null;
  if (a.placeId != null && placeId == null) warnings.push(`${slug} : lieu ${String(a.placeId).slice(0, 12)} inconnu de l’Atlas, non repris`);
  let place = null;
  if (placeId == null && a.place && typeof a.place === 'object' && Number.isFinite(a.place.lat) && Number.isFinite(a.place.lon) && a.place.lat >= 34 && a.place.lat <= 72 && a.place.lon >= -25 && a.place.lon <= 45) {
    place = { name: clean(a.place.name, 120).trim() || 'Étape', ...(typeof a.place.country === 'string' && ATLAS_COUNTRIES.has(a.place.country.trim()) ? { country: a.place.country.trim() } : {}),
      lat: Number(roundCoord(a.place.lat).toFixed(1)), lon: Number(roundCoord(a.place.lon).toFixed(1)) };
  }
  const fresh = { title: clean(a.title, 160), date: a.date, excerpt: clean(a.excerpt, 400), ...(placeId != null ? { placeId } : {}), ...(place ? { place } : {}),
    ...(files[0] ? { cover: { src: files[0].rel, alt: '', caption: files[0].caption } } : {}), photos: files.slice(1).map((f) => ({ src: f.rel, alt: '', caption: f.caption })), text: clean(a.text, 100000) };
  const hash = sha(imported(fresh));

  if (prior) {
    const j = prior.json, editedByHand = sha(imported(j)) !== (j.source && j.source.hash);
    if (j.source.hash === hash) { report.unchanged.push(slug + (editedByHand ? ' (retouches à la main conservées)' : '')); continue; }
    if (editedByHand && !force) { report.edited.push(slug); continue; }
    if (j.status === 'published' && !updatePublished) { report.published.push(slug); continue; }
    // Mise à jour : les champs du carnet sont remplacés, ceux du propriétaire gardés tels quels.
    const keep = Object.fromEntries(['visibility', 'status', 'voyage', 'onMap', 'updatedAt', 'demo'].filter((k) => j[k] !== undefined).map((k) => [k, j[k]]));
    plan.push({ file: prior.file, files, json: { slug, ...fresh, ...keep, source: { kind: 'carnet', id, hash, importedAt: new Date().toISOString().slice(0, 10) } }, old: j });
    report.updated.push(slug);
  } else {
    const voyage = voyageFor(a.date);
    plan.push({ file: slug + '.json', files, json: { slug, ...fresh, ...(voyage ? { voyage } : {}), visibility: 'private', status: 'draft', source: { kind: 'carnet', id, hash, importedAt: new Date().toISOString().slice(0, 10) } } });
    report.created.push(slug + (voyage ? ` (voyage « ${voyage} »)` : ''));
  }
}

const say = (title, list) => { if (list.length) console.log(`${title} (${list.length}) : ${list.join(', ')}`); };
say('Créés — privés, en brouillon', report.created); say('Mis à jour depuis le carnet', report.updated); say('Déjà à jour', report.unchanged);
say('Ignorés : modifiés à la main depuis l’import (--force pour remplacer le texte du carnet)', report.edited);
say('Ignorés : déjà publiés (--update-published pour les mettre à jour)', report.published);
for (const w of warnings) console.log('  à savoir : ' + w);
if (dry) { console.log('Essai (--dry-run) : rien n’a été écrit.'); process.exit(0); }

// Écriture : fichiers temporaires puis renommage, pour ne jamais laisser un article à moitié écrit.
const write = (file, body) => { fs.mkdirSync(path.dirname(file), { recursive: true }); const tmp = file + '.tmp-' + process.pid; fs.writeFileSync(tmp, body); fs.renameSync(tmp, file); };
for (const item of plan) {
  for (const f of item.files) { const target = inside('media', f.rel); if (!fs.existsSync(target)) write(target, f.bytes); }
  write(inside('articles', item.file), JSON.stringify(item.json, null, 2) + '\n');
  // Images de l'ancienne version devenues inutiles : retirées seulement si elles venaient de l'import (dossier carnet/, nom de l'article).
  if (item.old) {
    const now = new Set(item.files.map((f) => f.rel));
    for (const m of [item.old.cover, ...(item.old.photos || [])].filter(Boolean)) if (m.src.startsWith(`carnet/${item.json.slug}-`) && !now.has(m.src) && fs.existsSync(inside('media', m.src))) fs.rmSync(inside('media', m.src));
  }
}
console.log(`${plan.length} fichier(s) écrit(s) dans ${path.relative(process.cwd(), articlesDir) || '.'}/.`);
if (report.created.length) console.log('Pour publier un article : ouvrir son fichier, écrire le texte alternatif des images, puis passer « visibility » à "public" et « status » à "published".');
