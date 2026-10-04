// Tests de l'import du carnet vers le blog (build/import-articles.mjs) et du nettoyage des images (build/media.mjs).
//   node tests/import.mjs [--out <rapport.json>]
// Sans navigateur : chaque cas travaille dans une copie temporaire d'un dossier content/ ; content/ n'est pas touché.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { spawnSync } from 'node:child_process';
import { ROOT, writeJson } from './lib/harness.mjs';
import { hasGpsPosition, imageSize } from '../build/content.mjs';
import { sniff, stripMetadata } from '../build/media.mjs';

const args = process.argv.slice(2), out = path.resolve(args.includes('--out') ? args[args.indexOf('--out') + 1] : 'test-results/import.json');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-import-'));
const results = [];
const assert = (c, m) => { if (!c) throw new Error(m); };
const eq = (a, b, m) => assert(JSON.stringify(a) === JSON.stringify(b), `${m} — attendu ${JSON.stringify(b)}, obtenu ${JSON.stringify(a)}`.slice(0, 500));
const IMG = path.join(ROOT, 'tests/fixtures/images'), PNG = fs.readFileSync(path.join(ROOT, 'tests/fixtures/content/media/test/photo.png'));
const JPG = fs.readFileSync(path.join(IMG, 'photo.jpg')), WEBP = fs.readFileSync(path.join(IMG, 'photo.webp'));

// Bloc TIFF minimal portant un pointeur vers des données GPS (étiquette 0x8825), comme l'écrit un téléphone.
function gpsTiff() {
  const b = Buffer.alloc(68); b.write('II', 0, 'ascii'); b.writeUInt16LE(42, 2); b.writeUInt32LE(8, 4);
  b.writeUInt16LE(1, 8); b.writeUInt16LE(0x8825, 10); b.writeUInt16LE(4, 12); b.writeUInt32LE(1, 14); b.writeUInt32LE(26, 18); b.writeUInt32LE(0, 22);
  b.writeUInt16LE(1, 26); b.writeUInt16LE(2, 28); b.writeUInt16LE(5, 30); b.writeUInt32LE(3, 32); b.writeUInt32LE(44, 36); b.writeUInt32LE(0, 40);
  for (let k = 0; k < 3; k++) { b.writeUInt32LE([43, 40, 12][k], 44 + k * 8); b.writeUInt32LE(1, 48 + k * 8); }
  return b;
}
const withGps = {
  jpeg: (buf) => { const t = Buffer.concat([Buffer.from('Exif\0\0', 'ascii'), gpsTiff()]), seg = Buffer.alloc(4); seg.writeUInt16BE(0xffe1, 0); seg.writeUInt16BE(t.length + 2, 2); return Buffer.concat([buf.subarray(0, 2), seg, t, buf.subarray(2)]); },
  png: (buf) => { const t = gpsTiff(), head = Buffer.alloc(8); head.writeUInt32BE(t.length, 0); head.write('eXIf', 4, 'ascii'); const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(Buffer.concat([head.subarray(4), t])), 0);
    const iend = buf.length - 12; return Buffer.concat([buf.subarray(0, iend), head, t, crc, buf.subarray(iend)]); },
  webp: (buf) => { const t = Buffer.concat([Buffer.from('Exif\0\0', 'ascii'), gpsTiff()]), head = Buffer.alloc(8); head.write('EXIF', 0, 'ascii'); head.writeUInt32LE(t.length, 4);
    const body = Buffer.concat([buf.subarray(12), head, t, t.length % 2 ? Buffer.alloc(1) : Buffer.alloc(0)]), riff = Buffer.alloc(12); riff.write('RIFF', 0, 'ascii'); riff.writeUInt32LE(body.length + 4, 4); riff.write('WEBP', 8, 'ascii'); return Buffer.concat([riff, body]); }
};
const dataUrl = (type, buf) => `data:image/${type};base64,${buf.toString('base64')}`;
const exportFile = (name, articles, version = 2) => { const f = path.join(tmp, name + '.json'); fs.writeFileSync(f, JSON.stringify({ type: 'atlas-van-articles', version, exported: '2026-04-20T10:00:00Z', articles })); return f; };
const newContent = (name, extra = {}) => { const dir = path.join(tmp, 'content-' + name); fs.mkdirSync(path.join(dir, 'voyages'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'voyages/espagne.json'), JSON.stringify({ slug: 'espagne', title: 'Espagne', dateStart: '2026-04-01', countries: ['Espagne'] }));
  fs.writeFileSync(path.join(dir, 'site.json'), JSON.stringify({ currentVoyage: 'espagne', ...extra })); return dir; };
