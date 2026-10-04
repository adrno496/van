// Profil détaillé : démarrage phase par phase, coût de chaque interaction, DOM, mémoire.
//   node tests/profile.mjs [--dir <dossier servi>] [--out <rapport.json>] [--label <nom>] [--runs 5]
// Sources : repères performance.mark de l'application, trace du navigateur (protocole DevTools), Performance.getMetrics.
// Profils : ordinateur (processeur non bridé) et mobile (390 × 844, processeur ralenti ×4).
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { ROOT, loadPlaywright, serve, writeJson } from './lib/harness.mjs';

const args = process.argv.slice(2);
const opt = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
const dir = path.resolve(opt('--dir', ROOT));
const out = path.resolve(opt('--out', 'audit-refonte-v2/evidence/profile.json'));
const label = opt('--label', path.basename(dir));
const runs = Number(opt('--runs', 5));
const med = (a) => { const s = a.filter((x) => x != null).sort((x, y) => x - y); return s.length ? Number(s[Math.floor(s.length / 2)].toFixed(1)) : null; };
const { chromium } = loadPlaywright();

// Durées par type d'événement sur le fil principal de la page, extraites d'une trace.
function summarizeTrace(events) {
  const main = events.find((e) => e.name === 'thread_name' && e.args?.name === 'CrRendererMain');
  const X = events.filter((e) => e.ph === 'X' && main && e.pid === main.pid && e.tid === main.tid);
  const sum = (name) => X.filter((e) => e.name === name).reduce((a, e) => a + e.dur, 0) / 1000;
  const scripts = X.filter((e) => e.name === 'EvaluateScript').map((e) => ({ line: e.args?.data?.lineNumber, url: (e.args?.data?.url || '').split('/').pop(), ms: e.dur / 1000 })).sort((a, b) => (a.line || 0) - (b.line || 0));
  const tasks = X.filter((e) => e.name === 'RunTask' && e.dur > 50000).map((e) => e.dur / 1000);
  return { parseHTML: sum('ParseHTML'), compile: sum('v8.compile') + sum('V8.CompileCode'), evaluateScripts: scripts, layout: sum('Layout'), recalcStyle: sum('UpdateLayoutTree'), paint: sum('Paint') + sum('PrePaint') + sum('Layerize') + sum('Commit'),
    gc: sum('MajorGC') + sum('MinorGC') + sum('V8.GC_MARK_COMPACTOR') + sum('V8.GC_SCAVENGER'), longTasks: tasks.length, longTaskTotal: tasks.reduce((a, b) => a + b, 0), longTaskMax: Math.max(0, ...tasks), blockingTime: tasks.reduce((a, b) => a + (b - 50), 0) };
}

