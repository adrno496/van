// Contenu éditorial du site : voyages, articles du carnet, guides rédigés, réglages du site.
// Chaque fichier JSON de content/ est contrôlé champ par champ ; rien n'est repris sans que son type soit vérifié.
//
// Frontière public / privé : elle est portée par les données, jamais par l'emplacement dans la page.
//   visibility : "private" (défaut) | "public"
//   status     : "draft" (défaut)   | "published"
// Un élément n'entre dans la version publique que s'il est à la fois « public » et « published ».
import fs from 'node:fs';
import path from 'node:path';

export const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const LIMITS = { title: 160, summary: 400, excerpt: 400, text: 100000, caption: 300, alt: 300, name: 120, descriptor: 160 };

// Les erreurs de contenu arrêtent la construction : un fichier douteux ne produit pas de page.
class ContentError extends Error {}
const fail = (file, message) => { throw new ContentError(`Contenu refusé — ${file} : ${message}`); };

function text(file, value, field, max, { required = false } = {}) {
  if (value == null || value === '') { if (required) fail(file, `« ${field} » est obligatoire`); return ''; }
  if (typeof value !== 'string') fail(file, `« ${field} » doit être un texte`);
  if (value.length > max) fail(file, `« ${field} » dépasse ${max} caractères`);
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) fail(file, `« ${field} » contient des caractères de contrôle`);
  return value;
}
function day(file, value, field, required = false) {
  if (value == null || value === '') { if (required) fail(file, `« ${field} » est obligatoire`); return null; }
  if (typeof value !== 'string' || !DAY.test(value) || Number.isNaN(Date.parse(value))) fail(file, `« ${field} » doit être une date AAAA-MM-JJ`);
  return value;
}
// Seuls http et https sont acceptés pour un lien sortant.
export function safeUrl(value) {
  if (typeof value !== 'string') return '';
  try { const u = new URL(value); return /^https?:$/.test(u.protocol) ? u.href : ''; } catch { return ''; }
}
// Une image est un fichier de content/media/, désigné par un chemin relatif simple : ni « .. », ni chemin absolu, ni adresse.
const MEDIA = /^[a-z0-9][a-z0-9._-]*(?:\/[a-z0-9][a-z0-9._-]*)*\.(?:jpe?g|png|webp)$/i;
function media(file, value, field, contentDir) {
  if (value == null || value === '') return null;
  const src = typeof value === 'string' ? value : value && value.src;
  if (typeof src !== 'string' || !MEDIA.test(src) || src.includes('..')) fail(file, `« ${field} » doit désigner un fichier de content/media/ (jpg, png ou webp), sans « .. » ni adresse`);
  const full = path.join(contentDir, 'media', src);
  if (!path.resolve(full).startsWith(path.resolve(contentDir, 'media') + path.sep)) fail(file, `« ${field} » sort du dossier content/media/`);
  if (!fs.existsSync(full)) fail(file, `« ${field} » : fichier absent (${src})`);
  const size = imageSize(fs.readFileSync(full));
  if (!size) fail(file, `« ${field} » : image illisible (${src})`);
  const alt = typeof value === 'object' ? text(file, value.alt, field + '.alt', LIMITS.alt) : '';
  const caption = typeof value === 'object' ? text(file, value.caption, field + '.caption', LIMITS.caption) : '';
  const data = fs.readFileSync(full);
  return { src, width: size[0], height: size[1], alt, caption, bytes: data.length, gps: hasGpsPosition(data) };
}
// Une photographie peut porter la position où elle a été prise (métadonnées EXIF, étiquette GPS). Publier la photo publie cette position.
// Détection seulement : le fichier n'est jamais modifié ici.
export function hasGpsPosition(buf) {
  const inTiff = (start, end) => {
    if (end - start < 14) return false;
    const little = buf.toString('ascii', start, start + 2) === 'II';
    if (!little && buf.toString('ascii', start, start + 2) !== 'MM') return false;
    const u16 = (o) => (little ? buf.readUInt16LE(o) : buf.readUInt16BE(o)), u32 = (o) => (little ? buf.readUInt32LE(o) : buf.readUInt32BE(o));
    const ifd = start + u32(start + 4);
    if (ifd + 2 > end) return false;
    const count = u16(ifd);
    for (let i = 0; i < count && ifd + 2 + (i + 1) * 12 <= end; i++) if (u16(ifd + 2 + i * 12) === 0x8825) return true;
    return false;
  };
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    for (let i = 2; i + 4 < buf.length && buf[i] === 0xff;) {
      const marker = buf[i + 1], length = buf.readUInt16BE(i + 2);
      if (marker === 0xe1 && buf.toString('ascii', i + 4, i + 8) === 'Exif' && inTiff(i + 10, i + 2 + length)) return true;
      if (marker === 0xda) break;
      i += 2 + length;
    }
    return false;
  }
  if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) {
    for (let i = 8; i + 12 <= buf.length;) { const length = buf.readUInt32BE(i), type = buf.toString('ascii', i + 4, i + 8); if (type === 'eXIf' && inTiff(i + 8, i + 8 + length)) return true; i += 12 + length; }
    return false;
  }
  if (buf.length > 30 && buf.toString('ascii', 0, 4) === 'RIFF') {
    for (let i = 12; i + 8 <= buf.length;) { const type = buf.toString('ascii', i, i + 4), length = buf.readUInt32LE(i + 4); if (type === 'EXIF') { const at = buf.toString('ascii', i + 8, i + 12) === 'Exif' ? i + 14 : i + 8; if (inTiff(at, i + 8 + length)) return true; } i += 8 + length + (length % 2); }
  }
  return false;
}
// Dimensions lues dans l'en-tête du fichier : la page peut réserver la place de l'image avant son chargement.
export function imageSize(buf) {
  if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) return [buf.readUInt32BE(16), buf.readUInt32BE(20)];
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) { i++; continue; }
      const marker = buf[i + 1], length = buf.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) return [buf.readUInt16BE(i + 7), buf.readUInt16BE(i + 5)];
      i += 2 + length;
    }
    return null;
  }
  if (buf.length > 30 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    const kind = buf.toString('ascii', 12, 16);
    if (kind === 'VP8X') return [1 + buf.readUIntLE(24, 3), 1 + buf.readUIntLE(27, 3)];
    if (kind === 'VP8 ') return [buf.readUInt16LE(26) & 0x3fff, buf.readUInt16LE(28) & 0x3fff];
    if (kind === 'VP8L') { const b = buf.readUInt32LE(21); return [1 + (b & 0x3fff), 1 + ((b >> 14) & 0x3fff)]; }
  }
  return null;
}

