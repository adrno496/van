#!/usr/bin/env node
// Récupère les données de référence du pipeline et en garde un extrait européen, compact, dans data-sources/reference/.
//   node scripts/places/fetch-reference.mjs [--tmp <dossier>]
// Sources (téléchargées une fois, puis utilisées hors ligne par enrich.mjs, validate.mjs et report.mjs) :
//   - GeoNames, localités de plus de 1 000 habitants : paquet npm all-the-cities (CC BY 4.0, geonames.org)
//   - GeoNames, noms des régions (admin1) : paquet npm cities.json (CC BY 4.0)
//   - Liste du patrimoine mondial UNESCO : paquet npm @worldwideview/wwv-plugin-unesco-sites (instantané daté)
//   - Natural Earth, populated places (domaine public) : identifiants Wikidata des villes, sur raw.githubusercontent.com
// Ce script n'est jamais lancé par la construction du site : le site n'a aucune dépendance réseau.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { COUNTRIES, REF_DIR, writeJSON } from './lib.mjs';

const args = process.argv.slice(2);
const tmp = path.resolve(args.includes('--tmp') ? args[args.indexOf('--tmp') + 1] : fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-ref-')));
const PKGS = ['all-the-cities@3.1.0', 'cities.json@1.1.65', '@worldwideview/wwv-plugin-unesco-sites@1.0.0'];
const NE_URL = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_populated_places.geojson';
// Les pays du catalogue, plus les micro-États voisins (utiles pour reconnaître une frontière).
const CC = new Set([...Object.values(COUNTRIES).map((c) => c[0]), 'XK', 'MC', 'SM', 'VA', 'LI', 'MT']);

fs.mkdirSync(tmp, { recursive: true });
if (!fs.existsSync(path.join(tmp, 'package.json'))) fs.writeFileSync(path.join(tmp, 'package.json'), '{"private":true}');
console.log(`npm install ${PKGS.join(' ')} → ${tmp}`);
execFileSync('npm', ['install', '--no-audit', '--no-fund', '--silent', ...PKGS], { cwd: tmp, stdio: 'inherit' });
const req = createRequire(path.join(tmp, 'package.json'));

// GeoNames
const cities = req('all-the-cities').filter((c) => CC.has(c.country));
const admin1 = {};
for (const a of req('cities.json/admin1.json')) if (CC.has(a.code.slice(0, 2))) admin1[a.code] = a.name;
const rows = cities.map((c) => [c.cityId, c.name, c.country, c.adminCode, c.population, +c.loc.coordinates[1].toFixed(5), +c.loc.coordinates[0].toFixed(5)]);
// cities.json (même source GeoNames, autre extraction) apporte quelques localités absentes d'all-the-cities ;
// elles n'ont ni identifiant GeoNames ni population dans ce paquet (0).
const seen = new Set(rows.map((r) => r[2] + '|' + r[1] + '|' + Math.round(r[5] * 20) + ':' + Math.round(r[6] * 20)));
for (const c of req('cities.json')) {
  if (!CC.has(c.country)) continue;
  const y = +(+c.lat).toFixed(5), x = +(+c.lng).toFixed(5), k = c.country + '|' + c.name + '|' + Math.round(y * 20) + ':' + Math.round(x * 20);
  if (!seen.has(k) && !rows.some((r) => r[2] === c.country && r[1] === c.name && Math.abs(r[5] - y) < 0.05 && Math.abs(r[6] - x) < 0.05)) { seen.add(k); rows.push([null, c.name, c.country, c.admin1, 0, y, x]); }
}
fs.mkdirSync(REF_DIR, { recursive: true });
fs.writeFileSync(path.join(REF_DIR, 'geonames-europe.json.gz'), zlib.gzipSync(JSON.stringify({
  source: 'GeoNames (geonames.org) via npm all-the-cities@3.1.0 (localités ≥ 1 000 hab.) et cities.json@1.1.65 (localités complémentaires sans identifiant, noms admin1)',
  license: 'CC BY 4.0 — GeoNames', fetched: new Date().toISOString().slice(0, 10),
  fields: ['geonameid', 'name', 'country', 'admin1', 'population', 'lat', 'lon'], admin1, rows }), { level: 9 }));
console.log(`GeoNames : ${rows.length} localités, ${Object.keys(admin1).length} régions`);

// UNESCO
const pkgDir = path.dirname(req.resolve('@worldwideview/wwv-plugin-unesco-sites/package.json'));
const unesco = JSON.parse(fs.readFileSync(path.join(pkgDir, 'data', 'data.json'), 'utf8')).features
  .filter((f) => f.properties.region === 'Europe and North America' && f.geometry.coordinates[1] > 34 && f.geometry.coordinates[0] > -25 && f.geometry.coordinates[0] < 32)
  .map((f) => ({ id: f.properties.id, name: f.properties.name, countries: f.properties.country, category: f.properties.category, year: f.properties.year,
    url: f.properties.url, y: f.geometry.coordinates[1], x: f.geometry.coordinates[0] }));
writeJSON(path.join(REF_DIR, 'unesco-europe.json'), { source: '@worldwideview/wwv-plugin-unesco-sites@1.0.0 (instantané de la liste UNESCO, 2026-08-23)', fetched: new Date().toISOString().slice(0, 10), sites: unesco });
console.log(`UNESCO : ${unesco.length} sites`);

// Natural Earth
const res = await fetch(NE_URL);
if (!res.ok) throw new Error(`Natural Earth : HTTP ${res.status}`);
const ne = (await res.json()).features.filter((f) => CC.has(f.properties.ISO_A2)).map((f) => ({
  n: f.properties.NAME, fr: f.properties.NAME_FR || '', qid: f.properties.WIKIDATAID || '', cc: f.properties.ISO_A2,
  pop: f.properties.POP_MAX, y: f.properties.LATITUDE, x: f.properties.LONGITUDE }));
writeJSON(path.join(REF_DIR, 'naturalearth-places-europe.json'), { source: NE_URL, license: 'Natural Earth — domaine public', fetched: new Date().toISOString().slice(0, 10), places: ne });
console.log(`Natural Earth : ${ne.length} villes`);
