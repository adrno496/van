// Assemblage du Planner : src/ → un fichier HTML autonome (ou une variante à fichiers séparés).
// La politique de sécurité du contenu est calculée ici : seuls les scripts et la feuille de style
// dont l'empreinte SHA-256 figure dans la balise <meta> peuvent s'exécuter.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');

// L'ordre compte : jetons, base, mise en page, composants, puis écrans.
const CSS = ['tokens.css', 'base.css', 'layout.css', 'components.css', 'map.css', 'panes.css', 'journal.css'];
// L'ordre compte : outils, données, état, carte, puis écrans ; boot.js branche les événements et démarre.
const JS = ['util.js', 'data.js', 'geo.js', 'state.js', 'map.js', 'places.js', 'route.js', 'explore.js', 'journal.js', 'location.js', 'shell.js', 'boot.js'];
// Pays couverts par le catalogue : fond plus clair sur la carte.
const HI = new Set(['France', 'Spain', 'Portugal', 'Italy', 'Switzerland', 'Austria', 'Slovenia', 'Croatia', 'Bosnia and Herz.', 'Montenegro', 'Albania', 'Greece',
  'Germany', 'Czechia', 'Poland', 'Slovakia', 'Hungary', 'Serbia', 'Belgium', 'Netherlands', 'North Macedonia']);

/* Mode public : ce qui est personnel dans le catalogue, et rien d'autre.
   Les « bases » sont des logements de proches (catégorie « base ») ; elles sont retirées avec leurs textes,
   et retirées des parcours proposés. Tout le reste du catalogue est public et reste en place. */
