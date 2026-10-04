// Observation de principes généraux (structure, proportions) d'un site de référence. Aucune copie de texte, d'image ou de code :
// seules des mesures chiffrées sont produites ; les captures servent à un coup d'œil et sont supprimées ensuite.
import { loadPlaywright } from '../../tests/lib/harness.mjs';
const { chromium } = loadPlaywright(); const browser = await chromium.launch(); const out = {};
for (const [name, vp] of [['desktop', { width: 1440, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
  const ctx = await browser.newContext({ viewport: vp, isMobile: name === 'mobile', hasTouch: name === 'mobile', deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  try {
    const res = await page.goto('https://www.valenvan.com/', { waitUntil: 'domcontentloaded', timeout: 30000 }); await page.waitForTimeout(3500);
    out[name] = await page.evaluate(() => {
      const vw = innerWidth, vh = innerHeight, H = document.documentElement.scrollHeight;
      const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
      const media = [...document.querySelectorAll('img, video, picture, [style*="background-image"]')].filter(vis);
      const big = media.filter((e) => { const r = e.getBoundingClientRect(); return r.width >= vw * .45; });
      const fold = media.reduce((a, e) => { const r = e.getBoundingClientRect(); const w = Math.max(0, Math.min(r.right, vw) - Math.max(r.left, 0)), h = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0)); return a + w * h; }, 0);
      const nav = document.querySelector('header nav, nav');
      const words = (document.body.innerText || '').trim().split(/\s+/).length;
      const fonts = [...new Set([...document.querySelectorAll('h1,h2,h3,p,a')].slice(0, 200).map((e) => getComputedStyle(e).fontFamily.split(',')[0].replace(/["']/g, '').trim()))].length;
      const h1 = document.querySelector('h1'), p = document.querySelector('p');
      return { pageHeightScreens: +(H / vh).toFixed(1), mediaCount: media.length, wideMediaCount: big.length, foldMediaShare: +Math.min(1, fold / (vw * vh)).toFixed(2), navEntries: nav ? nav.querySelectorAll('a').length : null,
        headings: { h1: document.querySelectorAll('h1').length, h2: document.querySelectorAll('h2').length, h3: document.querySelectorAll('h3').length }, words, wordsPerScreen: Math.round(words / (H / vh)), sections: document.querySelectorAll('section, main > div, article').length,
        fontFamiliesCount: fonts, h1SizePx: h1 ? parseFloat(getComputedStyle(h1).fontSize) : null, bodySizePx: p ? parseFloat(getComputedStyle(p).fontSize) : null, videos: document.querySelectorAll('video, iframe').length,
        hasCarousel: !!document.querySelector('[class*="carousel"],[class*="slider"],[class*="swiper"]'), cards: document.querySelectorAll('article, [class*="card"]').length, thirdPartyScripts: [...document.scripts].filter((s) => s.src && !s.src.includes(location.hostname)).length };
    });
    out[name].status = res.status();
    await page.screenshot({ path: `/tmp/atlas-ref-${name}-fold.png` });
    if (name === 'desktop') { await page.evaluate(() => scrollTo(0, innerHeight * 1.6)); await page.waitForTimeout(1200); await page.screenshot({ path: '/tmp/atlas-ref-desktop-mid.png' }); }
  } catch (e) { out[name] = { error: String(e.message).split('\n')[0] }; }
  await ctx.close();
}
await browser.close(); console.log(JSON.stringify(out, null, 1));
