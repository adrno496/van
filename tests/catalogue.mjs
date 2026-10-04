// Tests du catalogue enrichi (lot v10) : données, construction, et usage réel dans le Planner.
//   node tests/catalogue.mjs [--dir <dossier servi>] [--public <Planner public>] [--out <rapport.json>] [--batch v10]
// Données : scripts/places/validate.mjs (quotas pays par pays, identifiants, QID, coordonnées, pays, catégories, format,
// fiches d'origine inchangées, provenance, confidentialité). Navigateur : les nouveaux lieux se trouvent, se filtrent,
// s'ajoutent au trajet, s'ouvrent par lien profond ; la carte reste lisible dans les pays les plus denses.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT, loadPlaywright, serve, openApp, writeJson, shippedCatalogue } from './lib/harness.mjs';

const args = process.argv.slice(2), opt = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
const dir = path.resolve(opt('--dir', ROOT)), publicDir = path.resolve(opt('--public', path.join(ROOT, 'dist/public/app')));
const out = path.resolve(opt('--out', 'test-results/catalogue.json')), BATCH = opt('--batch', 'v10');
const results = [], measures = {};
const assert = (c, m) => { if (!c) throw new Error(m); };
const eq = (a, b, m) => assert(JSON.stringify(a) === JSON.stringify(b), `${m} — attendu ${JSON.stringify(b)}, obtenu ${JSON.stringify(a)}`.slice(0, 500));
const node = (...a) => spawnSync(process.execPath, a, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 << 20 });
const CAT = shippedCatalogue(dir), FRESH = CAT.lieux.filter((p) => p.batch === BATCH);
// Échantillon réparti : un nouveau lieu sur ~60, dans l'ordre des identifiants (donc de tous les pays).
const SAMPLE = FRESH.filter((_, k) => k % Math.max(1, Math.floor(FRESH.length / 30)) === 0).slice(0, 30);

async function test(name, fn) {
  const t0 = Date.now();
  try { await fn(); results.push({ name, status: 'PASS', ms: Date.now() - t0 }); console.log(`PASS  ${name}`); }
  catch (e) { results.push({ name, status: 'FAIL', ms: Date.now() - t0, error: String(e.message).slice(0, 800) }); console.log(`FAIL  ${name}\n        ${String(e.message).split('\n')[0].slice(0, 400)}`); }
}

