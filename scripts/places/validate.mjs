#!/usr/bin/env node
// Contrôles automatiques du catalogue. Échoue (code 1) dès qu'une règle bloquante n'est pas respectée.
//   node scripts/places/validate.mjs [--batch v10] [--out <rapport.json>] [--quiet]
// Bloquant : quota par pays (≥ 2 × le nombre initial), identifiants, QID, coordonnées, pays, catégories, noms,
// format attendu par DATA.lieux, fiches d'origine inchangées, provenance des nouvelles fiches, point hors du pays,
// textes interdits dans la version publique, absence de fiche personnelle dans le catalogue public.
// Signalé sans bloquer : anomalies des fiches d'origine (antérieures au lot), paires de points à moins de 250 m.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  COUNTRIES, CATEGORIES, TOURIST_CATEGORIES, SOURCES_DIR, shapeNames, ccOf, km, sameName, dupName, countryShapes, insideShape, distanceToShape, gazetteer, loadData, loadPlaces, readJSON, writeJSON, slugOf
} from './lib.mjs';
import { catalogue, PERSONAL } from '../../build/planner.mjs';

const args = process.argv.slice(2);
const opt = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
const BATCH = opt('--batch', 'v10'), OUT = opt('--out', null), QUIET = args.includes('--quiet');
const baseline = readJSON(path.join(SOURCES_DIR, `baseline-${BATCH}.json`), null);
if (!baseline) throw new Error(`référence absente : data-sources/baseline-${BATCH}.json`);

const errors = [], warnings = [], info = {};
const fail = (rule, msg) => errors.push(`[${rule}] ${msg}`);
const warn = (rule, msg) => warnings.push(`[${rule}] ${msg}`);

const DATA = loadData(), SHAPES = countryShapes(DATA.pays), G = gazetteer();
const places = loadPlaces().map(({ _file, ...L }) => ({ ...L, _file }));
const isNew = (L) => L.batch === BATCH;

/* Format attendu par l'application (src/js/*.js lit ces champs sans autre contrôle) */
const TYPES = { i: 'number', n: 'string', y: 'number', x: 'number', p: 'string', c: 'string', w: 'number', d: 'string', s: 'string', du: 'string', v: 'string', e: 'string' };
const ids = new Map(), qids = new Map();
for (const L of places) {
  const tag = `${L.i} « ${L.n} »`;
  for (const [k, t] of Object.entries(TYPES)) if (typeof L[k] !== t) fail('format', `${tag} : champ « ${k} » de type ${typeof L[k]} (attendu ${t})`);
  if (!Number.isInteger(L.i) || L.i < 0) fail('id', `${tag} : identifiant non entier`);
  if (ids.has(L.i)) fail('id', `identifiant en double : ${L.i}`); ids.set(L.i, L);
  if (L.qid) { if (!/^Q[1-9][0-9]*$/.test(L.qid)) fail('qid', `${tag} : QID mal formé « ${L.qid} »`); if (qids.has(L.qid)) fail('qid', `QID en double ${L.qid} : ${qids.get(L.qid).i} et ${L.i}`); qids.set(L.qid, L); }
  if (!String(L.n || '').trim()) fail('nom', `${L.i} : nom vide`);
  if (!COUNTRIES[L.p]) fail('pays', `${tag} : pays inconnu « ${L.p} »`);
  else if (L._file !== slugOf(L.p) + '.json') fail('pays', `${tag} : rangé dans ${L._file} au lieu de ${slugOf(L.p)}.json`);
  if (!CATEGORIES.includes(L.c)) fail('categorie', `${tag} : catégorie inconnue « ${L.c} »`);
  if (![1, 2, 3].includes(L.w)) fail('format', `${tag} : importance « ${L.w} » hors de 1, 2, 3`);
  if (!(Math.abs(L.y) <= 90 && Math.abs(L.x) <= 180)) fail('coordonnees', `${tag} : latitude/longitude hors limites`);
  else if (L.y === 0 && L.x === 0) fail('coordonnees', `${tag} : coordonnées (0, 0)`);
  else if (L.y < 34 || L.y > 72 || L.x < -25 || L.x > 45) fail('coordonnees', `${tag} : point hors d'Europe (${L.y}, ${L.x})`);
  if (L.pe != null && !(Number.isFinite(L.pe) && L.pe >= 0)) fail('format', `${tag} : « pe » invalide`);
  if (L.d.length > 500 || L.v.length > 6000 || L.n.length > 200 || L.s.length > 100 || L.du.length > 60 || L.e.length > 3000) fail('format', `${tag} : texte plus long que la limite de l'application`);
}

