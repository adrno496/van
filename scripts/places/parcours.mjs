#!/usr/bin/env node
// Itinéraires (« idées de parcours ») définis par leurs étapes, ordonnés pour rester réalistes sur la route.
//   node scripts/places/parcours.mjs [--defs data-sources/parcours-v10.json] [--dry]
// Chaque définition : { n, d, t, stops: ["Nom du lieu" | "Nom du lieu|Pays" | identifiant], keep?: true, loop?: false }
//   - les étapes sont retrouvées par leur nom exact (et le pays si besoin) : un nom absent ou ambigu arrête le script ;
//   - sauf « keep », l'ordre est recalculé depuis la première étape : plus proche voisin, puis 2-opt (trajet ouvert) ;
//   - contrôle : aucune étape à plus de MAX_LEG km de la précédente, aucune base (logement personnel), aucun doublon.
// Les parcours d'origine ne sont jamais modifiés : seuls ceux dont le nom figure dans le fichier de définitions sont
// remplacés, les autres sont ajoutés à la fin de DATA.parcours (src/data/places.js).
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, km, loadData, loadPlaces, readJSON } from './lib.mjs';

const args = process.argv.slice(2), opt = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
const DEFS = path.resolve(opt('--defs', path.join(ROOT, 'data-sources', 'parcours-v10.json'))), DRY = args.includes('--dry');
const MAX_LEG = Number(opt('--max-leg', 420));
const defs = readJSON(DEFS, null); if (!defs) throw new Error('définitions introuvables : ' + DEFS);
const places = loadPlaces(), byId = new Map(places.map((p) => [p.i, p]));

function resolve(s) {
  if (typeof s === 'number') { if (!byId.has(s)) throw new Error(`identifiant inconnu : ${s}`); return byId.get(s); }
  const [n, p] = s.split('|'), hits = places.filter((L) => L.n === n && (!p || L.p === p));
  if (hits.length !== 1) throw new Error(`« ${s} » : ${hits.length ? hits.length + ' lieux portent ce nom, préciser « Nom|Pays »' : 'introuvable'}`);
  return hits[0];
}
const length = (list) => list.slice(1).reduce((a, L, k) => a + km(list[k], L), 0);
function order(list) {
  const rest = list.slice(1), out = [list[0]];
  while (rest.length) { const last = out[out.length - 1]; let b = 0; rest.forEach((L, k) => { if (km(last, L) < km(last, rest[b])) b = k; }); out.push(rest.splice(b, 1)[0]); }
  for (let improved = true; improved;) {   // 2-opt, première étape fixe, trajet ouvert
    improved = false;
    for (let i = 1; i < out.length - 1; i++) for (let j = i + 1; j < out.length; j++) {
      const a = out[i - 1], b = out[i], c = out[j], d = out[j + 1];
      const before = km(a, b) + (d ? km(c, d) : 0), after = km(a, c) + (d ? km(b, d) : 0);
      if (after < before - 0.01) { out.splice(i, j - i + 1, ...out.slice(i, j + 1).reverse()); improved = true; }
    }
  }
  return out;
}

const made = [];
for (const def of defs) {
  const stops = def.stops.map(resolve);
  const ids = stops.map((L) => L.i);
  if (new Set(ids).size !== ids.length) throw new Error(`« ${def.n} » : étape en double`);
  if (stops.some((L) => L.c === 'base')) throw new Error(`« ${def.n} » : une base (logement personnel) ne peut pas figurer dans un parcours proposé`);
  const route = def.keep ? stops : order(stops);
  const legs = route.slice(1).map((L, k) => ({ from: route[k].n, to: L.n, km: Math.round(km(route[k], L)) }));
  const worst = legs.reduce((a, l) => (l.km > a.km ? l : a), { km: 0 });
  if (worst.km > MAX_LEG) throw new Error(`« ${def.n} » : ${worst.from} → ${worst.to} fait ${worst.km} km à vol d'oiseau (max ${MAX_LEG})`);
  made.push({ def, p: { n: def.n, d: def.d, l: route.map((L) => L.i), t: def.t }, km: Math.round(length(route)), worst, countries: [...new Set(route.map((L) => L.p))] });
}
for (const m of made) console.log(`${m.def.n} — ${m.p.l.length} étapes, ~${m.km} km à vol d'oiseau, plus longue étape ${m.worst.km} km (${m.worst.from} → ${m.worst.to}) · ${m.countries.join(', ')}`);

if (!DRY) {
  const file = path.join(ROOT, 'src', 'data', 'places.js'), src = fs.readFileSync(file, 'utf8');
  const head = src.slice(0, src.indexOf('var DATA = ')), DATA = loadData();
  const names = new Set(made.map((m) => m.p.n));
  DATA.parcours = DATA.parcours.filter((p) => !names.has(p.n)).concat(made.map((m) => m.p));
  fs.writeFileSync(file, head + 'var DATA = ' + JSON.stringify({ pays: DATA.pays, parcours: DATA.parcours, meta: DATA.meta }) + ';\n');
  console.log(`${made.length} parcours écrits dans src/data/places.js (${DATA.parcours.length} au total)`);
}
