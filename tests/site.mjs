// Tests du site éditorial (cycle 3) : pages, navigation, passerelles vers le Planner, frontière public / privé, sécurité, images, accessibilité.
//   node tests/site.mjs [--out <rapport.json>] [--only <groupe,...>]
// Le site est construit ici même, dans un dossier temporaire, à partir du catalogue et d'un contenu de test (tests/fixtures/content) :
// un voyage et des articles publics, des éléments privés, un brouillon, un article aux textes hostiles. content/ n'est pas touché.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT, loadPlaywright, serve, writeJson } from './lib/harness.mjs';
import { catalogue } from '../build/planner.mjs';

const args = process.argv.slice(2), opt = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
const out = path.resolve(opt('--out', 'test-results/site.json')), only = opt('--only', null)?.split(',');
const FIX = path.join(ROOT, 'tests/fixtures/content'), DEMO = path.join(ROOT, 'tests/fixtures/content-demo'), VOY = path.join(ROOT, 'tests/fixtures/content-voyage');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-site-'));
const results = [], measures = {};
const assert = (c, m) => { if (!c) throw new Error(m); };
const eq = (a, b, m) => assert(JSON.stringify(a) === JSON.stringify(b), `${m} — attendu ${JSON.stringify(b)}, obtenu ${JSON.stringify(a)}`.slice(0, 600));
const build = (...a) => spawnSync(process.execPath, [path.join(ROOT, 'build.mjs'), ...a], { encoding: 'utf8', cwd: ROOT });
const built = (name, ...a) => { const dir = path.join(tmp, name), r = build(...a, '--dir', dir); if (r.status !== 0) throw new Error(`construction ${name} : ${(r.stderr || r.stdout).trim().split('\n').slice(0, 3).join(' | ')}`); return dir; };
const walk = (dir, base = '') => fs.readdirSync(path.join(dir, base), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(dir, path.join(base, e.name)) : [path.join(base, e.name)]));
const htmlFiles = (dir) => walk(dir).filter((f) => f.endsWith('.html') && !f.startsWith('app' + path.sep));
const read = (dir, f) => fs.readFileSync(path.join(dir, f), 'utf8');
// Contenu temporaire : copie du contenu de test, modifiée par la fonction donnée (pour les cas de refus).
const contentWith = (name, change, from = FIX) => { const dir = path.join(tmp, 'content-' + name); fs.cpSync(from, dir, { recursive: true }); change(dir); return dir; };
const writeJsonFile = (file, value) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value)); };

const PRIVATE_STRINGS = ['Voyage privé de test à ne jamais publier', 'Résumé privé du voyage de test', 'Paragraphe privé du voyage de test', 'Note privée de test à ne jamais publier', 'Contenu privé de la note de test',
  'Brouillon de test à ne jamais publier', 'Contenu du brouillon de test', 'Section privée de test', 'Phrase privée de la section à propos', 'privee.png'];
const PERSONAL_STRINGS = ['Chez ma mère', 'Chez mes grands-parents', 'Chez une amie', 'Chez ma marraine', 'Maison des grands-parents', 'Milan (marraine)', 'marraine', 'grands-parents'];
// Le site est construit ici même à partir des sources : nombres de lieux attendus (1 600 et 1 595 avant le lot v10).
const N_ALL = catalogue('personal').app.lieux.length, N_PUB = catalogue('public').app.lieux.length;
// Valeurs du catalogue public utilisées par les pages : itinéraires (25 avant le lot v10), lieux d'Italie sans la base
// retirée (362 avant), écriture des nombres dans les pages (espace insécable entre les milliers).
const CAT_PUB = catalogue('public').app, N_TRIPS = CAT_PUB.parcours.length, N_ITALIE = CAT_PUB.lieux.filter((p) => p.p === 'Italie').length;
const numRe = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const WIDTHS = [320, 360, 390, 430, 768, 820, 1024, 1280, 1440, 1920];

console.log('construction des versions de test…');
const PUB = built('public', '--mode', 'public', '--content', FIX);
const PERSO = built('personal', '--mode', 'personal', '--content', FIX);
const BARE = built('bare', '--mode', 'public', '--content', path.join(tmp, 'aucun-contenu'));          // aucun contenu rédigé : le site doit tenir debout
const URLED = built('url', '--mode', 'public', '--content', FIX, '--site-url', 'https://atlas.example');
const VOYPUB = built('voyage-public', '--mode', 'public', '--content', VOY), VOYPERSO = built('voyage-personal', '--mode', 'personal', '--content', VOY);
const KEY = ['index.html', 'voyage-en-cours/index.html', 'partage/index.html', 'destinations/index.html', 'destinations/italie/index.html', 'road-trips/index.html', 'road-trips/balkans-en-six-semaines/index.html', 'voyages/index.html', 'voyages/portugal-de-test/index.html',
  'carnet/index.html', 'carnet/une-nuit-a-nazare/index.html', 'guides/index.html', 'guides/regles-et-couts-par-pays/index.html', 'a-propos/index.html', 'confidentialite/index.html', 'mentions/index.html', 'recherche/index.html', '404.html'];

const { chromium, firefox, webkit } = loadPlaywright();
const server = await serve(PUB), personal = await serve(PERSO), bare = await serve(BARE), voyage = await serve(VOYPUB);
const browser = await chromium.launch();
async function open(base, file = 'index.html', { width = 1440, height = 900, mobile = false, storageState } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1, locale: 'fr-FR', reducedMotion: 'reduce', ...(storageState ? { storageState } : {}) });
  const remote = [], errors = [];
  await context.route('**/*', (r) => { const u = r.request().url(); if (u.startsWith('http://127.0.0.1') || /^(data|blob):/.test(u)) return r.continue(); remote.push(u); return r.abort(); });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message)); page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 200)); });
  // Une image encore en chargement quand le test change de page est annulée (net::ERR_ABORTED) : ce n'est pas une erreur du site.
  page.on('requestfailed', (r) => { if (r.url().startsWith('http://127.0.0.1') && !/ERR_ABORTED/.test(r.failure()?.errorText || '')) errors.push('échec: ' + r.url().replace(/^http:\/\/[^/]+/, '') + ' ' + (r.failure()?.errorText || '')); });
  page.on('response', (r) => { if (r.status() >= 400) errors.push(`HTTP ${r.status()}: ` + r.url().replace(/^http:\/\/[^/]+/, '')); });
  await page.goto(base + file, { waitUntil: 'load' });
  return { context, page, remote, errors };
}
const plannerReady = (page) => page.waitForFunction(() => typeof journalReady !== 'undefined' && journalReady === true, null, { timeout: 20000 });

const GROUPS = {};
const group = (name, tests) => { GROUPS[name] = tests; };

