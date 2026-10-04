#!/usr/bin/env node
// Enrichissement reproductible du catalogue : candidats → contrôles → sélection → fiches.
//   node scripts/places/enrich.mjs [--batch v10] [--only <pays,...>] [--dry]
//
// Entrées (versionnées, relançables à l'identique, sans réseau) :
//   data-sources/candidates/<batch>/*.json      candidats proposés (un tableau JSON par fichier)
//   data-sources/candidates/<batch>/_decisions.json   arbitrages manuels : { keep: [clé…], drop: { clé: raison } }
//   data-sources/targets-<batch>.json           cible de lieux par pays (au moins 2 × le nombre initial)
//   data-sources/reference/*                    GeoNames, UNESCO, Natural Earth (scripts/places/fetch-reference.mjs)
//   data-sources/ledger-<batch>.json            identifiants déjà attribués : un candidat garde toujours le même « i »
// Sorties :
//   data-sources/review/<batch>/<pays>.json     chaque candidat, ses contrôles, son score, la décision et sa raison
//   src/data/lieux/<pays>.json                  fiches retenues ajoutées (les fiches existantes ne sont jamais touchées)
//
// Une relance retire d'abord les fiches du lot (batch) puis les remet : le résultat ne dépend que des entrées.
import fs from 'node:fs';
import path from 'node:path';
import {
  COUNTRIES, TOURIST_CATEGORIES, SOURCES_DIR, REF_DIR, LIEUX_DIR, noac, slugOf, km, nameCore, sameName, dupName, dupNames,
  countryShapes, insideShape, distanceToShape, gazetteer, loadData, readCountryFile, writeCountryFile, readJSON, writeJSON
} from './lib.mjs';

const args = process.argv.slice(2);
const opt = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
const BATCH = opt('--batch', 'v10'), DRY = args.includes('--dry');
const ONLY = opt('--only', '') ? new Set(opt('--only').split(',')) : null;
const CAND_DIR = path.join(SOURCES_DIR, 'candidates', BATCH), REVIEW_DIR = path.join(SOURCES_DIR, 'review', BATCH);
const LEDGER = path.join(SOURCES_DIR, `ledger-${BATCH}.json`);
const TARGETS = readJSON(path.join(SOURCES_DIR, `targets-${BATCH}.json`), null);
if (!TARGETS) throw new Error(`cibles absentes : data-sources/targets-${BATCH}.json`);

