// Outils communs du pipeline du catalogue (scripts/places/*.mjs). Aucune dépendance, aucun appel réseau.
// Lecture du catalogue modulaire, normalisation des noms, distances, appartenance à un pays, gazetier de référence.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const LIEUX_DIR = path.join(ROOT, 'src', 'data', 'lieux');
export const SOURCES_DIR = path.join(ROOT, 'data-sources');
export const REF_DIR = path.join(SOURCES_DIR, 'reference');

// Pays du catalogue : nom affiché (champ « p ») → code ISO 3166-1, nom du contour dans DATA.pays.
export const COUNTRIES = {
  'France': ['FR', 'France'], 'Espagne': ['ES', 'Spain'], 'Portugal': ['PT', 'Portugal'], 'Italie': ['IT', 'Italy'],
  'Suisse': ['CH', 'Switzerland'], 'Autriche': ['AT', 'Austria'], 'Allemagne': ['DE', 'Germany'], 'Belgique': ['BE', 'Belgium'],
  'Pays-Bas': ['NL', 'Netherlands'], 'Slovénie': ['SI', 'Slovenia'], 'Croatie': ['HR', 'Croatia'], 'Bosnie': ['BA', 'Bosnia and Herz.'],
  'Monténégro': ['ME', 'Montenegro'], 'Albanie': ['AL', 'Albania'], 'Mac. du Nord': ['MK', 'North Macedonia'], 'Serbie': ['RS', 'Serbia'],
  'Grèce': ['GR', 'Greece'], 'Hongrie': ['HU', 'Hungary'], 'Slovaquie': ['SK', 'Slovakia'], 'Tchéquie': ['CZ', 'Czechia'],
  'Pologne': ['PL', 'Poland'], 'Roumanie': ['RO', 'Romania'], 'Bulgarie': ['BG', 'Bulgaria'], 'Danemark': ['DK', 'Denmark'],
  'Suède': ['SE', 'Sweden'], 'Norvège': ['NO', 'Norway'], 'Royaume-Uni': ['GB', 'United Kingdom'], 'Irlande': ['IE', 'Ireland'],
  'Luxembourg': ['LU', 'Luxembourg'], 'Lituanie': ['LT', 'Lithuania'], 'Lettonie': ['LV', 'Latvia'], 'Estonie': ['EE', 'Estonia'],
  'Andorre': ['AD', 'Andorra'], 'Finlande': ['FI', 'Finland']
};
// Territoires rattachés à un pays du catalogue mais dessinés à part sur la carte (contour) ou codés à part dans GeoNames.
export const ATTACHED = { 'Finlande': { shapes: ['Åland'], cc: ['AX'] } };
export const shapeNames = (p) => [COUNTRIES[p][1], ...((ATTACHED[p] || {}).shapes || [])];
export const ccOf = (p) => [COUNTRIES[p][0], ...((ATTACHED[p] || {}).cc || [])];
export const CATEGORIES = ['ville', 'nature', 'patrimoine', 'plage', 'pratique', 'boulot', 'base'];
export const TOURIST_CATEGORIES = ['ville', 'nature', 'patrimoine', 'plage'];

export const noac = (s) => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export const slugOf = (s) => noac(s).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
// Même règle que src/js/geo.js (slugOf) : le fichier d'un pays s'appelle comme son adresse sur le site.
export const countryFile = (p) => path.join(LIEUX_DIR, slugOf(p) + '.json');

// Distance à vol d'oiseau (km).
export function km(a, b) {
  const d2r = Math.PI / 180, dA = (b.y - a.y) * d2r, dO = (b.x - a.x) * d2r;
  const s = Math.sin(dA / 2) ** 2 + Math.cos(a.y * d2r) * Math.cos(b.y * d2r) * Math.sin(dO / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(s));
}

/* ── Catalogue ── */
export function readCountryFile(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
// Une fiche par ligne : les différences Git restent lisibles, fiche par fiche.
export function writeCountryFile(file, list) {
  fs.writeFileSync(file, '[\n' + list.slice().sort((a, b) => a.i - b.i).map((l) => JSON.stringify(l)).join(',\n') + '\n]\n');
}
export function loadPlaces(dir = LIEUX_DIR) {
  const all = [];
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) for (const L of readCountryFile(path.join(dir, f))) all.push({ ...L, _file: f });
  return all.sort((a, b) => a.i - b.i);
}
export function loadData() {
  const ctx = {};
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'src', 'data', 'places.js'), 'utf8') + '\n;this.DATA = DATA;', ctx);
  return ctx.DATA;
}