group('pages', {
  '1 · accueil : un seul h1, première page, appels à l\'action, sections, aucune erreur': async () => {
    const a = await open(server.url);
    try {
      const s = await a.page.evaluate(() => ({ h1: [...document.querySelectorAll('h1')].map((h) => h.textContent.trim()), hero: !!document.querySelector('.hero .plate'), cta: [...document.querySelectorAll('.hero-actions a')].map((x) => [x.textContent.trim(), x.getAttribute('href')]),
        tertiary: [...document.querySelectorAll('.hero-more a')].map((x) => [x.textContent.trim(), x.getAttribute('href')]),
        sections: [...document.querySelectorAll('main h2')].map((h) => h.textContent.trim()), title: document.title, lang: document.documentElement.lang, lead: document.querySelector('.hero-lead').textContent,
        atlas: [...document.querySelectorAll('main h2')].find((h) => /Explorer l’Atlas/.test(h.textContent))?.parentElement.querySelector('.section-lead').textContent || '' }));
      eq([s.h1, s.hero, s.cta, s.tertiary, s.lang], [['Préparez votre prochain voyage en van'], true, [['Préparer mon voyage', 'app/index.html'], ['Explorer les destinations', 'destinations/index.html']], [['Découvrir les itinéraires', 'road-trips/index.html']], 'fr'], 'structure de l\'accueil');
      eq(s.lead, 'Trouvez des destinations, découvrez des itinéraires et des conseils pratiques pour préparer un voyage à votre rythme.', 'phrase d\'accroche');
      // L'accueil présente les ressources pour préparer un voyage.
      const order = ['Explorer l’Atlas', 'Road trips', 'Partage', 'Guides pratiques', 'Un outil pour préparer votre voyage', 'À propos'];
      for (const t of order) assert(s.sections.includes(t), 'section absente : ' + t + ' — ' + s.sections.join(' | '));
      eq(order.map((t) => s.sections.indexOf(t)).every((v, i, l) => !i || v > l[i - 1]), true, 'ordre des sections : ' + s.sections.join(' | '));
      assert(new RegExp(numRe(N_PUB) + ' lieux dans 34.pays d’Europe et ' + N_TRIPS + ' itinéraires').test(s.atlas), 'chiffres tirés du catalogue : ' + s.atlas); eq([a.errors, a.remote], [[], []], 'erreurs et requêtes tierces');
    } finally { await a.context.close(); }
  },
  '2 · navigation grand écran : cinq rubriques dont Partage, rubrique courante signalée, retour à l\'accueil': async () => {
    const a = await open(server.url);
    try {
      const links = await a.page.locator('.site-nav a').evaluateAll((l) => l.map((x) => [x.textContent, x.getAttribute('href')]));
      eq(links.map((l) => l[0]), ['Destinations', 'Road trips', 'Partage', 'Guides', 'À propos'], 'rubriques');
      for (const [label, href] of links) { await a.page.goto(server.url + href); const s = await a.page.evaluate(() => [document.querySelectorAll('h1').length, document.querySelector('.site-nav [aria-current]')?.textContent]); eq(s, [1, label], 'page « ' + label + ' »'); }
      await a.page.click('.site-head .brand'); await a.page.waitForLoadState('load'); assert(await a.page.locator('.hero').count() === 1, 'la marque ramène à l\'accueil'); eq(a.errors, [], 'erreurs');
    } finally { await a.context.close(); }
  },
  '3 · navigation téléphone : menu plein écran, focus retenu, Échap, retour du focus, Planner accessible': async () => {
    const a = await open(server.url, 'index.html', { width: 390, height: 844, mobile: true });
    try {
      eq(await a.page.evaluate(() => [getComputedStyle(document.querySelector('.site-nav')).display, getComputedStyle(document.querySelector('[data-menu-open]')).display !== 'none']), ['none', true], 'rubriques repliées, bouton de menu visible');
      await a.page.locator('[data-menu-open]').tap(); await a.page.waitForSelector('#menu[open]');
      const s = await a.page.evaluate(() => { const d = document.querySelector('#menu'), r = d.getBoundingClientRect(); return { full: r.width >= innerWidth - 1 && r.height >= innerHeight - 1, links: [...d.querySelectorAll('a')].map((x) => x.textContent.trim().replace(/\s+/g, ' ')), inside: d.contains(document.activeElement), expanded: document.querySelector('[data-menu-open]').getAttribute('aria-expanded'),
        small: [...d.querySelectorAll('a,button')].filter((e) => e.getBoundingClientRect().height < 44).length }; });
      eq([s.full, s.inside, s.expanded, s.small], [true, true, 'true', 0], 'menu ouvert'); assert(s.links.includes('Destinations') && s.links.some((l) => l.startsWith('Préparer mon voyage')), 'liens du menu : ' + s.links.join(', '));
      // Fenêtre modale native : le focus parcourt le menu puis, après le dernier lien, passe au navigateur (document.body) avant de revenir au menu ;
      // il ne doit jamais atteindre un élément de la page derrière le menu.
      for (let i = 0; i < 30; i++) { await a.page.keyboard.press('Tab'); assert(await a.page.evaluate(() => document.querySelector('#menu').contains(document.activeElement) || document.activeElement === document.body), 'le focus reste dans le menu (arrêt ' + (i + 1) + ')'); }
      assert(await a.page.evaluate(() => document.querySelector('#menu').contains(document.activeElement)) || (await a.page.keyboard.press('Tab'), await a.page.evaluate(() => document.querySelector('#menu').contains(document.activeElement))), 'le focus revient au menu');
      await a.page.keyboard.press('Escape'); await a.page.waitForTimeout(150);
      eq(await a.page.evaluate(() => [document.querySelector('#menu').open, document.activeElement === document.querySelector('[data-menu-open]'), document.querySelector('[data-menu-open]').getAttribute('aria-expanded')]), [false, true, 'false'], 'fermé par Échap, focus rendu au bouton');
      await a.page.locator('[data-menu-open]').tap(); await a.page.waitForSelector('#menu[open]'); await Promise.all([a.page.waitForURL(/road-trips\/index\.html$/, { timeout: 8000 }), a.page.locator('#menu a', { hasText: 'Road trips' }).tap()]); assert(await a.page.locator('h1').textContent() === 'Road trips', 'un lien du menu navigue');
      eq(a.errors, [], 'erreurs');
    } finally { await a.context.close(); }
  },
  '4 · voyages : liste et page d\'un voyage (faits fournis seulement, étapes par identifiant, galerie)': async () => {
    const a = await open(server.url, 'voyages/index.html');
    try {
      eq(await a.page.locator('.card-title').allTextContents(), ['Portugal de test'], 'seul le voyage public est listé');
      await a.page.click('.card-link'); await a.page.waitForLoadState('load');
      const s = await a.page.evaluate(() => ({ h1: document.querySelector('h1').textContent, facts: [...document.querySelectorAll('.facts dt')].map((d) => d.textContent), stops: [...document.querySelectorAll('.stop-title')].map((d) => d.textContent), links: [...document.querySelectorAll('.stop-title a')].map((x) => x.getAttribute('href')),
        h2: [...document.querySelectorAll('main h2')].map((h) => h.textContent), imgs: document.querySelectorAll('main img').length }));
      eq([s.h1, s.facts, s.stops.length, s.links[0]], ['Portugal de test', ['Pays', 'Départ', 'Durée', 'Distance', 'Étapes'], 3, '../../app/index.html#lieu=124'], 'page du voyage');
      assert(s.h2.includes('Un intertitre') && s.h2.includes('Récits de ce voyage') && s.imgs >= 2, 'texte, récits liés et images'); eq(a.errors, [], 'erreurs');
    } finally { await a.context.close(); }
  },
  '5 · destinations : 34 pays, page d\'un pays (lieux, saison, itinéraires, notes signalées)': async () => {
    const a = await open(server.url, 'destinations/index.html');
    try {
      const cards = await a.page.locator('.card').count(); eq(cards, 34, 'pays listés');
      eq(await a.page.evaluate(() => [...document.querySelectorAll('.card')].filter((c) => c.querySelector('.badge')).map((c) => [c.querySelector('.card-title').textContent, c.querySelector('.badge').textContent])), [['Portugal', 'Raconté']], 'seul le pays d\'un voyage publié porte « Raconté »');
      await a.page.goto(server.url + 'destinations/italie/index.html');
      const s = await a.page.evaluate(() => ({ h1: document.querySelector('h1').textContent, badge: document.querySelector('.detail-intro .badge').textContent, lead: document.querySelector('.page-lead').textContent, h2: [...document.querySelectorAll('main h2')].map((h) => h.textContent),
        caveat: document.querySelector('.caveat')?.textContent || '', cta: document.querySelector('.detail-intro .btn-primary').getAttribute('href'), map: document.querySelector('.detail-art svg').getAttribute('aria-label') }));
      eq([s.h1, s.badge, s.cta], ['Italie', 'Dans l’Atlas', '../../app/index.html#pays=italie'], 'page Italie'); assert(new RegExp(numRe(N_ITALIE) + '.lieux repérés').test(s.lead), 'nombre de lieux (sans la base retirée) : ' + s.lead);
      for (const t of ['Incontournables de l’Atlas', 'Quand partir', 'Road trips qui y passent', 'Sur la route']) assert(s.h2.includes(t), 'section absente : ' + t);
      assert(/non sourcées/.test(s.caveat) && /Carte : Italie/.test(s.map), 'notes signalées comme non sourcées, carte décrite');
      await a.page.goto(server.url + 'destinations/portugal/index.html'); eq(await a.page.locator('.detail-intro .badge').textContent(), 'Raconté', 'pays d\'un voyage publié');
      eq(a.errors, [], 'erreurs');
    } finally { await a.context.close(); }
  },
  '6 · road trips : tous les itinéraires, page d\'un itinéraire (étapes ordonnées, distance estimée, aucune durée inventée)': async () => {
    const a = await open(server.url, 'road-trips/index.html');
    try {
      eq(await a.page.locator('.card').count(), N_TRIPS, 'itinéraires listés');
      await a.page.goto(server.url + 'road-trips/balkans-en-six-semaines/index.html');
      const s = await a.page.evaluate(() => ({ h1: document.querySelector('h1').textContent, facts: [...document.querySelectorAll('.facts dt')].map((d) => d.textContent), stops: document.querySelectorAll('.stops-numbered > li').length, cta: document.querySelector('.detail-intro .btn-primary').getAttribute('href'), text: document.querySelector('main').textContent }));
      eq([s.h1, s.facts, s.stops, s.cta], ['Balkans en six semaines', ['Étapes', 'Distance estimée', 'Pays'], 28, '../../app/index.html#parcours=balkans-en-six-semaines'], 'page de l\'itinéraire');
      assert(/pas un voyage réalisé/.test(s.text) && !/jours/.test(s.text.replace(/à jour/g, '')), 'présenté comme une proposition, sans durée'); eq(a.errors, [], 'erreurs');
    } finally { await a.context.close(); }
  },
  '7 · carnet : articles publics seulement, lecture, navigation entre récits, étape sur la carte': async () => {
    const a = await open(server.url, 'carnet/index.html');
    try {
      const titles = await a.page.locator('.card-title').allTextContents(); eq(titles.length, 3, 'articles publics listés : ' + titles.join(' | '));
      await a.page.goto(server.url + 'carnet/une-nuit-a-nazare/index.html');
      const s = await a.page.evaluate(() => ({ h1: document.querySelector('h1').textContent, time: document.querySelector('time').getAttribute('datetime'), meta: document.querySelector('.story-meta').textContent, map: document.querySelector('.story-foot .btn')?.getAttribute('href'),
        nav: [...document.querySelectorAll('.story-nav a')].map((x) => x.getAttribute('rel')), width: Math.round(document.querySelector('.prose p').getBoundingClientRect().width), aside: document.querySelectorAll('aside').length }));
      eq([s.h1, s.time, s.map, s.aside], ['Article de test à Nazaré', '2026-03-09', '../../app/index.html#lieu=119', 0], 'article'); assert(/Nazaré, Portugal/.test(s.meta) && s.nav.length >= 1 && s.width <= 820, `lieu, navigation, largeur de lecture ${s.width} px`);
      eq(a.errors, [], 'erreurs');
    } finally { await a.context.close(); }
  },
  '8 · guides : guides de l\'Atlas et guide rédigé, tableau par pays, sources': async () => {
    const a = await open(server.url, 'guides/index.html');
    try {
      const titles = await a.page.locator('.link-title').allTextContents(); for (const t of ['Règles et coûts par pays', 'Avant de partir', 'Travailler en route', 'Comment Atlas estime un trajet', 'Guide de test']) assert(titles.some((x) => x.trim().startsWith(t)), 'guide absent : ' + t);
      await a.page.goto(server.url + 'guides/regles-et-couts-par-pays/index.html');
      eq(await a.page.evaluate(() => [document.querySelectorAll('tbody tr').length, document.querySelectorAll('thead th[scope=col]').length, document.querySelectorAll('tbody th[scope=row]').length, /non sourcées/.test(document.querySelector('.caveat').textContent)]), [33, 4, 33, true], 'tableau des pays');
      await a.page.goto(server.url + 'guides/guide-de-test/index.html'); eq(await a.page.evaluate(() => [...document.querySelectorAll('.prose a')].map((x) => [x.href, x.rel])), [['https://example.org/source', 'noopener noreferrer']], 'source du guide rédigé');
      eq(a.errors, [], 'erreurs');
    } finally { await a.context.close(); }
  },
  '9 · à propos, confidentialité, mentions : contenu factuel, sections publiques seulement': async () => {
    const a = await open(server.url, 'a-propos/index.html');
    try {
      const h2 = await a.page.locator('main h2').allTextContents(); assert(h2.includes('Ce que c’est') && h2.includes('Section publique de test') && !h2.some((t) => /privée/.test(t)), 'sections : ' + h2.join(' | '));
      eq(await a.page.locator('.todo').count(), 0, 'aucun emplacement « à compléter » dans la version publique');
      await a.page.goto(server.url + 'confidentialite/index.html'); assert(/aucun cookie/.test(await a.page.locator('main').textContent()), 'page de confidentialité');
      await a.page.goto(server.url + 'mentions/index.html'); assert(/ne sont pas encore renseignées/.test(await a.page.locator('main').textContent()), 'mentions : absence dite clairement, rien d\'inventé'); eq(a.errors, [], 'erreurs');
    } finally { await a.context.close(); }
  },
  '14 · page 404 : message, retour à l\'accueil, non indexée': async () => {
    const a = await open(server.url, '404.html');
    try { eq(await a.page.evaluate(() => [document.querySelector('h1').textContent, document.querySelector('meta[name=robots]').content, document.querySelector('main .btn-primary').getAttribute('href')]), ['Cette page n’existe pas', 'noindex', 'index.html'], 'page 404'); eq(a.errors, [], 'erreurs'); }
    finally { await a.context.close(); }
  },
  'recherche locale : pages et lieux, lien vers le Planner, aucun envoi': async () => {
    const a = await open(server.url, 'recherche/index.html');
    try {
      await a.page.fill('#site-q', 'portugal'); await a.page.waitForTimeout(100);
      const r = await a.page.evaluate(() => [...document.querySelectorAll('#site-results a')].map((x) => [x.querySelector('.link-kind').textContent, x.getAttribute('href')]));
      assert(r.some(([k, h]) => k === 'Destination' && h === '../destinations/portugal/index.html') && r.some(([k]) => k === 'Voyage') && r.some(([k, h]) => k === 'Lieu' && /app\/index\.html#lieu=\d+$/.test(h)), 'résultats : ' + JSON.stringify(r.slice(0, 5)));
      await a.page.fill('#site-q', 'zzzzqq'); assert(/Aucun résultat/.test(await a.page.locator('#site-results-status').textContent()), 'aucun résultat annoncé'); eq([a.errors, a.remote], [[], []], 'erreurs et requêtes');
    } finally { await a.context.close(); }
  }
});

group('planner', {
  '10 · « Préparer mon voyage » ouvre le Planner complet ; la marque du Planner ramène au site': async () => {
    const a = await open(server.url);
    try {
      await a.page.click('.head-row .btn-cta'); await plannerReady(a.page);
      eq(await a.page.evaluate(() => [PTS.length, document.querySelectorAll('#map .poi').length, document.querySelectorAll('.tabs button').length, document.querySelector('.brand a').getAttribute('href')]), [N_PUB, N_PUB, 5, '../index.html'], 'Planner public dans le site');
      await a.page.click('.brand a'); await a.page.waitForLoadState('load'); assert(await a.page.locator('.hero').count() === 1, 'retour à l\'accueil du site'); eq(a.errors, [], 'erreurs');
    } finally { await a.context.close(); }
  },
  '11 · liens d\'entrée : pays filtré, parcours chargé, lieu centré — depuis les pages du site': async () => {
    const a = await open(server.url, 'destinations/italie/index.html');
    try {
      await a.page.click('.detail-intro .btn-primary'); await plannerReady(a.page); await a.page.waitForTimeout(300);
      eq(await a.page.evaluate(() => [paysF, document.querySelector('#paysSel').value, document.querySelectorAll('#map .poi:not(.off)').length, location.hash]), ['Italie', 'Italie', N_ITALIE, ''], 'depuis une destination : carte filtrée sur le pays');
      await a.page.goto(server.url + 'road-trips/balkans-en-six-semaines/index.html'); await a.page.click('.detail-intro .btn-primary'); await plannerReady(a.page); await a.page.waitForTimeout(400);
      eq(await a.page.evaluate(() => [route.length, document.querySelector('.pane.on').id]), [28, 'p3'], 'depuis un road trip : parcours chargé');
      await a.page.goto(server.url + 'carnet/une-nuit-a-nazare/index.html'); await a.page.click('.story-foot .btn'); await plannerReady(a.page); await a.page.waitForTimeout(400);
      eq(await a.page.evaluate(() => [byId[sel].n, route.length]), ['Nazaré', 28], 'depuis un article : lieu choisi, trajet conservé'); eq(a.errors, [], 'erreurs');
    } finally { await a.context.close(); }
  },
  'parcours demandé alors qu\'un trajet existe : rien n\'est remplacé sans accord': async () => {
    const a = await open(server.url, 'app/index.html');
    try {
      await plannerReady(a.page); const ids = await a.page.evaluate(() => { route = PTS.slice(10, 13).map((p) => p.i); paint(); writeState(); return route.slice(); });
      await a.page.goto(server.url + 'app/index.html'); await plannerReady(a.page); eq(await a.page.evaluate(() => route.slice()), ids, 'trajet relu');
      await a.page.evaluate(() => { location.hash = '#parcours=balkans-en-six-semaines'; }); await a.page.waitForSelector('dialog[open] [data-dialog-cancel]');
      eq(await a.page.evaluate(() => route.slice()), ids, 'trajet intact pendant la question'); await a.page.click('dialog[open] [data-dialog-cancel]'); await a.page.waitForTimeout(200); eq(await a.page.evaluate(() => route.slice()), ids, 'refus : trajet conservé');
      await a.page.evaluate(() => { location.hash = '#parcours=balkans-en-six-semaines'; }); await a.page.waitForSelector('dialog[open] [data-dialog-ok]'); await a.page.click('dialog[open] [data-dialog-ok]'); await a.page.waitForTimeout(300);
      eq(await a.page.evaluate(() => route.length), 28, 'accord : parcours chargé'); await a.page.evaluate(() => undo()); eq(await a.page.evaluate(() => route.slice()), ids, 'annulable'); eq(a.errors, [], 'erreurs');
    } finally { await a.context.close(); }
  },
  'liens d\'entrée hostiles ou inconnus : ignorés, rien n\'est injecté': async () => {
    for (const hash of ['#lieu=__proto__', '#lieu=constructor', '#lieu=999999', '#lieu=-1', '#pays=<img src=x onerror=window.__xss=1>', '#pays=' + encodeURIComponent('"><script>window.__xss=1</script>'), '#parcours=../../etc/passwd', '#q=' + encodeURIComponent('<img src=x onerror=window.__xss=1>'), '#lieu=31&pays=%E0%A4%A', '#' + 'a'.repeat(5000)]) {
      const a = await open(server.url, 'app/index.html' + hash);
      try { await plannerReady(a.page); await a.page.waitForTimeout(250);
        const s = await a.page.evaluate(() => ({ xss: window.__xss || 0, paysF, route: route.length, shown: document.querySelectorAll('#map .poi:not(.off)').length, imgs: document.querySelectorAll('img[onerror]').length }));
        eq([s.xss, s.paysF, s.route, s.shown, s.imgs, a.errors], [0, '', 0, N_PUB, 0, []], 'lien ' + hash.slice(0, 40));
      } finally { await a.context.close(); }
    }
  },
  'version personnelle : Planner complet (tous les lieux) dans le site, pages marquées « noindex »': async () => {
    const a = await open(personal.url, 'app/index.html');
    try { await plannerReady(a.page); eq(await a.page.evaluate(() => [PTS.length, PTS.filter((p) => p.c === 'base').length]), [N_ALL, 5], 'catalogue complet');
      for (const f of ['index.html', 'destinations/italie/index.html', 'carnet/note-privee/index.html']) assert(/<meta name="robots" content="noindex">/.test(read(PERSO, f)), 'noindex absent : ' + f); eq(a.errors, [], 'erreurs'); }
    finally { await a.context.close(); }
  }
});

group('confidentialite', {
  '12 · contenu privé et brouillons : absents de tous les fichiers publics, présents et étiquetés dans la version personnelle': async () => {
    const files = walk(PUB), text = files.filter((f) => /\.(html|js|css|json|xml|txt)$/.test(f));
    for (const f of text) { const body = read(PUB, f); for (const s of PRIVATE_STRINGS) assert(!body.includes(s), `${f} contient « ${s} »`); }
    for (const slug of ['voyage-prive', 'note-privee', 'brouillon-public']) assert(!files.some((f) => f.includes(slug)), 'page publiée pour un contenu privé : ' + slug);
    eq(files.filter((f) => f.startsWith('media' + path.sep)).sort(), ['media/test/cover.png', 'media/test/photo.png'], 'seules les images des contenus publics sont copiées');
    for (const s of ['Voyage privé de test à ne jamais publier', 'Note privée de test à ne jamais publier', 'Brouillon de test à ne jamais publier']) assert(walk(PERSO).some((f) => f.endsWith('.html') && read(PERSO, f).includes(s)), 'absent de la version personnelle : ' + s);
    const a = await open(personal.url, 'carnet/index.html');
    try { const badges = await a.page.locator('.badge-private').allTextContents(); assert(badges.includes('Privé') && badges.includes('Brouillon — privé'), 'étiquettes : ' + badges.join(', ')); assert(await a.page.locator('.todo').count() >= 1, 'emplacement « à compléter » visible en version personnelle'); }
    finally { await a.context.close(); }
  },
  '13 · version publique : aucune donnée personnelle du catalogue, ni chemin local, ni marqueur de démonstration': async () => {
    for (const f of walk(PUB).filter((x) => /\.(html|js|css|json|xml|txt)$/.test(x))) { const body = read(PUB, f);
      for (const s of PERSONAL_STRINGS) assert(!body.includes(s), `${f} contient « ${s} »`); assert(!/\/Users\/|file:\/\//.test(body), f + ' : chemin local'); if (f.endsWith('.html') && !f.startsWith('app')) assert(!/badge-demo|badge-private|class="todo"/.test(body), f + ' : marqueur privé'); }
    assert(!fs.existsSync(path.join(PUB, 'destinations/italie/index.html')) || !/La Roche-sur-Yon|Annemasse/.test(read(PUB, 'road-trips/index.html')), 'bases retirées des itinéraires');
  },
  'le contrôle de confidentialité arrête la construction publique au moindre doute': async () => {
    const cases = [
      ['texte personnel dans un article public', (d) => writeJsonFile(path.join(d, 'articles/fuite.json'), { slug: 'fuite', title: 'Halte', date: '2026-01-01', text: 'Nous avons dormi chez ma marraine.', visibility: 'public', status: 'published' }), /expression interdite/],
      ['article public citant un lieu personnel (base)', (d) => writeJsonFile(path.join(d, 'articles/base.json'), { slug: 'base', title: 'Base', date: '2026-01-01', placeId: 0, text: 'Texte suffisamment long.', visibility: 'public', status: 'published' }), /lieu inconnu/],
      ['chemin local dans un texte public', (d) => writeJsonFile(path.join(d, 'guides/chemin.json'), { slug: 'chemin', title: 'Chemin', text: 'Voir /Users/dreano/Documents/notes.txt pour le détail.', visibility: 'public', status: 'published' }), /expression interdite/],
      ['un texte privé repris mot pour mot dans un contenu public', (d) => writeJsonFile(path.join(d, 'articles/copie.json'), { slug: 'copie', title: 'Copie', date: '2026-01-01', text: 'Contenu privé de la note de test : publié mais pas public.', visibility: 'public', status: 'published' }), /texte d’un contenu privé/],
      ['une photographie publique portant une position GPS', (d) => { const exif = Buffer.concat([Buffer.from('Exif\0\0MM\0*\0\0\0\x08', 'latin1'), Buffer.from([0, 1, 0x88, 0x25, 0, 4, 0, 0, 0, 1, 0, 0, 0, 26, 0, 0, 0, 0])]), len = Buffer.alloc(2); len.writeUInt16BE(exif.length + 2);
        fs.writeFileSync(path.join(d, 'media/test/gps.jpg'), Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe1]), len, exif, Buffer.from([0xff, 0xc0, 0, 11, 8, 0, 100, 0, 150, 1, 1, 0x11, 0, 0xff, 0xd9])]));
        writeJsonFile(path.join(d, 'articles/gps.json'), { slug: 'gps', title: 'Photo située', date: '2026-01-01', text: 'Texte de l’article.', cover: { src: 'test/gps.jpg', alt: '' }, visibility: 'public', status: 'published' }); }, /position GPS/],
      ['une clé de service dans un texte public', (d) => writeJsonFile(path.join(d, 'guides/cle.json'), { slug: 'cle', title: 'Clé', text: 'jeton ghp_' + 'a'.repeat(36) + ' oublié ici', visibility: 'public', status: 'published' }), /motif interdit/]
    ];
    for (const [name, change, expected] of cases) { const dir = path.join(tmp, 'refus'); fs.rmSync(dir, { recursive: true, force: true }); const r = build('--mode', 'public', '--content', contentWith(name.replace(/\W+/g, '-').slice(0, 30), change), '--dir', dir);
      assert(r.status === 1 && expected.test(r.stderr + r.stdout), `« ${name} » aurait dû être refusé : code ${r.status}, ${(r.stderr || r.stdout).slice(0, 160)}`); assert(!fs.existsSync(path.join(dir, 'index.html')), `« ${name} » : aucun fichier ne doit être écrit`); }
    const demo = build('--mode', 'public', '--content', DEMO, '--demo', '--dir', path.join(tmp, 'demo-public')); assert(demo.status === 1 && /démonstration/.test(demo.stderr), 'démonstration refusée en version publique');
  },
  'contenu de démonstration : visible et étiqueté DÉMO en version personnelle avec --demo, absent sinon': async () => {
    const withDemo = built('demo', '--mode', 'personal', '--content', DEMO, '--demo'), without = built('nodemo', '--mode', 'personal', '--content', DEMO);
    assert(/badge-demo">DÉMO/.test(read(withDemo, 'voyages/index.html')) && fs.existsSync(path.join(withDemo, 'voyages/demo-norvege/index.html')), 'voyage de démonstration étiqueté');
    assert(!fs.existsSync(path.join(without, 'voyages/demo-norvege/index.html')) && !/démonstration/i.test(read(without, 'voyages/index.html')), 'sans --demo : absent');
    const silent = built('demo-pub', '--mode', 'public', '--content', DEMO); assert(!walk(silent).some((f) => /demo/.test(f)), 'version publique sans --demo : la démonstration est écartée');
  },
  '20 · aucun traceur : aucune requête tierce, aucun cookie, aucune ressource externe dans aucune page': async () => {
    for (const f of htmlFiles(PUB)) { const body = read(PUB, f);
      assert(!/<(script|link|img|iframe|video|audio|source|embed|object)\b[^>]*\s(src|href)="(https?:)?\/\//i.test(body.replace(/<link rel="canonical"[^>]*>/, '')), f + ' : ressource externe');
      assert(!/google-analytics|googletagmanager|gtag\(|fbq\(|hotjar|matomo|plausible|segment\.com|doubleclick|facebook\.net/i.test(body), f + ' : traceur'); }
    const a = await open(server.url);
    try { for (const f of KEY) { await a.page.goto(server.url + f, { waitUntil: 'load' }); } await a.page.waitForTimeout(200);
      eq([a.remote, (await a.context.cookies()).length, await a.page.evaluate(() => [localStorage.length, sessionStorage.length, document.cookie])], [[], 0, [0, 0, '']], 'requêtes tierces, cookies, stockage après 16 pages'); }
    finally { await a.context.close(); }
  }
});

group('securite', {
  '17 · politique de sécurité : présente et stricte sur chaque page, aucun style ni script en ligne, 0 violation': async () => {
    const files = htmlFiles(PUB); assert(files.length >= 70, 'pages : ' + files.length);
    for (const f of files) { const body = read(PUB, f), csp = (/http-equiv="Content-Security-Policy" content="([^"]+)"/.exec(body) || [])[1] || '';
      assert(/default-src 'none'/.test(csp) && /script-src 'self'/.test(csp) && /connect-src 'none'/.test(csp) && !/unsafe-inline|unsafe-eval|\*/.test(csp), f + ' : politique ' + csp.slice(0, 80));
      assert(!/\sstyle="/.test(body) && !/\son[a-z]+="/i.test(body) && !/<style/i.test(body) && !/href="javascript:/i.test(body), f + ' : style ou gestionnaire en ligne');
      assert((body.match(/<script\b/g) || []).length === (body.match(/<script (src="[^"]+" defer|type="application\/(ld\+)?json")/g) || []).length, f + ' : script en ligne'); }
    const a = await open(server.url);
    try { for (const f of KEY) await a.page.goto(server.url + f, { waitUntil: 'load' }); eq(a.errors.filter((e) => /Content Security Policy/i.test(e)), [], 'violations'); eq(a.errors, [], 'erreurs'); } finally { await a.context.close(); }
  },
  '18 · contenu hostile (titre, extrait, légende, texte alternatif, texte) : affiché comme du texte, rien ne s\'exécute': async () => {
    for (const f of ['carnet/titre-hostile/index.html', 'carnet/index.html', 'index.html', 'recherche/index.html', 'destinations/portugal/index.html']) {
      const a = await open(server.url, f);
      try { await a.page.waitForTimeout(150); if (f.startsWith('recherche')) { await a.page.fill('#site-q', 'hostile'); await a.page.waitForTimeout(150); }
        const s = await a.page.evaluate(() => ({ xss: window.__xss || 0, handlers: [...document.querySelectorAll('*')].filter((e) => [...e.attributes].some((x) => /^on/i.test(x.name))).length, scripts: [...document.scripts].filter((x) => !x.src && !/json/.test(x.type)).length, injected: document.querySelectorAll('img[src="x"]').length }));
        eq([s.xss, s.handlers, s.scripts, s.injected, a.errors], [0, 0, 0, 0, []], f); } finally { await a.context.close(); }
    }
    const a = await open(server.url, 'carnet/titre-hostile/index.html');
    try { assert((await a.page.locator('h1').textContent()).includes('<img src=x onerror='), 'le titre hostile est visible tel quel'); eq(await a.page.title().then((t) => t.includes('<img')), true, 'titre de page échappé'); } finally { await a.context.close(); }
  },
  '18 · adresse hostile (#q=…) sur la page de recherche : placée dans le champ, jamais dans le HTML': async () => {
    const a = await open(server.url, 'recherche/index.html#q=' + encodeURIComponent('<img src=x onerror=window.__xss=1>'));
    try { await a.page.waitForTimeout(200); eq(await a.page.evaluate(() => [window.__xss || 0, document.querySelector('#site-q').value, document.querySelectorAll('#site-results img, main img[src="x"]').length, /Aucun résultat pour « <img/.test(document.querySelector('#site-results-status').textContent)]), [0, '<img src=x onerror=window.__xss=1>', 0, true], 'terme hostile'); eq(a.errors, [], 'erreurs'); }
    finally { await a.context.close(); }
  },
  '18 · fichiers de contenu refusés : adresse, lien, chemin d\'image, clé inconnue, pollution de prototype, JSON illisible': async () => {
    const article = (extra) => ({ slug: 'essai', title: 'Essai', date: '2026-01-01', text: 'Texte.', visibility: 'public', status: 'published', ...extra });
    const cases = [
      ['slug avec remontée de dossier', (d) => writeJsonFile(path.join(d, 'articles/x.json'), article({ slug: '../../etc/passwd' })), /slug/],
      ['slug avec balise', (d) => writeJsonFile(path.join(d, 'articles/x.json'), article({ slug: '<script>' })), /slug/],
      ['slug en majuscules et espaces', (d) => writeJsonFile(path.join(d, 'articles/x.json'), article({ slug: 'Mon Article' })), /slug/],
      ['image hors de content/media (..)', (d) => writeJsonFile(path.join(d, 'articles/x.json'), article({ cover: { src: '../../../build.mjs' } })), /content\/media/],
      ['image par adresse distante', (d) => writeJsonFile(path.join(d, 'articles/x.json'), article({ cover: { src: 'https://evil.example/x.png' } })), /content\/media/],
      ['image en javascript:', (d) => writeJsonFile(path.join(d, 'articles/x.json'), article({ cover: 'javascript:alert(1)' })), /content\/media/],
      ['image absente', (d) => writeJsonFile(path.join(d, 'articles/x.json'), article({ cover: { src: 'test/absente.png' } })), /fichier absent/],
      ['image illisible', (d) => { fs.writeFileSync(path.join(d, 'media/test/faux.png'), 'pas une image'); writeJsonFile(path.join(d, 'articles/x.json'), article({ cover: { src: 'test/faux.png' } })); }, /image illisible/],
      ['source de guide en javascript:', (d) => writeJsonFile(path.join(d, 'guides/x.json'), { slug: 'g', title: 'G', text: 'T', sources: [{ label: 'x', url: 'javascript:alert(1)' }] }), /http\(s\)/],
      ['réseau social en data:', (d) => writeJsonFile(path.join(d, 'site.json'), { social: [{ label: 'x', url: 'data:text/html,<script>1</script>' }] }), /http\(s\)/],
      ['clé inconnue', (d) => writeJsonFile(path.join(d, 'articles/x.json'), article({ onload: 'alert(1)' })), /clé inconnue/],
      ['pollution de prototype', (d) => writeJsonFile(path.join(d, 'articles/x.json'), '{"slug":"p","title":"P","date":"2026-01-01","text":"T","__proto__":{"isPublic":true,"visibility":"public"}}'), /clé inconnue/],
      ['visibilité inventée', (d) => writeJsonFile(path.join(d, 'articles/x.json'), article({ visibility: 'tout-le-monde' })), /visibility/],
      ['date impossible', (d) => writeJsonFile(path.join(d, 'articles/x.json'), article({ date: '2026-13-45' })), /date/],
      ['lieu inexistant', (d) => writeJsonFile(path.join(d, 'articles/x.json'), article({ placeId: 999999 })), /lieu inconnu/],
      ['JSON illisible', (d) => writeJsonFile(path.join(d, 'articles/x.json'), '{"slug": "x", '), /JSON illisible/],
      ['adresse du site en javascript:', (d) => writeJsonFile(path.join(d, 'site.json'), { siteUrl: 'javascript:alert(1)' }), /http\(s\)/]
    ];
    for (const [name, change, expected] of cases) { const r = build('--mode', 'personal', '--content', contentWith('bad-' + name.replace(/\W+/g, '-').slice(0, 24), change), '--dir', path.join(tmp, 'bad'));
      assert(r.status === 1 && expected.test(r.stderr + r.stdout), `« ${name} » aurait dû être refusé : code ${r.status} — ${(r.stderr || r.stdout).trim().slice(0, 140)}`); }
    assert(({}).isPublic === undefined, 'prototype intact'); measures.refus = cases.length;
    const badUrl = build('--mode', 'public', '--content', FIX, '--site-url', 'javascript:alert(1)', '--dir', path.join(tmp, 'bad-url')); assert(badUrl.status === 1, '--site-url hostile refusé');
    const outside = build('--mode', 'public', '--content', FIX, '--dir', path.join(ROOT, 'src')); assert(outside.status === 1 && /n’a pas été produit/.test(outside.stderr) && fs.existsSync(path.join(ROOT, 'src/index.template.html')), 'un dossier existant n\'est jamais écrasé');
  },
  'export du Planner pour le site : articles privés et en brouillon par défaut ; import contrôlé': async () => {
    const a = await open(personal.url, 'app/index.html');
    try {
      await plannerReady(a.page);
      const data = await a.page.evaluate(() => articlesForSite([{ title: 'Un Matin à Annecy !', date: '2026-06-14', text: 'Le lac était un miroir.', placeId: PTS.find((p) => p.n === 'Annecy').i, photos: [{ src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', caption: 'Le lac' }] }, { title: 'Chez moi', date: '2026-06-15', text: 'x', placeId: 'c1', photos: [] }]));
      eq(data.articles.map((x) => [x.slug, x.visibility, x.status, x.placeId]), [['un-matin-a-annecy', 'private', 'draft', 31], ['chez-moi', 'private', 'draft', null]], 'export : privé, brouillon, lieu personnel non repris');
      const file = path.join(tmp, 'export.json'), dir = path.join(tmp, 'content-import'); data.articles[0].visibility = 'public'; data.articles[0].status = 'published'; fs.writeFileSync(file, JSON.stringify(data));
      const run = (...x) => spawnSync(process.execPath, [path.join(ROOT, 'build/import-articles.mjs'), ...x, '--content', dir], { encoding: 'utf8' });
      const r = run(file); assert(r.status === 0, 'import : ' + r.stderr);
      const saved = JSON.parse(fs.readFileSync(path.join(dir, 'articles/2026-06-14-un-matin-a-annecy.json'), 'utf8'));
      // Nom de la photo : adresse de l'article, rang, empreinte du contenu (aucune image n'en écrase une autre).
      eq([saved.visibility, saved.status, /^carnet\/2026-06-14-un-matin-a-annecy-1-[a-f0-9]{10}\.png$/.test(saved.cover.src), fs.existsSync(path.join(dir, 'media', saved.cover.src))], ['private', 'draft', true, true], 'importé en privé et brouillon même si le fichier prétend le contraire ; photo extraite');
      // Second import du même fichier : idempotent (rien n'est réécrit ni dupliqué), au lieu de l'ancien refus.
      const first = fs.readFileSync(path.join(dir, 'articles/2026-06-14-un-matin-a-annecy.json'), 'utf8'), again = run(file);
      assert(again.status === 0 && /Déjà à jour/.test(again.stdout) && fs.readFileSync(path.join(dir, 'articles/2026-06-14-un-matin-a-annecy.json'), 'utf8') === first && fs.readdirSync(path.join(dir, 'articles')).length === 2, 'second import : rien d\'écrasé, aucun doublon');
      fs.writeFileSync(file, JSON.stringify({ type: 'atlas-van-articles', version: 1, articles: [{ title: 'x', date: '2026-01-01', text: 'x', photos: [{ src: 'data:image/svg+xml;base64,PHN2Zz4=' }] }] })); const svg = run(file); assert(svg.status === 1 && /format refusé/.test(svg.stderr), 'photo SVG refusée');
      const pub = build('--mode', 'public', '--content', dir, '--dir', path.join(tmp, 'import-public')); assert(pub.status === 0 && !fs.existsSync(path.join(tmp, 'import-public/carnet/2026-06-14-un-matin-a-annecy')), 'article importé absent de la version publique tant qu\'il n\'est pas publié');
    } finally { await a.context.close(); }
  }
});

group('images-seo', {
  '19 · images : dimensions réservées, texte alternatif, chargement différé hors première image, aucune image cassée': async () => {
    const a = await open(server.url, 'voyages/portugal-de-test/index.html');
    try {
      const imgs = await a.page.evaluate(async () => { const list = [...document.querySelectorAll('main img')]; for (const i of list) { i.dataset.was = i.getAttribute('loading') || ''; i.loading = 'eager'; } await Promise.all(list.map((i) => (i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; }))));
        return list.map((i) => ({ w: i.getAttribute('width'), h: i.getAttribute('height'), alt: i.getAttribute('alt'), loading: i.dataset.was === 'lazy', priority: i.getAttribute('fetchpriority'), ok: i.naturalWidth > 0 })); });
      eq(imgs[0], { w: '1200', h: '800', alt: 'Image de test : dégradé de couleurs', loading: false, priority: 'high', ok: true }, 'image de couverture'); assert(imgs.slice(1).every((i) => i.w && i.h && i.alt !== null && i.loading && i.ok), 'autres images : ' + JSON.stringify(imgs.slice(1)));
      eq(await a.page.evaluate(() => Math.round(performance.getEntriesByType('layout-shift').reduce((s, e) => s + e.value, 0) * 1000) / 1000), 0, 'aucun décalage de mise en page'); eq(a.errors, [], 'erreurs');
    } finally { await a.context.close(); }
    for (const f of htmlFiles(PUB)) for (const m of read(PUB, f).matchAll(/<img\b[^>]*>/g)) assert(/\swidth="\d+"/.test(m[0]) && /\sheight="\d+"/.test(m[0]) && /\salt="/.test(m[0]), f + ' : image sans dimensions ou sans alt');
    for (const f of htmlFiles(PUB)) for (const m of read(PUB, f).matchAll(/<svg class="plate[^>]*>/g)) assert(/aria-hidden="true"|role="img" aria-label="[^"]+"/.test(m[0]), f + ' : carte illustrée ni décorative ni décrite');
  },
  'référencement des pages publiques : titre et description uniques, un seul h1, hiérarchie des titres, données structurées lisibles': async () => {
    const titles = new Map(), descs = new Map();
    for (const f of htmlFiles(PUB)) { const body = read(PUB, f), title = (/<title>([^<]*)<\/title>/.exec(body) || [])[1], desc = ((/<meta name="description" content="([^"]*)"/.exec(body) || [])[1] || '').replace(/&(lt|gt|quot|#39);/g, 'x').replace(/&amp;/g, '&');
      assert(title && (title.length <= 75 || f.includes('titre-hostile')) && desc && desc.length >= 40 && desc.length <= 160, `${f} : titre ${title && title.length}, description ${desc && desc.length}`);
      assert(!titles.has(title), `titre en double : ${f} et ${titles.get(title)}`); titles.set(title, f); if (!/noindex/.test(body)) { assert(!descs.has(desc), `description en double : ${f} et ${descs.get(desc)}`); descs.set(desc, f); }
      eq((body.match(/<h1\b/g) || []).length, 1, f + ' : nombre de h1');
      const levels = [...body.replace(/<dialog[\s\S]*?<\/dialog>/, '').matchAll(/<h([1-6])\b/g)].map((m) => Number(m[1])); for (let i = 1; i < levels.length; i++) assert(levels[i] - levels[i - 1] <= 1, `${f} : saut de niveau h${levels[i - 1]} → h${levels[i]}`);
      assert(/<html lang="fr"/.test(body) && /property="og:title"/.test(body) && /<main id="main"/.test(body), f + ' : langue, Open Graph ou repère principal'); }
    measures.pagesPubliques = titles.size;
    assert(!/rel="canonical"/.test(read(PUB, 'index.html')) && !fs.existsSync(path.join(PUB, 'sitemap.xml')), 'sans adresse de site : ni lien canonique, ni sitemap');
    const home = read(URLED, 'index.html'), map = read(URLED, 'sitemap.xml');
    assert(/<link rel="canonical" href="https:\/\/atlas\.example\/">/.test(home) && /Sitemap: https:\/\/atlas\.example\/sitemap\.xml/.test(read(URLED, 'robots.txt')), 'avec adresse : canonique et robots.txt');
    assert(map.includes('https://atlas.example/destinations/italie/') && !/recherche|404|mentions/.test(map), 'sitemap : pages indexables seulement');
    const nf = read(URLED, '404.html'); assert(/href="\/assets\/site\.css"/.test(nf) && /href="\/index\.html"/.test(nf) && !/href="index\.html"/.test(nf), 'page 404 : liens depuis la racine quand l\'adresse du site est connue');
    for (const f of ['index.html', 'carnet/une-nuit-a-nazare/index.html', 'destinations/italie/index.html']) for (const m of read(URLED, f).matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) { const o = JSON.parse(m[1]); assert(o['@context'] === 'https://schema.org' && o['@type'], f + ' : données structurées'); assert(!/aggregateRating|review|price|author/i.test(m[1]), f + ' : aucune note, avis, prix ni auteur inventé'); }
  },
  'robustesse : site sans aucun contenu rédigé, rubriques vides honnêtes, aucune page cassée': async () => {
    const a = await open(bare.url);
    try {
      eq(await a.page.evaluate(() => [...document.querySelectorAll('main h2')].map((h) => h.textContent).filter((t) => /voyages|Carnet/i.test(t))), [], 'accueil : pas de section vide');
      for (const [f, text] of [['voyages/index.html', 'Aucun voyage n’est encore raconté ici'], ['carnet/index.html', 'Aucun récit publié pour l’instant'], ['voyage-en-cours/index.html', 'Aucun voyage en cours n’est publié']]) { await a.page.goto(bare.url + f); assert((await a.page.locator('.empty').textContent()).includes(text), f + ' : état vide'); eq(await a.page.locator('.todo').count(), 0, f + ' : rien « à compléter » en public'); }
      eq(a.errors, [], 'erreurs');
    } finally { await a.context.close(); }
    eq(htmlFiles(BARE).length, htmlFiles(PUB).length - 5, 'pages produites sans contenu rédigé (5 de moins : 1 voyage, 3 articles, 1 guide)');
  }
});

group('accessibilite-responsive', {
  '15 · clavier : lien d\'évitement, ordre de tabulation, focus visible, cibles nommées': async () => {
    const a = await open(server.url);
    try {
      await a.page.keyboard.press('Tab'); eq(await a.page.evaluate(() => [document.activeElement.className, document.activeElement.getAttribute('href')]), ['skip-link', '#main'], 'premier arrêt : lien d\'évitement');
      await a.page.keyboard.press('Enter'); await a.page.waitForTimeout(100);
      const order = []; for (let i = 0; i < 4; i++) { await a.page.keyboard.press('Tab'); await a.page.waitForTimeout(150); /* le contour se lit une fois l'image suivante dessinée */ order.push(await a.page.evaluate(() => { const e = document.activeElement, s = getComputedStyle(e); return [e.textContent.trim().replace(/\s+/g, ' ').slice(0, 26), s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 2]; })); }
      eq(order.map((o) => o[0]).slice(0, 2), ['Préparer mon voyage', 'Explorer les destinations'], 'après le lien d\'évitement : les deux actions de la première page'); assert(order.every((o) => o[1]), 'focus visible sur chaque arrêt');
      for (const f of KEY) { await a.page.goto(server.url + f); const bad = await a.page.evaluate(() => [...document.querySelectorAll('a,button,input')].filter((e) => !e.closest('dialog:not([open])') && !(e.textContent.trim() || e.getAttribute('aria-label') || e.getAttribute('aria-labelledby') || (e.id && document.querySelector('label[for="' + e.id + '"]')))).length);
        eq(bad, 0, f + ' : commandes sans nom'); eq(await a.page.evaluate(() => [document.querySelectorAll('header.site-head').length, document.querySelectorAll('main').length, document.querySelectorAll('footer.site-foot').length, document.querySelectorAll('nav:not([aria-label])').length]), [1, 1, 1, 0], f + ' : repères'); }
    } finally { await a.context.close(); }
  },
  '16 · mise en page : dix largeurs de 320 à 1920 px, aucun débordement, cibles de 44 px sur écran tactile': async () => {
    const pagesToCheck = ['index.html', 'destinations/index.html', 'destinations/italie/index.html', 'road-trips/balkans-en-six-semaines/index.html', 'carnet/titre-hostile/index.html', 'guides/regles-et-couts-par-pays/index.html', 'voyages/portugal-de-test/index.html', 'recherche/index.html'];
    const worst = { overflow: 0, small: 0, checked: 0 };
    for (const w of WIDTHS) {
      const a = await open(server.url, 'index.html', { width: w, height: w < 700 ? 800 : 900, mobile: w < 1024 });
      try { for (const f of pagesToCheck) { await a.page.goto(server.url + f, { waitUntil: 'load' });
        const s = await a.page.evaluate(() => { const vw = document.documentElement.clientWidth; const wide = [...document.querySelectorAll('main *, header *, footer *')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.right > vw + 1 || r.left < -1) && !e.closest('.table-scroll, svg, .hero-art'); }).map((e) => e.className || e.tagName).slice(0, 3);
          const small = [...document.querySelectorAll('a,button,input')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !e.closest('dialog:not([open])') && !e.closest('.prose p, .prose li, .caveat, td, th, .page-lead, .foot-note, .notes, .story-meta') && (r.height < 44 || r.width < 44) && !(r.height >= 44); }).map((e) => (e.textContent.trim() || e.className).slice(0, 20));
          return { overflow: document.documentElement.scrollWidth - vw, wide, small, hero: document.querySelector('.hero') ? Math.round(document.querySelector('.hero-title').getBoundingClientRect().right) <= vw : true }; });
        worst.checked++; assert(s.overflow <= 0 && !s.wide.length && s.hero, `${f} à ${w} px : débordement ${s.overflow} px ${s.wide.join(', ')}`); if (w < 1024) assert(!s.small.length, `${f} à ${w} px : cibles sous 44 px — ${s.small.slice(0, 4).join(' | ')}`); }
        eq(a.errors, [], 'erreurs à ' + w + ' px'); } finally { await a.context.close(); }
    }
    measures.responsive = worst.checked + ' couples page × largeur';
  },
  'texte agrandi à 200 %, mouvement réduit, couleurs forcées : lisible, sans animation, sans perte de contenu': async () => {
    const a = await open(server.url, 'index.html', { width: 1280, height: 720 });
    try {
      await a.page.addStyleTag({ content: 'html{font-size:200%}' }).catch(() => {});
      const cdp = await a.context.newCDPSession(a.page); await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'forced-colors', value: 'active' }, { name: 'prefers-reduced-motion', value: 'reduce' }] });
      await a.page.goto(server.url + 'index.html'); const s = await a.page.evaluate(() => ({ overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, motion: document.documentElement.classList.contains('motion'), hidden: [...document.querySelectorAll('.reveal')].filter((e) => getComputedStyle(e).opacity !== '1').length, plates: document.querySelectorAll('.plate').length }));
      eq([s.overflow <= 0, s.motion, s.hidden], [true, false, 0], 'mouvement réduit : aucune apparition animée, tout est visible'); assert(s.plates > 5, 'cartes illustrées présentes en couleurs forcées');
    } finally { await a.context.close(); }
    const zoom = await open(server.url, 'index.html', { width: 640, height: 450 });   // 1280 × 900 agrandi à 200 %
    try { for (const f of ['index.html', 'destinations/italie/index.html', 'guides/regles-et-couts-par-pays/index.html']) { await zoom.page.goto(server.url + f); eq(await zoom.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth <= 0), true, f + ' à 200 % : pas de défilement horizontal'); } }
    finally { await zoom.context.close(); }
  },
  'sans JavaScript : pages lisibles, rubriques accessibles par le pied de page': async () => {
    const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } }); const page = await context.newPage();
    try { await page.goto(server.url + 'index.html'); assert(await page.locator('.reveal').first().isVisible(), 'contenu visible sans script');
      await page.locator('.foot-nav a', { hasText: 'Destinations' }).click(); await page.waitForLoadState('load'); assert(/destinations\/index\.html$/.test(page.url()) && await page.locator('.card').count() === 34, 'navigation par le pied de page'); }
    finally { await context.close(); }
  },
  'fichier local : accueil, destination et Planner s\'ouvrent par double-clic dans les trois moteurs': async () => {
    for (const [name, type] of [['chromium', chromium], ['firefox', firefox], ['webkit', webkit]]) {
      const b = await type.launch(); const page = await b.newPage(); const errors = []; page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 120)); });
      try { await page.goto('file://' + path.join(PUB, 'index.html')); const css = await page.evaluate(() => getComputedStyle(document.querySelector('.hero-title')).fontSize); assert(parseFloat(css) > 30, name + ' : feuille de style appliquée');
        await page.click('.foot-nav a[href="destinations/index.html"]'); await page.waitForLoadState('load'); assert(await page.locator('.card').count() === 34, name + ' : lien relatif vers les destinations');
        await page.goto('file://' + path.join(PUB, 'voyages/portugal-de-test/index.html')); assert(await page.evaluate(() => document.querySelector('main img').naturalWidth) === 1200, name + ' : image locale affichée');
        await page.goto('file://' + path.join(PUB, 'destinations/italie/index.html')); await page.click('.detail-intro .btn-primary'); await plannerReady(page); await page.waitForTimeout(300);
        eq(await page.evaluate(() => [PTS.length, paysF]), [N_PUB, 'Italie'], name + ' : Planner ouvert et filtré depuis un fichier local'); eq(errors, [], name + ' : erreurs'); }
      finally { await b.close(); }
    }
  }
});

