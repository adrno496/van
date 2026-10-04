#!/usr/bin/env node
// Range dans content/ les articles exportés depuis le Planner (Carnet › Blog à partager › « Fichier pour le site »).
//   node build/import-articles.mjs <atlas-van-articles.json> [--content <dossier content>] [--force]
// Un fichier par article dans content/articles/, les photographies dans content/media/carnet/.
// Tout arrive « private » et « draft », quoi que dise le fichier : la publication est un geste séparé, fait à la main.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SLUG } from './content.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2), opt = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
const source = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--content'), contentDir = path.resolve(opt('--content', path.join(ROOT, 'content'))), force = args.includes('--force');
const stop = (m) => { console.error('Import refusé : ' + m); process.exit(1); };
if (!source) stop('indiquer le fichier exporté depuis le Planner');
let data;
try { data = JSON.parse(fs.readFileSync(source, 'utf8')); } catch { stop('fichier illisible'); }
if (!data || data.type !== 'atlas-van-articles' || !Array.isArray(data.articles) || data.articles.length > 1000) stop('ce fichier n’est pas un export d’articles Atlas Van');
const PHOTO = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/, DAY = /^\d{4}-\d{2}-\d{2}$/;
const plan = [], used = new Set(fs.existsSync(path.join(contentDir, 'articles')) ? fs.readdirSync(path.join(contentDir, 'articles')).map((f) => f.replace(/\.json$/, '')) : []);
for (const [i, a] of data.articles.entries()) {
  if (!a || typeof a.title !== 'string' || !a.title.trim() || typeof a.text !== 'string' || !DAY.test(a.date || '')) stop(`article ${i + 1} : titre, texte ou date invalide`);
  let slug = typeof a.slug === 'string' && SLUG.test(a.slug) && a.slug.length <= 70 ? a.slug : 'article';
  slug = `${a.date}-${slug}`.slice(0, 80).replace(/-+$/, '');
  if (used.has(slug) && !force) stop(`content/articles/${slug}.json existe déjà (ajouter --force pour le remplacer)`);
  used.add(slug);
  const photos = Array.isArray(a.photos) ? a.photos : [];
  if (photos.length > 12) stop(`article ${i + 1} : 12 photographies au plus`);
  const files = photos.map((ph, n) => { const m = PHOTO.exec(ph && ph.src || ''); if (!m || ph.src.length > 8e6) stop(`article ${i + 1}, photographie ${n + 1} : format refusé`);
    return { rel: `carnet/${slug}-${n + 1}.${m[1] === 'jpeg' ? 'jpg' : m[1]}`, bytes: Buffer.from(m[2], 'base64'), caption: typeof ph.caption === 'string' ? ph.caption.slice(0, 300) : '' }; });
  plan.push({ slug, files, json: { slug, title: a.title.slice(0, 160), date: a.date, excerpt: typeof a.excerpt === 'string' ? a.excerpt.slice(0, 400) : '', ...(Number.isInteger(a.placeId) && a.placeId >= 0 ? { placeId: a.placeId } : {}),
    ...(files[0] ? { cover: { src: files[0].rel, alt: '', caption: files[0].caption } } : {}), photos: files.slice(1).map((f) => ({ src: f.rel, alt: '', caption: f.caption })), text: a.text.slice(0, 100000), visibility: 'private', status: 'draft' } });
}
// Rien n'est écrit avant que tout le fichier ait été contrôlé.
fs.mkdirSync(path.join(contentDir, 'articles'), { recursive: true }); fs.mkdirSync(path.join(contentDir, 'media', 'carnet'), { recursive: true });
for (const item of plan) {
  for (const f of item.files) fs.writeFileSync(path.join(contentDir, 'media', f.rel), f.bytes);
  fs.writeFileSync(path.join(contentDir, 'articles', item.slug + '.json'), JSON.stringify(item.json, null, 2) + '\n');
}
console.log(`${plan.length} article(s) rangé(s) dans ${path.relative(process.cwd(), path.join(contentDir, 'articles'))}/ — tous privés et en brouillon.`);
console.log('Pour en publier un : ouvrir son fichier, écrire le texte alternatif des images, puis passer « visibility » à "public" et « status » à "published".');