/* ── Noms : comparaison tolérante aux langues, accents, articles et mots génériques ── */
const GENERIC = new Set(('chateau castle castello castillo castelo castell burg schloss slot zamek hrad grad kalesi kasteel kastel kasztel festung fortezza fortaleza forteresse fort fortress citadelle citadel cittadella citadela tvrdjava tvrđava kale ' +
  'abbaye abbey abbazia abadia abtei opactwo klasztor kloster monastere monastery monastero monasterio mosteiro manastir manastiri ' +
  'eglise church chiesa iglesia igreja kirche kirke kyrka kostel kosciol cathedrale cathedral cattedrale duomo catedral se dom basilique basilica basilika chapelle chapel sanctuaire santuario ' +
  'lac lake lago laguna see sjo jarvi jezero jezioro ezero liqeni loch lough meer ' +
  'parc park parco parque nationalpark national nationale nazionale nacional naturel natural naturale regional regionale reserve riserva reserva ' +
  'gorges gorge gola gole canyon cascade cascata cascada waterfall wasserfall foss fossen vodopad slap ' +
  'grotte grotta cueva gruta cave caves hohle jaskinia jaskyna jeskyne pestera pecina ' +
  'mont monte mount mountain montagne berg massif col pass passo puerto paso pas ' +
  'ile isola isla ilha island insel otok ostrov nisos ' +
  'plage spiaggia playa praia beach strand plaza ' +
  'vallee valley valle val tal dolina ' +
  'cap capo cabo cape kap ' +
  'pont ponte puente bridge brucke most ' +
  'musee museum museo muzeum ' +
  'palais palace palazzo palacio palast ' +
  'vieille ville old town centre historique centro storico casco antiguo altstadt stare miasto stari grad ' +
  'site archeologique archaeological archeologico area zona ruines ruins rovine ruinas ' +
  'route road strada carretera strasse panoramique panoramic panoramica ' +
  'tour tower torre turm ' +
  'saint sainte san santa santo sankt st ste sv svети').split(/\s+/));