group('blog', {
  'accueil avec un voyage publié : accroche réglable et préparation mise en avant': async () => {
    const a = await open(voyage.url);
    try {
      const s = await a.page.evaluate(() => ({
        h1: document.querySelector('h1').textContent, lead: document.querySelector('.hero-lead').textContent,
        cta: [...document.querySelectorAll('.hero-actions a')].map((x) => x.getAttribute('href')),
        personal: document.querySelectorAll('.section-voyage, .stage-list, .last-stage, .hero-art .pl-route, .hero-art .pl-last').length,
        text: document.body.textContent
      }));
      eq([s.h1, s.lead], ['Titre d’accueil de test', 'Phrase d’accroche de test, réglée dans content/site.json.'], 'accroche réglable');
      eq(s.cta, ['app/index.html', 'destinations/index.html'], 'actions de préparation');
      eq(s.personal, 0, 'aucun suivi personnel sur l’accueil');
      assert(!/Mon voyage|Mes voyages|Suivre le voyage|Espagne de test/.test(s.text), 'accueil centré sur les visiteurs');
      eq([a.errors, a.remote], [[], []], 'erreurs et requêtes');
    } finally { await a.context.close(); }
  },
  'page « voyage en cours » : faits, distance dite estimée, chronologie, prévu distinct, récits, liens vers l\'Atlas et le Planner': async () => {
    const a = await open(voyage.url, 'voyage-en-cours/index.html');
    try {
      const s = await a.page.evaluate(() => ({ h1: document.querySelector('h1').textContent, badge: document.querySelector('.detail-intro .badge').textContent, robots: document.querySelector('meta[name=robots]')?.content || '',
        facts: [...document.querySelectorAll('.facts > div')].map((d) => [d.querySelector('dt').textContent, d.querySelector('dd').textContent]),
        timeline: [...document.querySelectorAll('.timeline > li')].map((li) => [li.querySelector('.stop-title').textContent, li.querySelector('time')?.getAttribute('datetime')]),
        approx: document.querySelector('.timeline > li:nth-child(2) .stop-meta').textContent, planned: [...document.querySelectorAll('.plain-list li')].map((l) => l.textContent),
        caveat: document.querySelector('.caveat')?.textContent || '', stories: document.querySelectorAll('.card-story').length, current: document.querySelector('.site-nav [aria-current]')?.textContent,
        links: [...document.querySelectorAll('main a')].map((x) => x.getAttribute('href')) }));
      eq([s.h1, s.badge, s.robots, s.current], ['Espagne de test', 'En cours', '', 'Mon voyage'], 'en-tête, indexable, rubrique courante');
      const f = Object.fromEntries(s.facts); eq([f['Départ'], f['État'], f['Pays'], f['Étapes publiées']], ['10 avril 2026', 'En cours', 'Espagne', '3'], 'faits');
      assert(/km/.test(f.Distance) && /estimée/.test(f.Distance), 'distance calculée dite estimée : ' + f.Distance); assert(/^9 jours/.test(f['Jours de voyage']) && /dernier récit publié/.test(f['Jours de voyage']), 'jours comptés jusqu\'au dernier récit : ' + f['Jours de voyage']);
      eq(s.timeline, [['Saint-Sébastien', '2026-04-11'], ['Village de test', '2026-04-14'], ['Bardenas Reales', '2026-04-18']], 'chronologie'); assert(/position approximative/.test(s.approx), 'étape hors Atlas signalée comme approximative');
      assert(s.planned.some((t) => /^Valence/.test(t)) && s.planned.some((t) => /^Séville/.test(t)) && /ne sont pas des étapes parcourues/.test(s.caveat), 'prévu distinct du parcouru');
      eq(s.stories, 4, 'récits publiés du voyage'); assert(s.links.includes('../destinations/espagne/index.html') && s.links.includes('../app/index.html') && s.links.includes('../voyages/espagne-de-test/index.html'), 'liens vers l\'Atlas, le Planner, la page du voyage');
      eq(a.errors, [], 'erreurs');
    } finally { await a.context.close(); }
  },
  'confidentialité du voyage : brouillon absent, position arrondie, aucune position « en direct », prévu masqué par défaut': async () => {
    for (const f of walk(VOYPUB).filter((x) => /\.(html|js|json|xml|txt)$/.test(x) && !x.startsWith('app'))) {
      const body = read(VOYPUB, f);
      assert(!/Brouillon d’étape|etape-brouillon/.test(body), f + ' : brouillon publié'); assert(!/42\.12|1\.98765|42\.123456/.test(body), f + ' : position précise publiée');
      assert(!/position actuelle|en temps réel|géolocalisation en direct/i.test(body), f + ' : position présentée comme actuelle');
    }
    assert(/Brouillon d’étape/.test(read(VOYPERSO, 'carnet/etape-brouillon/index.html')), 'le brouillon reste visible dans la version personnelle');
    const hidden = built('voyage-sans-prevu', '--mode', 'public', '--content', contentWith('sans-prevu', (dir) => { const f = path.join(dir, 'voyages/espagne-de-test.json'), v = JSON.parse(fs.readFileSync(f, 'utf8')); delete v.showPlanned; fs.writeFileSync(f, JSON.stringify(v)); }, VOY));
    for (const f of ['index.html', 'voyage-en-cours/index.html']) assert(!/pl-planned|Étapes prévues|Valence/.test(read(hidden, f)), f + ' : étapes prévues montrées sans accord explicite');
    const priv = contentWith('voyage-prive-en-cours', (dir) => { const f = path.join(dir, 'voyages/espagne-de-test.json'), v = JSON.parse(fs.readFileSync(f, 'utf8')); v.visibility = 'private'; fs.writeFileSync(f, JSON.stringify(v));
      for (const n of fs.readdirSync(path.join(dir, 'articles'))) { const g = path.join(dir, 'articles', n), x = JSON.parse(fs.readFileSync(g, 'utf8')); delete x.voyage; fs.writeFileSync(g, JSON.stringify(x)); } }, VOY);
    const privPub = built('voyage-prive-public', '--mode', 'public', '--content', priv), privPerso = built('voyage-prive-perso', '--mode', 'personal', '--content', priv);
    assert(/Aucun voyage en cours n’est publié/.test(read(privPub, 'voyage-en-cours/index.html')) && /noindex/.test(read(privPub, 'voyage-en-cours/index.html')) && !/Espagne de test/.test(read(privPub, 'index.html')), 'voyage en cours privé : absent de la version publique');
    assert(/Espagne de test/.test(read(privPerso, 'voyage-en-cours/index.html')) && /badge-private/.test(read(privPerso, 'voyage-en-cours/index.html')), 'voyage en cours privé : visible et signalé dans la version personnelle');
  },
  'Planner public : rien ne propose de publier sur le blog ; la version personnelle garde l\'export pour le site': async () => {
    for (const [base, expected] of [[server.url, false], [personal.url, true]]) {
      const a = await open(base, 'app/index.html');
      try {
        await plannerReady(a.page);
        const s = await a.page.evaluate(() => { J.posts.push({ id: 'test', title: 'Récit de test', text: 'Texte', date: '2026-04-01', status: 'ready', created: 1, updated: 1, photos: [] }); journalExportDialog();
          const d = document.querySelector('dialog[open]'); return { site: !!d.querySelector('#exportForSite'), file: !!d.querySelector('#exportJournalConfirm'), text: d.textContent, edition: document.documentElement.dataset.edition }; });
        eq([s.site, s.file, s.edition], [expected, true, expected ? 'personal' : 'public'], base === server.url ? 'version publique' : 'version personnelle');
        if (!expected) assert(!/site Atlas Van|pour le site/.test(s.text) && /publié nulle part/.test(s.text), 'texte du dialogue public : ' + s.text.slice(0, 200));
        eq(a.errors, [], 'erreurs');
      } finally { await a.context.close(); }
    }
  },
  'réglages refusés : voyage en cours inconnu, clé de service pour Partage, adresse non https, clé inconnue': async () => {
    const jwt = (role) => 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' + Buffer.from(JSON.stringify({ role, iss: 'supabase' })).toString('base64url') + '.c2lnbmF0dXJl';
    const cases = [['voyage inconnu', { currentVoyage: 'nulle-part' }, /voyage inconnu/], ['clé service JWT', { community: { url: 'https://exemple.supabase.co', anonKey: jwt('service_role') } }, /clé de service/],
      ['clé secrète', { community: { url: 'https://exemple.supabase.co', anonKey: 'sb_secret_abcdefghijklmnop' } }, /clé de service/], ['http', { community: { url: 'http://exemple.supabase.co', anonKey: jwt('anon') } }, /https/],
      ['secret en plus', { community: { url: 'https://exemple.supabase.co', anonKey: jwt('anon'), serviceKey: 'x' } }, /clé inconnue/], ['hero inconnu', { hero: { titre: 'x' } }, /clé inconnue/]];
    for (const [name, extra, expected] of cases) {
      const dir = contentWith('reglage-' + name.replace(/\W+/g, '-'), (d) => { const f = path.join(d, 'site.json'); fs.writeFileSync(f, JSON.stringify({ ...JSON.parse(fs.readFileSync(f, 'utf8')), ...extra })); }, VOY);
      const r = build('--mode', 'public', '--content', dir, '--dir', path.join(tmp, 'refus-' + name.replace(/\W+/g, '-')));
      assert(r.status === 1 && expected.test(r.stderr + r.stdout), `« ${name} » aurait dû être refusé : ${(r.stderr || r.stdout).trim().slice(0, 160)}`);
    }
  }
});

// ---- exécution -------------------------------------------------------------------------------------------
const started = Date.now();
try {
  for (const [name, tests] of Object.entries(GROUPS)) {
    if (only && !only.some((o) => name.includes(o))) continue;
    for (const [title, fn] of Object.entries(tests)) {
      const t0 = Date.now(); let status = 'PASS', detail = '';
      try { await fn(); } catch (e) { status = 'FAIL'; detail = String(e.message).split('\n')[0].slice(0, 600); }
      results.push({ group: name, title, status, detail, ms: Date.now() - t0 });
      console.log(`${status}  ${name} › ${title}${detail ? '\n        ' + detail : ''}`);
    }
  }
} finally { await browser.close(); await server.close(); await personal.close(); await bare.close(); await voyage.close(); fs.rmSync(tmp, { recursive: true, force: true }); }
const pass = results.filter((r) => r.status === 'PASS').length, fail = results.length - pass;
writeJson(out, { generatedAt: new Date().toISOString(), durationS: Math.round((Date.now() - started) / 1000), totals: { tests: results.length, pass, fail }, measures, results });
console.log(`\nsite : ${pass}/${results.length} PASS, ${fail} FAIL → ${path.relative(ROOT, out)}`);
process.exitCode = fail ? 1 : 0;
