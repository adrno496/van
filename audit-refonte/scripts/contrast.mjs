// Contraste des couples de couleurs d'un fichier de jetons, calculé avec contrastRatio de CREATIVE_ENGINE_V9.
//   node audit-refonte/scripts/contrast.mjs <tokens.css> [...]
import fs from 'node:fs';
import path from 'node:path';
const CE = process.env.CREATIVE_ENGINE || '/Users/dreano/Downloads/CREATIVE_ENGINE_V9';
const { contrastRatio } = await import(path.join(CE, 'src/color-engine.mjs'));
// [texte, fond, seuil, usage]. 4,5 : texte courant (WCAG 1.4.3). 3 : composants et repères graphiques (WCAG 1.4.11).
const PAIRS = [['text', 'surface', 4.5, 'texte courant'], ['text', 'bg', 4.5, 'texte sur le fond de page'], ['text-2', 'surface', 4.5, 'texte secondaire'], ['text-2', 'surface-2', 4.5, 'texte secondaire sur surface atténuée'],
  ['text-3', 'surface', 4.5, 'mentions et texte d’aide'], ['text-3', 'surface-2', 4.5, 'mentions sur surface atténuée'], ['on-accent', 'accent', 4.5, 'bouton principal'], ['on-accent', 'accent-hover', 4.5, 'bouton principal survolé'],
  ['accent-text', 'surface', 4.5, 'liens'], ['accent-text', 'accent-soft', 4.5, 'pastille accentuée'], ['surface', 'text', 4.5, 'pastille active (clair sur sombre)'], ['success', 'success-soft', 4.5, 'pastille de succès'],
  ['warning', 'warning-soft', 4.5, 'pastille d’avertissement'], ['danger', 'danger-soft', 4.5, 'message d’erreur'], ['danger', 'surface', 4.5, 'bouton de suppression'], ['border-strong', 'surface', 3, 'contour des champs et boutons'],
  ['focus', 'surface', 3, 'anneau de focus'], ['focus', 'map-land', 3, 'anneau de focus sur la carte'], ['text', 'map-land-hi', 4.5, 'noms de lieux sur la carte'], ['map-label', 'map-land-hi', 3, 'noms de pays (repère)'],
  ['cat-ville', 'map-land-hi', 3, 'marqueur ville'], ['cat-patrimoine', 'map-land-hi', 3, 'marqueur patrimoine'], ['cat-nature', 'map-land-hi', 3, 'marqueur nature'], ['cat-plage', 'map-land-hi', 3, 'marqueur côte'],
  ['cat-boulot', 'map-land-hi', 3, 'marqueur boulot'], ['cat-pratique', 'map-land-hi', 3, 'marqueur pratique'], ['route', 'map-land-hi', 3, 'tracé du trajet'], ['journal', 'map-land-hi', 3, 'fil du carnet'], ['geo', 'map-sea', 3, 'position']];
const out = {};
for (const file of process.argv.slice(2)) {
  const css = fs.readFileSync(file, 'utf8'), t = Object.fromEntries([...css.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\b/g)].map((m) => [m[1], m[2]]));
  const rows = PAIRS.map(([fg, bg, min, use]) => { const r = contrastRatio(t[fg], t[bg]); return { use, fg: `${fg} ${t[fg]}`, bg: `${bg} ${t[bg]}`, ratio: r == null ? null : Number(r.toFixed(2)), required: min, status: r == null ? 'NON TESTÉ' : r >= min ? 'PASS' : 'FAIL' }; });
  out[path.basename(file)] = { pairs: rows.length, pass: rows.filter((r) => r.status === 'PASS').length, fail: rows.filter((r) => r.status === 'FAIL'), min_text_ratio: Math.min(...rows.filter((r) => r.required === 4.5 && r.ratio).map((r) => r.ratio)), rows };
}
process.stdout.write(JSON.stringify(out, null, 2) + '\n');