/* ── Données et construction ── */
await test('données : validate.mjs — quotas, identifiants, QID, coordonnées, pays, catégories, format, provenance, public', async () => {
  const r = node('scripts/places/validate.mjs', '--batch', BATCH, '--quiet', '--out', path.join(os.tmpdir(), 'atlas-validate.json'));
  const rep = JSON.parse(fs.readFileSync(path.join(os.tmpdir(), 'atlas-validate.json'), 'utf8'));
  measures.validate = { errors: rep.errors.length, warnings: rep.warnings.length, total: rep.info.total, fresh: rep.info.fresh, collisions: rep.info.collisions.length };
  assert(r.status === 0, 'validate.mjs : ' + rep.errors.slice(0, 5).join(' | '));
});
await test('construction : Planner personnel et public avec le catalogue enrichi (≥ 3 200 lieux)', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-cat-'));
  for (const mode of ['personal', 'public']) {
    const t0 = Date.now(), r = node('build.mjs', '--mode', mode, '--out', path.join(tmp, mode + '.html'));
    assert(r.status === 0, `build ${mode} : ${(r.stderr || r.stdout).trim().slice(0, 300)}`);
    measures['build_' + mode + '_ms'] = Date.now() - t0;
  }
  const per = shippedCatalogue(path.join(tmp, 'personal.html')), pub = shippedCatalogue(path.join(tmp, 'public.html'));
  assert(per.places >= 3200, 'catalogue personnel : ' + per.places);
  eq([pub.bases, pub.places], [0, per.places - per.bases], 'public : aucune base, tout le reste');
  assert(pub.lieux.filter((p) => p.batch === BATCH).length === per.lieux.filter((p) => p.batch === BATCH).length, 'public : toutes les nouvelles fiches');
  measures.places = { personal: per.places, public: pub.places, fresh: FRESH.length };
});
await test('site : pages destinations et compteurs suivent le catalogue', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-site-'));
  const r = node('build.mjs', '--mode', 'public', '--dir', tmp, '--content', path.join(ROOT, 'tests/fixtures/content'));
  assert(r.status === 0, 'construction du site : ' + (r.stderr || r.stdout).slice(0, 300));
  const pub = shippedCatalogue(path.join(tmp, 'app')), fmt = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const home = fs.readFileSync(path.join(tmp, 'index.html'), 'utf8');
  assert(new RegExp(String(pub.places).replace(/\B(?=(\d{3})+(?!\d))/g, '[\\s\\u00a0\\u202f]')).test(home), 'accueil : nombre de lieux ' + fmt(pub.places) + ' absent');
  assert(!/1[\s  ]?600 lieux|1[\s  ]?595 lieux/.test(home), 'accueil : ancien nombre de lieux encore écrit');
  const counts = {}; for (const p of pub.lieux) counts[p.p] = (counts[p.p] || 0) + 1;
  for (const [p, slug] of [['Italie', 'italie'], ['France', 'france'], ['Espagne', 'espagne'], ['Andorre', 'andorre']]) {
    const html = fs.readFileSync(path.join(tmp, 'destinations', slug, 'index.html'), 'utf8');
    assert(new RegExp(String(counts[p]).replace(/\B(?=(\d{3})+(?!\d))/g, '[\\s\\u00a0\\u202f]') + ' lieux').test(html), `${p} : « ${counts[p]} lieux » absent de la page destination`);
    assert(html.includes(`app/index.html#pays=${slug}`), `${p} : lien vers le Planner filtré absent`);
  }
  const sitemap = fs.existsSync(path.join(tmp, 'sitemap.xml')) ? fs.readFileSync(path.join(tmp, 'sitemap.xml'), 'utf8') : '';
  measures.site = { pages: fs.readdirSync(path.join(tmp, 'destinations')).length, sitemap: !!sitemap };
});

/* ── Navigateur ── */
const pw = loadPlaywright(), browser = await pw.chromium.launch(), server = await serve(dir);
const ready = (page) => page.waitForFunction(() => typeof journalReady !== 'undefined' && journalReady === true, null, { timeout: 20000 });
async function withApp(viewport, fn, options = {}) {
  const a = await openApp(browser, server.url + (options.hash || ''), viewport, options);
  try { await fn(a); } finally { await a.context.close(); }
}

await test('démarrage : tous les lieux chargés et dessinés, aucune erreur', () => withApp('desktop-1440x900', async ({ page, errors }) => {
  const s = await page.evaluate(() => ({ pts: PTS.length, nodes: document.querySelectorAll('#map .poi').length, ready: performance.getEntriesByName('atlas:boot-end')[0]?.startTime || null }));
  eq([s.pts, s.nodes], [CAT.places, CAT.places], 'lieux et marqueurs'); eq(errors, [], 'erreurs');
  measures.readyMs = s.ready;
}));

await test(`recherche : ${SAMPLE.length} nouveaux lieux, répartis dans tous les pays, se trouvent par leur nom`, () => withApp('desktop-1440x900', async ({ page }) => {
  const missing = [], times = [];
  for (const L of SAMPLE) {
    const r = await page.evaluate(({ n, i }) => { const q = document.querySelector('#q'); q.value = n; const t0 = performance.now(); runSearch(); const ms = performance.now() - t0;
      return { ms, found: [...document.querySelectorAll('#res [data-s]')].some((d) => d.dataset.s === String(i)) }; }, { n: L.n, i: L.i });
    times.push(r.ms); if (!r.found) missing.push(`${L.i} ${L.n}`);
  }
  measures.searchMs = { median: +times.sort((a, b) => a - b)[times.length >> 1].toFixed(2), max: +Math.max(...times).toFixed(2) };
  eq(missing, [], 'introuvables');
  // Et la fiche s'ouvre depuis la liste de résultats, avec la mention sur les coordonnées.
  const L = SAMPLE[0];
  await page.fill('#q', L.n); await page.locator(`#res [data-s="${L.i}"]`).click(); await page.waitForSelector('#detail h2');
  assert((await page.locator('#detail h2').innerText()).includes(L.n), 'fiche du nouveau lieu');
  assert(/Coordonnées de repérage/.test(await page.locator('#detail').innerText()), 'mention « coordonnées de repérage »');
  assert(await page.locator('#detail a[href*="google.com/maps"]').count() > 0, 'lien Google Maps');
}));