const STOP = new Set('de du des la le les l d di del della dello dei degli delle da do dos das of the von vom der den die das y e et and und i a al au aux en in im am an on sur sul sulla'.split(' '));
export function nameTokens(name) {
  return noac(name).replace(/['’`]/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter((t) => t && !STOP.has(t));
}
// Noyau d'un nom : sans mots génériques (« Château de Peyrepertuse » → « peyrepertuse »).
export function nameCore(name) {
  const generic = (x) => GENERIC.has(x) || (/[sx]$/.test(x) && GENERIC.has(x.slice(0, -1)));   // pluriels : lacs, châteaux
  const t = nameTokens(name), core = t.filter((x) => !generic(x));
  return (core.length ? core : t).join(' ');
}
// Doublon probable de nom, selon la distance : noyau identique à moins de 30 km ; nom contenu dans l'autre
// (« Albufera de Valence » / « Valence ») seulement à moins de 5 km — au-delà, ce sont deux lieux distincts.
export function dupName(a, b, d) {
  const A = nameCore(a), B = nameCore(b);
  if (!A || !B) return false;
  if (A === B) return d < 30;
  return d < 5 && sameName(a, b);
}
// Même chose pour deux lieux décrits par leur nom principal et leurs autres noms : les autres noms (« Passo Lanciano »
// pour le Blockhaus) ne comptent que tout près (< 5 km), pour ne pas confondre un col et la ville qui lui donne son nom.
export function dupNames(a, altA, b, altB, d) {
  if (dupName(a, b, d)) return true;
  if (d >= 5) return false;
  return [a, ...altA].some((x) => [b, ...altB].some((y) => dupName(x, y, d)));
}
export function sameName(a, b) {
  const A = nameCore(a), B = nameCore(b);
  if (!A || !B) return false;
  if (A === B) return true;
  const short = A.length < B.length ? A : B, long = A.length < B.length ? B : A;
  return short.length >= 5 && (' ' + long + ' ').includes(' ' + short + ' ');
}

/* ── Contours des pays (DATA.pays) : appartenance d'un point, distance à la frontière ── */
function inRing(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function segKm(p, a, b) {
  const c = Math.cos((p.y * Math.PI) / 180), ax = (a[0] - p.x) * c, ay = a[1] - p.y, bx = (b[0] - p.x) * c, by = b[1] - p.y;
  const dx = bx - ax, dy = by - ay, len = dx * dx + dy * dy, t = len ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len)) : 0;
  return Math.hypot(ax + t * dx, ay + t * dy) * 111.195;
}
export function countryShapes(pays) {
  return pays.map((c) => {
    let x0 = 180, x1 = -180, y0 = 90, y1 = -90;
    for (const r of c.r) for (const [x, y] of r) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    return { n: c.n, r: c.r, box: [x0, y0, x1, y1] };
  });
}
export function insideShape(shape, p) {
  const [x0, y0, x1, y1] = shape.box;
  if (p.x < x0 || p.x > x1 || p.y < y0 || p.y > y1) return false;
  return shape.r.some((ring) => inRing(p.x, p.y, ring));
}
export function distanceToShape(shape, p) {
  const [x0, y0, x1, y1] = shape.box, m = 1;
  if (p.x < x0 - m * 3 || p.x > x1 + m * 3 || p.y < y0 - m * 2 || p.y > y1 + m * 2) return Infinity;
  let best = Infinity;
  for (const ring of shape.r) for (let i = 1; i < ring.length; i++) best = Math.min(best, segKm(p, ring[i - 1], ring[i]));
  return best;
}

/* ── Gazetier de référence (GeoNames, localités de plus de 1 000 habitants) ── */
let GAZ = null;
export function gazetteer() {
  if (GAZ) return GAZ;
  const file = path.join(REF_DIR, 'geonames-europe.json.gz');
  if (!fs.existsSync(file)) throw new Error('gazetier absent : lancer « node scripts/places/fetch-reference.mjs »');
  const raw = JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString('utf8'));
  const rows = raw.rows.map(([id, n, cc, a1, pop, y, x]) => ({ id, n, cc, a1, pop, y, x, k: noac(n).replace(/[^a-z0-9]+/g, ' ').trim() }));
  const byKey = new Map();
  for (const r of rows) { const k = r.cc + '|' + r.k; if (!byKey.has(k)) byKey.set(k, []); byKey.get(k).push(r); }
  // Grille de 0,5° pour trouver vite la localité la plus proche.
  const grid = new Map(), cell = (x, y) => Math.floor(x * 2) + ':' + Math.floor(y * 2);
  for (const r of rows) { const c = cell(r.x, r.y); if (!grid.has(c)) grid.set(c, []); grid.get(c).push(r); }
  GAZ = {
    rows, admin1: raw.admin1, license: raw.license,
    find(cc, name) { return byKey.get(cc + '|' + noac(name).replace(/[^a-z0-9]+/g, ' ').trim()) || []; },
    nearest(p, { cc = null, minPop = 0 } = {}) {
      let best = null, bd = Infinity;
      for (let ring = 0; ring <= 4 && !(best && bd < ring * 40); ring++) {
        const gx = Math.floor(p.x * 2), gy = Math.floor(p.y * 2);
        for (let dx = -ring; dx <= ring; dx++) for (let dy = -ring; dy <= ring; dy++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
          for (const r of grid.get((gx + dx) + ':' + (gy + dy)) || []) {
            if ((cc && r.cc !== cc) || r.pop < minPop) continue;
            const d = km(p, r); if (d < bd) { bd = d; best = r; }
          }
        }
      }
      return best ? { ...best, km: bd } : null;
    },
    region(r) { return (r && raw.admin1[r.cc + '.' + r.a1]) || (r ? r.cc + '.' + r.a1 : '?'); }
  };
  return GAZ;
}

export function readJSON(file, fallback) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; } }
export function writeJSON(file, value) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(value, null, 1) + '\n'); }
