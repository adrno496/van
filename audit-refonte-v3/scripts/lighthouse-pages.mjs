// Lighthouse sur plusieurs pages d'un site construit, avec la fonction runLighthouse de CREATIVE_ENGINE_V9
// (la commande « lighthouse » du moteur ne mesure que la page d'accueil).
//   node audit-refonte-v3/scripts/lighthouse-pages.mjs <dossier du site> <rapport.json> [--routes /,/app/] [--runs 3]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const CE = process.env.CREATIVE_ENGINE || '/Users/dreano/Downloads/CREATIVE_ENGINE_V9';
const { runLighthouse } = await import(path.join(CE, 'src/lighthouse-lab.mjs'));
const args = process.argv.slice(2), opt = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
const dir = path.resolve(args[0]), out = path.resolve(args[1]), routes = opt('--routes', '/').split(','), runs = Number(opt('--runs', 3));
const report = await runLighthouse(dir, { routes, runs, outDir: fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-lh-')), keepReports: false });
const slim = { engine: fs.readFileSync(path.join(CE, 'VERSION'), 'utf8').trim(), lighthouse_version: report.lighthouse_version, runs, load1: Number(os.loadavg()[0].toFixed(1)), status: report.status,
  results: (report.results || []).map((r) => ({ route: r.route, form_factor: r.form_factor, status: r.status, scores: r.median && r.median.scores, metrics: r.median && r.median.metrics, runs: (r.runs || []).map((x) => ({ performance: x.scores && x.scores.performance, tbt_ms: x.metrics && Math.round(x.metrics.tbt_ms), lcp_ms: x.metrics && Math.round(x.metrics.lcp_ms) })) })), limitations: report.limitations };
fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, JSON.stringify(slim, null, 1) + '\n');
for (const r of slim.results) console.log(r.route.padEnd(44), r.form_factor.padEnd(8), r.status.padEnd(8), JSON.stringify(r.scores), r.metrics ? `LCP ${Math.round(r.metrics.lcp_ms)} ms · TBT ${Math.round(r.metrics.tbt_ms)} ms · CLS ${r.metrics.cls}` : '');