const run = (...a) => spawnSync(process.execPath, [path.join(ROOT, 'build/import-articles.mjs'), ...a], { encoding: 'utf8', cwd: ROOT });
const imp = (file, dir, ...a) => { const r = run(file, '--content', dir, ...a); if (r.status !== 0) throw new Error('import : ' + (r.stderr || r.stdout).trim().slice(0, 300)); return r.stdout; };
const refused = (file, dir, expected, ...a) => { const before = snapshot(dir), r = run(file, '--content', dir, ...a); assert(r.status === 1 && expected.test(r.stderr), `aurait dû être refusé (${expected}) : ${r.status} ${(r.stderr || r.stdout).trim().slice(0, 200)}`); eq(snapshot(dir), before, 'rien n\'est écrit après un refus'); };
const articles = (dir) => (fs.existsSync(path.join(dir, 'articles')) ? fs.readdirSync(path.join(dir, 'articles')).sort().map((f) => JSON.parse(fs.readFileSync(path.join(dir, 'articles', f), 'utf8'))) : []);
const walk = (dir, base = '') => fs.readdirSync(path.join(dir, base), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(dir, path.join(base, e.name)) : [path.join(base, e.name)]));
const snapshot = (dir) => walk(dir).sort().map((f) => [f, fs.readFileSync(path.join(dir, f)).toString('base64').length, fs.statSync(path.join(dir, f)).mtimeMs]);
const post = (over = {}) => ({ id: 'note-0001', slug: 'nuit-a-bardenas', title: 'Nuit aux Bardenas', date: '2026-04-18', excerpt: 'Extrait', placeId: 77, text: 'Premier paragraphe.\n\nSecond.', photos: [], visibility: 'public', status: 'published', ...over });

