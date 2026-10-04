// Contrôles d'interface : mesures de mise en page comparables entre deux versions, puis parcours réels
// au pointeur et au clavier propres à la nouvelle interface.
//   node tests/ui.mjs [--dir <dossier servi>] [--out <rapport.json>] [--label <nom>]
import path from 'node:path';
import { ROOT, loadPlaywright, serve, openApp, VIEWPORTS, writeJson } from './lib/harness.mjs';

const args = process.argv.slice(2);
const opt = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
const dir = path.resolve(opt('--dir', ROOT));
const out = path.resolve(opt('--out', 'test-results/ui.json'));
const label = opt('--label', path.basename(dir));
const results = [], metrics = {};
const assert = (c, m) => { if (!c) throw new Error(m); };
const eq = (a, b, m) => assert(JSON.stringify(a) === JSON.stringify(b), `${m} — attendu ${JSON.stringify(b)}, obtenu ${JSON.stringify(a)}`);
const settle = (page, ms = 150) => page.waitForTimeout(ms);

// Mesures prises dans la page sur l'écran courant.
const measure = (page) => page.evaluate(() => {
  const vw = document.documentElement.clientWidth, vh = document.documentElement.clientHeight;
  const visible = (e) => { const r = e.getBoundingClientRect(), s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw && !e.closest('[inert]') && (!e.checkVisibility || e.checkVisibility({ visibilityProperty: true, contentVisibilityAuto: true })); };
  const top = (e) => { const r = e.getBoundingClientRect(), x = Math.min(vw - 1, Math.max(0, r.left + r.width / 2)), y = Math.min(vh - 1, Math.max(0, r.top + r.height / 2)), hit = document.elementFromPoint(x, y); return !!hit && (e.contains(hit) || hit.contains(e)); };
  const controls = [...document.querySelectorAll('button,a[href],input:not([type=hidden]),select,textarea,summary,[role=button],[role=tab],[role=option]')].filter((e) => visible(e) && top(e) && !e.closest('svg#map'));
  const name = (e) => (e.id ? '#' + e.id : e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.split(' ')[0] : '')) + ' « ' + (e.getAttribute('aria-label') || e.textContent || e.placeholder || '').trim().slice(0, 28) + ' »';
  const size = (e) => { const r = e.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; };
  // Une case à cocher ou un bouton radio dans un libellé : la cible est le libellé entier.
  const target = (e) => (e.matches('input[type=checkbox],input[type=radio]') && e.closest('label')) || e;
  const below = (min) => controls.filter((e) => { const [w, h] = size(target(e)); return w < min || h < min; }).map((e) => name(e) + ' ' + size(target(e)).join('×'));
  const texts = [...document.querySelectorAll('body *')].filter((e) => visible(e) && !e.closest('svg') && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()));
  const fontSizes = [...new Set(texts.map((e) => Math.round(parseFloat(getComputedStyle(e).fontSize) * 10) / 10))].sort((a, b) => a - b);
  const colors = new Set(texts.map((e) => getComputedStyle(e).color));
  const map = document.querySelector('#map').getBoundingClientRect(), header = document.querySelector('.top').getBoundingClientRect();
  const mapVisible = getComputedStyle(document.querySelector('.mapwrap')).visibility !== 'hidden';
  const over = [...document.querySelectorAll('.mapwrap button, .mapwrap summary, .mapwrap .peek, .mapwrap .scale, .mapwrap .ui, .mapwrap .map-hint')].filter((e) => visible(e) && !e.closest('svg') && !(e.matches('button,summary') && e.parentElement.closest('.peek,.ui,.map-hint'))).reduce((a, e) => { const r = e.getBoundingClientRect(); return a + Math.max(0, Math.min(r.right, map.right) - Math.max(r.left, map.left)) * Math.max(0, Math.min(r.bottom, map.bottom) - Math.max(r.top, map.top)); }, 0);
  const clipped = controls.filter((e) => e.matches('button,[role=tab]') && e.scrollWidth > e.clientWidth + 1).map(name);
  return { viewport: [vw, vh], horizontalOverflowPx: Math.max(0, document.documentElement.scrollWidth - vw), headerHeight: Math.round(header.height), mapShareOfScreen: mapVisible ? Number((map.width * map.height / (vw * vh)).toFixed(3)) : 0,
    mapCoveredByControls: mapVisible && map.width ? Number((over / (map.width * map.height)).toFixed(3)) : 0, visibleControls: controls.length, below24: below(24), below44: below(44), fontSizes, textColors: colors.size, minFontSize: fontSizes[0], clippedLabels: clipped };
});

