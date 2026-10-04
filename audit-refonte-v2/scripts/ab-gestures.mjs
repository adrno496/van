// Fluidité des gestes sur la carte, entre plusieurs versions construites, mesurées en alternance.
//   node audit-refonte-v2/scripts/ab-gestures.mjs --variants nom=dossier,nom=dossier [--runs 5] [--cpu 4] [--out rapport.json]
// Déplacement : 90 images en vue d'ensemble puis 90 en vue rapprochée ; zoom continu (pincement) : 60 images.
// Par geste : durée médiane d'une image, 9e décile, nombre d'images au-delà de 33 ms, et temps de fil principal par image.
import path from 'node:path';
import os from 'node:os';
import { loadPlaywright, serve, writeJson } from '../../tests/lib/harness.mjs';

const args = process.argv.slice(2);
const opt = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
const variants = opt('--variants', '').split(',').filter(Boolean).map((v) => { const [name, dir] = v.split('='); return { name, dir: path.resolve(dir) }; });
const runs = Number(opt('--runs', 5)), cpu = Number(opt('--cpu', 4)), out = opt('--out', null);
const med = (a) => { const s = a.filter((x) => x != null).sort((x, y) => x - y); return s.length ? Number(s[Math.floor(s.length / 2)].toFixed(1)) : null; };
const { chromium } = loadPlaywright();
const browser = await chromium.launch();
for (const v of variants) { v.server = await serve(v.dir); v.samples = []; }

// Exécuté dans la page : joue un geste image par image et relève la durée de chaque image.
const gesture = async (kind) => {
  const svg = document.querySelector('#map'), r = svg.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, frames = [];
  const fire = (type, id, x, y) => svg.dispatchEvent(new PointerEvent(type, { pointerId: id, clientX: x, clientY: y, bubbles: true, pointerType: 'touch', isPrimary: id === 5 }));
  svg.setPointerCapture = () => {};
  const frame = () => new Promise((res) => requestAnimationFrame(res));
  await frame(); let last = performance.now();
  if (kind === 'pan') {
    fire('pointerdown', 5, cx, cy);
    for (let i = 1; i <= 90; i++) { fire('pointermove', 5, cx + Math.sin(i / 10) * 120, cy + Math.cos(i / 13) * 90); await frame(); const now = performance.now(); frames.push(now - last); last = now; }
    fire('pointerup', 5, cx + 300, cy + 300);
  } else {
    fire('pointerdown', 5, cx - 60, cy); fire('pointerdown', 6, cx + 60, cy);
    for (let i = 1; i <= 60; i++) { const d = 60 + 40 * Math.sin(i / 9); fire('pointermove', 5, cx - d, cy); fire('pointermove', 6, cx + d, cy); await frame(); const now = performance.now(); frames.push(now - last); last = now; }
    fire('pointerup', 6, cx + 60, cy); fire('pointerup', 5, cx + 300, cy + 300);
  }
  frames.sort((a, b) => a - b);
  return { median: frames[Math.floor(frames.length / 2)], p90: frames[Math.floor(frames.length * .9)], over33: frames.filter((f) => f > 33.4).length, n: frames.length };
};
try {
  for (let i = 0; i < runs; i++) {
    for (const v of variants) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, locale: 'fr-FR' });
      await context.route('**/*', (r) => (r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort()));
      const page = await context.newPage(), cdp = await context.newCDPSession(page);
      if (cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
      await cdp.send('Performance.enable');
      await page.goto(v.server.url, { waitUntil: 'load' });
      await page.waitForFunction(() => typeof journalReady !== 'undefined' && journalReady, null, { timeout: 60000 });
      await page.waitForTimeout(800);
      const metrics = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
      const run = async (kind) => { const a = await metrics(), g = await page.evaluate(gesture, kind), b = await metrics(); await page.waitForTimeout(400);
        return { ...g, taskPerFrame: (b.TaskDuration - a.TaskDuration) * 1000 / g.n, layoutPerFrame: (b.LayoutDuration - a.LayoutDuration) * 1000 / g.n, stylePerFrame: (b.RecalcStyleDuration - a.RecalcStyleDuration) * 1000 / g.n, scriptPerFrame: (b.ScriptDuration - a.ScriptDuration) * 1000 / g.n }; };
      const sample = { panOverview: await run('pan'), pinch: await run('pinch') };
      await page.evaluate(() => { const p = PTS.find((x) => x.n === 'Lyon') || PTS[10]; flyTo(p, 260); }); await page.waitForTimeout(500);
      sample.panClose = await run('pan');
      v.samples.push(sample);
      await context.close();
    }
  }
} finally { await browser.close(); for (const v of variants) await v.server.close(); }
const gestures = ['panOverview', 'panClose', 'pinch'], keys = ['median', 'p90', 'over33', 'taskPerFrame', 'layoutPerFrame', 'stylePerFrame', 'scriptPerFrame'];
const report = { generatedAt: new Date().toISOString(), runs, cpu, viewport: '390x844', load1: Number(os.loadavg()[0].toFixed(2)),
  variants: variants.map((v) => ({ name: v.name, median: Object.fromEntries(gestures.map((g) => [g, Object.fromEntries(keys.map((k) => [k, med(v.samples.map((s) => s[g][k]))]))])), samples: v.samples })) };
if (out) writeJson(path.resolve(out), report);
console.log(`mobile 390×844, processeur ×${cpu}, ${runs} passages en alternance, charge ${report.load1} — médianes, en ms par image`);
for (const g of gestures) {
  console.log(`\n${g}`.padEnd(15) + keys.map((k) => k.padStart(16)).join(''));
  for (const v of report.variants) console.log(v.name.padEnd(14) + keys.map((k) => String(v.median[g][k]).padStart(16)).join(''));
}