function common(file, raw, contentDir) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail(file, 'le fichier doit contenir un objet');
  // Clés connues seulement : une clé inattendue (dont « __proto__ ») arrête la lecture.
  if (typeof raw.slug !== 'string' || raw.slug.length > 80 || !SLUG.test(raw.slug)) fail(file, '« slug » doit être en minuscules, chiffres et tirets (80 caractères au plus)');
  const visibility = raw.visibility == null ? 'private' : raw.visibility;
  if (visibility !== 'private' && visibility !== 'public') fail(file, '« visibility » vaut "private" ou "public"');
  const status = raw.status == null ? 'draft' : raw.status;
  if (status !== 'draft' && status !== 'published') fail(file, '« status » vaut "draft" ou "published"');
  return { slug: raw.slug, title: text(file, raw.title, 'title', LIMITS.title, { required: true }), visibility, status, isPublic: visibility === 'public' && status === 'published',
    demo: raw.demo === true, updatedAt: day(file, raw.updatedAt, 'updatedAt'), cover: media(file, raw.cover, 'cover', contentDir) };
}
const KEYS = {
  voyage: ['slug', 'title', 'visibility', 'status', 'demo', 'updatedAt', 'cover', 'summary', 'countries', 'dateStart', 'dateEnd', 'distanceKm', 'placeIds', 'gallery', 'text'],
  article: ['slug', 'title', 'visibility', 'status', 'demo', 'updatedAt', 'cover', 'excerpt', 'date', 'placeId', 'voyage', 'photos', 'text'],
  guide: ['slug', 'title', 'visibility', 'status', 'demo', 'updatedAt', 'cover', 'summary', 'text', 'sources']
};
function known(file, raw, kind) {
  for (const k of Object.keys(raw)) if (!KEYS[kind].includes(k)) fail(file, `clé inconnue « ${k.slice(0, 40)} »`);
}
function places(file, list, field, catalogueIds) {
  if (list == null) return [];
  if (!Array.isArray(list) || list.length > 500) fail(file, `« ${field} » doit être une liste d'identifiants de lieux`);
  return list.map((id) => { if (!(Number.isInteger(id) && id >= 0) || !catalogueIds.has(id)) fail(file, `« ${field} » : lieu inconnu (${String(id).slice(0, 20)})`); return id; });
}
function gallery(file, list, field, contentDir) {
  if (list == null) return [];
  if (!Array.isArray(list) || list.length > 40) fail(file, `« ${field} » : 40 images au plus`);
  return list.map((item, i) => media(file, item, `${field}[${i}]`, contentDir)).filter(Boolean);
}