await test('filtre pays : Italie, France, Espagne et petits pays — la carte et la liste ne montrent que ce pays', () => withApp('desktop-1440x900', async ({ page }) => {
  const counts = {}; for (const p of CAT.lieux) counts[p.p] = (counts[p.p] || 0) + 1;
  const bases = (p) => CAT.lieux.filter((l) => l.c === 'base' && l.p !== p).length;   // les bases restent visibles
  measures.filterMs = {};
  for (const p of ['Italie', 'France', 'Espagne', 'Andorre', 'Luxembourg']) {
    const s = await page.evaluate((p) => { const sel = document.querySelector('#paysSel'); sel.value = p; const t0 = performance.now(); sel.dispatchEvent(new Event('change')); const ms = performance.now() - t0;
      return { ms, shown: PTS.filter((L) => !L._off).length, other: PTS.filter((L) => !L._off && L.p !== p && L.c !== 'base').length, list: document.querySelector('#discoveryCount').textContent }; }, p);
    eq([s.shown, s.other], [counts[p] + bases(p), 0], `${p} : lieux affichés`);
    measures.filterMs[p] = +s.ms.toFixed(1);
  }
}));

await test('« Ajouter tout un pays » : les incontournables d\'Italie, de France et d\'Espagne entrent dans le trajet', () => withApp('desktop-1440x900', async ({ page, errors }) => {
  measures.addCountry = {};
  for (const p of ['Italie', 'France', 'Espagne']) {
    const want = CAT.lieux.filter((L) => L.p === p && L.w === 1).length;
    const s = await page.evaluate((p) => { route.length = 0; paint(); const sel = document.querySelector('#paysSel'); sel.value = p; sel.dispatchEvent(new Event('change'));
      const t0 = performance.now(); document.querySelector('#addTop').click(); return { ms: performance.now() - t0, n: route.length, all: route.every((i) => byId[i].p === p && byId[i].w === 1) }; }, p);
    eq([s.n, s.all], [want, true], `${p} : incontournables ajoutés`);
    measures.addCountry[p] = { steps: s.n, ms: +s.ms.toFixed(1) };
  }
  eq(errors, [], 'erreurs');
}));

await test('liens profonds : #pays=, #lieu= et #q= vers de nouveaux lieux', async () => {
  const L = SAMPLE[Math.min(5, SAMPLE.length - 1)];
  await withApp('desktop-1440x900', async ({ page }) => { eq(await page.evaluate(() => paysF), 'Italie', '#pays=italie'); }, { hash: '#pays=italie' });
  await withApp('desktop-1440x900', async ({ page }) => { await page.waitForSelector('#detail h2'); eq(await page.evaluate(() => sel), L.i, '#lieu=' + L.i); }, { hash: '#lieu=' + L.i });
  await withApp('desktop-1440x900', async ({ page }) => {
    eq(await page.evaluate((i) => [...document.querySelectorAll('#res [data-s]')].some((d) => d.dataset.s === String(i)), L.i), true, '#q=' + L.n);
  }, { hash: '#q=' + encodeURIComponent(L.n.slice(0, 60)) });
});

