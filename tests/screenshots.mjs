// Captures de référence des écrans clés, à chaque largeur cible.
//   node tests/screenshots.mjs <dossier-de-sortie> [--dir <dossier servi>] [--only <viewport,...>]
// Les écrans sont atteints par l'API interne de l'application (show, tab…) : les mêmes appels
// fonctionnent sur la baseline et sur la version refondue, ce qui rend les captures comparables.
import path from 'node:path';
import fs from 'node:fs';
import { ROOT, loadPlaywright, serve, openApp, VIEWPORTS, writeJson } from './lib/harness.mjs';

const args = process.argv.slice(2);
const opt = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
const outDir = path.resolve(args[0] && !args[0].startsWith('--') ? args[0] : 'test-results/screenshots');
const dir = path.resolve(opt('--dir', ROOT));
const only = opt('--only', null)?.split(',');
fs.mkdirSync(outDir, { recursive: true });

const SCREENS = [
  ['01-carte', async () => {}],
  ['02-fiche-lieu', async (page) => { await page.evaluate(() => { const p = PTS.find((x) => x.n === 'Paris') || PTS[0]; show(p.i); }); }],
  ['03-idees-parcours', async (page) => { await page.evaluate(() => tab('p3')); }],
  ['04-trajet', async (page) => { await page.evaluate(() => { document.querySelector('#presets [data-pr]').click(); tab('p2'); }); }],
  ['05-carte-avec-trajet', async (page) => { await page.evaluate(() => { document.body.classList.remove('preset-preview'); setMobileView('map'); }); }],
  ['06-carnet-vide', async (page) => { await page.evaluate(() => tab('pBlog')); }],
  ['07-carnet-editeur', async (page) => { await page.evaluate(() => openJournalEditor()); }],
  ['08-parametres', async (page) => { await page.evaluate(async () => { await closeJournalEditor(); openAtlasSettings(); }); }],
  ['09-filtres', async (page) => { await page.evaluate(() => { document.querySelector('dialog[open]')?.close(); openMapFilters(); }); }],
  ['10-recherche', async (page) => { await page.evaluate(() => { document.querySelector('dialog[open]')?.close(); setMobileView('map'); }); await page.fill('#q', 'lac'); }]
];

const { chromium } = loadPlaywright();
const server = await serve(dir);
const browser = await chromium.launch();
const report = { dir, url: server.url, generatedAt: new Date().toISOString(), shots: [], errors: {} };
try {
  for (const name of Object.keys(VIEWPORTS)) {
    if (only && !only.some((o) => name.includes(o))) continue;
    const { context, page, errors } = await openApp(browser, server.url, name);
    for (const [screen, go] of SCREENS) {
      try {
        await go(page);
        await page.waitForTimeout(350);
        const file = path.join(outDir, `${name}__${screen}.png`);
        await page.screenshot({ path: file });
        const overflow = await page.evaluate(() => ({ scrollW: document.documentElement.scrollWidth, clientW: document.documentElement.clientWidth }));
        report.shots.push({ viewport: name, screen, file: path.relative(ROOT, file), horizontalOverflowPx: Math.max(0, overflow.scrollW - overflow.clientW) });
      } catch (e) { report.shots.push({ viewport: name, screen, error: String(e.message).split('\n')[0] }); }
    }
    if (errors.length) report.errors[name] = errors;
    await context.close();
  }
} finally { await browser.close(); await server.close(); }
writeJson(path.join(outDir, 'screenshots.json'), report);
const failed = report.shots.filter((s) => s.error);
console.log(`${report.shots.length - failed.length}/${report.shots.length} captures → ${outDir}`);
for (const f of failed) console.log(`  ÉCHEC ${f.viewport} ${f.screen}: ${f.error}`);
for (const s of report.shots.filter((x) => x.horizontalOverflowPx)) console.log(`  débordement horizontal ${s.horizontalOverflowPx}px : ${s.viewport} ${s.screen}`);
for (const [v, e] of Object.entries(report.errors)) console.log(`  erreurs console ${v}: ${e.slice(0, 3).join(' | ')}`);
