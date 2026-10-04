// Tests du cycle V2 : marqueurs et formes, bouton « retour » mobile, sécurité étendue, endurance et mémoire, version publique.
//   node tests/v2.mjs [--dir <dossier servi>] [--public <dossier de la version publique>] [--out <rapport.json>] [--only <groupe,...>]
// Complète tests/e2e.mjs (77 tests de non-régression, inchangés) sans le remplacer.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, loadPlaywright, serve, openApp, writeJson, shippedCatalogue, countPattern } from './lib/harness.mjs';

const args = process.argv.slice(2);
const opt = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
const dir = path.resolve(opt('--dir', ROOT));
const publicDir = path.resolve(opt('--public', path.join(ROOT, 'dist/public/app')));   // le Planner de la version publique (node build.mjs --mode public)
// Nombre de lieux de la version publique : celui que contient son fichier (1 595 avant le lot v10).
const PUB = fs.existsSync(path.join(publicDir, 'index.html')) ? shippedCatalogue(publicDir).places : 0, PUBRE = new RegExp(countPattern(PUB));
const out = path.resolve(opt('--out', 'test-results/v2.json'));
const only = opt('--only', null)?.split(',');

const results = [], measures = {};
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };
const eq = (a, b, msg) => assert(JSON.stringify(a) === JSON.stringify(b), `${msg} — attendu ${JSON.stringify(b)}, obtenu ${JSON.stringify(a)}`);
const ev = (page, fn, arg) => page.evaluate(fn, arg);
const settle = (page, ms = 150) => page.waitForTimeout(ms);
const ready = (page) => page.waitForFunction(() => typeof journalReady !== 'undefined' && journalReady === true, null, { timeout: 20000 });
const closeDialogs = (page) => ev(page, () => document.querySelectorAll('dialog[open]').forEach((d) => d.close()));
const X = '<img src=x onerror="window.__xss=(window.__xss||0)+1">';
const PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const fileOf = (name, value) => ({ name, mimeType: 'application/json', buffer: Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)) });
// Restaure une sauvegarde par l'interface (rubrique Plus) et attend le rechargement s'il a lieu.
async function restore(page, payload, { expectReload = true } = {}) {
  const nav = expectReload ? page.waitForNavigation({ waitUntil: 'load', timeout: 8000 }).catch(() => null) : null;
  await page.setInputFiles('#bkImp', fileOf('sauvegarde.json', payload)); await settle(page, 300);
  const ok = page.locator('dialog[open] [data-dialog-ok]');
  const asked = await ok.count();
  if (asked) await ok.first().click();
  if (nav) { await nav; await ready(page).catch(() => {}); }
  await settle(page, 400);
  return asked > 0;
}
const toastText = (page) => ev(page, () => document.querySelector('#toast')?.textContent || '');

const GROUPS = {};
const group = (name, viewport, options, tests) => { GROUPS[name] = { viewport, options, tests }; };