const readers = {
  voyage(file, raw, ctx) {
    known(file, raw, 'voyage');
    const base = common(file, raw, ctx.contentDir);
    const countries = raw.countries == null ? [] : raw.countries;
    if (!Array.isArray(countries) || countries.some((c) => typeof c !== 'string' || !ctx.countries.has(c))) fail(file, '« countries » : pays inconnu de l’Atlas');
    const km = raw.distanceKm == null ? null : raw.distanceKm;
    if (km != null && !(Number.isFinite(km) && km >= 0 && km < 1e6)) fail(file, '« distanceKm » doit être un nombre positif');
    const dateStart = day(file, raw.dateStart, 'dateStart'), dateEnd = day(file, raw.dateEnd, 'dateEnd');
    if (dateStart && dateEnd && dateEnd < dateStart) fail(file, '« dateEnd » précède « dateStart »');
    return { ...base, kind: 'voyage', summary: text(file, raw.summary, 'summary', LIMITS.summary), countries, dateStart, dateEnd, distanceKm: km,
      placeIds: places(file, raw.placeIds, 'placeIds', ctx.placeIds), gallery: gallery(file, raw.gallery, 'gallery', ctx.contentDir), text: text(file, raw.text, 'text', LIMITS.text) };
  },
  article(file, raw, ctx) {
    known(file, raw, 'article');
    const base = common(file, raw, ctx.contentDir);
    const placeId = raw.placeId == null ? null : places(file, [raw.placeId], 'placeId', ctx.placeIds)[0];
    if (raw.voyage != null && (typeof raw.voyage !== 'string' || !SLUG.test(raw.voyage))) fail(file, '« voyage » doit être le slug d’un voyage');
    return { ...base, kind: 'article', excerpt: text(file, raw.excerpt, 'excerpt', LIMITS.excerpt), date: day(file, raw.date, 'date', true), placeId, voyage: raw.voyage || null,
      photos: gallery(file, raw.photos, 'photos', ctx.contentDir), text: text(file, raw.text, 'text', LIMITS.text, { required: true }) };
  },
  guide(file, raw, ctx) {
    known(file, raw, 'guide');
    const base = common(file, raw, ctx.contentDir);
    const sources = raw.sources == null ? [] : raw.sources;
    if (!Array.isArray(sources) || sources.length > 30) fail(file, '« sources » : 30 liens au plus');
    return { ...base, kind: 'guide', summary: text(file, raw.summary, 'summary', LIMITS.summary), text: text(file, raw.text, 'text', LIMITS.text, { required: true }),
      sources: sources.map((s, i) => { const url = safeUrl(s && s.url); if (!url) fail(file, `« sources[${i}].url » doit être une adresse http(s)`); return { url, label: text(file, s.label, `sources[${i}].label`, 200, { required: true }) }; }) };
  }
};