export const PERSONAL = {
  isPersonal: (place) => place.c === 'base',
  // Expressions qui ne doivent figurer nulle part dans un fichier public, même si une fiche est modifiée plus tard.
  patterns: [/chez (ma|mon|mes|une amie|un ami)\b/i, /grands?-parents/i, /marraine/i, /port d['’]attache/i, /\/Users\//, /file:\/\//i]
};

const read = (...p) => fs.readFileSync(path.join(...p), 'utf8');
const sha = (text) => `'sha256-${crypto.createHash('sha256').update(text, 'utf8').digest('base64')}'`;
const escHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fmtCount = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');   // même écriture que dans le gabarit : « 1 600 »

// Le catalogue (src/data/places.js) et la projection (src/js/geo.js) sont évalués ici, hors de tout navigateur.
export function evaluate(file, names) {
  const context = {};
  vm.runInNewContext(`${read(SRC, ...file)}\n;${names.map((n) => `this.${n} = ${n};`).join('')}`, context);
  return context;
}

export function catalogue(mode) {
  const { DATA } = evaluate(['data', 'places.js'], ['DATA']);
  const { CHECKLIST } = evaluate(['data', 'checklist.js'], ['CHECKLIST']);
  let lieux = DATA.lieux, parcours = DATA.parcours, removed = [];
  if (mode === 'public') {
    removed = lieux.filter(PERSONAL.isPersonal);
    const gone = new Set(removed.map((p) => p.i));
    lieux = lieux.filter((p) => !gone.has(p.i));
    parcours = parcours.map((r) => ({ ...r, l: r.l.filter((id) => !gone.has(id)) })).filter((r) => r.l.length >= 2);
  }
  return { pays: DATA.pays, app: { lieux, parcours, meta: DATA.meta, checklist: CHECKLIST }, removed };
}

// Les contours des pays sont projetés ici une fois pour toutes : la page les reçoit déjà dessinés.
function countriesMarkup(pays) {
  const { P } = evaluate(['js', 'geo.js'], ['P']);
  const at = (lon, lat) => P(lon, lat).map((v) => v.toFixed(1));
  const paths = pays.map((c) => `<path class="pays${HI.has(c.n) ? ' hi' : ''}" d="${c.r.map((ring) => 'M' + ring.map((p) => at(p[0], p[1]).join(',')).join('L') + 'Z').join('')}"/>`).join('');
  const names = pays.filter((c) => c.l).map((c) => { const q = at(c.c[0], c.c[1]); return `<text class="plabel" x="${q[0]}" y="${q[1]}">${escHtml(c.l)}</text>`; }).join('');
  return `<g id="mapCountries" aria-hidden="true">${paths}</g><g id="mapCountryNames" aria-hidden="true">${names}</g>`;
}

// Le catalogue voyage en JSON : le navigateur le lit bien plus vite qu'un littéral JavaScript de cette taille.
// « < » est écrit < : aucune suite de caractères du catalogue ne peut fermer la balise qui le contient.
const jsonForHtml = (value) => JSON.stringify(value).replace(/</g, '\\u003c');

// Contrôle de confidentialité du mode public : la construction échoue plutôt que de produire un fichier douteux.
export function privacyGate(files, cat) {
  const problems = [];
  const forbidden = new Set();
  for (const place of cat.removed) for (const key of ['q', 'd', 't', 'v']) if (typeof place[key] === 'string' && place[key].length >= 8) forbidden.add(place[key]);
  for (const [name, text] of Object.entries(files)) {
    for (const s of forbidden) if (text.includes(s) || text.includes(jsonForHtml(s).slice(1, -1))) problems.push(`${name} : texte d'une fiche personnelle encore présent (« ${s.slice(0, 30)}… »)`);
    for (const re of PERSONAL.patterns) { const m = text.match(re); if (m) problems.push(`${name} : expression interdite « ${m[0]} »`); }
  }
  if (cat.app.lieux.some(PERSONAL.isPersonal)) problems.push('catalogue : une fiche personnelle est encore présente');
  const ids = new Set(cat.app.lieux.map((p) => p.i));
  for (const r of cat.app.parcours) if (r.l.some((id) => !ids.has(id))) problems.push(`parcours « ${r.n} » : étape absente du catalogue public`);
  if (!cat.removed.length) problems.push('aucune fiche personnelle trouvée : la règle de sélection ne correspond plus au catalogue');
  if (problems.length) throw new Error('Contrôle de confidentialité : construction publique refusée\n  - ' + [...new Set(problems)].join('\n  - '));
}

function sources({ tokens = null, mode = 'personal' } = {}) {
  if (mode !== 'personal' && mode !== 'public') throw new Error(`mode inconnu : ${mode} (personal ou public)`);
  const css = CSS.map((f) => (f === 'tokens.css' && tokens ? fs.readFileSync(tokens, 'utf8') : read(SRC, 'css', f)).trim()).join('\n');
  const cat = catalogue(mode);
  const js = `'use strict';\n` + JS.map((f) => `/* ── ${f} ── */\n${read(SRC, 'js', f).trim()}`).join('\n\n');
  // Une balise fermante dans un bloc en ligne terminerait ce bloc : le fichier assemblé serait cassé.
  if (/<\/style/i.test(css)) throw new Error('CSS : la séquence </style est interdite');
  if (/<\/script/i.test(js)) throw new Error('JavaScript : la séquence </script est interdite');
  // Le nombre de lieux annoncé dans la page suit le catalogue réellement livré.
  const html = read(SRC, 'index.template.html').replaceAll('1 600 lieux', `${fmtCount(cat.app.lieux.length)} lieux`);
  return { css, js, cat, html, countries: countriesMarkup(cat.pays) };
}
// La marque du Planner : simple titre dans le fichier autonome, lien vers l'accueil quand le Planner vit dans le site.
const brand = (siteHome) => (siteHome ? `<a href="${escHtml(siteHome)}" title="Retour à l’accueil d’Atlas Van">Atlas <em>van</em></a>` : 'Atlas <em>van</em>');
const putter = (state) => (mark, value) => { if (!state.html.includes(mark)) throw new Error(`repère absent du gabarit : ${mark}`); state.html = state.html.replace(mark, () => value); };
const policy = (script, style) => [`default-src 'none'`, `script-src ${script}`, `style-src ${style}`, `img-src data: blob:`, `connect-src 'none'`, `font-src 'none'`, `object-src 'none'`, `base-uri 'none'`, `form-action 'none'`].join('; ');

export function build(options = {}) {
  const s = sources(options), put = putter(s);
  const data = jsonForHtml(s.cat.app);
  put('/*@CSS@*/', s.css); put('<!--@COUNTRIES@-->', s.countries); put('<!--@BRAND@-->', brand(options.siteHome));
  put('<!--@DATA@-->', `<script type="application/json" id="atlasData">${data}</script>`);
  put('/*@JS@*/', s.js);
  // Les empreintes portent sur le contenu exact des blocs tels qu'ils figurent dans le fichier (retours à la ligne compris).
  // La feuille de style est cherchée dans l'en-tête seulement : le JavaScript contient, en texte, celle du blog exporté.
  // Le bloc de données (type application/json) n'est pas exécuté : il n'a pas besoin d'empreinte.
  const blocks = (source, tag) => [...source.matchAll(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'g'))].map((m) => sha(m[1]));
  const head = s.html.slice(0, s.html.indexOf('<body'));
  put('@CSP@', policy(blocks(s.html, 'script').join(' '), blocks(head, 'style').join(' ')));
  if (options.mode === 'public') privacyGate({ 'index.html': s.html }, s.cat);
  return { html: s.html, places: s.cat.app.lieux.length, removed: s.cat.removed.length,
    bytes: { css: Buffer.byteLength(s.css), data: Buffer.byteLength(data), js: Buffer.byteLength(s.js), html: Buffer.byteLength(s.html) } };
}

// Variante à fichiers séparés, pour un hébergement sur un serveur web (fichiers mis en cache séparément,
// politique de sécurité limitée à 'self'). Elle ne s'ouvre pas en double-cliquant : pour cela, utiliser index.html.
export function buildSplit(outDir, options = {}) {
  const s = sources(options), put = putter(s);
  const data = `var ATLAS_DATA = ${JSON.stringify(s.cat.app)};`;
  put('<style>\n/*@CSS@*/\n</style>', '<link rel="stylesheet" href="assets/app.css">');
  put('<!--@COUNTRIES@-->', s.countries); put('<!--@BRAND@-->', brand(options.siteHome));
  put('<!--@DATA@-->', '<script src="assets/places.js"></script>');
  put('<script>\n/*@JS@*/\n</script>', '<script src="assets/app.js"></script>');
  put('@CSP@', policy(`'self'`, `'self'`));
  if (options.mode === 'public') privacyGate({ 'index.html': s.html, 'assets/places.js': data, 'assets/app.js': s.js }, s.cat);
  fs.mkdirSync(path.join(outDir, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(outDir, 'index.html'), s.html);
  fs.writeFileSync(path.join(outDir, 'assets', 'app.css'), s.css + '\n');
  fs.writeFileSync(path.join(outDir, 'assets', 'places.js'), data + '\n');
  fs.writeFileSync(path.join(outDir, 'assets', 'app.js'), s.js + '\n');
  return { html: Buffer.byteLength(s.html), css: Buffer.byteLength(s.css), data: Buffer.byteLength(data), js: Buffer.byteLength(s.js), places: s.cat.app.lieux.length };
}
