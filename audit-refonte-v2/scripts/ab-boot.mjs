// Comparaison de démarrage entre plusieurs versions construites, mesurées en alternance (A, B, C, A, B, C…)
// pour que la charge de la machine pèse de la même façon sur chacune.
//   node audit-refonte-v2/scripts/ab-boot.mjs --variants nom=dossier,nom=dossier [--runs 9] [--cpu 4] [--out rapport.json]
// Mesures prises dans la page : premier affichage (FCP), fin du démarrage (carnet prêt), tâches longues (> 50 ms)
// et temps de blocage après le premier affichage (somme des dépassements au-delà de 50 ms, comme le TBT de Lighthouse).
import path from 'node:path';
import os from 'node:os';
import { loadPlaywright, serve, writeJson } from '../../tests/lib/harness.mjs';

const args = process.argv.slice(2);
const opt = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
const variants = opt('--variants', '').split(',').filter(Boolean).map((v) => { const [name, dir] = v.split('='); return { name, dir: path.resolve(dir) }; });
const runs = Number(opt('--runs', 9)), cpu = Number(opt('--cpu', 4)), out = opt('--out', null);
const med = (a) => { const s = a.filter((x) => x != null).sort((x, y) => x - y); return s.length ? Math.round(s[Math.floor(s.length / 2)]) : null; };
const { chromium } = loadPlaywright();
const browser = await chromium.launch();
for (const v of variants) { v.server = await serve(v.dir); v.samples = []; }
try {
  for (let i = 0; i < runs; i++) {
    for (const v of variants) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, locale: 'fr-FR' });
      await context.route('**/*', (r) => (r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort()));
      const page = await context.newPage(), cdp = await context.newCDPSession(page);
      if (cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
      await page.addInitScript(() => { window.__lt = []; try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt.push([e.startTime, e.duration]); }).observe({ type: 'longtask', buffered: true }); } catch {} });
      await page.goto(v.server.url, { waitUntil: 'load' });
      const ready = await page.evaluate(() => new Promise((res) => { const t = setInterval(() => { if (typeof journalReady !== 'undefined' && journalReady) { clearInterval(t); res(performance.now()); } }, 5); }));
      await page.waitForTimeout(600);
      const m = await page.evaluate(() => ({ fcp: (performance.getEntriesByType('paint').find((x) => x.name === 'first-contentful-paint') || {}).startTime ?? null, lt: window.__lt, nodes: document.getElementsByTagName('*').length }));
      const after = m.lt.filter(([s, d]) => s + d > (m.fcp || 0));
      v.samples.push({ fcp: m.fcp, ready, longTasks: m.lt.length, longTaskMax: Math.max(0, ...m.lt.map((x) => x[1])), longTaskTotal: m.lt.reduce((a, x) => a + x[1], 0), blockingAfterFcp: after.reduce((a, x) => a + Math.max(0, x[1] - 50), 0), nodes: m.nodes });
      await context.close();
    }
  }
} finally { await browser.close(); for (const v of variants) await v.server.close(); }
const keys = ['fcp', 'ready', 'longTasks', 'longTaskMax', 'longTaskTotal', 'blockingAfterFcp', 'nodes'];
const report = { generatedAt: new Date().toISOString(), runs, cpu, viewport: '390x844', load1: Number(os.loadavg()[0].toFixed(2)),
  variants: variants.map((v) => ({ name: v.name, median: Object.fromEntries(keys.map((k) => [k, med(v.samples.map((s) => s[k]))])), min: Object.fromEntries(keys.map((k) => [k, Math.round(Math.min(...v.samples.map((s) => s[k] ?? Infinity)))])), samples: v.samples })) };
if (out) writeJson(path.resolve(out), report);
console.log(`mobile 390×844, processeur ×${cpu}, ${runs} passages en alternance, charge ${report.load1} — médiane (minimum)`);
console.log('version'.padEnd(14) + keys.map((k) => k.padStart(18)).join(''));
for (const v of report.variants) console.log(v.name.padEnd(14) + keys.map((k) => `${v.median[k]} (${v.min[k]})`.padStart(18)).join(''));