/* Fiches d'origine : présentes et inchangées */
const hash = (L) => { const { _file, ...o } = L; return crypto.createHash('sha256').update(JSON.stringify(o)).digest('hex').slice(0, 16); };
let changed = 0, missing = 0;
for (const [id, h] of Object.entries(baseline.hashes)) {
  const L = ids.get(Number(id));
  if (!L) { missing++; fail('non-regression', `fiche d'origine ${id} absente`); }
  else if (hash(L) !== h) { changed++; fail('non-regression', `fiche d'origine ${id} « ${L.n} » modifiée`); }
}
info.originals = { expected: Object.keys(baseline.hashes).length, missing, changed };

/* Quotas pays par pays */
const counts = {}; for (const L of places) counts[L.p] = (counts[L.p] || 0) + 1;
info.quota = Object.entries(baseline.counts).map(([p, n]) => ({ p, before: n, min: 2 * n, after: counts[p] || 0, ok: (counts[p] || 0) >= 2 * n }));
for (const q of info.quota) if (!q.ok) fail('quota', `${q.p} : ${q.after} lieux, minimum ${q.min} (2 × ${q.before})`);
info.total = { before: baseline.total, after: places.length };

/* Géographie : pays annoncé, mer, inversion, collisions */
info.geo = { outside: [], swapped: [], tooFar: [] };
for (const L of places) {
  if (!COUNTRIES[L.p]) continue;
  const shapes = SHAPES.filter((s) => shapeNames(L.p).includes(s.n));
  if (shapes.some((s) => insideShape(s, L))) continue;
  const border = Math.min(...shapes.map((s) => distanceToShape(s, L))), other = SHAPES.find((s) => !shapes.includes(s) && insideShape(s, L));
  const loc = G.nearest(L), sameCC = loc && ccOf(L.p).includes(loc.cc) && loc.km < 15;
  const swapped = shapes.some((s) => insideShape(s, { x: L.y, y: L.x }));
  const report = isNew(L) ? fail : warn, tag = `${L.i} « ${L.n} » (${L.p})`;
  if (swapped) { info.geo.swapped.push(L.i); report('geo', `${tag} : latitude et longitude probablement inversées`); }
  else if (other && border > 2) { info.geo.outside.push(L.i); report('geo', `${tag} : point dans ${other.n}, à ${border.toFixed(1)} km du pays annoncé`); }
  else if (border > 12 && !sameCC) { info.geo.outside.push(L.i); report('geo', `${tag} : point à ${border.toFixed(1)} km du pays annoncé, sans localité du pays à proximité (mer ?)`); }
}

