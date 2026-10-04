// Captures du site éditorial.   node tests/site-shots.mjs <dossier de sortie> [--dir dist/personal] [--only accueil,destination] [--widths 1440,390]
import path from 'node:path';
import fs from 'node:fs';
import { loadPlaywright, serve } from './lib/harness.mjs';
const args = process.argv.slice(2), opt = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
const out = path.resolve(args[0] && !args[0].startsWith('--') ? args[0] : 'test-results/site-shots'), dir = path.resolve(opt('--dir', 'dist/personal'));
const only = opt('--only', null)?.split(','), widths = opt('--widths', '1440,820,390').split(',').map(Number), full = !args.includes('--fold');
const firstDir = (d) => fs.existsSync(path.join(dir, d)) ? fs.readdirSync(path.join(dir, d), { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name) : [];
const PAGES = [['accueil', 'index.html'], ['destinations', 'destinations/index.html'], ['destination', 'destinations/italie/index.html'], ['road-trips', 'road-trips/index.html'], ['road-trip', 'road-trips/balkans-en-six-semaines/index.html'],
  ['voyages', 'voyages/index.html'], ['voyage', firstDir('voyages')[0] ? `voyages/${firstDir('voyages')[0]}/index.html` : null], ['carnet', 'carnet/index.html'], ['article', firstDir('carnet')[0] ? `carnet/${firstDir('carnet')[0]}/index.html` : null],
  ['guides', 'guides/index.html'], ['guide', 'guides/regles-et-couts-par-pays/index.html'], ['a-propos', 'a-propos/index.html'], ['recherche', 'recherche/index.html'], ['404', '404.html']].filter((p) => p[1]);
fs.mkdirSync(out, { recursive: true });
const { chromium } = loadPlaywright(); const server = await serve(dir); const browser = await chromium.launch(); let n = 0;
for (const w of widths) {
  const ctx = await browser.newContext({ viewport: { width: w, height: w < 700 ? 844 : w < 1100 ? 1180 : 900 }, deviceScaleFactor: w < 700 ? 2 : 1, isMobile: w < 700, hasTouch: w < 1100, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  for (const [name, file] of PAGES) { if (only && !only.includes(name)) continue; await page.goto(server.url + file, { waitUntil: 'load' }); await page.waitForTimeout(150); await page.screenshot({ path: path.join(out, `${name}-${w}.png`), fullPage: full }); n++; }
  await ctx.close();
}
await browser.close(); await server.close(); console.log(`${n} captures → ${out}`);