await test('carte lisible : noms limités et sans chevauchement en vue d\'ensemble et dans les pays denses (Italie, France, Espagne)', () => withApp('desktop-1440x900', async ({ page }) => {
  measures.labels = {};
  const look = async (label) => {
    await page.waitForTimeout(350);
    const s = await page.evaluate(() => {
      const boxes = [...document.querySelectorAll('#map text.lbl')].filter((t) => t.style.display !== 'none').map((t) => t.getBoundingClientRect());
      let overlaps = 0;
      // Recouvrement réel : plus de 30 % de la hauteur du texte et plus de 4 px de large. Le contact de quelques pixels
      // entre les boîtes des glyphes (accents, jambages) de deux lignes voisines n'empêche pas de lire (déjà le cas avant le lot).
      for (let a = 0; a < boxes.length; a++) for (let b = a + 1; b < boxes.length; b++) {
        const A = boxes[a], B = boxes[b], w = Math.min(A.right, B.right) - Math.max(A.left, B.left), h = Math.min(A.bottom, B.bottom) - Math.max(A.top, B.top);
        if (w > 4 && h > 0.3 * Math.min(A.height, B.height)) overlaps++;
      }
      return { shown: boxes.length, overlaps, markers: PTS.filter((L) => !L._off).length };
    });
    measures.labels[label] = s;
    assert(s.shown <= 220, `${label} : ${s.shown} noms affichés`); assert(s.overlaps === 0, `${label} : ${s.overlaps} noms se chevauchent`);
  };
  await look('europe');
  for (const p of ['Italie', 'France', 'Espagne']) { await page.evaluate((p) => fitPts(PTS.filter((L) => L.p === p), .18), p); await look(p); }
  await page.evaluate(() => { const L = PTS.find((p) => p.p === 'Italie' && p.n === 'Florence') || PTS.find((p) => p.p === 'Italie'); flyTo(L, 60); }); await look('Italie zoomée');
}));

await test('Explorer : « Voir 24 lieux de plus » et « Nouveautés » montrent le nouveau lot', () => withApp('desktop-1440x900', async ({ page }) => {
  const s = await page.evaluate(() => { tab('p1'); renderDiscovery(); const a = document.querySelectorAll('#discoverList article').length; document.querySelector('#discoverMore').click(); const b = document.querySelectorAll('#discoverList article').length;
    document.querySelector('#onlyNew').click(); return { a, b, count: document.querySelector('#discoveryCount').textContent, batch: NEWEST_BATCH }; });
  eq([s.a, s.b], [24, 48], 'liste'); eq(s.batch, BATCH, 'lot des nouveautés');
  assert(new RegExp('^' + String(FRESH.length).replace(/\B(?=(\d{3})+(?!\d))/g, '[\\s\\u00a0\\u202f]')).test(s.count), 'nouveautés : ' + s.count);
}));

await test('« Près de moi » : les nouveaux lieux voisins sont proposés', async () => {
  const L = SAMPLE[Math.min(10, SAMPLE.length - 1)];
  await withApp('mobile-390x844', async ({ page }) => {
    await page.evaluate(() => { openAround(); });
    await page.waitForFunction(() => geoPosition, null, { timeout: 8000 });
    const s = await page.evaluate((i) => ({ ids: nearbyPlaces().map((p) => p.i), summary: document.querySelector('#aroundSummary').textContent }), L.i);
    assert(s.ids.includes(L.i), `${L.n} absent de « Près de moi » : ${s.summary}`);
  }, { geolocation: { latitude: L.y, longitude: L.x, accuracy: 30 }, permissions: ['geolocation'] });
});

await test('mobile : carte dense de l\'Italie utilisable (filtre, zoom, aperçu d\'un nouveau lieu)', () => withApp('mobile-390x844', async ({ page, errors }) => {
  const L = FRESH.find((p) => p.p === 'Italie') || FRESH[0];
  await page.evaluate((i) => { const sel = document.querySelector('#paysSel'); sel.value = 'Italie'; sel.dispatchEvent(new Event('change')); setMobileView('map'); flyTo(byId[i], 40); show(i); }, L.i);
  await page.waitForTimeout(300);
  const s = await page.evaluate(() => ({ sel }));
  eq(s.sel, L.i, 'lieu choisi'); eq(errors, [], 'erreurs');
}));

if (fs.existsSync(path.join(publicDir, 'index.html'))) {
  await test('version publique : nouvelles fiches présentes, aucune base', async () => {
    const pub = shippedCatalogue(publicDir);
    eq([pub.bases, pub.lieux.filter((p) => p.batch === BATCH).length], [0, FRESH.length], 'public');
  });
}

await server.close(); await browser.close();
const pass = results.filter((r) => r.status === 'PASS').length;
writeJson(out, { dir, batch: BATCH, generatedAt: new Date().toISOString(), measures, results });
console.log(`\ncatalogue : ${pass}/${results.length} PASS${results.length - pass ? `, ${results.length - pass} FAIL` : ''} → ${path.relative(process.cwd(), out)}`);
console.log('mesures : ' + JSON.stringify(measures));
process.exitCode = pass === results.length ? 0 : 1;
