// Mesures de performance en laboratoire (Chromium), identiques avant et après refonte.
//   node tests/perf.mjs [--dir <dossier servi>] [--out <rapport.json>] [--label <nom>] [--runs 5]
// Deux profils : ordinateur (processeur non bridé) et mobile (processeur ralenti ×4 via le protocole DevTools).
// Ce sont des mesures locales sur cette machine : elles servent à comparer deux versions, pas à certifier.
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { ROOT, loadPlaywright, serve, openApp, writeJson } from './lib/harness.mjs';

const args = process.argv.slice(2);
const opt = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
const dir = path.resolve(opt('--dir', ROOT));
const out = path.resolve(opt('--out', 'test-results/perf.json'));
const label = opt('--label', path.basename(dir));
const runs = Number(opt('--runs', 5));
const median = (a) => { const s = a.slice().sort((x, y) => x - y); return s.length ? Number(s[Math.floor(s.length / 2)].toFixed(2)) : null; };

async function measure(browser, url, viewport, cpuRate) {
  const boots = [], rows = [];
  for (let i = 0; i < runs; i++) {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, hasTouch: !!viewport.touch, isMobile: !!viewport.mobile, deviceScaleFactor: viewport.mobile ? 2 : 1, locale: 'fr-FR' });
    await context.route('**/*', (r) => (r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort()));
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    if (cpuRate > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpuRate });
    await page.addInitScript(() => { window.__cls = 0; window.__long = []; try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true }); new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__long.push(Math.round(e.duration)); }).observe({ type: 'longtask', buffered: true }); } catch {} });
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForFunction(() => typeof journalReady !== 'undefined' && journalReady, null, { timeout: 60000 });
    await page.waitForTimeout(600);
    const boot = await page.evaluate(() => { const n = performance.getEntriesByType('navigation')[0], p = performance.getEntriesByType('paint');
      return { domInteractive: Math.round(n.domInteractive), domContentLoaded: Math.round(n.domContentLoadedEventEnd), load: Math.round(n.loadEventEnd), fcp: Math.round(p.find((x) => x.name === 'first-contentful-paint')?.startTime || 0), cls: Number(window.__cls.toFixed(4)), longTasks: window.__long.length, longTaskTotal: window.__long.reduce((a, b) => a + b, 0), longTaskMax: Math.max(0, ...window.__long), domNodes: document.getElementsByTagName('*').length, heapMb: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null }; });
    boots.push(boot);
    if (i === 0) {
      // Interactions : chaque opération est répétée, la médiane est retenue.
      const ops = await page.evaluate(async () => {
        const time = (fn, n = 15) => { const t = []; for (let i = 0; i < n; i++) { const a = performance.now(); fn(); t.push(performance.now() - a); } t.sort((x, y) => x - y); return Number(t[Math.floor(t.length / 2)].toFixed(2)); };
        const res = {};
        res.rescale = time(() => rescale());
        res.applyFilters = time(() => applyFilters(), 9);
        res.renderDiscovery = time(() => renderDiscovery(), 9);
        const q = document.querySelector('#q'); res.searchKeystroke = time(() => { q.value = 'la'; q.dispatchEvent(new Event('input')); }, 9); q.value = ''; q.dispatchEvent(new Event('input'));
        const paris = PTS.find((p) => p.n === 'Paris').i; res.showPlace = time(() => show(paris), 9);
        document.querySelector('#presets [data-pr]').click(); res.paintRoute51 = time(() => paint(), 9);
        document.body.classList.remove('preset-preview'); setMobileView('map');
        // Déplacement de la carte : 40 mouvements, durée de chaque image mesurée par requestAnimationFrame.
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        const svg = document.querySelector('#map'), r = svg.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, frames = [];
        const fire = (type, x, y) => svg.dispatchEvent(new PointerEvent(type, { pointerId: 5, clientX: x, clientY: y, bubbles: true, pointerType: 'mouse', isPrimary: true }));
        const capture = svg.setPointerCapture; svg.setPointerCapture = () => {}; fire('pointerdown', cx, cy);
        let last = performance.now();
        for (let i = 1; i <= 40; i++) { fire('pointermove', cx + i * 4, cy + i * 2); await new Promise((res2) => requestAnimationFrame(res2)); const now = performance.now(); frames.push(now - last); last = now; }
        fire('pointerup', cx + 160, cy + 80); svg.setPointerCapture = capture;
        frames.sort((a, b) => a - b); res.panFrameMedian = Number(frames[20].toFixed(2)); res.panFrameP95 = Number(frames[37].toFixed(2));
        return res;
      });
      rows.push(ops);
    }
    await context.close();
  }
  const keys = Object.keys(boots[0]);
  return { runs, boot: Object.fromEntries(keys.map((k) => [k, median(boots.map((b) => b[k]).filter((v) => v != null))])), interactionsMs: rows[0] };
}

const { chromium } = loadPlaywright();
const server = await serve(dir);
const browser = await chromium.launch();
const load = os.loadavg()[0];
let report;
try {
  const files = fs.readdirSync(dir).filter((f) => !f.startsWith('.'));
  report = { label, dir, generatedAt: new Date().toISOString(), host: { cpus: os.cpus().length, load1: Number(load.toFixed(2)), platform: process.platform }, htmlBytes: fs.statSync(path.join(dir, 'index.html')).size, files,
    desktop: await measure(browser, server.url, { width: 1440, height: 900 }, 1),
    mobile: await measure(browser, server.url, { width: 390, height: 844, touch: true, mobile: true }, 4) };
} finally { await browser.close(); await server.close(); }
writeJson(out, report);
const show = (n, r) => console.log(`${n.padEnd(8)} FCP ${r.boot.fcp} ms · interactif ${r.boot.domInteractive} ms · chargé ${r.boot.load} ms · CLS ${r.boot.cls} · tâches longues ${r.boot.longTasks} (${r.boot.longTaskTotal} ms, max ${r.boot.longTaskMax}) · nœuds ${r.boot.domNodes} · tas ${r.boot.heapMb} Mo\n         ${Object.entries(r.interactionsMs).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
console.log(`${label} — HTML ${(report.htmlBytes / 1024).toFixed(0)} Ko — charge machine ${report.host.load1}`);
show('desktop', report.desktop); show('mobile×4', report.mobile);
