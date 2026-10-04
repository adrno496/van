// Contraste des éléments de la carte sur chacun de ses fonds, calculé avec contrastRatio de CREATIVE_ENGINE_V9.
//   node audit-refonte-v2/scripts/map-contrast.mjs [tokens.css]
// Texte : seuil 4,5 (WCAG 1.4.3). Repères graphiques (marqueurs, tracés) : seuil 3 (WCAG 1.4.11).
// axe-core classe ces textes « à vérifier à la main » parce qu'ils sont posés sur un dessin : ce script fait cette vérification.
import fs from 'node:fs';
import path from 'node:path';
const CE = process.env.CREATIVE_ENGINE || '/Users/dreano/Downloads/CREATIVE_ENGINE_V9';
const { contrastRatio } = await import(path.join(CE, 'src/color-engine.mjs'));
const file = process.argv[2] || 'src/css/tokens.css';
const t = Object.fromEntries([...fs.readFileSync(file, 'utf8').matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\b/g)].map((m) => [m[1], m[2]]));
const grounds = ['map-land-hi', 'map-land', 'map-sea', 'map-halo'];
const rows = [];
const add = (use, fg, min, list = grounds) => { for (const bg of list) { const r = contrastRatio(t[fg], t[bg]); rows.push({ use, fg: `${fg} ${t[fg]}`, bg: `${bg} ${t[bg]}`, ratio: Number(r.toFixed(2)), required: min, status: r >= min ? 'PASS' : 'FAIL' }); } };
add('nom de lieu (texte, entouré d’un liseré map-halo)', 'text', 4.5);
add('nom de pays (repère en capitales, décoratif)', 'map-label', 3, ['map-land-hi', 'map-land']);
for (const c of ['ville', 'patrimoine', 'nature', 'plage', 'boulot', 'pratique', 'base', 'perso']) add(`marqueur ${c}`, `cat-${c}`, 3);
add('tracé du trajet', 'route', 3); add('fil du carnet', 'journal', 3); add('position', 'geo', 3);
add('contour d’un lieu choisi ou survolé', 'text', 3, ['map-halo']);
const fail = rows.filter((r) => r.status === 'FAIL');
process.stdout.write(JSON.stringify({ tokens: file, pairs: rows.length, pass: rows.length - fail.length, fail, min_text: Math.min(...rows.filter((r) => r.required === 4.5).map((r) => r.ratio)), min_graphic: Math.min(...rows.filter((r) => r.required === 3).map((r) => r.ratio)), rows }, null, 2) + '\n');