/* Nouvelles fiches : provenance, contrôle de position, textes */
const reviewDir = path.join(SOURCES_DIR, 'review', BATCH), reviews = new Map();
if (fs.existsSync(reviewDir)) for (const f of fs.readdirSync(reviewDir)) for (const r of readJSON(path.join(reviewDir, f), [])) if (r.i != null) reviews.set(r.i, r);
const fresh = places.filter(isNew);
info.fresh = { count: fresh.length, withSource: fresh.filter((L) => L.source).length, withQid: fresh.filter((L) => L.qid).length, geoStatus: {} };
for (const L of fresh) {
  const tag = `${L.i} « ${L.n} »`, r = reviews.get(L.i);
  if (L.i in baseline.hashes) fail('id', `${tag} : identifiant d'une fiche d'origine réutilisé`);
  if (!r || r.decision !== 'retenu') { fail('provenance', `${tag} : aucune trace de revue (data-sources/review/${BATCH})`); continue; }
  if (r.n !== L.n || r.p !== L.p) fail('provenance', `${tag} : la trace de revue ne correspond pas (« ${r.n} », ${r.p})`);
  if (!L.coordinateNote) fail('provenance', `${tag} : coordinateNote absente`);
  if (L.source && !/^https:\/\/(whc\.unesco\.org|www\.geonames\.org|www\.wikidata\.org)\//.test(L.source)) fail('provenance', `${tag} : source inattendue ${L.source}`);
  info.fresh.geoStatus[r.geo.status] = (info.fresh.geoStatus[r.geo.status] || 0) + 1;
  if (r.geo.ref && r.geo.ref.y != null) {
    // Même règle que enrich.mjs (écart max(5 km, 50 %) entre distance mesurée et annoncée), +1 km pour les villes
    // recalées sur GeoNames ; contrôle de repli : localité du pays la plus proche à moins de 40 km (90 km dans le pays, zones presque vides).
    const d = km(L, r.geo.ref), stated = r.geo.ref.statedKm || 0;
    if (r.geo.ref.fallback ? d > (r.geo.inCountry ? 90 : 40) : Math.abs(d - stated) > Math.max(5, stated * 0.5) + 1) fail('geo', `${tag} : à ${d.toFixed(1)} km de sa localité de référence ${r.geo.ref.name} (annoncé ${stated} km)`);
  }
  if (!['nature', 'patrimoine', 'ville', 'plage'].includes(L.c)) fail('categorie', `${tag} : une nouvelle fiche doit être touristique (pas « ${L.c} »)`);
  if (L.d.length < 40) fail('texte', `${tag} : description trop courte`);
  if (/^(Localité|Lieu|Site) (situé|située)|Consultez les informations locales/i.test(L.d)) fail('texte', `${tag} : description générique`);
}

/* Doublons : nom proche au même endroit, points à moins de 250 m */
info.collisions = [];
const grid = new Map(), cell = (p) => Math.floor(p.x * 20) + ':' + Math.floor(p.y * 20);
for (const L of places) { const k = cell(L); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(L); }
for (const L of places) {
  const [cx, cy] = cell(L).split(':').map(Number);
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (const M of grid.get((cx + dx) + ':' + (cy + dy)) || []) {
    if (M.i <= L.i) continue;
    const d = km(L, M); if (d >= 0.25) continue;
    const pair = { a: L.i, an: L.n, b: M.i, bn: M.n, m: Math.round(d * 1000), fresh: isNew(L) || isNew(M) };
    info.collisions.push(pair);
    if (pair.fresh && sameName(L.n, M.n)) fail('doublon', `${L.i} « ${L.n} » et ${M.i} « ${M.n} » : même lieu (${pair.m} m)`);
  }
}
// Exceptions arbitrées à la revue (data-sources/candidates/<lot>/_decisions.json → keep, avec leur raison).
const kept = new Set(readJSON(path.join(SOURCES_DIR, 'candidates', BATCH, '_decisions.json'), { keep: [] }).keep || []);
for (const L of fresh) if (!kept.has((reviews.get(L.i) || {}).key)) for (const M of places) if (M !== L && TOURIST_CATEGORIES.includes(M.c) && !(isNew(M) && M.i < L.i) && dupName(L.n, M.n, km(L, M))) fail('doublon', `${L.i} « ${L.n} » et ${M.i} « ${M.n} » : même nom à ${km(L, M).toFixed(1)} km`);

/* Version publique : aucune fiche personnelle, aucun texte interdit */
const pub = catalogue('public');
if (pub.app.lieux.some(PERSONAL.isPersonal)) fail('public', 'une fiche personnelle figure dans le catalogue public');
if (!pub.removed.length) fail('public', 'aucune fiche personnelle retirée : la règle ne correspond plus au catalogue');
for (const L of pub.app.lieux) for (const re of PERSONAL.patterns) for (const k of ['n', 'd', 'v', 'q', 't', 'e']) if (typeof L[k] === 'string' && re.test(L[k])) fail('public', `${L.i} « ${L.n} » : expression interdite ${re} dans « ${k} »`);
info.public = { places: pub.app.lieux.length, removed: pub.removed.length };

/* Bilan */
info.categories = {}; for (const L of places) info.categories[L.c] = (info.categories[L.c] || 0) + 1;
const result = { batch: BATCH, ok: !errors.length, errors, warnings, info };
if (OUT) writeJSON(path.resolve(OUT), result);
if (!QUIET) {
  for (const q of info.quota) console.log(`${q.p.padEnd(14)} ${String(q.before).padStart(4)} → ${String(q.after).padStart(4)}  (min ${q.min})  ${q.ok ? 'PASS' : 'FAIL'}`);
  console.log(`total ${info.total.before} → ${info.total.after} · nouvelles fiches ${info.fresh.count} (source ${info.fresh.withSource}, QID ${info.fresh.withQid}) · public ${info.public.places}`);
  console.log(`fiches d'origine : ${info.originals.expected - info.originals.missing - info.originals.changed}/${info.originals.expected} inchangées · paires < 250 m : ${info.collisions.length}`);
  if (warnings.length) console.log(`${warnings.length} signalement(s) non bloquant(s) (fiches d'origine) — voir --out`);
  for (const e of errors.slice(0, 40)) console.log('ERREUR ' + e);
  if (errors.length > 40) console.log(`… ${errors.length - 40} autres erreurs`);
  console.log(errors.length ? `FAIL — ${errors.length} erreur(s)` : 'PASS — catalogue valide');
}
process.exit(errors.length ? 1 : 0);