const TESTS = {
  'images : type réel reconnu, métadonnées (dont GPS) retirées en JPEG, PNG et WebP, image intacte': () => {
    for (const [type, buf] of [['jpeg', JPG], ['png', PNG], ['webp', WEBP]]) {
      const dirty = withGps[type](buf), clean = stripMetadata(dirty);
      eq([sniff(dirty), hasGpsPosition(dirty), hasGpsPosition(clean), sniff(clean)], [type, true, false, type], type + ' : position détectée puis retirée');
      eq(imageSize(clean), imageSize(buf), type + ' : dimensions inchangées');
      assert(Buffer.compare(stripMetadata(buf), clean) === 0, type + ' : seul le bloc de métadonnées diffère, les données de l\'image sont intactes');
    }
    eq([sniff(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>')), sniff(Buffer.from('GIF89a' + 'x'.repeat(20))), sniff(Buffer.from('<html><script>alert(1)</script></html>'))], [null, null, null], 'SVG, GIF, HTML refusés');
  },
  'premier import : brouillon privé quoi que dise le fichier, identifiant de la note, rattachement au voyage en cours, avertissements ; publication explicite': () => {
    const dir = newContent('premier'), f = exportFile('premier', [post({ photos: [{ src: dataUrl('jpeg', withGps.jpeg(JPG)), caption: 'Coucher de soleil' }, { src: dataUrl('png', PNG), caption: '' }] })]);
    const outText = imp(f, dir), [a] = articles(dir);
    eq([a.visibility, a.status, a.voyage, a.source.kind, a.source.id, a.slug], ['private', 'draft', 'espagne', 'carnet', 'note-0001', '2026-04-18-nuit-a-bardenas'], 'article créé');
    assert(/^carnet\/2026-04-18-nuit-a-bardenas-1-[a-f0-9]{10}\.jpg$/.test(a.cover.src) && /-2-[a-f0-9]{10}\.png$/.test(a.photos[0].src), 'noms de fichiers sûrs : ' + a.cover.src);
    const cover = fs.readFileSync(path.join(dir, 'media', a.cover.src)); eq([hasGpsPosition(cover), sniff(cover)], [false, 'jpeg'], 'photographie écrite sans position GPS');
    assert(/sans texte alternatif/.test(outText) && /métadonnées retirées/.test(outText), 'avertissements : ' + outText);
    const b = spawnSync(process.execPath, [path.join(ROOT, 'build.mjs'), '--mode', 'personal', '--content', dir, '--dir', path.join(tmp, 'site-premier')], { encoding: 'utf8', cwd: ROOT });
    assert(b.status === 0, 'le contenu importé se construit : ' + (b.stderr || '').slice(0, 300));
    assert(/Brouillon/.test(fs.readFileSync(path.join(tmp, 'site-premier', 'carnet', a.slug, 'index.html'), 'utf8')), 'article visible et marqué brouillon dans la version personnelle');
    const p = spawnSync(process.execPath, [path.join(ROOT, 'build.mjs'), '--mode', 'public', '--content', dir, '--dir', path.join(tmp, 'site-premier-pub')], { encoding: 'utf8', cwd: ROOT });
    assert(p.status === 0 && !fs.existsSync(path.join(tmp, 'site-premier-pub', 'carnet', a.slug)), 'absent de la version publique');
    // Publication explicite : le propriétaire écrit les textes alternatifs et passe l'article en public et publié.
    const file = path.join(dir, 'articles', a.slug + '.json'), j = JSON.parse(fs.readFileSync(file, 'utf8'));
    j.cover.alt = 'Coucher de soleil sur le désert'; j.photos[0].alt = 'Photo de test'; j.visibility = 'public'; j.status = 'published';
    const vf = path.join(dir, 'voyages/espagne.json'), v = JSON.parse(fs.readFileSync(vf, 'utf8')); v.visibility = 'public'; v.status = 'published'; fs.writeFileSync(vf, JSON.stringify(v));
    fs.writeFileSync(file, JSON.stringify(j));
    const q = spawnSync(process.execPath, [path.join(ROOT, 'build.mjs'), '--mode', 'public', '--content', dir, '--dir', path.join(tmp, 'site-premier-pub2')], { encoding: 'utf8', cwd: ROOT });
    assert(q.status === 0 && fs.existsSync(path.join(tmp, 'site-premier-pub2', 'carnet', a.slug, 'index.html')), 'publié explicitement : présent dans la version publique ' + (q.stderr || '').slice(0, 200));
    assert(/Nuit aux Bardenas/.test(fs.readFileSync(path.join(tmp, 'site-premier-pub2', 'voyage-en-cours', 'index.html'), 'utf8')), 'devient la dernière étape du voyage en cours');
  },
  'réimport : idempotent, mise à jour du brouillon, retouches à la main jamais écrasées sans --force, article publié protégé': () => {
    const dir = newContent('reimport'), v1 = exportFile('r1', [post()]);
    imp(v1, dir); const first = snapshot(dir);
    assert(/Déjà à jour \(1\)/.test(imp(v1, dir)), 'deuxième import identique : rien à faire'); eq(snapshot(dir), first, 'aucun fichier réécrit');
    // Le carnet change : le brouillon suit, les choix du propriétaire restent.
    const file = path.join(dir, 'articles', '2026-04-18-nuit-a-bardenas.json'), j = JSON.parse(fs.readFileSync(file, 'utf8')); j.voyage = 'espagne'; j.onMap = false; fs.writeFileSync(file, JSON.stringify(j));
    assert(/Mis à jour depuis le carnet \(1\)/.test(imp(exportFile('r2', [post({ text: 'Texte revu dans le carnet.' })]), dir)), 'mise à jour depuis le carnet');
    let a = articles(dir)[0]; eq([a.text, a.voyage, a.onMap, a.visibility, a.status, articles(dir).length], ['Texte revu dans le carnet.', 'espagne', false, 'private', 'draft', 1], 'champs du carnet remplacés, ceux du propriétaire gardés, aucun doublon');
    // Le propriétaire retouche le texte : un nouvel export ne l'écrase pas.
    a.text = 'Texte retouché à la main.'; fs.writeFileSync(file, JSON.stringify(a));
    assert(/modifiés à la main/.test(imp(exportFile('r3', [post({ text: 'Encore une version du carnet.' })]), dir)), 'retouche détectée'); eq(articles(dir)[0].text, 'Texte retouché à la main.', 'retouche conservée');
    imp(exportFile('r3', [post({ text: 'Encore une version du carnet.' })]), dir, '--force'); eq(articles(dir)[0].text, 'Encore une version du carnet.', '--force remplace le texte');
    // Publié : jamais mis à jour sans demande explicite, et reste publié quand c'est demandé.
    a = articles(dir)[0]; a.visibility = 'public'; a.status = 'published'; fs.writeFileSync(file, JSON.stringify(a));
    assert(/déjà publiés/.test(imp(exportFile('r4', [post({ text: 'Version après publication.' })]), dir)), 'article publié ignoré'); eq(articles(dir)[0].text, 'Encore une version du carnet.', 'publié intact');
    imp(exportFile('r4', [post({ text: 'Version après publication.' })]), dir, '--update-published'); a = articles(dir)[0];
    eq([a.text, a.status, a.visibility], ['Version après publication.', 'published', 'public'], '--update-published');
  },
  'refus : type annoncé faux, SVG, HTML déguisé, photo trop grosse, export inconnu — rien n\'est écrit': () => {
    const dir = newContent('refus'); imp(exportFile('base', [post({ id: 'autre' })]), dir);
    refused(exportFile('faux-type', [post({ photos: [{ src: dataUrl('png', JPG) }] })]), dir, /annoncée png, contenu jpeg/);
    refused(exportFile('svg', [post({ photos: [{ src: 'data:image/svg+xml;base64,' + Buffer.from('<svg onload="alert(1)"/>').toString('base64') }] })]), dir, /format refusé/);
    refused(exportFile('html', [post({ photos: [{ src: dataUrl('png', Buffer.from('<html><script>alert(1)</script></html>' + ' '.repeat(40))) }] })]), dir, /n’est pas une image/);
    refused(exportFile('gros', [post({ photos: [{ src: dataUrl('jpeg', Buffer.concat([JPG, Buffer.alloc(9 * 1024 * 1024)])) }] })]), dir, /format refusé/);
    refused(exportFile('trop', [post({ photos: Array.from({ length: 13 }, () => ({ src: dataUrl('png', PNG) })) })]), dir, /12 photographies/);
    const bad = path.join(tmp, 'pas-un-export.json'); fs.writeFileSync(bad, JSON.stringify({ type: 'autre', articles: [] })); refused(bad, dir, /pas un export/);
    refused(exportFile('date', [post({ date: '2026-13-45' })]), dir, /date invalide/);
  },
  'noms hostiles : « ../ », identifiant piégé, caractères de contrôle — tout reste dans content/': () => {
    const dir = newContent('hostile'), f = exportFile('hostile', [post({ id: '../../etc/passwd', slug: '../../../evil', title: 'Titre\u0007 piégé', text: 'Texte <script>alert(1)</script>\u0000', photos: [{ src: dataUrl('png', PNG), caption: '../x' }] })]), before = new Set(walk(tmp));
    imp(f, dir);
    const [a] = articles(dir), added = walk(tmp).filter((f) => !before.has(f));
    assert(added.every((f) => f.startsWith('content-hostile' + path.sep)), 'fichiers écrits hors du dossier : ' + added.join(', '));
    eq([a.slug, /^v1-[a-f0-9]{24}$/.test(a.source.id), a.title, a.text.includes('\u0000')], ['2026-04-18-article', true, 'Titre piégé', false], 'adresse, identifiant et textes nettoyés');
    const b = spawnSync(process.execPath, [path.join(ROOT, 'build.mjs'), '--mode', 'personal', '--content', dir, '--dir', path.join(tmp, 'site-hostile')], { encoding: 'utf8', cwd: ROOT });
    assert(b.status === 0 && !/<script>alert/.test(fs.readFileSync(path.join(tmp, 'site-hostile', 'carnet', a.slug, 'index.html'), 'utf8')), 'texte hostile affiché échappé');
  },
  'lieux : position personnelle arrondie (≈ 10 km), pays inconnu écarté, lieu de l\'Atlas inconnu non repris ; ancien format accepté ; --dry-run ; --voyage': () => {
    const dir = newContent('lieux');
    imp(exportFile('lieux', [post({ id: 'n1', placeId: null, place: { name: 'Bivouac au bord du lac', country: 'Espagne', lat: 42.123456, lon: -1.987654 } }), post({ id: 'n2', slug: 'b', date: '2026-04-19', placeId: 999999 }), post({ id: 'n3', slug: 'c', date: '2026-04-20', placeId: null, place: { name: 'X', country: 'Atlantide', lat: 43.21, lon: -2.34 } })]), dir);
    const [a, b, c] = articles(dir);
    eq([a.place, b.placeId, c.place], [{ name: 'Bivouac au bord du lac', country: 'Espagne', lat: 42.1, lon: -2 }, undefined, { name: 'X', lat: 43.2, lon: -2.3 }], 'lieux');
    const v1dir = newContent('v1'); imp(exportFile('v1', [{ slug: 'ancien', title: 'Ancien format', date: '2026-04-05', text: 'Texte', photos: [], placeId: null }], 1), v1dir);
    eq(articles(v1dir).map((x) => [x.slug, x.source.id.startsWith('v1-')]), [['2026-04-05-ancien', true]], 'export de la version 1 accepté');
    const drydir = newContent('dry'), before = snapshot(drydir); assert(/rien n’a été écrit/.test(imp(exportFile('dry', [post()]), drydir, '--dry-run')), 'essai annoncé'); eq(snapshot(drydir), before, '--dry-run n\'écrit rien');
    const other = newContent('voyage'); fs.writeFileSync(path.join(other, 'voyages/autre.json'), JSON.stringify({ slug: 'autre', title: 'Autre' }));
    imp(exportFile('voy', [post({ date: '2026-03-01' })]), other); eq(articles(other)[0].voyage, undefined, 'avant le départ du voyage en cours : pas de rattachement');
    const other2 = newContent('voyage2'); fs.writeFileSync(path.join(other2, 'voyages/autre.json'), JSON.stringify({ slug: 'autre', title: 'Autre' }));
    imp(exportFile('voy2', [post()]), other2, '--voyage', 'autre'); eq(articles(other2)[0].voyage, 'autre', '--voyage');
    refused(exportFile('voy3', [post()]), other2, /voyage inconnu/, '--voyage', 'nulle-part');
  }
};

for (const [title, fn] of Object.entries(TESTS)) {
  const t0 = Date.now(); let status = 'PASS', detail = '';
  try { await fn(); } catch (e) { status = 'FAIL'; detail = String(e.message).split('\n')[0].slice(0, 600); }
  results.push({ title, status, detail, ms: Date.now() - t0 });
  console.log(`${status}  ${title}${detail ? '\n        ' + detail : ''}`);
}
fs.rmSync(tmp, { recursive: true, force: true });
const pass = results.filter((r) => r.status === 'PASS').length;
writeJson(out, { generatedAt: new Date().toISOString(), totals: { tests: results.length, pass, fail: results.length - pass }, results });
console.log(`\nimport : ${pass}/${results.length} PASS → ${path.relative(ROOT, out)}`);
process.exitCode = pass === results.length ? 0 : 1;
