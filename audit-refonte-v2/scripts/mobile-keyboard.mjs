// Champs de saisie sur mobile (taille de texte, donc pas de zoom forcé sur iOS) et clavier virtuel simulé par réduction de la hauteur visible.
//   node audit-refonte-v2/scripts/mobile-keyboard.mjs   (depuis la racine du projet) — émulation Chromium et WebKit, pas un appareil réel.
import { loadPlaywright, serve, openApp } from '../../tests/lib/harness.mjs';
const { chromium, webkit } = loadPlaywright(); const server = await serve(process.cwd());
const out = {};
for (const [name, type] of [['chromium', chromium], ['webkit', webkit]]) {
  const browser = await type.launch(); const { page, errors } = await openApp(browser, server.url, 'mobile-390x844');
  await page.evaluate(() => { show(PTS.find((p) => p.n === 'Paris').i, { full: true }); });
  const fields = await page.evaluate(() => { const r = {}; for (const s of ['#q', '#discoverQuery', '#nTxt', '#nBud', '#nDate']) { const e = document.querySelector(s); if (e) r[s] = parseFloat(getComputedStyle(e).fontSize); } return r; });
  await page.evaluate(() => { tab('pBlog'); openJournalEditor(); }); await page.waitForTimeout(300);
  Object.assign(fields, await page.evaluate(() => { const r = {}; for (const s of ['#postTitle', '#postText', '#postDate', '#postPlaceSearch']) { const e = document.querySelector(s); if (e) r[s] = parseFloat(getComputedStyle(e).fontSize); } return r; }));
  // Clavier virtuel simulé : la hauteur visible tombe à 844 - 336 ; le champ actif et le bouton d'enregistrement restent-ils atteignables ?
  await page.setViewportSize({ width: 390, height: 508 }); await page.locator('#postText').focus(); await page.waitForTimeout(300);
  const kb = await page.evaluate(() => { const a = document.activeElement.getBoundingClientRect(), s = document.querySelector('#savePost'); s.scrollIntoView({ block: 'nearest' }); const b = s.getBoundingClientRect(); return { fieldVisible: a.top >= 0 && a.top < innerHeight, saveReachable: b.top >= 0 && b.bottom <= innerHeight + 1, overflowX: document.documentElement.scrollWidth - innerWidth }; });
  await page.setViewportSize({ width: 390, height: 844 }); await page.evaluate(() => closeJournalEditor()); await page.waitForTimeout(300);
  await page.evaluate(() => { setMobileView('map'); document.querySelector('#q').focus(); document.querySelector('#q').value = 'lac'; document.querySelector('#q').dispatchEvent(new Event('input')); });
  await page.setViewportSize({ width: 390, height: 508 }); await page.waitForTimeout(300);
  const search = await page.evaluate(() => { const r = document.querySelector('#res').getBoundingClientRect(), first = document.querySelector('#res [data-s]').getBoundingClientRect(); return { resultsVisible: first.top >= 0 && first.bottom <= innerHeight, listFits: r.bottom <= innerHeight + 1 || getComputedStyle(document.querySelector('#res')).overflowY !== 'visible' }; });
  out[name] = { fields, minFont: Math.min(...Object.values(fields)), kb, search, errors }; await browser.close();
}
console.log(JSON.stringify(out, null, 1)); await server.close();