/* ───────────── Marqueurs : un élément par lieu, une forme par catégorie ───────────── */
group('marqueurs', 'desktop-1440x900', {}, {
  'un seul élément SVG par lieu, noms dans un calque à part': async ({ page }) => {
    const s = await ev(page, () => ({ markers: document.querySelectorAll('#map .poi').length, inside: document.querySelectorAll('#map .poi *').length, pts: PTS.length, labels: document.querySelectorAll('#map text.lbl').length,
      shown: [...document.querySelectorAll('#map text.lbl')].filter((t) => t.style.display !== 'none').length, svg: document.querySelectorAll('#map *').length }));
    eq([s.markers, s.inside], [s.pts, 0], 'un élément par lieu, sans enfant'); assert(s.shown > 10 && s.labels < 400, `noms créés à la demande : ${s.labels} créés, ${s.shown} affichés`);
    assert(s.svg < s.pts + 700, `carte légère : ${s.svg} éléments SVG`); measures.svgNodes = s.svg;
  },
  'chaque catégorie a sa forme, sur la carte et dans la légende': async ({ page }) => {
    // Depuis le lot v10, chaque marqueur est dessiné en coordonnées de carte (sans « transform ») : sa forme est
    // retrouvée en ramenant le chemin à l'origine et au rayon 1, puis comparée d'une catégorie à l'autre.
    const shapes = await ev(page, () => { const o = {}; PTS.forEach((p) => { (o[p.c] = o[p.c] || new Set()).add(unitShape(p)); }); return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, [...v]])); });
    for (const [cat, list] of Object.entries(shapes)) eq(list.length, 1, `une seule forme pour « ${cat} »`);
    const distinct = new Set(Object.values(shapes).map((l) => l[0])); eq(distinct.size, Object.keys(shapes).length, 'formes toutes différentes');
    eq(await ev(page, () => Object.keys(SHAPES).sort()), ['base', 'boulot', 'nature', 'patrimoine', 'perso', 'plage', 'pratique', 'ville'], 'une forme prévue pour les 8 catégories');
    eq(await ev(page, () => PTS.filter((p) => unitShape(p) !== unitOf(SHAPES[p.c] || SHAPES.perso)).length), 0, 'chaque marqueur dessine exactement la forme de sa catégorie');
    const legend = await ev(page, () => ['ville', 'patrimoine', 'nature', 'plage', 'boulot', 'pratique', 'base', 'perso'].map((c) => { const i = document.createElement('i'); i.className = 'dot ' + c; document.body.appendChild(i); const s = getComputedStyle(i), v = [s.clipPath, s.borderRadius, s.borderTopWidth].join('|'); i.remove(); return v; }));
    eq(new Set(legend).size, 8, 'pastilles de légende toutes différentes par la forme');
  },
  'contour d\'épaisseur constante à l\'écran, sans non-scaling-stroke': async ({ page }) => {
    // L'épaisseur est en unités de carte (le marqueur n'est plus agrandi par « scale »), portée par le calque pour le cas
    // commun : on lit l'épaisseur effective du marqueur, px = épaisseur × W / largeur de la vue.
    const widthPx = () => ev(page, () => { const p = PTS.find((x) => x.n === 'Paris'), n = nodes[p.i]; return { px: +(parseFloat(getComputedStyle(n).strokeWidth) * W / vb[2]).toFixed(2), effect: getComputedStyle(n).vectorEffect }; });
    await ev(page, () => fitDefault()); await settle(page, 400); const a = await widthPx();
    await ev(page, () => { const p = PTS.find((x) => x.n === 'Paris'); flyTo(p, 120); }); await settle(page, 400); const b = await widthPx();
    eq([a.px, b.px, a.effect], [1.2, 1.2, 'none'], 'contour de 1,2 px en vue d\'ensemble et en vue rapprochée');
    await ev(page, () => fitDefault()); await settle(page, 300);
  },
  'survol : le lieu le plus proche est désigné, comme au clic': async ({ page }) => {
    await ev(page, () => { const p = PTS.find((x) => x.n === 'Paris'); flyTo(p, 60); }); await settle(page, 400);
    const at = await ev(page, () => { const p = PTS.find((x) => x.n === 'Paris'), r = document.querySelector('#map').getBoundingClientRect(); return { x: r.left + (p.px - vb[0]) / vb[2] * r.width, y: r.top + (p.py - vb[1]) / vb[3] * r.height, i: p.i }; });
    await page.mouse.move(at.x + 6, at.y + 5); await settle(page, 200);
    const s = await ev(page, (i) => ({ hov: nodes[i].classList.contains('hov'), tip: document.querySelector('#tip').classList.contains('on'), text: document.querySelector('#tip b')?.textContent, over: document.querySelector('#map').classList.contains('over') }), at.i);
    eq(s, { hov: true, tip: true, text: 'Paris', over: true }, 'survol');
    await page.mouse.move(at.x + 6, at.y + 5); await page.mouse.down(); await page.mouse.up(); await settle(page, 200);
    eq(await ev(page, () => [byId[sel]?.n, document.querySelector('#tip').classList.contains('on')]), ['Paris', false], 'le clic choisit le même lieu et retire l\'infobulle');
    await ev(page, () => { document.body.classList.remove('has-place'); fitDefault(); }); await settle(page, 300);
  },
  'catégorie modifiée : la forme et le halo suivent': async ({ page }) => {
    const r = await ev(page, () => { const p = PTS.find((x) => x.n === 'Paris'), before = nodes[p.i].getAttribute('d'), c = p.c; p.c = 'base'; redrawMarker(p); const mid = [unitShape(p) === unitOf(SHAPES.base), !!halos[p.i]]; p.c = c; redrawMarker(p); rescale();
      return { mid, back: nodes[p.i].getAttribute('d') === before, halo: !!halos[p.i] }; });
    eq(r, { mid: [true, true], back: true, halo: false }, 'forme et halo');
  }
});

/* ───────────── Bouton « retour » du téléphone ───────────── */
group('retour-mobile', 'mobile-390x844', {}, {
  'aperçu d\'un lieu : « retour » le referme, la page reste ouverte': async ({ page }) => {
    const url = page.url();
    await ev(page, () => show(PTS.find((p) => p.n === 'Paris').i)); await settle(page);
    eq(await ev(page, () => [!document.querySelector('#peek').hidden, backArmed]), [true, true], 'aperçu ouvert, retour armé');
    await page.goBack(); await settle(page, 250);
    eq([await ev(page, () => [document.querySelector('#peek').hidden, document.body.dataset.mobileView, typeof PTS]), page.url()], [[true, 'map', 'object'], url], 'aperçu fermé, application toujours là, adresse inchangée');
  },
  'fenêtre puis rubrique : un « retour » par niveau': async ({ page }) => {
    await ev(page, () => tab('p2')); await settle(page); await ev(page, () => openAtlasSettings()); await settle(page);
    await page.goBack(); await settle(page, 250); eq(await ev(page, () => [document.querySelectorAll('dialog[open]').length, document.body.dataset.mobileView]), [0, 'panel'], 'premier retour : la fenêtre se ferme');
    await page.goBack(); await settle(page, 250); eq(await ev(page, () => document.body.dataset.mobileView), 'map', 'second retour : la carte');
  },
  'éditeur du carnet : « retour » enregistre le brouillon et revient à la liste': async ({ page }) => {
    await ev(page, () => tab('pBlog')); await settle(page); await ev(page, () => openJournalEditor()); await settle(page, 250);
    await page.fill('#postTitle', 'Brouillon gardé par le retour'); await page.goBack(); await settle(page, 600);
    eq(await ev(page, () => [journalEditing, J.posts.some((p) => p.title === 'Brouillon gardé par le retour'), document.body.dataset.mobileView]), [false, true, 'panel'], 'brouillon enregistré, liste affichée');
    await page.goBack(); await settle(page, 250); eq(await ev(page, () => document.body.dataset.mobileView), 'map', 'retour suivant : la carte');
  },
  'retour à la carte par l\'interface : aucune entrée d\'historique en trop': async ({ page }) => {
    const before = await ev(page, () => history.length);
    for (let i = 0; i < 5; i++) { await ev(page, () => tab('p3')); await settle(page, 80); await page.locator('.mobile-nav [data-mobile]').tap(); await settle(page, 120); }
    const s = await ev(page, () => [history.length, backArmed, document.body.dataset.mobileView]); assert(s[0] <= before + 1, `historique : ${before} → ${s[0]} entrées après 5 allers-retours`); eq(s.slice(1), [false, 'map'], 'état');
  },
  'grand écran : l\'historique n\'est pas touché': async ({ browser, url }) => {
    const a = await openApp(browser, url, 'desktop-1440x900');
    try { const n = await ev(a.page, () => history.length); await ev(a.page, () => { tab('p2'); openAtlasSettings(); }); await settle(a.page); eq(await ev(a.page, () => [history.length, backArmed]), [n, false], 'aucune entrée ajoutée'); } finally { await a.context.close(); }
  }
});