const SITE_DEFAULTS = { name: 'Atlas Van', descriptor: 'Atlas de l’Europe en van', siteUrl: null, about: [], legal: null, social: [] };
function readSite(file, raw) {
  if (raw == null) return { ...SITE_DEFAULTS };
  if (typeof raw !== 'object' || Array.isArray(raw)) fail(file, 'le fichier doit contenir un objet');
  for (const k of Object.keys(raw)) if (!Object.keys(SITE_DEFAULTS).includes(k)) fail(file, `clé inconnue « ${k.slice(0, 40)} »`);
  const site = { ...SITE_DEFAULTS, name: text(file, raw.name, 'name', LIMITS.name) || SITE_DEFAULTS.name, descriptor: text(file, raw.descriptor, 'descriptor', LIMITS.descriptor) || SITE_DEFAULTS.descriptor };
  if (raw.siteUrl != null) { const u = safeUrl(raw.siteUrl); if (!u) fail(file, '« siteUrl » doit être une adresse http(s)'); site.siteUrl = u.replace(/\/+$/, ''); }
  const about = raw.about == null ? [] : raw.about;
  if (!Array.isArray(about) || about.length > 12) fail(file, '« about » : 12 sections au plus');
  site.about = about.map((s, i) => { if (!s || typeof s !== 'object') fail(file, `« about[${i}] » invalide`);
    const visibility = s.visibility === 'public' ? 'public' : 'private';
    return { title: text(file, s.title, `about[${i}].title`, LIMITS.title, { required: true }), text: text(file, s.text, `about[${i}].text`, 20000, { required: true }), visibility }; });
  if (raw.legal != null) {
    if (typeof raw.legal !== 'object') fail(file, '« legal » invalide');
    site.legal = { publisher: text(file, raw.legal.publisher, 'legal.publisher', 300, { required: true }), contact: text(file, raw.legal.contact, 'legal.contact', 300), host: text(file, raw.legal.host, 'legal.host', 500) };
  }
  const social = raw.social == null ? [] : raw.social;
  if (!Array.isArray(social) || social.length > 10) fail(file, '« social » : 10 liens au plus');
  site.social = social.map((s, i) => { const url = safeUrl(s && s.url); if (!url) fail(file, `« social[${i}].url » doit être une adresse http(s)`); return { url, label: text(file, s.label, `social[${i}].label`, 60, { required: true }) }; });
  return site;
}

// Lit content/. ctx : { placeIds: Set, countries: Set }.
export function loadContent(contentDir, ctx) {
  const out = { site: { ...SITE_DEFAULTS }, voyages: [], articles: [], guides: [], contentDir };
  if (!contentDir || !fs.existsSync(contentDir)) return out;
  const parse = (file) => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { fail(path.relative(contentDir, file), 'JSON illisible'); } };
  const siteFile = path.join(contentDir, 'site.json');
  if (fs.existsSync(siteFile)) out.site = readSite('site.json', parse(siteFile));
  for (const [folder, kind, target] of [['voyages', 'voyage', out.voyages], ['articles', 'article', out.articles], ['guides', 'guide', out.guides]]) {
    const dir = path.join(contentDir, folder);
    if (!fs.existsSync(dir)) continue;
    const seen = new Set();
    for (const name of fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
      const rel = `${folder}/${name}`, item = readers[kind](rel, parse(path.join(dir, name)), { ...ctx, contentDir });
      if (seen.has(item.slug)) fail(rel, `slug en double « ${item.slug} »`);
      seen.add(item.slug); target.push(item);
    }
  }
  const voyageSlugs = new Set(out.voyages.map((v) => v.slug));
  for (const a of out.articles) if (a.voyage && !voyageSlugs.has(a.voyage)) fail(`articles/${a.slug}.json`, `voyage inconnu « ${a.voyage} »`);
  out.voyages.sort((a, b) => String(b.dateStart || '').localeCompare(String(a.dateStart || '')));
  out.articles.sort((a, b) => b.date.localeCompare(a.date));
  return out;
}
// Ce qu'une version a le droit de montrer. Version publique : seulement ce qui est explicitement public et publié, jamais une démo.
export function visibleContent(content, mode, { demo = false } = {}) {
  const keep = (item) => (mode === 'public' ? item.isPublic && !item.demo : (demo || !item.demo));
  return { ...content, voyages: content.voyages.filter(keep), articles: content.articles.filter(keep), guides: content.guides.filter(keep),
    site: { ...content.site, about: content.site.about.filter((s) => mode !== 'public' || s.visibility === 'public') } };
}
// Tout ce que la version publique ne doit contenir sous aucune forme : sert au contrôle de confidentialité.
export function privateStrings(content) {
  const out = [];
  const add = (s) => { if (typeof s === 'string' && s.trim().length >= 12) out.push(s.trim()); };
  const lines = (s) => String(s || '').split(/\n+/).forEach(add);
  for (const item of [...content.voyages, ...content.articles, ...content.guides]) {
    if (item.isPublic && !item.demo) continue;
    add(item.title); add(item.summary); add(item.excerpt); lines(item.text);
    for (const p of [item.cover, ...(item.gallery || []), ...(item.photos || [])]) if (p) { add(p.caption); add(p.alt); }
  }
  for (const s of content.site.about) if (s.visibility !== 'public') { add(s.title); lines(s.text); }
  return out;
}
export { ContentError };