async function profile(browser, url, vp, cpu) {
  const boots = [], interactions = [];
  let dom = null;
  for (let i = 0; i < runs; i++) {
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: !!vp.mobile, hasTouch: !!vp.mobile, deviceScaleFactor: vp.mobile ? 2 : 1, locale: 'fr-FR' });
    await context.route('**/*', (r) => (r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort()));
    const page = await context.newPage(), cdp = await context.newCDPSession(page);
    if (cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
    await cdp.send('Performance.enable');
    await page.addInitScript(() => { window.__lt = []; try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt.push([e.startTime, e.duration]); }).observe({ type: 'longtask', buffered: true }); } catch {} });
    await browser.startTracing(page, { categories: ['devtools.timeline', 'v8', 'disabled-by-default-v8.compile'] });
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForFunction(() => typeof journalReady !== 'undefined' && journalReady, null, { timeout: 60000 });
    await page.waitForTimeout(700);
    const trace = summarizeTrace(JSON.parse((await browser.stopTracing()).toString()).traceEvents);
    const marks = await page.evaluate(() => { const o = {}; for (const m of performance.getEntriesByType('mark')) if (m.name.startsWith('atlas:')) o[m.name.slice(6)] = m.startTime; const p = performance.getEntriesByType('paint').find((x) => x.name === 'first-contentful-paint'); o.fcp = p ? p.startTime : null; o.longTasks = window.__lt || []; return o; });
    const lt = marks.longTasks, afterFcp = lt.filter(([s, dur]) => s + dur > (marks.fcp || 0));
    const d = (a, b) => (marks[a] != null && marks[b] != null ? marks[b] - marks[a] : null);
    const dataScript = trace.evaluateScripts[0], appScript = trace.evaluateScripts[trace.evaluateScripts.length - 1];
    boots.push({ FCP: marks.fcp, DATA_PARSE: marks['data-parsed'] != null ? d('data-start', 'data-parsed') : (trace.evaluateScripts.length > 1 ? dataScript.ms : null), APP_SCRIPT: appScript ? appScript.ms : null, COMPILE: trace.compile, COUNTRY_RENDER: d('countries-start', 'countries-end'), MARKER_RENDER: d('markers-start', 'markers-end'),
      WIRE: d('boot-start', 'wired'), LISTS: d('wired', 'lists') ?? d('deferred-start', 'deferred-end'), VIEW_FIRST_LAYOUT: d('lists', 'view') ?? d('wired', 'view'), INITIAL_FILTER_LABELS: d('view', 'filter'), ROUTE: d('filter', 'route'), BOOT_TOTAL: d('app-start', 'boot-end'), READY: marks['journal-ready'] ?? null,
      PARSE_HTML: trace.parseHTML, LAYOUT: trace.layout, RECALC_STYLE: trace.recalcStyle, PAINT: trace.paint, GC: trace.gc, LONG_TASKS: lt.length, LONG_TASK_MAX: Math.max(0, ...lt.map((x) => x[1])), LONG_TASK_TOTAL: lt.reduce((a, x) => a + x[1], 0), BLOCKING_TIME_AFTER_FCP: afterFcp.reduce((a, [s, dur]) => a + Math.max(0, dur - 50 - Math.max(0, (marks.fcp || 0) - s)), 0) });
    // Interactions : durée de script, de style et de mise en page mesurées par le navigateur autour de chaque opération.
    const metrics = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
    const measure = async (fn, arg) => { const a = await metrics(), t0 = Date.now(); await page.evaluate(fn, arg); await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))); const b = await metrics();
      return { script: (b.ScriptDuration - a.ScriptDuration) * 1000, style: (b.RecalcStyleDuration - a.RecalcStyleDuration) * 1000, layout: (b.LayoutDuration - a.LayoutDuration) * 1000, task: (b.TaskDuration - a.TaskDuration) * 1000, wall: Date.now() - t0 }; };
    const row = {};
    row.FIRST_INTERACTION = await measure(() => { document.querySelector('#zin').click(); rescale(); });
    row.ZOOM = await measure(() => { for (let i = 0; i < 4; i++) { zoomAt(vb[0] + vb[2] / 2, vb[1] + vb[3] / 2, i % 2 ? 1.5 : 1 / 1.5); rescale(); } });
    row.PAN = await measure(async () => { const s = document.querySelector('#map'), r = s.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2; const f = (t, x, y) => s.dispatchEvent(new PointerEvent(t, { pointerId: 9, clientX: x, clientY: y, bubbles: true, pointerType: 'touch', isPrimary: true })); const cap = s.setPointerCapture; s.setPointerCapture = () => {}; f('pointerdown', cx, cy); for (let i = 1; i <= 30; i++) { f('pointermove', cx + i * 4, cy + i * 2); await new Promise((q) => requestAnimationFrame(q)); } f('pointerup', cx + 120, cy + 60); s.setPointerCapture = cap; });
    row.FILTER_APPLY = await measure(() => { for (let i = 0; i < 4; i++) document.querySelector('[data-cat="nature"]').click(); });
    row.SEARCH = await measure(() => { const q = document.querySelector('#q'); for (const v of ['la', 'lac', 'lac ', 'po']) { q.value = v; q.dispatchEvent(new Event('input')); } q.value = ''; q.dispatchEvent(new Event('input')); });
    row.SHOW_PLACE = await measure(() => { const p = PTS.find((x) => x.n === 'Paris'); show(p.i, { full: true }); });
    row.ROUTE_51 = await measure(() => { document.querySelector('#presets [data-pr]').click(); });
    interactions.push(row);
    if (!dom) { const m = await metrics(); dom = await page.evaluate(() => ({ total: document.getElementsByTagName('*').length, svg: document.querySelectorAll('#map *').length, markerNodes: document.querySelectorAll('#map .poi, #map .poi *').length, markers: document.querySelectorAll('#map .poi').length, textNodes: document.querySelectorAll('#map text').length, labelsShown: [...document.querySelectorAll('#map text')].filter((t) => !t.classList.contains('plabel') && !t.classList.contains('rnum') && t.style.display !== 'none').length, groups: document.querySelectorAll('#map g').length, countryPaths: document.querySelectorAll('#map path.pays').length })); dom.jsEventListeners = m.JSEventListeners; dom.heapUsedMb = Number((m.JSHeapUsedSize / 1048576).toFixed(1)); dom.documents = m.Documents; }
    await context.close();
  }
  const keys = Object.keys(boots[0]);
  const ops = Object.keys(interactions[0]);
  return { boot: Object.fromEntries(keys.map((k) => [k, med(boots.map((b) => b[k]))])), interactions: Object.fromEntries(ops.map((o) => [o, Object.fromEntries(['script', 'style', 'layout', 'task', 'wall'].map((f) => [f, med(interactions.map((r) => r[o][f]))]))])), dom };
}

const server = await serve(dir);
const browser = await chromium.launch();
let report;
try {
  report = { label, dir, generatedAt: new Date().toISOString(), runs, host: { cpus: os.cpus().length, load1: Number(os.loadavg()[0].toFixed(2)) },
    desktop: await profile(browser, server.url, { width: 1440, height: 900 }, 1), mobile: await profile(browser, server.url, { width: 390, height: 844, mobile: true }, 4) };
} finally { await browser.close(); await server.close(); }
writeJson(out, report);
// Le résumé lisible est affiché et rangé à côté du rapport JSON.
const lines = []; const say = (...a) => { lines.push(a.join(' ')); console.log(...a); };
const f = (v) => (v == null ? '—' : String(Math.round(v)).padStart(5));
say(`${label} — charge ${report.host.load1} — médiane de ${runs} démarrages (ms)`);
say('phase                   ordinateur  mobile×4');
for (const k of Object.keys(report.desktop.boot)) say(k.padEnd(24) + f(report.desktop.boot[k]) + '      ' + f(report.mobile.boot[k]));
say('interaction (tâche)     ordinateur  mobile×4   [script/style/layout mobile]');
for (const k of Object.keys(report.desktop.interactions)) { const m = report.mobile.interactions[k]; say(k.padEnd(24) + f(report.desktop.interactions[k].task) + '      ' + f(m.task) + `      [${Math.round(m.script)}/${Math.round(m.style)}/${Math.round(m.layout)}]`); }
say('DOM', JSON.stringify(report.mobile.dom));

fs.writeFileSync(out.replace(/\.json$/, '') + '.txt', lines.join('\n') + '\n');