/* ───────────── Sécurité : rejeu ciblé et cas hostiles supplémentaires ───────────── */
group('securite-etendue', 'desktop-1440x900', {}, {
  'liens : seuls http et https sont acceptés': async ({ page }) => {
    const r = await ev(page, () => ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', ' javascript:alert(1)', 'data:text/html,<script>1</script>', 'vbscript:x', 'file:///etc/passwd', 'blob:x', '//evil.example/x', 'ftp://x/y', 'https://example.org/a?b=1', 'http://example.org'].map((u) => safeURL(u)));
    eq(r, ['', '', '', '', '', '', '', '', '', 'https://example.org/a?b=1', 'http://example.org/'], 'protocoles');
    const hrefs = await ev(page, () => { show(PTS.find((p) => p.source) ? PTS.find((p) => p.source).i : PTS[0].i); return [...document.querySelectorAll('#detail a[href]')].map((a) => [new URL(a.href).protocol, a.rel]); });
    assert(hrefs.length > 0 && hrefs.every(([p, rel]) => /^https?:$/.test(p) && /noopener/.test(rel) && /noreferrer/.test(rel)), 'liens de la fiche : http(s), noopener, noreferrer');
  },
  'source d\'une fiche en « javascript: » : aucun lien produit': async ({ page }) => {
    const n = await ev(page, () => { const p = PTS.find((x) => x.source) || PTS[5], keep = p.source; p.source = 'javascript:window.__xss=1'; show(p.i); const bad = [...document.querySelectorAll('#detail a')].filter((a) => !/^https?:/.test(a.getAttribute('href') || '')).length; p.source = keep; show(p.i); return bad; });
    eq([n, await ev(page, () => window.__xss || 0)], [0, 0], 'liens non http(s) dans la fiche');
  },
  'carnet piégé (titre, texte, légende, lieu, auteur) : restauré comme du texte': async ({ page }) => {
    const journal = { version: 1, title: 'Carnet ' + X, subtitle: X, author: X, posts: [{ id: 'p1', title: 'Titre ' + X, text: 'Texte ' + X + '\n</p><script>window.__xss=1</script>', date: '2026-05-02', placeId: 'c9"><img src=x onerror="window.__xss=1">',
      location: { n: X, p: X, x: 2.3, y: 48.8 }, status: 'ready', photos: [{ src: PIXEL, caption: 'Légende ' + X }], created: 1, updated: 2 }] };
    assert(await restore(page, { app: 'atlas-van', version: 5, journal }, { expectReload: false }), 'confirmation demandée');
    await ev(page, () => { tab('pBlog'); }); await settle(page, 400);
    await ev(page, () => { document.querySelector('[data-read-post]').click(); }); await settle(page, 300);
    const s = await ev(page, () => ({ xss: window.__xss || 0, posts: J.posts.length, shown: document.querySelector('dialog[open] .post-text')?.textContent.includes('<script>'), imgs: document.querySelectorAll('dialog[open] img[onerror], #journalRoot img[onerror]').length, scripts: document.querySelectorAll('#journalRoot script, dialog script').length }));
    eq(s, { xss: 0, posts: 1, shown: true, imgs: 0, scripts: 0 }, 'carnet piégé'); await closeDialogs(page);
    await ev(page, () => { document.querySelector('[data-edit-post]').click(); }); await settle(page, 400);
    eq(await ev(page, () => [window.__xss || 0, document.querySelector('#postTitle').value.includes('<img')]), [0, true], 'éditeur : le texte piégé reste du texte'); await ev(page, () => closeJournalEditor()); await settle(page, 400);
  },
  'blog exporté depuis un carnet piégé : aucun script, aucun gestionnaire, texte échappé': async ({ page, context }) => {
    await ev(page, () => tab('pBlog')); await ev(page, () => document.querySelector('#journalExport').click()); await settle(page, 300);
    const [d] = await Promise.all([page.waitForEvent('download', { timeout: 8000 }), ev(page, () => document.querySelector('#exportJournalConfirm').click())]);
    const html = fs.readFileSync(await d.path(), 'utf8');
    assert(!/<script/i.test(html), 'aucune balise script'); assert(html.includes('&lt;img src=x onerror='), 'texte piégé échappé');
    assert(/Content-Security-Policy" content="default-src 'none'/.test(html), 'politique de sécurité du blog exporté'); await closeDialogs(page);
    // Le fichier exporté est ouvert pour de bon : c'est le navigateur qui dit s'il contient un élément actif.
    const blog = await context.newPage();
    try { await blog.setContent(html, { waitUntil: 'load' }); await blog.waitForTimeout(300);
      const s = await blog.evaluate(() => ({ xss: window.__xss || 0, handlers: [...document.querySelectorAll('*')].filter((e) => [...e.attributes].some((a) => /^on/i.test(a.name))).length, scripts: document.scripts.length, js: [...document.querySelectorAll('[href],[src]')].filter((e) => /^\s*javascript:/i.test(e.getAttribute('href') || e.getAttribute('src') || '')).length, title: document.querySelector('h2')?.textContent || '' }));
      eq([s.xss, s.handlers, s.scripts, s.js, s.title.includes('<img')], [0, 0, 0, 0, true], 'blog ouvert dans le navigateur');
    } finally { await blog.close(); }
  },
  'photo hostile (SVG, URL distante, javascript:) : sauvegarde refusée en bloc': async ({ page }) => {
    for (const src of ['data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9ImFsZXJ0KDEpIi8+', 'https://evil.example/x.png', 'javascript:alert(1)', 'data:text/html;base64,PHNjcmlwdD4=', PIXEL + '" onerror="window.__xss=1']) {
      const before = await ev(page, () => J.posts.length);
      const asked = await restore(page, { app: 'atlas-van', version: 5, journal: { posts: [{ id: 'h', title: 't', text: 't', date: '2026-01-01', photos: [{ src, caption: '' }] }] } }, { expectReload: false });
      eq([asked, await ev(page, () => J.posts.length), /refusée/i.test(await toastText(page))], [false, before, true], 'photo refusée : ' + src.slice(0, 30)); await closeDialogs(page);
    }
    eq(await ev(page, () => window.__xss || 0), 0, 'exécutions de script');
  },
  'pollution de prototype par un fichier : sans effet': async ({ page }) => {
    const raw = '{"app":"atlas-van","version":3,"data":{"__proto__":{"polluted":"oui"},"constructor":{"prototype":{"polluted":"oui"}},"edits":{"__proto__":{"polluted":"oui"}},"notes":{"__proto__":{"st":"fav","polluted":"oui"},"constructor":{"st":"fav"}},"custom":[],"route":[],"saved":[],"opts":{"__proto__":{"polluted":"oui"}},"cSeq":0}}';
    await restore(page, raw); await closeDialogs(page);
    const s = await ev(page, () => ({ obj: ({}).polluted, arr: [].polluted, notes: Object.keys(ST.notes).filter((k) => !/^(\d+|c\d+)$/.test(k)), edits: Object.keys(ST.edits).filter((k) => !/^(\d+|c\d+)$/.test(k)), proto: Object.getPrototypeOf(ST.notes) === Object.prototype || Object.getPrototypeOf(ST.notes) === null, alive: PTS.length }));
    eq([s.obj, s.arr, s.notes, s.edits, s.proto], [undefined, undefined, [], [], true], 'prototype intact, aucune clé étrangère'); assert(s.alive >= shippedCatalogue(dir).places - 5, 'application utilisable');
    const route = '{"version":3,"etapes":[{"nom":"A","lat":46,"lon":2,"perso":true,"__proto__":{"polluted":"oui"}}],"__proto__":{"polluted":"oui"}}';
    await page.setInputFiles('#imp', fileOf('p.json', route)); await settle(page, 400); const ok = page.locator('dialog[open] [data-dialog-ok]'); if (await ok.count()) await ok.first().click(); await settle(page, 300);
    eq(await ev(page, () => [({}).polluted, PTS.filter((p) => p.perso).every((p) => p.polluted === undefined)]), [undefined, true], 'import de parcours : prototype intact'); await closeDialogs(page);
  },
  'JSON mal formé, tronqué, mauvais types, très profond : refusés sans casse': async ({ page }) => {
    const before = await ev(page, () => JSON.stringify([route, ST.saved.length, PTS.length, J.posts.length]));
    const deep = '['.repeat(20000) + ']'.repeat(20000);
    for (const [name, text] of [['vide', ''], ['tronqué', '{"app":"atlas-van","version":3,"data":{"edits":{'], ['tableau', '[1,2,3]'], ['null', 'null'], ['nombre', '42'], ['types', '{"data":{"edits":[],"notes":"x","custom":{},"route":"abc","saved":7}}'], ['profond', deep], ['binaire', '\u0000\u0001\u0002PNG']]) {
      await page.setInputFiles('#bkImp', fileOf(name + '.json', text)); await settle(page, 350);
      eq([await page.locator('dialog[open] [data-dialog-ok]').count(), /refusée/i.test(await toastText(page))], [0, true], 'sauvegarde « ' + name + ' » refusée'); await closeDialogs(page);
      await page.setInputFiles('#imp', fileOf(name + '.json', text)); await settle(page, 350); await closeDialogs(page);
    }
    eq(await ev(page, () => JSON.stringify([route, ST.saved.length, PTS.length, J.posts.length])), before, 'données intactes après 16 fichiers invalides');
  },
  'chaînes très longues : tronquées aux limites, interface intacte': async ({ page }) => {
    const long = 'L'.repeat(1_000_000);
    await page.setInputFiles('#imp', fileOf('long.json', { version: 3, etapes: [{ nom: long, lat: 44.2, lon: 3.1, perso: true, note: long, saison: long, duree: long, a_voir: long, tarifs: long, pays: long, categorie: long }] })); await settle(page, 600);
    const ok = page.locator('dialog[open] [data-dialog-ok]'); if (await ok.count()) await ok.first().click(); await settle(page, 500);
    const p = await ev(page, () => { const p = PTS.filter((x) => x.perso).pop(); show(p.i); return { n: p.n.length, d: p.d.length, s: p.s.length, v: p.v.length, e: p.e.length, c: p.c, overflow: document.documentElement.scrollWidth - innerWidth, panel: document.querySelector('.panel').scrollWidth - document.querySelector('.panel').clientWidth }; });
    assert(p.n <= 200 && p.d <= 500 && p.s <= 100 && p.v <= 6000 && p.e <= 3000, 'longueurs bornées : ' + JSON.stringify(p)); eq([p.c, p.overflow <= 0, p.panel <= 0], ['perso', true, true], 'catégorie inconnue ramenée à « perso », aucun débordement');
    await ev(page, () => { const p = PTS.filter((x) => x.perso).pop(); route = route.filter((i) => i !== p.i); delCustom(p.i); }); await settle(page, 300); await closeDialogs(page);
  },
  'import volumineux : 2 000 étapes acceptées, 2 001 refusées': async ({ page }) => {
    const steps = (n) => ({ version: 3, etapes: Array.from({ length: n }, (_, i) => ({ nom: 'Étape ' + i, lat: 40 + (i % 100) / 10, lon: -5 + (i % 150) / 10 })) });
    const before = await ev(page, () => route.length);
    await page.setInputFiles('#imp', fileOf('trop.json', steps(2001))); await settle(page, 500);
    eq([await page.locator('dialog[open] [data-dialog-ok]').count(), await ev(page, () => route.length)], [0, before], '2 001 étapes : refus'); await closeDialogs(page);
    const t0 = Date.now(); await page.setInputFiles('#imp', fileOf('max.json', steps(2000))); await settle(page, 600);
    const ok = page.locator('dialog[open] [data-dialog-ok]'); if (await ok.count()) await ok.first().click(); await settle(page, 800);
    const s = await ev(page, () => ({ n: route.length, items: document.querySelectorAll('#p2 .item').length, t: typeof stats })); measures.import2000Ms = Date.now() - t0;
    assert(s.n > 100, 'parcours volumineux chargé : ' + s.n + ' étapes'); assert(measures.import2000Ms < 15000, 'import en ' + measures.import2000Ms + ' ms');
    await ev(page, () => { route = []; paint(); save(); }); await settle(page, 500); await closeDialogs(page);
  },
  'politique de sécurité : un gestionnaire injecté est bloqué par le navigateur': async ({ browser, url }) => {
    // Page à part : les refus du navigateur s'affichent en erreurs de console, attendues ici et seulement ici.
    const a = await openApp(browser, url, 'desktop-1440x900'), page = a.page;
    try {
    const r = await ev(page, () => new Promise((res) => { let blocked = 0; document.addEventListener('securitypolicyviolation', () => { blocked++; }); const d = document.createElement('div');
      d.innerHTML = '<img src="data:image/png;base64,AAAA" onerror="window.__csp=1"><a id="jsl" href="javascript:window.__csp=2">x</a>'; document.body.appendChild(d); d.querySelector('#jsl').click();
      const s = document.createElement('script'); s.textContent = 'window.__csp=3'; document.body.appendChild(s);
      setTimeout(() => { d.remove(); s.remove(); res({ ran: window.__csp || 0, blocked }); }, 500); }));
    eq(r.ran, 0, 'aucun code injecté exécuté'); assert(r.blocked >= 2, 'violations signalées par le navigateur : ' + r.blocked);
    const csp = await ev(page, () => document.querySelector('meta[http-equiv="Content-Security-Policy"]').content);
    assert(/connect-src 'none'/.test(csp) && /default-src 'none'/.test(csp) && !/unsafe-inline|unsafe-eval/.test(csp) && /script-src 'sha256-/.test(csp), 'politique : ' + csp.slice(0, 160));
    assert(a.errors.every((e) => /Content Security Policy/i.test(e)), 'seules des erreurs de politique de sécurité sont attendues : ' + a.errors.join(' | ').slice(0, 200));
    } finally { await a.context.close(); }
  },
  'aucune requête réseau pendant l\'usage (recherche, fiche, trajet, carnet, export)': async ({ browser, url }) => {
    const a = await openApp(browser, url, 'desktop-1440x900'); const seen = [];
    a.page.on('request', (r) => { if (!r.url().startsWith(url) && !/^(data|blob):/.test(r.url())) seen.push(r.url()); });
    try {
      await ev(a.page, () => { show(PTS.find((p) => p.n === 'Paris').i); document.querySelector('#presets [data-pr]').click(); tab('p2'); tab('pBlog'); tab('p4'); openAtlasSettings(); document.querySelector('#q').value = 'lac'; document.querySelector('#q').dispatchEvent(new Event('input')); });
      await settle(a.page, 600); eq([seen, a.remote, a.errors], [[], [], []], 'requêtes sortantes et erreurs');
      eq(await ev(a.page, () => [typeof navigator.sendBeacon, document.querySelectorAll('script[src], link[rel=stylesheet][href], iframe, img[src^="http"]').length]), ['function', 0], 'aucune ressource tierce dans la page');
    } finally { await a.context.close(); }
  }
});

/* ───────────── Endurance et mémoire ───────────── */
group('endurance', 'desktop-1440x900', {}, {
  'zoom, déplacement, filtres, navigation, fiches répétés : ni nœuds, ni écouteurs, ni mémoire accumulés': async ({ page, context }) => {
    const cdp = await context.newCDPSession(page); await cdp.send('Performance.enable'); await cdp.send('HeapProfiler.enable');
    const snap = async () => { await cdp.send('HeapProfiler.collectGarbage'); await settle(page, 200); await cdp.send('HeapProfiler.collectGarbage'); const m = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((x) => [x.name, x.value]));
      return { nodes: m.Nodes, listeners: m.JSEventListeners, heapMb: +(m.JSHeapUsedSize / 1048576).toFixed(2), dom: await ev(page, () => document.getElementsByTagName('*').length), labels: await ev(page, () => document.querySelectorAll('#map text.lbl').length) }; };
    const cycle = async () => {
      await ev(page, async () => {
        const frame = () => new Promise((r) => requestAnimationFrame(r)), paris = PTS.find((p) => p.n === 'Paris'), others = PTS.filter((p) => p.w === 1).slice(0, 20);
        for (let i = 0; i < 20; i++) { zoomAt(paris.px, paris.py, i % 2 ? 2.5 : .4); await frame(); vb[0] += (i % 2 ? 1 : -1) * vb[2] * .3; applyVB(); await frame(); rescale(); }
        for (let i = 0; i < 20; i++) { document.querySelector('.map-chips [data-cat="' + ['ville', 'nature', 'patrimoine', 'plage'][i % 4] + '"]').click(); if (i % 5 === 4) await frame(); }
        for (let i = 0; i < 20; i++) { show(others[i].i); tab(['p2', 'p3', 'pBlog', 'p4', 'p1'][i % 5]); if (i % 4 === 0) { openAtlasSettings(); document.querySelector('#settingsDialog').close(); openMapFilters(); document.querySelector('#filtersDialog').close(); } await frame(); }
        for (let i = 0; i < 20; i++) { document.querySelector('#q').value = ['lac', 'port', 'chât', 'parc'][i % 4]; document.querySelector('#q').dispatchEvent(new Event('input')); } closeSearch(); document.querySelector('#q').value = '';
        resetFilters(); document.body.classList.remove('has-place'); sel = null; paintSel(); tab('p1'); fitDefault(); await frame(); rescale();
      });
      await settle(page, 500);
    };
    await cycle();                      // un premier tour remplit les réserves (noms de la carte, caches) : il sert de référence
    const a = await snap();
    for (let i = 0; i < 4; i++) await cycle();   // 4 tours de plus : 80 zooms et déplacements, 80 filtres, 80 fiches et rubriques, 80 recherches
    const b = await snap();
    measures.endurance = { apres1tour: a, apres5tours: b };
    assert(b.dom - a.dom <= 20, `nœuds dans la page : ${a.dom} → ${b.dom}`); assert(b.listeners - a.listeners <= 10, `écouteurs : ${a.listeners} → ${b.listeners}`);
    assert(b.heapMb - a.heapMb < 3, `mémoire JavaScript : ${a.heapMb} → ${b.heapMb} Mo`); assert(b.labels <= a.labels + 60, `réserve de noms bornée : ${a.labels} → ${b.labels}`);
  },
  'long trajet (200 étapes) et 300 favoris : interface réactive, rien ne déborde': async ({ page }) => {
    const r = await ev(page, async () => {
      const frame = () => new Promise((res) => requestAnimationFrame(res));
      let t = performance.now(); snap(); route = PTS.slice(100, 300).map((p) => p.i); paint(); await frame(); const paintMs = performance.now() - t;
      PTS.slice(300, 600).forEach((p) => { nt(p.i).st = 'fav'; }); t = performance.now(); applyFilters(); await frame(); const filterMs = performance.now() - t;
      document.querySelector('#fOnlyFav').click(); await frame(); const favShown = document.querySelectorAll('#map .poi:not(.off)').length; document.querySelector('#fOnlyFav').click();
      tab('p2'); await frame();
      const out = { paintMs: Math.round(paintMs), filterMs: Math.round(filterMs), favShown, steps: document.querySelectorAll('#p2 .item').length, nums: document.querySelectorAll('#map .rnum').length, overflow: document.documentElement.scrollWidth - innerWidth };
      PTS.slice(300, 600).forEach((p) => { delete ST.notes[p.i]; }); route = []; paint(); applyFilters(); tab('p1'); await frame();
      return { ...out, numsAfter: document.querySelectorAll('#map .rnum').length };
    });
    measures.longRoute = r; eq([r.favShown, r.nums, r.numsAfter, r.overflow <= 0], [300, 200, 0, true], 'favoris affichés, numéros d\'étape créés puis retirés'); assert(r.steps >= 200, 'étapes listées : ' + r.steps); assert(r.paintMs < 1500 && r.filterMs < 500, `durées : trajet ${r.paintMs} ms, filtre ${r.filterMs} ms`);
  },
  'restauration complète juste après le démarrage : un enregistrement en attente ne l\'écrase pas': async ({ browser, url }) => {
    // Cas réel : le démarrage programme un enregistrement 300 ms plus tard ; l'écriture du carnet restauré peut durer plus longtemps.
    const a = await openApp(browser, url, 'desktop-1440x900');
    try {
      const ids = await ev(a.page, () => ['Nantes', 'Paris', 'Annecy'].map((n) => PTS.find((p) => p.n === n).i));
      const backup = { app: 'atlas-van', version: 5, travel: { edits: {}, notes: { [ids[1]]: { st: 'fav', txt: 'note restaurée' } }, custom: [], route: ids, opts: {}, cSeq: 0, prAppend: false, saved: [{ n: 'Tour', d: '', l: ids }] },
        journal: { title: 'Carnet restauré', posts: [{ id: 'r1', title: 'Article', text: 'x', date: '2026-03-01', photos: [] }] } };
      await ev(a.page, () => { const write = dbWrite; dbWrite = async (j) => { await new Promise((r) => setTimeout(r, 700)); return write(j); }; nt(PTS[40].i).txt = 'modification en attente'; save(); });
      const nav = a.page.waitForNavigation({ waitUntil: 'load', timeout: 10000 });
      await a.page.setInputFiles('#bkImp', fileOf('complet.json', backup)); await a.page.waitForSelector('#confirmJournalImport'); await a.page.click('#confirmJournalImport'); await nav; await ready(a.page);
      const s = await ev(a.page, () => [route.slice(), Object.values(ST.notes).map((n) => n.txt), ST.saved.length, J.title, J.posts.length]);
      eq(s, [ids, ['note restaurée'], 1, 'Carnet restauré', 1], 'trajet, notes, parcours et carnet restaurés ensemble');
    } finally { await a.context.close(); }
  },
  'carnet volumineux (60 articles, 120 photos) : restauration, affichage, images libérées à la suppression': async ({ page, context }) => {
    const posts = Array.from({ length: 60 }, (_, i) => ({ id: 'big' + i, title: 'Étape ' + (i + 1), text: 'Récit '.repeat(200), date: '2026-0' + (1 + (i % 9)) + '-1' + (i % 9), status: i % 3 ? 'ready' : 'draft', photos: [{ src: PIXEL, caption: 'a' }, { src: PIXEL, caption: 'b' }], created: i, updated: i }));
    assert(await restore(page, { app: 'atlas-van', version: 5, journal: { title: 'Grand carnet', posts } }, { expectReload: false }), 'confirmation demandée'); await ev(page, () => tab('pBlog')); await settle(page, 600);
    const s = await ev(page, () => ({ posts: J.posts.length, cards: document.querySelectorAll('#journalPosts .journal-post').length, imgs: document.querySelectorAll('#journalPosts img').length, blobs: [...document.querySelectorAll('img')].filter((i) => i.src.startsWith('blob:')).length }));
    eq(s.posts, 60, 'articles restaurés'); assert(s.cards > 0 && s.cards <= 24, 'liste paginée : ' + s.cards + ' cartes pour 60 articles'); eq(s.blobs, 0, 'aucune adresse blob: laissée dans la page');
    await page.reload(); await ready(page); eq(await ev(page, () => J.posts.length), 60, 'carnet volumineux relu après rechargement');
    await restore(page, { app: 'atlas-van', version: 5, journal: { title: 'Mon carnet de voyage', posts: [] } }, { expectReload: false }); eq(await ev(page, () => J.posts.length), 0, 'carnet vidé');
  }
});

/* ───────────── Version publique (dist-public) ───────────── */
const PERSONAL_STRINGS = ['Chez ma mère', 'Chez mes grands-parents', 'Chez une amie', 'Chez ma marraine', 'Maison des grands-parents', 'Milan (marraine)', 'Port d\'attache', 'marraine', 'grands-parents'];
group('public', 'desktop-1440x900', { publicBuild: true }, {
  'démarrage : tous les lieux publics, aucune base, aucune erreur': async ({ page, errors }) => {
    const s = await ev(page, () => ({ pts: PTS.length, markers: document.querySelectorAll('#map .poi').length, bases: PTS.filter((p) => p.c === 'base').length, halos: Object.keys(halos).length, status: document.querySelector('#topStatus').textContent, title: document.title, counter: document.querySelector('#counter').textContent }));
    eq([s.pts, s.markers, s.bases, s.halos], [PUB, PUB, 0, 0], 'catalogue public'); assert(new RegExp(countPattern(PUB) + ' lieux').test(s.status) && new RegExp(countPattern(PUB) + ' lieux').test(s.title) && PUBRE.test(s.counter), 'nombre annoncé : ' + [s.status, s.title, s.counter].join(' | ')); eq(errors, [], 'erreurs');
  },
  'aucun texte personnel dans le fichier ni dans la page': async ({ page }) => {
    const html = fs.readFileSync(path.join(publicDir, 'index.html'), 'utf8');
    for (const s of PERSONAL_STRINGS) assert(!html.includes(s), 'fichier public : « ' + s + ' » présent');
    assert(!/\/Users\/|file:\/\//.test(html), 'aucun chemin local'); assert(!/"c":"base"/.test(html), 'aucune fiche de catégorie « base »');
    const dom = await ev(page, () => { tab('p3'); tab('p2'); tab('p4'); return document.body.textContent + JSON.stringify(DATA); });
    for (const s of PERSONAL_STRINGS) assert(!dom.includes(s), 'page publique : « ' + s + ' » présent');
  },
  'rubrique « Bases d\'hébergement » absente, recherche sans résultat personnel': async ({ page }) => {
    eq(await ev(page, () => [document.querySelector('#baselist').closest('details').hidden, document.querySelector('#baselist').children.length]), [true, 0], 'rubrique masquée et vide');
    await ev(page, () => { const q = document.querySelector('#q'); q.value = 'marraine'; q.dispatchEvent(new Event('input')); }); await settle(page);
    eq(await ev(page, () => document.querySelectorAll('#res [data-s]').length), 0, 'recherche « marraine »'); await ev(page, () => { closeSearch(); document.querySelector('#q').value = ''; });
  },
  'toutes les idées de parcours se chargent, sans étape manquante': async ({ page }) => {
    const r = await ev(page, () => DATA.parcours.map((p, k) => { loadPreset(k); return [p.l.length, route.length, p.l.every((i) => !!byId[i])]; }));
    eq(r.length, shippedCatalogue(publicDir).parcours.length, 'parcours (25 avant le lot v10)'); assert(r.every(([a, b, ok]) => a === b && ok && a >= 2), 'étapes : ' + JSON.stringify(r.filter(([a, b, ok]) => a !== b || !ok)));
    await ev(page, () => { route = []; paint(); document.body.classList.remove('preset-preview'); tab('p1'); });
  },
  'données d\'une version personnelle (trajet et notes sur des bases) : démarrage propre, le reste conservé': async ({ browser, publicUrl }) => {
    const a = await openApp(browser, publicUrl, 'desktop-1440x900');
    try {
      await ev(a.page, () => { booted = false; localStorage.setItem('atlasvan.v3', JSON.stringify({ edits: {}, notes: { 0: { st: 'fav', txt: 'note sur une base' }, 16: { st: 'fav', txt: 'note gardée' } }, custom: [], route: [0, 16, 20, 1, 25], opts: {}, cSeq: 0, prAppend: false, saved: [{ n: 'Mon tour', d: '', l: [0, 16, 20] }] })); });
      await a.page.reload(); await ready(a.page);
      const s = await ev(a.page, () => ({ route: route.slice(), note: ST.notes[16] && ST.notes[16].txt, pts: PTS.length, saved: ST.saved.map((p) => p.l) }));
      eq([s.route, s.note, s.pts, s.saved], [[16, 20, 25], 'note gardée', PUB, [[16, 20]]], 'étapes publiques et notes conservées, bases ignorées'); eq(a.errors, [], 'erreurs');
      // Rien n'est perdu en silence : l'état d'origine est mis de côté, l'utilisateur est prévenu.
      eq(await ev(a.page, () => [stateRepaired, JSON.parse(localStorage.getItem('atlasvan.v3.recovery')).route]), [true, [0, 16, 20, 1, 25]], 'état d\'origine conservé à part');
    } finally { await a.context.close(); }
  },
  'politique de sécurité et absence de requête : identiques à la version personnelle': async ({ page, errors, remote }) => {
    const csp = await ev(page, () => document.querySelector('meta[http-equiv="Content-Security-Policy"]').content);
    assert(/default-src 'none'/.test(csp) && /connect-src 'none'/.test(csp) && !/unsafe-/.test(csp), 'politique : ' + csp.slice(0, 120)); eq([errors, remote], [[], []], 'erreurs et requêtes tierces');
  }
});

// Forme d'un marqueur ramenée à l'origine et au rayon 1 (unitShape), forme de référence d'une catégorie (unitOf) :
// même écriture des deux côtés (commandes absolues, nombres à 2 décimales), pour comparer des géométries.
const SHAPE_HELPERS = `(() => {
  const parse = (d) => [...d.matchAll(/([MLHVAZmlhvaz])([^MLHVAZmlhvaz]*)/g)].map((m) => [m[1], m[2].trim() ? m[2].trim().split(/[\\s,]+/).map(Number) : []]);
  // Commandes relatives (m, l, h, v, a, z) remises en absolu, pour comparer des géométries quelle que soit l'écriture.
  const absolute = (cmds) => { let cx = 0, cy = 0, sx = 0, sy = 0; return cmds.map(([c, v]) => {
    const rel = c === c.toLowerCase() && c !== 'z', C = c.toUpperCase(), ox = rel ? cx : 0, oy = rel ? cy : 0;
    if (C === 'M' || C === 'L') { cx = v[0] + ox; cy = v[1] + oy; if (C === 'M') { sx = cx; sy = cy; } return [C, [cx, cy]]; }
    if (C === 'H') { cx = v[0] + ox; return [C, [cx]]; }
    if (C === 'V') { cy = v[0] + oy; return [C, [cy]]; }
    if (C === 'A') { cx = v[5] + ox; cy = v[6] + oy; return [C, [v[0], v[1], v[2], v[3], v[4], cx, cy]]; }
    cx = sx; cy = sy; return ['Z', []]; }); };
  const out = (cmds) => cmds.map(([c, v]) => c + v.map((x) => (Math.round(x * 100) / 100 + 0).toFixed(2)).join(',')).join('');
  window.unitOf = (src) => out(absolute(parse(src)));
  window.unitShape = (p) => { const r = p._r || 1, X = (x) => (x - p.px) / r, Y = (y) => (y - p.py) / r;
    return out(absolute(parse(nodes[p.i].getAttribute('d'))).map(([c, v]) => [c, c === 'A' ? [v[0] / r, v[1] / r, v[2], v[3], v[4], X(v[5]), Y(v[6])] : c === 'H' ? [X(v[0])] : c === 'V' ? [Y(v[0])] : c === 'Z' ? [] : [X(v[0]), Y(v[1])]])); };
})()`;

// ---- exécution -------------------------------------------------------------------------------------------
const { chromium } = loadPlaywright();
const server = await serve(dir);
const hasPublic = fs.existsSync(path.join(publicDir, 'index.html'));
const publicServer = hasPublic ? await serve(publicDir) : null;
const browser = await chromium.launch();
const started = Date.now();
try {
  for (const [name, g] of Object.entries(GROUPS)) {
    if (only && !only.some((o) => name.includes(o))) continue;
    if (g.options.publicBuild && !hasPublic) { results.push({ group: name, title: 'version publique construite (node build.mjs --mode public)', status: 'FAIL', detail: 'dist/public/app/index.html absent', ms: 0 }); continue; }
    const url = g.options.publicBuild ? publicServer.url : server.url;
    const app = await openApp(browser, url, g.viewport, {});
    await app.page.evaluate(SHAPE_HELPERS);
    for (const [title, fn] of Object.entries(g.tests)) {
      const t0 = Date.now(); let status = 'PASS', detail = '';
      try { await fn({ page: app.page, context: app.context, errors: app.errors, remote: app.remote, browser, url: server.url, publicUrl: publicServer?.url }); }
      catch (e) { status = 'FAIL'; detail = String(e.message).split('\n')[0].slice(0, 500); await closeDialogs(app.page).catch(() => {}); }
      results.push({ group: name, title, status, detail, ms: Date.now() - t0 });
      console.log(`${status}  ${name} › ${title}${detail ? '\n        ' + detail : ''}`);
    }
    const noise = [...new Set(app.errors)];
    results.push({ group: name, title: 'console sans erreur pendant tout le groupe', status: noise.length ? 'FAIL' : 'PASS', detail: noise.slice(0, 4).join(' | ').slice(0, 500), ms: 0 });
    if (noise.length) console.log(`FAIL  ${name} › console sans erreur pendant tout le groupe\n        ${noise.slice(0, 3).join(' | ').slice(0, 300)}`);
    await app.context.close();
  }
} finally { await browser.close(); await server.close(); if (publicServer) await publicServer.close(); }
const pass = results.filter((r) => r.status === 'PASS').length, fail = results.length - pass;
writeJson(out, { dir, publicDir: hasPublic ? publicDir : null, generatedAt: new Date().toISOString(), durationS: Math.round((Date.now() - started) / 1000), totals: { tests: results.length, pass, fail }, measures, results });
console.log(`\nV2 : ${pass}/${results.length} PASS, ${fail} FAIL → ${path.relative(ROOT, out)}`);
if (Object.keys(measures).length) console.log('mesures : ' + JSON.stringify(measures));
process.exitCode = fail ? 1 : 0;
