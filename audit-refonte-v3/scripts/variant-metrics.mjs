// Mesures comparées des directions visuelles du site (une version construite par direction).
//   node audit-refonte-v3/scripts/variant-metrics.mjs --variants A=<dossier>,B=<dossier>,C=<dossier> [--out rapport.json]
// Par direction, à 1440 × 900 et 390 × 844 : ce que montre le premier écran (mots, appels à l'action, part de l'image),
// la longueur de la page, les débordements, les cibles tactiles, et les contrastes des couples texte / fond réellement rendus
// (couleurs lues dans le navigateur, rapport calculé par contrastRatio de CREATIVE_ENGINE_V9).
import path from 'node:path';
import { loadPlaywright, serve, writeJson } from '../../tests/lib/harness.mjs';
const CE = process.env.CREATIVE_ENGINE || '/Users/dreano/Downloads/CREATIVE_ENGINE_V9';
const { contrastRatio } = await import(path.join(CE, 'src/color-engine.mjs'));
const args = process.argv.slice(2), opt = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
const variants = opt('--variants', '').split(',').filter(Boolean).map((v) => { const [name, dir] = v.split('='); return { name, dir: path.resolve(dir) }; });
const out = opt('--out', null);
// Couleur calculée par le navigateur → #rrggbb. Deux écritures possibles : rgb(…) et color(srgb …) (résultat d'un color-mix).
const hex = (c) => { let m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(c), v = m ? m.slice(1, 4).map(Number) : null;
  if (!v) { m = /color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)/.exec(c); v = m ? m.slice(1, 4).map((x) => Math.round(Number(x) * 255)) : null; }
  return v ? '#' + v.map((x) => x.toString(16).padStart(2, '0')).join('') : null; };
// Couples à contrôler : [nom, sélecteur, seuil, page].
const PAIRS = [['texte courant', '.section-lead', 4.5, 'index.html'], ['titre de section', '.section-title', 3, 'index.html'], ['titre de première page', '.hero-title', 3, 'index.html'], ['accent du titre de première page', '.hero-title em', 3, 'index.html'],
  ['phrase de première page', '.hero-lead', 4.5, 'index.html'], ['surtitre de première page', '.hero .eyebrow', 4.5, 'index.html'], ['bouton principal de première page', '.hero .btn-primary', 4.5, 'index.html'], ['bouton secondaire de première page', '.hero .btn-ghost', 4.5, 'index.html'],
  ['lien de navigation', '.nav-link', 4.5, 'index.html'], ['bouton « Préparer mon voyage » (en-tête)', '.head-row .btn-cta', 4.5, 'index.html'], ['étiquette', '.badge', 4.5, 'index.html'], ['titre de carte', '.card-title', 3, 'index.html'], ['métadonnées de carte', '.card-meta', 4.5, 'index.html'],
  ['texte de bandeau', '.band p', 4.5, 'index.html'], ['titre de bandeau', '.band-title', 3, 'index.html'], ['bouton de bandeau', '.band .btn', 4.5, 'index.html'], ['lien « tous les… »', '.more', 4.5, 'index.html'], ['pied de page', '.foot-brand p', 4.5, 'index.html'],
  ['navigation intérieure', '.nav-link', 4.5, 'destinations/italie/index.html'], ['chapeau de page', '.page-lead', 4.5, 'destinations/italie/index.html'], ['libellé de fait', '.facts dt', 4.5, 'destinations/italie/index.html'], ['note sur un fait', '.facts small', 4.5, 'destinations/italie/index.html'],
  ['bouton principal', '.detail-intro .btn-primary', 4.5, 'destinations/italie/index.html'], ['mise en garde', '.caveat', 4.5, 'destinations/italie/index.html'], ['lien dans le texte', '.stop-link', 4.5, 'destinations/italie/index.html'], ['fil d’Ariane', '.crumbs a', 4.5, 'destinations/italie/index.html']];
