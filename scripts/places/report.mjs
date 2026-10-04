#!/usr/bin/env node
// Rapport de couverture du catalogue, avant / après un lot : nombres, catégories, couverture territoriale.
//   node scripts/places/report.mjs [--batch v10] [--md <fichier.md>] [--json <fichier.json>]
// Couverture territoriale (deux mesures simples, sans réseau) :
//   - régions : régions administratives GeoNames (admin1) qui ont au moins un lieu, sur celles du pays ;
//   - mailles : cellules de 0,5° × 0,5° (~ 40 × 55 km) occupées, sur les cellules du pays qui ont une localité
//     de plus de 1 000 habitants (repère du territoire habité, montagnes comprises à leurs vallées).
import path from 'node:path';
import fs from 'node:fs';
import { COUNTRIES, SOURCES_DIR, gazetteer, loadPlaces, readJSON, writeJSON } from './lib.mjs';

const args = process.argv.slice(2);
const opt = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
const BATCH = opt('--batch', 'v10');
const baseline = readJSON(path.join(SOURCES_DIR, `baseline-${BATCH}.json`), null);
const G = gazetteer(), all = loadPlaces();
const before = all.filter((L) => L.i in baseline.hashes), after = all;
const cell = (p) => Math.floor(p.x * 2) + ':' + Math.floor(p.y * 2);
const habitable = {}, regionsOf = {};
for (const r of G.rows) { (habitable[r.cc] = habitable[r.cc] || new Set()).add(cell(r)); }
for (const k of Object.keys(G.admin1)) { const cc = k.slice(0, 2); regionsOf[cc] = (regionsOf[cc] || 0) + 1; }

function measure(list, p) {
  const [cc] = COUNTRIES[p], mine = list.filter((L) => L.p === p);
  const cats = {}, regs = new Set(), cells = new Set();
  for (const L of mine) {
    cats[L.c] = (cats[L.c] || 0) + 1;
    const loc = G.nearest(L, { cc }); if (loc && loc.km < 60) regs.add(G.region(loc));
    if (habitable[cc] && habitable[cc].has(cell(L))) cells.add(cell(L));
  }
  return { n: mine.length, cats, regions: regs.size, cells: cells.size };
}
const rows = Object.keys(COUNTRIES).map((p) => {
  const [cc] = COUNTRIES[p], b = measure(before, p), a = measure(after, p);
  return { p, before: b.n, after: a.n, min: 2 * b.n, ok: a.n >= 2 * b.n, ratio: +(a.n / b.n).toFixed(2), added: a.n - b.n,
    regionsTotal: regionsOf[cc] || 0, regionsBefore: b.regions, regionsAfter: a.regions,
    cellsTotal: habitable[cc] ? habitable[cc].size : 0, cellsBefore: b.cells, cellsAfter: a.cells, catsBefore: b.cats, catsAfter: a.cats };
}).sort((x, y) => y.before - x.before);

const pct = (a, b) => (b ? Math.round((100 * a) / b) + ' %' : '—');
const cats = (o) => ['ville', 'nature', 'patrimoine', 'plage', 'pratique', 'boulot', 'base'].filter((k) => o[k]).map((k) => `${k} ${o[k]}`).join(', ');
const md = [];
md.push('| Pays | Avant | Après | Minimum | Ratio | Statut | Régions avant → après | Mailles avant → après |', '|---|---:|---:|---:|---:|:---:|---|---|');
for (const r of rows) md.push(`| ${r.p} | ${r.before} | ${r.after} | ${r.min} | ×${r.ratio} | ${r.ok ? 'PASS' : 'FAIL'} | ${r.regionsBefore} → ${r.regionsAfter} / ${r.regionsTotal} | ${r.cellsBefore} → ${r.cellsAfter} / ${r.cellsTotal} (${pct(r.cellsBefore, r.cellsTotal)} → ${pct(r.cellsAfter, r.cellsTotal)}) |`);
const T = rows.reduce((o, r) => ({ b: o.b + r.before, a: o.a + r.after, cb: o.cb + r.cellsBefore, ca: o.ca + r.cellsAfter, ct: o.ct + r.cellsTotal, rb: o.rb + r.regionsBefore, ra: o.ra + r.regionsAfter }), { b: 0, a: 0, cb: 0, ca: 0, ct: 0, rb: 0, ra: 0 });
md.push(`| **Total** | **${T.b}** | **${T.a}** | **${2 * T.b}** | ×${(T.a / T.b).toFixed(2)} | ${rows.every((r) => r.ok) ? 'PASS' : 'FAIL'} | ${T.rb} → ${T.ra} | ${T.cb} → ${T.ca} / ${T.ct} (${pct(T.cb, T.ct)} → ${pct(T.ca, T.ct)}) |`);
md.push('', '| Pays | Catégories avant | Catégories après |', '|---|---|---|');
for (const r of rows) md.push(`| ${r.p} | ${cats(r.catsBefore)} | ${cats(r.catsAfter)} |`);
const catTot = (list) => { const o = {}; for (const L of list) o[L.c] = (o[L.c] || 0) + 1; return o; };
md.push(`| **Total** | ${cats(catTot(before))} | ${cats(catTot(after))} |`);

if (opt('--md', null)) fs.writeFileSync(path.resolve(opt('--md')), md.join('\n') + '\n');
if (opt('--json', null)) writeJSON(path.resolve(opt('--json')), rows);
for (const r of rows) console.log(`${r.p.padEnd(14)} ${String(r.before).padStart(4)} -> ${String(r.after).padStart(4)}  ${r.ok ? 'PASS' : 'FAIL'}   régions ${r.regionsBefore}→${r.regionsAfter}/${r.regionsTotal}   mailles ${r.cellsBefore}→${r.cellsAfter}/${r.cellsTotal}`);
console.log(`Total ${T.b} -> ${T.a} · mailles ${pct(T.cb, T.ct)} -> ${pct(T.ca, T.ct)}`);
process.exit(rows.every((r) => r.ok) ? 0 : 1);