export const COORD_NOTE = 'Coordonnées de repérage, pas une entrée ni un parking.';
export const PRACTICAL = 'Horaires, accès et tarifs à vérifier avant la visite.';
// Informations volatiles qu'un candidat ne doit pas affirmer (prix, horaires, stationnement, bivouac…).
export const VOLATILE = /\d\s?€|\beuros?\b|\bhoraires?\b|(?<!ciel )\bouvert(e|s)? (de|du|tous|toute|en)\b|\bferm[ée]e?s? (le|les) (lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)|\bferm[ée]e?s? (en |l['’])hiver|\bparking\b|\bstationnement\b|\bbivouac\b|camping-car|\bgratuit|\bpayant|\b\d{1,2} ?h ?\d{2}\b|\bréservation obligatoire\b/i;
// Expressions refusées par le contrôle de confidentialité du mode public (build/planner.mjs, PERSONAL.patterns).
export const PRIVATE = [/chez (ma|mon|mes|une amie|un ami)\b/i, /grands?-parents/i, /marraine/i, /port d['’]attache/i, /\/Users\//, /file:\/\//i];
const DURATIONS = new Set(['passage', '1 h', '2 h', '3 h', '½ j', '1 j', '1-2 j', '2 j', '2-3 j']);
const SEASON_OK = /^(toute l'année|Saison et accès à vérifier)$|(jan|fév|fev|mars|avr|mai|juin|juil|août|aout|sept|oct|nov|déc|dec)/i;

const DATA = loadData(), SHAPES = countryShapes(DATA.pays), G = gazetteer();
const UNESCO = readJSON(path.join(REF_DIR, 'unesco-europe.json'), { sites: [] }).sites;
const NE = readJSON(path.join(REF_DIR, 'naturalearth-places-europe.json'), { places: [] }).places;
const shapeOf = (p) => SHAPES.find((s) => s.n === COUNTRIES[p][1]);
const cellOf = (p) => Math.floor(p.x * 2) + ':' + Math.floor(p.y * 2);   // ~ 40 × 55 km
export const keyOf = (c) => slugOf(c.p) + '|' + slugOf(nameCore(c.n)) + '|' + Math.round(c.y * 10) + ':' + Math.round(c.x * 10);

/* ── 1. Lecture : catalogue actuel (sans le lot en cours), candidats, arbitrages ── */
const files = fs.readdirSync(LIEUX_DIR).filter((f) => f.endsWith('.json')).sort();
const base = new Map();   // fichier → fiches hors lot
for (const f of files) base.set(f, readCountryFile(path.join(LIEUX_DIR, f)).filter((L) => L.batch !== BATCH));
const existing = [...base.values()].flat();
const maxBaseId = Math.max(...existing.map((L) => L.i));
const decisions = readJSON(path.join(CAND_DIR, '_decisions.json'), { keep: [], drop: {} });
const keep = new Set(decisions.keep || []), drop = decisions.drop || {};
const ledger = readJSON(LEDGER, {});

const raw = [];
for (const f of fs.readdirSync(CAND_DIR).filter((f) => f.endsWith('.json') && !f.startsWith('_')).sort()) {
  const list = JSON.parse(fs.readFileSync(path.join(CAND_DIR, f), 'utf8'));
  list.forEach((c, k) => raw.push({ ...c, _src: `${f}#${k}` }));
}

/* ── 2. Contrôles de chaque candidat ── */
const str = (v) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '');
function check(c) {
  const out = { key: null, issues: [], flags: [], geo: {}, links: {} };
  c.n = str(c.n); c.p = str(c.p); c.c = str(c.c); c.d = str(c.d); c.v = str(c.v); c.q = str(c.q); c.near = str(c.near); c.s = str(c.s); c.du = str(c.du);
  c.alt = Array.isArray(c.alt) ? c.alt.map(str).filter(Boolean) : [];
  c.y = Number(c.y); c.x = Number(c.x);
  if (!c.n) out.issues.push('nom absent');
  if (!COUNTRIES[c.p]) out.issues.push(`pays inconnu « ${c.p} »`);
  if (!TOURIST_CATEGORIES.includes(c.c)) out.issues.push(`catégorie refusée « ${c.c} »`);
  if (!Number.isFinite(c.y) || !Number.isFinite(c.x) || Math.abs(c.y) > 90 || Math.abs(c.x) > 180) out.issues.push('coordonnées invalides');
  if (c.y === 0 && c.x === 0) out.issues.push('coordonnées (0, 0)');
  if (!c.d || c.d.length < 40) out.issues.push('description absente ou trop courte');
  if (c.d.length > 500) out.issues.push('description trop longue');
  for (const re of PRIVATE) if (re.test(c.n + ' ' + c.d + ' ' + c.v + ' ' + c.q)) out.issues.push(`expression refusée par le contrôle public : ${re}`);
  if (VOLATILE.test(c.d + ' ' + c.v)) out.flags.push('information volatile dans le texte');
  if (/^(Localité|Lieu|Site) (situé|située)/i.test(c.d)) out.issues.push('description générique');
  if (out.issues.length) return out;
  out.key = keyOf(c);
  const cc = COUNTRIES[c.p][0], shape = shapeOf(c.p);

  // Appartenance au pays (contours simplifiés de la carte : tolérance côtière et frontalière)
  const inside = insideShape(shape, c), border = inside ? 0 : distanceToShape(shape, c);
  const other = SHAPES.find((s) => s !== shape && insideShape(s, c));
  out.geo.inCountry = inside; out.geo.borderKm = +border.toFixed(1); out.geo.otherCountry = other ? other.n : null;
  const swapped = { x: c.y, y: c.x };
  if (!inside && insideShape(shape, swapped)) out.issues.push('latitude et longitude inversées');
  const nearestAny = G.nearest(c);
  out.geo.nearestLocality = nearestAny ? `${nearestAny.n} (${nearestAny.cc}, ${nearestAny.km.toFixed(1)} km)` : null;
  if (!inside) {
    if (other && border > 2) out.issues.push(`point dans un autre pays (${other.n}), à ${border.toFixed(1)} km de ${c.p}`);
    else if (border > 12 && !(nearestAny && nearestAny.cc === cc && nearestAny.km < 15)) out.issues.push(`point hors du pays (${border.toFixed(1)} km), probablement en mer`);
    else if (border > 3) out.flags.push(`hors des contours simplifiés (${border.toFixed(1)} km) : côte ou île`);
  }

  // Localité de référence déclarée : distance cohérente avec celle annoncée
  const homonyms = [c.near, ...c.near.split(/[\/,(]/)].map((n) => G.find(cc, n)).flat();
  const neMatch = NE.filter((p) => p.cc === cc && [p.n, p.fr].some((n) => n && noac(n) === noac(c.near)));
  const refs = [...homonyms, ...neMatch.map((p) => ({ n: p.n, y: p.y, x: p.x, id: null }))];
  if (refs.length) {
    const ref = refs.map((r) => ({ r, d: km(c, r) })).sort((a, b) => a.d - b.d)[0];
    // La distance mesurée doit concorder avec la distance annoncée : écart toléré max(5 km, 50 % de l'annoncé).
    // (Sur le lot v10, l'écart médian est de 0,3 km et 99 % des candidats sont sous 2,6 km : un écart plus grand
    // trahit une coordonnée fausse, par exemple une décimale décalée.)
    const stated = Number(c.nearKm) || 0, gap = Math.abs(ref.d - stated), allowed = Math.max(5, stated * 0.5);
    out.geo.ref = { name: ref.r.n, geonameid: ref.r.id || null, y: ref.r.y, x: ref.r.x, km: +ref.d.toFixed(1), statedKm: stated };
    if (gap > allowed) out.issues.push(`à ${ref.d.toFixed(1)} km de ${c.near} (annoncé ${stated} km) : coordonnées incohérentes`);
    out.geo.status = gap <= allowed ? 'vérifié' : 'écart';
  } else {
    const loc = G.nearest(c, { cc });
    out.geo.ref = loc ? { name: loc.n, geonameid: loc.id, y: loc.y, x: loc.x, km: +loc.km.toFixed(1), statedKm: null, fallback: true } : null;
    if (!loc || loc.km > 40) out.issues.push(`localité « ${c.near} » introuvable et aucune localité du pays à moins de 40 km`);
    out.geo.status = 'partiel';
    out.flags.push(`localité « ${c.near} » absente du gazetier : contrôle par la localité la plus proche`);
  }

  // Une ville ou un village présent dans GeoNames prend les coordonnées et la référence GeoNames.
  if (c.c === 'ville' || /village|ville|bourg|cité|town|port/i.test(c.q)) {
    const names = [c.n, ...c.alt];
    const town = names.map((n) => G.find(cc, n)).flat().map((r) => ({ r, d: km(c, r) })).filter((o) => o.d < 6).sort((a, b) => a.d - b.d)[0];
    if (town) {
      out.links.geonames = town.r.id; out.geo.snapped = +town.d.toFixed(2);
      c.y = town.r.y; c.x = town.r.x;
      const ne = NE.find((p) => p.cc === cc && p.qid && km(p, town.r) < 5 && [p.n, p.fr].some((n) => names.some((m) => noac(m) === noac(n))));
      if (ne) out.links.qid = ne.qid;
    }
  }
  // Site UNESCO : rattachement à la liste quand le point UNESCO est tout proche.
  if (c.unesco) {
    const site = UNESCO.map((u) => ({ u, d: km(c, u) })).filter((o) => o.d < 4).sort((a, b) => a.d - b.d)[0];
    if (site) out.links.unesco = site.u.url;
    else out.flags.push('UNESCO annoncé, point de la liste UNESCO éloigné (bien en série ou à vérifier)');
  }
  return out;
}

/* ── 3. Score sur 100 ── */
const cap = (v, m) => Math.max(0, Math.min(m, Number(v) || 0));
function baseScore(c, chk) {
  const sc = c.sc || {};
  const reliability = ({ haute: 10, moyenne: 6, basse: 2 }[c.conf] ?? 4) - (chk.geo.status === 'partiel' ? 3 : chk.geo.status === 'écart' ? 5 : 0) - (chk.flags.length ? 1 : 0);
  const sourceQ = chk.links.unesco || chk.links.geonames ? 5 : chk.geo.status === 'vérifié' ? 3 : 1;
  return { tour: cap(sc.tour, 25), van: cap(sc.van, 15), sing: cap(sc.sing, 15), val: cap(sc.val, 15), acc: cap(sc.acc, 5), rel: Math.max(0, reliability), src: sourceQ };
}
const geoBonus = (n) => (n === 0 ? 10 : n === 1 ? 8 : n === 2 ? 6 : n <= 4 ? 4 : n <= 8 ? 2 : 0);

/* ── 4. Doublons, puis sélection pays par pays ── */
const reviews = {};
const all = raw.map((c) => ({ c, chk: check(c) }));
for (const o of all) {
  o.review = { key: o.chk.key, src: o.c._src, n: o.c.n, p: o.c.p, c: o.c.c, issues: o.chk.issues.slice(), flags: o.chk.flags, geo: o.chk.geo, links: o.chk.links };
  (reviews[o.c.p] = reviews[o.c.p] || []).push(o);
}
const placesOut = new Map();
for (const [p, list] of Object.entries(reviews)) {
  if (!COUNTRIES[p] || (ONLY && !ONLY.has(p))) continue;
  const mine = existing.filter((L) => L.p === p);
  const need = Math.max(0, (TARGETS[p] || 0) - mine.length);
  for (const o of list) {
    if (o.chk.issues.length) continue;
    const c = o.c, names = [c.n, ...c.alt];
    // Doublon avec une fiche existante : même QID, même nom (toutes langues) près du même endroit, ou quasi même point.
    // Les fiches pratiques (travail saisonnier, logistique, bases) ne sont pas des lieux de visite : une ville
    // qui n'existe au catalogue que comme « Olives — Jaén » peut entrer comme ville.
    for (const L of existing) {
      const d = km(c, L);
      if (o.chk.links.qid && L.qid === o.chk.links.qid) { o.review.issues.push(`doublon : même QID que la fiche ${L.i} « ${L.n} »`); break; }
      if (!TOURIST_CATEGORIES.includes(L.c)) continue;
      if (dupNames(c.n, c.alt, L.n, [], d) && !keep.has(o.chk.key)) { o.review.issues.push(`doublon : fiche ${L.i} « ${L.n} » (${d.toFixed(1)} km)`); break; }
      if (d < 0.25) { o.review.collision = { id: L.i, n: L.n, km: +d.toFixed(3) }; }
    }
    if (o.review.collision && !keep.has(o.chk.key) && !o.review.issues.length) o.review.issues.push(`à contrôler : à ${(o.review.collision.km * 1000).toFixed(0)} m de la fiche ${o.review.collision.id} « ${o.review.collision.n} »`);
    if (drop[o.chk.key]) o.review.issues.push(`écarté à la revue : ${drop[o.chk.key]}`);
    if (o.review.flags.includes('information volatile dans le texte') && !keep.has(o.chk.key)) o.review.issues.push('texte à revoir : information volatile');
    o.s = baseScore(c, o.chk);
    o.review.score = o.s;
  }
  // Doublons entre candidats : le mieux noté reste.
  const ok = list.filter((o) => !o.review.issues.length).sort((a, b) => tot(b.s) - tot(a.s) || a.c.n.localeCompare(b.c.n));
  const kept = [];
  for (const o of ok) {
    const twin = kept.find((k) => { const d = km(k.c, o.c); return d < 0.25 || dupNames(o.c.n, o.c.alt, k.c.n, k.c.alt, d); });
    if (twin) o.review.issues.push(`doublon d'un autre candidat : « ${twin.c.n} »`); else kept.push(o);
  }
  // Sélection gloutonne : score de base + bonus de couverture (cellule peu dotée) − pénalité si une catégorie domine.
  const cells = new Map(); for (const L of mine) cells.set(cellOf(L), (cells.get(cellOf(L)) || 0) + 1);
  const catN = {}; let picked = [];
  const pool = kept.slice();
  while (picked.length < need && pool.length) {
    let best = -1, bestV = -Infinity;
    pool.forEach((o, k) => {
      const share = (catN[o.c.c] || 0) / Math.max(1, picked.length);
      const v = tot(o.s) + geoBonus(cells.get(cellOf(o.c)) || 0) - (picked.length > 10 && share > 0.5 ? 6 : 0);
      if (v > bestV) { bestV = v; best = k; }
    });
    const o = pool.splice(best, 1)[0];
    o.s.geo = geoBonus(cells.get(cellOf(o.c)) || 0); o.review.total = tot(o.s);
    cells.set(cellOf(o.c), (cells.get(cellOf(o.c)) || 0) + 1); catN[o.c.c] = (catN[o.c.c] || 0) + 1;
    picked.push(o);
  }
  for (const o of pool) { o.review.decision = 'réserve'; o.review.reason = 'cible du pays atteinte par de meilleurs candidats'; o.review.total = tot(o.s) + geoBonus(cells.get(cellOf(o.c)) || 0); }
  for (const o of list) if (o.review.issues.length) { o.review.decision = 'rejeté'; o.review.reason = o.review.issues.join(' ; '); }
  for (const o of picked) o.review.decision = 'retenu';
  // « Incontournable » (w = 1) reste rare : au plus ~6 % des nouvelles fiches du pays, les mieux notées, et ≥ 75/100.
  const maxTop = Math.max(1, Math.round(picked.length * 0.06));
  picked.filter((o) => o.c.w === 1 && o.review.total >= 75).sort((a, b) => b.review.total - a.review.total).forEach((o, k) => { o.top = k < maxTop; });
  placesOut.set(p, { need, picked, list });
}
function tot(s) { return s.tour + s.van + s.sing + s.val + s.acc + s.rel + s.src + (s.geo || 0); }

/* ── 5. Identifiants stables, fiches, écriture ── */
let next = Math.max(maxBaseId, ...Object.values(ledger)) + 1;
const order = Object.keys(COUNTRIES);
const report = [];
for (const p of order) {
  const r = placesOut.get(p); if (!r) continue;
  const file = path.join(LIEUX_DIR, slugOf(p) + '.json');
  const fresh = r.picked.sort((a, b) => (ledger[a.chk.key] ?? 1e9) - (ledger[b.chk.key] ?? 1e9) || b.review.total - a.review.total).map((o) => {
    if (ledger[o.chk.key] == null) ledger[o.chk.key] = next++;
    o.review.i = ledger[o.chk.key];
    return toPlace(o);
  });
  const before = (base.get(slugOf(p) + '.json') || []).length;
  report.push({ p, before: existing.filter((L) => L.p === p).length, added: fresh.length, after: before + fresh.length, target: TARGETS[p], candidates: r.list.length,
    rejected: r.list.filter((o) => o.review.decision === 'rejeté').length, reserve: r.list.filter((o) => o.review.decision === 'réserve').length });
  if (!DRY) {
    writeCountryFile(file, [...(base.get(slugOf(p) + '.json') || []), ...fresh]);
    const rank = { 'retenu': 0, 'réserve': 1, 'rejeté': 2 };
    writeJSON(path.join(REVIEW_DIR, slugOf(p) + '.json'), r.list.map((o) => o.review).sort((a, b) => rank[a.decision] - rank[b.decision] || (b.total || 0) - (a.total || 0) || a.n.localeCompare(b.n)));
  }
}
if (!DRY) writeJSON(LEDGER, ledger);
console.table(report);
if (args.includes('--explain')) for (const r of placesOut.values()) for (const o of r.list) if (o.review.decision !== 'retenu') console.log(`${o.review.decision.padEnd(8)} ${o.c.p} · ${o.c.n} — ${o.review.reason || ''}`);
const sum = (k) => report.reduce((a, r) => a + r[k], 0);
console.log(`${BATCH} : ${sum('candidates')} candidats, ${sum('added')} retenus, ${sum('rejected')} rejetés, ${sum('reserve')} en réserve${DRY ? ' (essai, rien écrit)' : ''}`);

function toPlace(o) {
  const c = o.c, L = { i: o.review.i, n: c.n, y: +c.y.toFixed(5), x: +c.x.toFixed(5), p: c.p, c: c.c };
  const w = [1, 2, 3].includes(c.w) ? c.w : 2;
  L.w = w === 1 && !o.top ? 2 : w;                            // « incontournable » réservé aux candidats les mieux notés
  L.d = c.d;
  L.s = SEASON_OK.test(c.s) ? c.s : (c.c === 'ville' ? "toute l'année" : 'Saison et accès à vérifier');
  if (c.q) L.q = c.q.slice(0, 40);
  L.du = DURATIONS.has(c.du) ? c.du : '';
  L.v = c.v;
  L.e = PRACTICAL;
  L.batch = BATCH;
  if (o.chk.links.qid) L.qid = o.chk.links.qid;
  const src = o.chk.links.unesco || (o.chk.links.geonames ? `https://www.geonames.org/${o.chk.links.geonames}` : null);
  if (src) L.source = src;
  L.coordinateNote = COORD_NOTE;
  return L;
}