const { chromium } = loadPlaywright();
const server = await serve(dir);
const browser = await chromium.launch();
async function test(group, title, fn) {
  const t0 = Date.now(); let status = 'PASS', detail = '';
  try { await fn(); } catch (e) { status = 'FAIL'; detail = String(e.message).split('\n')[0].slice(0, 500); }
  results.push({ group, title, status, detail, ms: Date.now() - t0 });
  console.log(`${status}  ${group} › ${title}${detail ? '\n        ' + detail : ''}`);
}

try {
  // ── 1. Mesures à chaque largeur, sur les écrans principaux ─────────────────────────────────────────
  const SCREENS = { carte: () => { setMobileView('map'); }, explorer: () => { document.body.classList.remove('has-place'); renderDiscovery(); tab('p1'); }, trajet: () => { document.querySelector('#presets [data-pr]').click(); document.body.classList.remove('preset-preview'); tab('p2'); }, idees: () => tab('p3'), carnet: () => tab('pBlog'), plus: () => { tab('p4'); document.querySelectorAll('#p4 details').forEach((d) => { d.open = true; }); }, filtres: () => { if (typeof openMapFilters === 'function') openMapFilters(); }, parametres: () => { document.querySelectorAll('dialog[open]').forEach((d) => d.close()); openAtlasSettings(); document.querySelectorAll('dialog[open] details').forEach((d) => { d.open = true; }); }, fiche: () => { document.querySelectorAll('dialog[open]').forEach((d) => d.close()); setMobileView('panel'); show(PTS.find((p) => p.n === 'Paris').i); if (document.querySelector('#peekOpen')) document.querySelector('#peekOpen').click(); } };
  for (const vp of Object.keys(VIEWPORTS)) {
    const app = await openApp(browser, server.url, vp);
    metrics[vp] = {};
    for (const [screen, go] of Object.entries(SCREENS)) { await app.page.evaluate(go); await settle(app.page, 300); metrics[vp][screen] = await measure(app.page); }
    const all = Object.entries(metrics[vp]);
    await test('mise-en-page', `${vp} : aucun débordement horizontal`, async () => eq(all.filter(([, m]) => m.horizontalOverflowPx).map(([s, m]) => `${s} +${m.horizontalOverflowPx}px`), [], 'écrans qui débordent'));
    await test('mise-en-page', `${vp} : aucune commande sous 24 × 24 px`, async () => eq([...new Set(all.flatMap(([, m]) => m.below24))], [], 'commandes trop petites'));
    if (VIEWPORTS[vp].touch) await test('mise-en-page', `${vp} : commandes tactiles d'au moins 44 px`, async () => eq([...new Set(all.flatMap(([, m]) => m.below44))].slice(0, 8), [], 'commandes sous 44 px'));
    await test('mise-en-page', `${vp} : aucun libellé de bouton tronqué`, async () => eq([...new Set(all.flatMap(([, m]) => m.clippedLabels))], [], 'libellés tronqués'));
    await test('mise-en-page', `${vp} : texte d'au moins 12 px, champs d'au moins 16 px`, async () => {
      assert(Math.min(...all.map(([, m]) => m.minFontSize)) >= 12, 'plus petit texte : ' + Math.min(...all.map(([, m]) => m.minFontSize)) + ' px');
      const small = await app.page.evaluate(() => [...document.querySelectorAll('input:not([type=checkbox]):not([type=range]):not([type=file]),select,textarea')].filter((e) => parseFloat(getComputedStyle(e).fontSize) < 16).map((e) => e.id));
      eq(small, [], 'champs sous 16 px (zoom automatique sur iOS)');
    });
    if (app.errors.length) results.push({ group: 'mise-en-page', title: `${vp} : console sans erreur`, status: 'FAIL', detail: app.errors.slice(0, 3).join(' | ') });
    await app.context.close();
  }

  const isNew = await (async () => { const a = await openApp(browser, server.url, 'desktop-1440x900'); const v = await a.page.evaluate(() => !!document.querySelector('#peek')); await a.context.close(); return v; })();
  if (isNew) {
    // ── 2. Clavier, sur grand écran ──────────────────────────────────────────────────────────────────
    const d = await openApp(browser, server.url, 'desktop-1440x900');
    const page = d.page, focusId = () => page.evaluate(() => document.activeElement.id || document.activeElement.className || document.activeElement.tagName);
    await test('clavier', 'lien d\'évitement en premier, puis recherche', async () => {
      await page.keyboard.press('Tab'); eq(await page.evaluate(() => document.activeElement.className), 'skip-link', 'premier arrêt');
      assert(await page.evaluate(() => { const r = document.activeElement.getBoundingClientRect(); return r.top >= 0 && r.left >= 0; }), 'lien d\'évitement visible au focus');
      await page.keyboard.press('Enter'); await settle(page); eq(await focusId(), 'main', 'le lien amène au contenu');
      await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Shift+Tab');
    });
    await test('clavier', 'un seul titre de niveau 1, un seul contenu principal', async () => eq(await page.evaluate(() => [document.querySelectorAll('h1').length, document.querySelectorAll('main').length, document.documentElement.lang, document.documentElement.dir]), [1, 1, 'fr', 'ltr'], 'structure'));
    await test('clavier', 'onglets : flèches, sélection annoncée', async () => {
      await page.focus('#tab-p1'); await page.keyboard.press('ArrowRight'); await settle(page);
      eq(await page.evaluate(() => [document.activeElement.id, document.querySelector('.pane.on').id, document.querySelector('#tab-p2').getAttribute('aria-selected'), document.querySelector('#tab-p1').getAttribute('aria-selected')]), ['tab-p2', 'p2', 'true', 'false'], 'flèche droite');
      await page.keyboard.press('End'); await settle(page); eq(await page.evaluate(() => document.querySelector('.pane.on').id), 'p4', 'touche Fin'); await page.keyboard.press('Home'); await settle(page);
    });
    await test('clavier', 'carte : flèches pour déplacer, + et − pour zoomer', async () => {
      await page.focus('#map'); const a = await page.evaluate(() => vb.slice()); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowDown'); await settle(page);
      const b = await page.evaluate(() => vb.slice()); assert(b[0] > a[0] && b[1] > a[1], 'la vue se déplace'); await page.keyboard.press('+'); await settle(page); assert((await page.evaluate(() => vb[2])) < b[2], 'zoom au clavier');
    });
    await test('clavier', 'dialogue des filtres : focus retenu, Échap, retour du focus', async () => {
      await page.focus('#mapFiltersButton'); await page.keyboard.press('Enter'); await settle(page, 250);
      // Un dialogue modal natif rend le reste de la page inerte : la tabulation ne peut atteindre que le dialogue ou l'interface du navigateur.
      const stops = new Set(); for (let i = 0; i < 40; i++) { await page.keyboard.press('Tab'); const where = await page.evaluate(() => { const a = document.activeElement; return a === document.body || a === document.documentElement ? 'navigateur' : document.querySelector('#filtersDialog').contains(a) ? 'dialogue' : 'page:' + (a.id || a.tagName); }); stops.add(where); }
      eq([...stops].filter((s) => s.startsWith('page:')), [], 'éléments de la page atteints derrière le dialogue'); assert(stops.has('dialogue'), 'le dialogue reçoit le focus');
      await page.keyboard.press('Escape'); await settle(page, 200); eq(await page.evaluate(() => [document.querySelector('#filtersDialog').open, document.activeElement.id]), [false, 'mapFiltersButton'], 'fermeture et retour du focus');
    });
    await test('clavier', 'bascules annoncées (aria-pressed) et filtre synchronisé', async () => {
      await page.evaluate(() => document.querySelector('.map-chips [data-cat="nature"]').click());
      eq(await page.evaluate(() => [...document.querySelectorAll('[data-cat="nature"]')].map((b) => b.getAttribute('aria-pressed') + '/' + b.classList.contains('on'))), ['false/false', 'false/false'], 'les deux pastilles « Nature » suivent le même état');
      await page.evaluate(() => document.querySelector('#clearExplore').click());
    });
    await test('clavier', 'menu des outils de la carte : ouverture, Échap', async () => {
      await page.locator('#mapToolsButton').click(); assert(await page.locator('#addPt').isVisible(), 'menu ouvert'); eq(await page.getAttribute('#mapToolsButton', 'aria-expanded'), 'true', 'état annoncé'); await page.keyboard.press('Escape'); await settle(page);
      eq(await page.evaluate(() => [document.querySelector('#mapToolsMenu').hidden, document.activeElement.id]), [true, 'mapToolsButton'], 'menu refermé par Échap, focus rendu');
    });
    await test('parcours', 'ajouter mon lieu : bandeau d\'aide, annulation possible', async () => {
      await page.locator('#mapToolsButton').click(); await page.locator('#addPt').click(); await settle(page);
      assert(/placer votre lieu/.test(await page.locator('#mapHint').innerText()), 'bandeau affiché'); await page.locator('#mapHint button').click(); await settle(page);
      eq(await page.evaluate(() => [addMode, !!document.querySelector('#mapHint')]), [false, false], 'mode annulé');
    });
    await test('parcours', 'bouton de la fiche fidèle au trajet (ajouter / retirer)', async () => {
      await page.evaluate(() => { route = []; paint(); show(PTS.find((p) => p.n === 'Paris').i); });
      assert(/Ajouter au trajet/.test(await page.locator('#addBtn').innerText()), 'libellé initial'); await page.locator('#addBtn').click(); await settle(page);
      assert(/Retirer du trajet/.test(await page.locator('#addBtn').innerText()), 'le bouton devient « Retirer »'); await page.locator('#addBtn').click(); await settle(page);
      eq(await page.evaluate(() => route.length), 0, 'retrait effectif');
    });
    await test('parcours', 'guide pratique et données atteignables depuis « Plus »', async () => {
      await page.locator('#tab-p4').click(); assert(await page.locator('#backupAllFromInfo').isVisible(), 'sauvegarde complète visible sans dépliage');
      await page.locator('#p4 summary', { hasText: 'Fiches pays' }).click(); assert(await page.locator('#metaTab').isVisible(), 'fiches pays');
      await page.locator('#p4 summary', { hasText: 'Checklist' }).click(); assert(await page.locator('#check').isVisible(), 'checklist');
      await page.locator('#p4 summary', { hasText: 'Autres options' }).click(); assert(await page.locator('#bkReset').isVisible() && await page.locator('#bkExp').isVisible(), 'sauvegarde légère et réinitialisation');
    });
    await test('parcours', 'recherche le long du trajet : liens, aucune fenêtre ouverte d\'office', async () => {
      let popups = 0; d.context.on('page', () => popups++);
      await page.evaluate(() => { document.querySelector('#presets [data-pr]').click(); tab('p2'); document.querySelector('#gmapSearch').click(); }); await settle(page, 250);
      await page.locator('dialog[open] [data-dialog-input]').fill('laverie'); await page.locator('dialog[open] [data-dialog-ok]').click(); await settle(page, 250);
      const links = await page.evaluate(() => [...document.querySelectorAll('#alongRoute a')].map((a) => a.href)); const steps = await page.evaluate(() => route.length); assert(steps > 10 && links.length === steps && links.every((h) => /google\.com\/maps\/search/.test(h) && /laverie/.test(h)), 'un lien par étape : ' + links.length); eq(popups, 0, 'fenêtres ouvertes');
    });
    await test('accessibilite', 'mouvement réduit respecté', async () => {
      const c = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' }); const p = await c.newPage(); await p.goto(server.url); await p.waitForFunction(() => typeof journalReady !== 'undefined' && journalReady);
      const dur = await p.evaluate(() => Math.max(...[...document.querySelectorAll('.btn,.toast,.chip,#tip')].map((e) => parseFloat(getComputedStyle(e).transitionDuration) || 0))); await c.close(); assert(dur <= 0.001, 'transition la plus longue : ' + dur + ' s');
    });
    await test('accessibilite', 'zoom navigateur 200 % (1280 × 720) : utilisable sans défilement horizontal', async () => {
      const c = await browser.newContext({ viewport: { width: 640, height: 360 } }); const p = await c.newPage(); await p.goto(server.url); await p.waitForFunction(() => typeof journalReady !== 'undefined' && journalReady);
      for (const go of ['setMobileView("map")', 'tab("p2")', 'tab("p4")']) { await p.evaluate(go); await p.waitForTimeout(150); eq(await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 0, 'débordement avec ' + go); }
      assert(await p.locator('.mobile-nav').isVisible() && await p.locator('#q').isVisible(), 'navigation et recherche visibles'); await c.close();
    });
    if (d.errors.length) results.push({ group: 'clavier', title: 'console sans erreur', status: 'FAIL', detail: d.errors.slice(0, 3).join(' | ') });
    await d.context.close();

    // ── 3. Petit écran : aperçu d'un lieu sur la carte ───────────────────────────────────────────────
    const m = await openApp(browser, server.url, 'mobile-390x844'); const mp = m.page;
    await test('mobile', 'aperçu du lieu : la carte reste visible, ajout en un geste', async () => {
      const id = await mp.evaluate(() => PTS.find((p) => p.n === 'Lisbonne').i); await mp.evaluate((i) => flyTo(byId[i], 8), id); await settle(mp, 400);
      const pt = await mp.evaluate((i) => { const p = byId[i], r = document.querySelector('#map').getBoundingClientRect(); return { x: r.left + (p.px - vb[0]) / vb[2] * r.width, y: r.top + (p.py - vb[1]) / vb[3] * r.height }; }, id);
      await mp.touchscreen.tap(pt.x, pt.y); await settle(mp, 300);
      const chooser = mp.locator(`dialog[open] [data-choice="${id}"]`); if (await chooser.count()) { await chooser.tap(); await settle(mp, 250); }
      assert(await mp.locator('#peek').isVisible(), 'aperçu affiché'); eq(await mp.evaluate(() => [document.body.dataset.mobileView, getComputedStyle(document.querySelector('.mapwrap')).visibility]), ['map', 'visible'], 'carte toujours à l\'écran');
      await mp.locator('#peekAdd').tap(); await settle(mp); eq(await mp.evaluate(() => route.length), 1, 'ajout depuis l\'aperçu'); assert(/Retirer/.test(await mp.locator('#peekAdd').innerText()), 'le bouton reflète l\'ajout');
      eq(await mp.evaluate(() => document.querySelector('#navCnt').textContent), '1', 'compteur dans la navigation');
      await mp.locator('#peekClose').tap(); await settle(mp); eq(await mp.evaluate(() => [document.querySelector('#peek').hidden, sel]), [true, null], 'aperçu refermé');
    });
    await test('mobile', 'recherche : résultat choisi, carte centrée et aperçu', async () => {
      await mp.locator('#q').fill('porto'); await settle(mp); await mp.locator('#res [data-s]').first().tap(); await settle(mp, 300);
      eq(await mp.evaluate(() => [document.body.dataset.mobileView, !document.querySelector('#peek').hidden, document.querySelector('#res').classList.contains('on')]), ['map', true, false], 'carte, aperçu, résultats refermés');
    });
    await test('mobile', 'idée de parcours : carte et liste visibles ensemble', async () => {
      await mp.locator('.mobile-nav [data-p="p3"]').tap(); await settle(mp, 200); await mp.locator('#presets [data-pr]').first().tap(); await settle(mp, 400);
      const s = await mp.evaluate(() => { const m = document.querySelector('.mapwrap').getBoundingClientRect(), p = document.querySelector('.panel').getBoundingClientRect(); return { preview: document.body.classList.contains('preset-preview'), map: Math.round(m.height), panel: Math.round(p.height), overlap: m.bottom > p.top + 1 }; });
      assert(s.preview && s.map > 150 && s.panel > 250 && !s.overlap, 'aperçu partagé : ' + JSON.stringify(s)); assert(await mp.locator('#presetFeedback').isVisible(), 'retour sur le parcours choisi');
    });
    await test('mobile', 'dialogue en bas d\'écran : un toucher ne le referme pas aussitôt', async () => {
      await mp.locator('.mobile-nav [data-mobile="map"]').tap(); await settle(mp, 250); await mp.locator('#mapFiltersButton').tap(); await settle(mp, 500);
      eq(await mp.evaluate(() => document.querySelector('#filtersDialog').open), true, 'dialogue resté ouvert'); await mp.locator('#applyMapFilters').tap(); await settle(mp, 200);
    });
    if (m.errors.length) results.push({ group: 'mobile', title: 'console sans erreur', status: 'FAIL', detail: m.errors.slice(0, 3).join(' | ') });
    await m.context.close();
  }
} finally { await browser.close(); await server.close(); }

const pass = results.filter((r) => r.status === 'PASS').length;
writeJson(out, { label, dir, generatedAt: new Date().toISOString(), totals: { tests: results.length, pass, fail: results.length - pass }, results, metrics });
const mm = metrics['mobile-390x844']?.carte, dm = metrics['desktop-1440x900']?.carte;
console.log(`\n${label} : ${pass}/${results.length} PASS`);
if (mm && dm) console.log(`carte mobile 390 : en-tête ${mm.headerHeight}px, carte ${Math.round(mm.mapShareOfScreen * 100)} % de l'écran, ${Math.round(mm.mapCoveredByControls * 100)} % couverte, ${mm.visibleControls} commandes · carte 1440 : ${Math.round(dm.mapShareOfScreen * 100)} %, ${dm.visibleControls} commandes, ${dm.fontSizes.length} tailles de texte`);
process.exitCode = results.length - pass ? 1 : 0;