const { chromium } = loadPlaywright(); const browser = await chromium.launch(); const report = { generatedAt: new Date().toISOString(), variants: {} };
for (const v of variants) {
  const server = await serve(v.dir); const r = { screens: {}, contrast: [] };
  for (const [name, vp] of [['ordinateur', { width: 1440, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
    const ctx = await browser.newContext({ viewport: vp, isMobile: name === 'mobile', hasTouch: name === 'mobile', deviceScaleFactor: 1, reducedMotion: 'reduce' }); const page = await ctx.newPage();
    await page.goto(server.url + 'index.html', { waitUntil: 'load' });
    r.screens[name] = await page.evaluate(() => {
      const vh = innerHeight, vw = innerWidth, visible = (e) => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0 && b.top < vh && b.bottom > 0; };
      const words = (root) => { let n = 0; const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); while (w.nextNode()) { const p = w.currentNode.parentElement; if (!p || p.closest('script,style,dialog,.sr-only,svg')) continue; const b = p.getBoundingClientRect(); if (b.width && b.top < vh && b.bottom > 0 && getComputedStyle(p).visibility !== 'hidden') n += w.currentNode.textContent.trim().split(/\s+/).filter(Boolean).length; } return n; };
      const hero = document.querySelector('.hero').getBoundingClientRect(), art = document.querySelector('.hero-art').getBoundingClientRect();
      const cta = [...document.querySelectorAll('a.btn')].filter(visible), planner = [...document.querySelectorAll('a[href*="app/index.html"]')].filter(visible);
      const firstCard = document.querySelector('.card'), targets = [...document.querySelectorAll('a,button')].filter((e) => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0 && getComputedStyle(e).visibility !== 'hidden' && !e.closest('dialog:not([open])'); });
      const small = targets.filter((e) => { const b = e.getBoundingClientRect(); return b.height < 44 && !e.closest('p,.prose,li:not(.reveal)'); });
      return { motsPremierEcran: words(document.body), hauteurPremierePage: +(hero.height / vh).toFixed(2), partImagePremierEcran: +(Math.max(0, Math.min(art.bottom, vh) - Math.max(art.top, 0)) * Math.min(art.width, vw) / (vw * vh)).toFixed(2),
        boutonsPremierEcran: cta.length, accesPlannerPremierEcran: planner.length, positionPremiereCarte: firstCard ? Math.round(firstCard.getBoundingClientRect().top) : null, hauteurPageEnEcrans: +(document.documentElement.scrollHeight / vh).toFixed(1),
        debordementHorizontal: Math.max(0, document.documentElement.scrollWidth - vw), ciblesSous44: small.length, ciblesMin: Math.round(Math.min(...targets.map((e) => e.getBoundingClientRect().height))),
        taillesDeTexte: new Set([...document.querySelectorAll('h1,h2,h3,p,a,li,dt,dd,span')].map((e) => Math.round(parseFloat(getComputedStyle(e).fontSize)))).size, noeuds: document.getElementsByTagName('*').length, tailleTitre: Math.round(parseFloat(getComputedStyle(document.querySelector('.hero-title')).fontSize)) };
    });
    if (name === 'ordinateur') for (const [use, sel, min, file] of PAIRS) {
      await page.goto(server.url + file, { waitUntil: 'load' });
      const c = await page.evaluate((sel) => { const e = document.querySelector(sel); if (!e) return null; const s = getComputedStyle(e); let n = e, bg = 'rgba(0, 0, 0, 0)';
        while (n && /rgba\(0, 0, 0, 0\)|transparent/.test(bg)) { bg = getComputedStyle(n).backgroundColor; n = n.parentElement; }
        return { fg: s.color, bg, size: parseFloat(s.fontSize), weight: s.fontWeight }; }, sel);
      if (!c) continue;
      const fg = hex(c.fg), bg = hex(c.bg), ratio = fg && bg ? Number(contrastRatio(fg, bg).toFixed(2)) : null;
      const large = c.size >= 24 || (c.size >= 18.66 && Number(c.weight) >= 700), need = large ? 3 : min;
      r.contrast.push({ use, fg, bg, ratio, required: need, status: ratio != null && ratio >= need ? 'PASS' : 'FAIL' });
    }
    await ctx.close();
  }
  r.contrastSummary = { pairs: r.contrast.length, pass: r.contrast.filter((c) => c.status === 'PASS').length, minText: Math.min(...r.contrast.filter((c) => c.required === 4.5).map((c) => c.ratio)), fail: r.contrast.filter((c) => c.status !== 'PASS') };
  report.variants[v.name] = r; await server.close();
}
await browser.close();
if (out) writeJson(path.resolve(out), report);
for (const [name, r] of Object.entries(report.variants)) { console.log(`\n== ${name}`); console.log(' ordinateur', JSON.stringify(r.screens.ordinateur)); console.log(' mobile    ', JSON.stringify(r.screens.mobile)); console.log(' contrastes', r.contrastSummary.pass + '/' + r.contrastSummary.pairs, 'min texte', r.contrastSummary.minText, JSON.stringify(r.contrastSummary.fail)); }
