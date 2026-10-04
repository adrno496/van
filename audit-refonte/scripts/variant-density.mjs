// Mesures de densité et de hiérarchie pour comparer des variantes de thème (mêmes écrans, mêmes données).
//   node audit-refonte/scripts/variant-density.mjs <dossier A> <dossier B> ...
import { loadPlaywright, serve, openApp } from '../../tests/lib/harness.mjs';
const { chromium } = loadPlaywright();
const browser = await chromium.launch(); const out = {};
for (const dir of process.argv.slice(2)) {
  const server = await serve(dir); const row = {};
  for (const vp of ['mobile-390x844', 'desktop-1440x900']) {
    const { page, context } = await openApp(browser, server.url, vp);
    row[vp] = await page.evaluate(async () => {
      const vh = document.documentElement.clientHeight, inView = (e) => { const r = e.getBoundingClientRect(); return r.top >= 0 && r.bottom <= vh; };
      const wait = () => new Promise((r) => setTimeout(r, 250));
      const res = {};
      document.querySelector('#presets [data-pr]').click(); document.body.classList.remove('preset-preview'); tab('p2'); await wait();
      res.trajet = { premiereEtapeTopPx: Math.round(document.querySelector('#list .item').getBoundingClientRect().top), etapesEntieresVisibles: [...document.querySelectorAll('#list .item')].filter(inView).length };
      document.body.classList.remove('has-place'); renderDiscovery(); tab('p1'); await wait();
      res.explorer = { lieuxEntiersVisibles: [...document.querySelectorAll('#discoverList article')].filter(inView).length };
      show(PTS.find((p) => p.n === 'Paris').i, { full: true }); await wait();
      res.fiche = { actionPrincipaleTopPx: Math.round(document.querySelector('#addBtn').getBoundingClientRect().top), hauteurEnTetePx: Math.round(document.querySelector('.place-head').getBoundingClientRect().height) };
      tab('p3'); await wait();
      res.idees = { parcoursEntiersVisibles: [...document.querySelectorAll('#presets [data-pr]')].filter(inView).length };
      const body = getComputedStyle(document.body);
      res.texte = { taillePx: parseFloat(body.fontSize), interligne: Number((parseFloat(body.lineHeight) / parseFloat(body.fontSize)).toFixed(2)), hauteurCommandePx: Math.round(document.querySelector('#addTop').getBoundingClientRect().height) || null };
      return res;
    });
    await context.close();
  }
  await server.close(); out[dir.split('/').slice(-1)[0]] = row;
}
await browser.close();
process.stdout.write(JSON.stringify(out, null, 2) + '\n');
