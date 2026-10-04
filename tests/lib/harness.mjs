// Outillage commun des tests navigateur d'Atlas van.
// Playwright n'est pas une dépendance du projet : il est résolu depuis PLAYWRIGHT_FROM
// (par défaut l'installation de CREATIVE_ENGINE_V9), puis depuis le projet lui-même.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export function loadPlaywright() {
  const bases = [process.env.PLAYWRIGHT_FROM, '/Users/dreano/Downloads/CREATIVE_ENGINE_V9/', ROOT + '/'].filter(Boolean);
  for (const base of bases) {
    try { return createRequire(base.endsWith('/') ? base : base + '/')('playwright'); } catch { /* base suivante */ }
  }
  throw new Error('Playwright introuvable : définir PLAYWRIGHT_FROM=<dossier contenant node_modules/playwright>');
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };

// Serveur statique en boucle locale, limité au dossier servi.
export function serve(dir) {
  const root = path.resolve(dir);
  const server = http.createServer((req, res) => {
    let rel;
    try { rel = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { res.writeHead(400).end(); return; }
    if (rel.endsWith('/')) rel += 'index.html';
    const file = path.resolve(root, '.' + rel);
    if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    fs.readFile(file, (err, buf) => {
      if (err) { res.writeHead(404).end('not found'); return; }
      res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(buf);
    });
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({
    url: `http://127.0.0.1:${server.address().port}/`, close: () => new Promise((r) => server.close(r))
  })));
}

export const VIEWPORTS = {
  'desktop-1440x900': { width: 1440, height: 900 },
  'laptop-1280x800': { width: 1280, height: 800 },
  'tablet-1024x768': { width: 1024, height: 768 },
  'tablet-tactile-1024x768': { width: 1024, height: 768, touch: true, mobile: true },
  'tablet-768x1024': { width: 768, height: 1024, touch: true },
  'mobile-430x932': { width: 430, height: 932, touch: true, mobile: true },
  'mobile-390x844': { width: 390, height: 844, touch: true, mobile: true },
  'mobile-360x800': { width: 360, height: 800, touch: true, mobile: true },
  'mobile-320x568': { width: 320, height: 568, touch: true, mobile: true }
};

// Ouvre l'application dans un contexte neuf (stockage vide) et collecte les erreurs de console et de page.
// Les polices distantes sont bloquées par défaut : rendu reproductible, aucun appel réseau pendant les tests.
export async function openApp(browser, url, viewportName, { blockRemote = true, geolocation = null, permissions = [], storageState } = {}) {
  const v = VIEWPORTS[viewportName] || viewportName;
  const context = await browser.newContext({
    viewport: { width: v.width, height: v.height }, deviceScaleFactor: v.mobile ? 2 : 1, hasTouch: !!v.touch, isMobile: !!v.mobile,
    locale: 'fr-FR', timezoneId: 'Europe/Paris', acceptDownloads: true, ...(geolocation ? { geolocation } : {}), permissions, ...(storageState ? { storageState } : {})
  });
  const remote = [];
  await context.route('**/*', (route) => {
    const u = route.request().url();
    if (u.startsWith('http://127.0.0.1') || u.startsWith('data:') || u.startsWith('blob:')) return route.continue();
    remote.push(u);
    return blockRemote ? route.abort() : route.continue();
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/net::ERR_FAILED|Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });
  await page.goto(url, { waitUntil: 'load' });
  // Le carnet s'ouvre de façon asynchrone (IndexedDB) : on attend qu'il soit prêt.
  await page.waitForFunction(() => typeof journalReady !== 'undefined' && journalReady === true, null, { timeout: 15000 });
  return { context, page, errors, remote };
}

export function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
}

// Catalogue réellement livré dans un Planner construit (index.html autonome, ou variante à fichiers séparés) :
// les tests comparent ce que la page affiche à ce que le fichier contient, quelle que soit la taille du catalogue.
export function shippedCatalogue(dirOrFile) {
  const file = dirOrFile.endsWith('.html') ? dirOrFile : path.join(dirOrFile, 'index.html');
  const html = fs.readFileSync(file, 'utf8');
  const m = html.match(/<script type="application\/json" id="atlasData">([\s\S]*?)<\/script>/);
  let data;
  if (m) data = JSON.parse(m[1]);
  else {
    const js = fs.readFileSync(path.join(path.dirname(file), 'assets', 'places.js'), 'utf8');
    data = JSON.parse(js.slice(js.indexOf('{'), js.lastIndexOf('}') + 1));
  }
  return { places: data.lieux.length, bases: data.lieux.filter((p) => p.c === 'base').length, lieux: data.lieux, parcours: data.parcours };
}
// Écriture des nombres dans l'interface : « 3 412 », avec une espace (insécable ou non) entre les milliers.
export const countPattern = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
