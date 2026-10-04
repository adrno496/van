// Tests de bout en bout de l'espace « Partage » : site construit + serveur de développement (backend/dev/server.mjs) +
// vraie base PostgreSQL (PGlite) avec les migrations et la RLS de backend/. Navigateur : Chromium (Playwright).
//   PLAYWRIGHT_FROM=<…> PGLITE_FROM=<…> node tests/partage.mjs [--out <rapport.json>]
// Ce que ces tests ne couvrent pas : un vrai projet Supabase (Auth, PostgREST, Storage réels) — voir backend/README.md.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT, loadPlaywright, serve, writeJson } from './lib/harness.mjs';
import { loadPGlite } from '../backend/dev/db.mjs';

const args = process.argv.slice(2), out = path.resolve(args.includes('--out') ? args[args.indexOf('--out') + 1] : 'test-results/partage.json');
const results = [];
const assert = (c, m) => { if (!c) throw new Error(m); };
const eq = (a, b, m) => assert(JSON.stringify(a) === JSON.stringify(b), `${m} — attendu ${JSON.stringify(b)}, obtenu ${JSON.stringify(a)}`.slice(0, 600));
if (!(await loadPGlite())) {
  console.log('NON TESTÉ — PGlite introuvable (PGLITE_FROM).');
  writeJson(out, { generatedAt: new Date().toISOString(), status: 'NON TESTÉ', reason: 'PGlite absent', results: [] }); process.exit(0);
}
const { startServer } = await import('../backend/dev/server.mjs');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-partage-'));
const build = (dir, content) => { const r = spawnSync(process.execPath, [path.join(ROOT, 'build.mjs'), '--mode', 'public', '--content', content, '--dir', dir], { encoding: 'utf8', cwd: ROOT }); if (r.status !== 0) throw new Error('construction : ' + r.stderr.slice(0, 400)); return dir; };

// Serveur communautaire et site configuré pour lui. Le site est servi par une autre origine : la CSP et le CORS sont réels.
const site0 = await serve(fs.mkdtempSync(path.join(tmp, 'vide-')));      // réserve un port pour connaître l'origine du site
const siteOrigin = site0.url.replace(/\/$/, ''); await site0.close();
const api = await startServer({ origin: '*', rate: { signup: 500, login: 500 } });   // limites relevées ici ; éprouvées à part (essai « débit »)
const content = path.join(tmp, 'content'); fs.cpSync(path.join(ROOT, 'tests/fixtures/content-voyage'), content, { recursive: true });
const siteJson = JSON.parse(fs.readFileSync(path.join(content, 'site.json'), 'utf8')); siteJson.community = { url: api.url, anonKey: api.anonKey };
fs.writeFileSync(path.join(content, 'site.json'), JSON.stringify(siteJson));
const SITE = build(path.join(tmp, 'site'), content), CLOSED = build(path.join(tmp, 'ferme'), path.join(ROOT, 'tests/fixtures/content-voyage'));
const site = await serve(SITE), closed = await serve(CLOSED);

// Accès direct à l'API, comme le ferait n'importe quel script (attaquant compris).
async function call(p, { method = 'GET', body, token, apikey = api.anonKey } = {}) {
  const res = await fetch(api.url + p, { method, headers: { apikey, 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text(); let data = null; try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data };
}
let seq = 0;
async function user(pseudo, { moderator = false } = {}) {
  const email = `test${++seq}-${Date.now()}@exemple.test`, password = 'motdepasse-solide-' + seq;
  let s = await call('/auth/v1/signup', { method: 'POST', body: { email, password } });
  if (s.status !== 200) throw new Error('inscription : ' + JSON.stringify(s.data));
  if (moderator) { await api.promote(email); s = await call('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password } }); }
  const token = s.data.access_token;
  if (pseudo) { const r = await call('/rest/v1/rpc/save_profile', { method: 'POST', token, body: { p_pseudo: pseudo + seq } }); if (r.status !== 200) throw new Error('profil : ' + JSON.stringify(r.data)); }
  return { email, password, token, id: s.data.user.id, pseudo: pseudo ? pseudo + seq : null, session: s.data };
}
const rpc = (who, fn, body = {}) => call('/rest/v1/rpc/' + fn, { method: 'POST', token: who && who.token, body });
const tip = (o = {}) => ({ type: 'astuce', title: 'Astuce de test publiée', summary: 'Résumé de l’astuce de test, assez long pour passer.', body: 'Premier paragraphe.\n\nSecond paragraphe.', status: 'pending', ...o });
const MOD = await user('Moderatrice', { moderator: true });
const publish = (id) => rpc(MOD, 'moderate_item', { p_item: id, p_status: 'published', p_reason: 'test' });

const { chromium } = loadPlaywright();
const browser = await chromium.launch();
async function open(base, file, { width = 1280, height = 900, mobile = false, session = null } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile, locale: 'fr-FR', reducedMotion: 'reduce' });
  const errors = [], requests = [], csp = [];
  if (session) await context.addInitScript((s) => { try { localStorage.setItem('atlasvan.partage.session', JSON.stringify(s)); } catch (e) { /* */ } }, { access_token: session.access_token, refresh_token: session.refresh_token, expires_at: Date.now() + 3e6, user: session.user });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') { const t = m.text(); if (/Content Security Policy/.test(t)) csp.push(t); else if (!/Failed to load resource/.test(t)) errors.push('console: ' + t.slice(0, 200)); } });
  page.on('request', (r) => requests.push(r.method() + ' ' + r.url()));
  await page.goto(base + file, { waitUntil: 'load' });
  return { context, page, errors, requests, csp };
}
const asSession = (u) => ({ access_token: u.session.access_token, refresh_token: u.session.refresh_token, user: u.session.user });

const TESTS = {
  'espace fermé (sans « community ») : état honnête, aucune connexion autorisée ni tentée, aucun script de Partage': async () => {
    const a = await open(closed.url, 'partage/index.html');
    try {
      const s = await a.page.evaluate(() => ({ empty: document.querySelector('.empty')?.textContent || '', csp: document.querySelector('meta[http-equiv="Content-Security-Policy"]').content, scripts: [...document.scripts].map((x) => x.getAttribute('src')).filter(Boolean), config: !!document.getElementById('partage-config') }));
      assert(/pas encore ouvert/.test(s.empty), 'état fermé : ' + s.empty); assert(/connect-src 'none'/.test(s.csp), 'CSP inchangée : ' + s.csp);
      eq([s.scripts.some((x) => /partage\.js/.test(x)), s.config, fs.existsSync(path.join(CLOSED, 'assets/partage.js'))], [false, false, false], 'aucun script ni configuration');
      assert(a.requests.every((r) => r.includes(closed.url)), 'requêtes hors du site : ' + a.requests.filter((r) => !r.includes(closed.url)).join(', ')); eq(a.errors, [], 'erreurs');
    } finally { await a.context.close(); }
  },
  'lecture sans compte : liste des contributions publiées seulement, recherche, filtres, fiche, badge « Communauté »': async () => {
    const U = await user('Lucie');
    const pub = await rpc(U, 'save_item', { p: tip({ title: 'Remplir l’eau aux fontaines', country: 'France', category: 'eau-vidange' }) }); await publish(pub.data.id);
    const pending = await rpc(U, 'save_item', { p: tip({ title: 'Astuce encore en attente' }) });
    const spot = await rpc(U, 'save_item', { p: { type: 'spot', title: 'Parking calme au bord du Douro', summary: 'Parking en terre, plat, vérifié au printemps 2026.', country: 'Portugal', lat: 41.123, lon: -8.6111, spot_kind: 'parking', night_spot: true, last_verified: '2026-04-01', status: 'pending' } }); await publish(spot.data.id);
    const a = await open(site.url, 'partage/index.html');
    try {
      await a.page.waitForFunction(() => document.querySelectorAll('#partage-results .card').length >= 2);
      const titles = await a.page.locator('#partage-results .card-title').allTextContents();
      assert(titles.includes('Remplir l’eau aux fontaines') && titles.includes('Parking calme au bord du Douro') && !titles.includes('Astuce encore en attente'), 'liste : ' + titles.join(' | '));
      await a.page.fill('#ps-q', 'douro'); await a.page.click('#partage-search button[type=submit]');
      await a.page.waitForFunction(() => /^1 contribution/.test(document.querySelector('#partage-status').textContent));
      await a.page.selectOption('#ps-type', 'astuce'); await a.page.fill('#ps-q', ''); await a.page.click('#partage-search button[type=submit]');
      await a.page.waitForFunction(() => [...document.querySelectorAll('#partage-results .card-title')].every((t) => !/Douro/.test(t.textContent)));
      await a.page.selectOption('#ps-type', ''); await a.page.click('#partage-search button[type=submit]'); await a.page.waitForFunction(() => document.querySelectorAll('#partage-results .card').length >= 2);
      await a.page.click('text=Parking calme au bord du Douro'); await a.page.waitForSelector('#partage-item:not([aria-busy])');
      const s = await a.page.evaluate(() => ({ h1: document.querySelector('h1').textContent, badges: [...document.querySelectorAll('.page-head .badge')].map((b) => b.textContent), caveats: [...document.querySelectorAll('.caveat')].map((c) => c.textContent),
        facts: Object.fromEntries([...document.querySelectorAll('.facts > div')].map((d) => [d.querySelector('dt').textContent, d.querySelector('dd').textContent])), add: document.querySelector('#partage-item a.btn-primary')?.textContent }));
      eq([s.h1, s.badges, s.add], ['Parking calme au bord du Douro', ['Communauté', 'Spot'], 'Ajouter à mes lieux'], 'fiche du spot');
      assert(s.caveats.some((c) => /Contribution de la communauté — à vérifier/.test(c)) && s.caveats.some((c) => /Spot de nuit/.test(c)), 'avertissements : ' + s.caveats.join(' | '));
      assert(/^41,12 N, -8,61 E/.test(s.facts.Position) && /approximative/.test(s.facts.Position) && /1er avril 2026/.test(s.facts['Dernière vérification']), 'position arrondie et date de vérification : ' + JSON.stringify(s.facts));
      eq(a.errors, [], 'erreurs'); eq(a.csp, [], 'violations de CSP');
      await a.page.goto(site.url + 'partage/contribution/index.html?c=' + pending.data.slug); await a.page.waitForSelector('#partage-item:not([aria-busy])');
      eq(await a.page.locator('h1').textContent(), 'Contribution introuvable', 'contribution en attente : introuvable pour un visiteur');
    } finally { await a.context.close(); }
  },
  'compte : inscription, pseudo, proposition avec aperçu et confirmation, statut « en attente », modération, publication': async () => {
    const a = await open(site.url, 'partage/compte/index.html'), email = `ui-${Date.now()}@exemple.test`;
    try {
      await a.page.fill('#pc-email', email); await a.page.fill('#pc-password', 'motdepasse-solide-ui'); await a.page.click('#pc-signup');
      await a.page.waitForSelector('#pc-in:not([hidden])'); await a.page.fill('#pc-pseudo', 'Voyageuse UI'); await a.page.click('#pc-profile button[type=submit]');
      await a.page.waitForFunction(() => /Profil enregistré/.test(document.querySelector('#pc-status').textContent));
      assert(!(await a.page.content()).includes(email) || (await a.page.locator('#pc-email').inputValue()) === email, 'l\'adresse n\'est affichée nulle part ailleurs');
      await a.page.goto(site.url + 'partage/proposer/index.html');
      await a.page.check('input[name=type][value=astuce]'); await a.page.fill('#pp-title', 'Vider les eaux grises proprement');
      await a.page.fill('#pp-summary', 'Seulement aux aires prévues : jamais dans la nature ni dans un égout pluvial.'); await a.page.fill('#pp-body', 'Texte de l’astuce.\n\n<b>Pas de HTML</b>');
      await a.page.click('#pp-preview'); await a.page.waitForFunction(() => /balises HTML/.test(document.querySelector('#pp-status').textContent));
      await a.page.fill('#pp-body', 'Texte de l’astuce.\n\nSecond paragraphe.');
      const before = a.requests.filter((r) => /save_item/.test(r)).length;
      await a.page.click('#pp-preview'); await a.page.waitForSelector('#pp-confirm[open]');
      const preview = await a.page.locator('#pp-preview-body').textContent(); assert(/Vider les eaux grises proprement/.test(preview) && /Second paragraphe/.test(preview), 'aperçu : ' + preview.slice(0, 200));
      eq(a.requests.filter((r) => /save_item/.test(r)).length, before, 'rien n\'est envoyé avant la confirmation');
      await a.page.click('#pp-send'); await a.page.waitForFunction(() => /relecture par un modérateur/.test(document.querySelector('#pp-status').textContent));
      const href = await a.page.locator('#pp-status a').getAttribute('href'), slug = new URL(href, site.url).searchParams.get('c');
      eq((await rpc(null, 'get_item', { p_slug: slug })).data, null, 'en attente : invisible du public');
      const queue = (await rpc(MOD, 'moderation_queue', { p_status: 'pending' })).data; const item = queue.find((q) => q.slug === slug); assert(item, 'dans la file de modération');
      // Le modérateur publie depuis la page de modération.
      const m = await open(site.url, 'partage/moderation/index.html', { session: asSession(MOD) });
      try {
        await m.page.waitForSelector('.mod-card'); const card = m.page.locator('.mod-card', { hasText: 'Vider les eaux grises proprement' });
        await card.locator('input').fill('conforme aux règles'); await card.locator('button', { hasText: 'Publier' }).click();
        await m.page.waitForFunction(() => [...document.querySelectorAll('#pm-log li')].some((l) => /publish — conforme aux règles/.test(l.textContent)));
        eq(m.errors, [], 'erreurs (modération)');
      } finally { await m.context.close(); }
      eq((await rpc(null, 'get_item', { p_slug: slug })).data.status, 'published', 'publiée après modération');
      await a.page.goto(site.url + 'partage/compte/index.html'); await a.page.waitForFunction(() => /Vider les eaux grises/.test(document.querySelector('#pc-items').textContent));
      eq(a.errors, [], 'erreurs'); eq(a.csp, [], 'violations de CSP');
    } finally { await a.context.close(); }
  },
  'XSS stockée : même un contenu hostile présent en base est affiché comme du texte ; lien javascript: jamais rendu': async () => {
    // Contournement délibéré des contraintes (accès administrateur) pour éprouver le rendu du navigateur.
    const U = await user('Hostile');
    const NAMES = ['community_items_title_check', 'community_items_summary_check', 'community_items_body_check', 'community_items_source_url_check'];
    const defs = (await api.db.admin((tx) => tx.query(`select conname, pg_get_constraintdef(oid) def from pg_constraint where conname = any($1)`, [NAMES]))).rows;
    eq(defs.length, 4, 'contraintes retrouvées');
    await api.db.admin(async (tx) => {
      await tx.exec('alter table public.community_items disable trigger community_items_guard; ' + NAMES.map((n) => `alter table public.community_items drop constraint ${n};`).join(' '));
      await tx.query(`insert into public.community_items (owner_id, author_pseudo, type, status, slug, title, summary, body, source_url, published_at) values ($1, $2, 'retour', 'published', 'hostile-xss', $3, $4, $5, $6, now())`,
        [U.id, '<img src=x onerror=window.__xss=4>', '<img src=x onerror=window.__xss=1>', '<script>window.__xss=2</script> résumé hostile', '<svg onload=window.__xss=3></svg>\n\n<a href="javascript:window.__xss=5">clic</a>', 'javascript:window.__xss=6']);
    });
    try {
      for (const f of ['partage/index.html', 'partage/contribution/index.html?c=hostile-xss']) {
        const a = await open(site.url, f);
        try {
          await a.page.waitForFunction(() => !document.querySelector('[aria-busy]') && document.querySelector('#partage-results .card, #partage-item h1'));
          await a.page.waitForTimeout(300);
          const s = await a.page.evaluate(() => ({ xss: window.__xss || 0, img: document.querySelectorAll('main img[src="x"], main svg[onload], main script:not([type])').length, js: [...document.querySelectorAll('a')].filter((x) => /^javascript:/i.test(x.getAttribute('href') || '')).length, text: document.querySelector('main').textContent }));
          eq([s.xss, s.img, s.js], [0, 0, 0], f + ' : aucun code exécuté, aucune balise créée, aucun lien javascript:');
          assert(s.text.includes('<img src=x onerror=window.__xss=1>'), f + ' : texte hostile visible tel quel'); eq(a.errors, [], f + ' : erreurs');
        } finally { await a.context.close(); }
      }
    } finally {
      // Remise en état : contraintes et garde rétablies telles qu'elles étaient.
      await api.db.admin((tx) => tx.exec(`delete from public.community_items where slug = 'hostile-xss'; alter table public.community_items enable trigger community_items_guard; ` + defs.map((d) => `alter table public.community_items add constraint ${d.conname} ${d.def};`).join(' ')));
    }
  },
  'formulaire : circuit (étapes réordonnées), spot (position arrondie), retour d\'expérience ; modifier la sienne ; jamais celle d\'un autre': async () => {
    const U = await user('Formulaire'), other = await user('Voisin'), theirs = await rpc(other, 'save_item', { p: tip({ title: 'Astuce du voisin à protéger' }) });
    const a = await open(site.url, 'partage/proposer/index.html', { session: asSession(U), width: 390, height: 844, mobile: true });
    const sendForm = async () => { await a.page.click('#pp-preview'); await a.page.waitForSelector('#pp-confirm[open]'); await a.page.click('#pp-send'); await a.page.waitForFunction(() => /relecture|Publiée/.test(document.querySelector('#pp-status').textContent)); return new URL(await a.page.locator('#pp-status a').getAttribute('href'), site.url).searchParams.get('c'); };
    try {
      // Circuit : trois étapes saisies, la troisième remontée en deuxième position.
      await a.page.check('input[name=type][value=circuit]'); await a.page.fill('#pp-title', 'Boucle du Douro en fourgon');
      await a.page.fill('#pp-summary', 'Cinq jours de vignobles en terrasses, routes étroites après Pinhão.'); await a.page.fill('#pp-km', '320'); await a.page.fill('#pp-done', '5');
      await a.page.check('input[name=seasons][value=automne]');
      await a.page.click('#pp-add-stop');
      const rows = a.page.locator('#pp-stops > li');
      for (const [k, [n, lat, lon]] of [['Porto', '41,15', '-8,61'], ['Peso da Régua', '41.16', '-7.79'], ['Pinhão', '41,19', '-7,55']].entries()) {
        await rows.nth(k).locator('[data-stop=name]').fill(n); await rows.nth(k).locator('[data-stop=lat]').fill(lat); await rows.nth(k).locator('[data-stop=lon]').fill(lon);
      }
      await rows.nth(2).locator('[data-move="-1"]').click();
      const circuit = await sendForm(), c = (await rpc(U, 'get_item', { p_slug: circuit })).data;
      eq([c.type, c.status, c.distance_km, c.days_done, c.seasons, c.stops.map((s) => s.name), c.stops[1].lat], ['circuit', 'pending', 320, 5, ['automne'], ['Porto', 'Pinhão', 'Peso da Régua'], 41.19], 'circuit enregistré, étapes dans l\'ordre choisi');
      // Spot : position saisie finement, arrondie avant l'envoi.
      await a.page.goto(site.url + 'partage/proposer/index.html'); await a.page.check('input[name=type][value=spot]');
      await a.page.fill('#pp-title', 'Point d’eau du cimetière'); await a.page.fill('#pp-summary', 'Robinet accessible, eau potable selon le panneau (2026).');
      await a.page.fill('#pp-lat', '43,98765'); await a.page.fill('#pp-lon', '4,12345'); await a.page.selectOption('#pp-kind', 'eau'); await a.page.fill('#pp-verified', '2026-05-02');
      const spot = await sendForm(), s = (await rpc(U, 'get_item', { p_slug: spot })).data;
      eq([s.type, s.lat, s.lon, s.spot_kind, s.last_verified], ['spot', 43.99, 4.12, 'eau', '2026-05-02'], 'spot arrondi au centième');
      // Retour d'expérience.
      await a.page.goto(site.url + 'partage/proposer/index.html'); await a.page.check('input[name=type][value=retour]');
      await a.page.fill('#pp-title', 'Trois mois en Grèce hors saison'); await a.page.fill('#pp-summary', 'Ce qui a marché, ce qui a coûté plus cher que prévu, et les ferries.'); await a.page.fill('#pp-body', 'Premier paragraphe.\n\nSecond paragraphe.');
      eq((await rpc(U, 'get_item', { p_slug: await sendForm() })).data.type, 'retour', 'retour d\'expérience enregistré');
      // Modifier sa propre contribution.
      await a.page.goto(site.url + 'partage/proposer/index.html?id=' + spot); await a.page.waitForFunction(() => /Modification de/.test(document.querySelector('#pp-status').textContent));
      eq(await a.page.inputValue('#pp-lat'), '43,99', 'formulaire rempli avec la contribution'); await a.page.fill('#pp-summary', 'Robinet accessible ; eau potable selon le panneau, vérifié en mai 2026.');
      await sendForm(); eq((await rpc(U, 'get_item', { p_slug: spot })).data.summary, 'Robinet accessible ; eau potable selon le panneau, vérifié en mai 2026.', 'modification enregistrée, même adresse');
      // Celle d'un autre : le formulaire refuse de la charger, et un envoi forcé échoue côté serveur.
      await a.page.goto(site.url + 'partage/proposer/index.html?id=' + theirs.data.slug); await a.page.waitForFunction(() => /pas la vôtre/.test(document.querySelector('#pp-status').textContent));
      const forced = await a.page.evaluate(async (args) => { const r = await fetch(args.url + '/rest/v1/rpc/save_item', { method: 'POST', headers: { apikey: args.key, authorization: 'Bearer ' + args.token, 'content-type': 'application/json' }, body: JSON.stringify({ p: { id: args.id, type: 'astuce', title: 'Remplacée par Formulaire', summary: 'Tentative de modification de la contribution d’un autre.' } }) }); return r.status; }, { url: api.url, key: api.anonKey, token: U.token, id: theirs.data.id });
      eq(forced, 404, 'envoi forcé depuis le navigateur refusé'); eq((await rpc(other, 'get_item', { p_slug: theirs.data.slug })).data.title, 'Astuce du voisin à protéger', 'contribution de l\'autre intacte');
      eq(a.errors, [], 'erreurs');
    } finally { await a.context.close(); }
  },
  'pagination : 12 par page, « Voir plus » ajoute la suite sans doublon': async () => {
    for (let u = 0; u < 3; u++) { const W = await user('Auteur'); for (let i = 0; i < 5; i++) { const it = await rpc(W, 'save_item', { p: tip({ title: `Astuce paginée ${u}-${i}` }) }); await publish(it.data.id); } }
    const total = (await rpc(null, 'list_items', { p_limit: 1 })).data.total;
    const a = await open(site.url, 'partage/index.html');
    try {
      await a.page.waitForFunction(() => document.querySelectorAll('#partage-results .card').length === 12);
      assert(await a.page.locator('#partage-more').isVisible(), '« Voir plus » visible');
      await a.page.click('#partage-more'); await a.page.waitForFunction((n) => document.querySelectorAll('#partage-results .card').length === Math.min(n, 24), total);
      const hrefs = await a.page.locator('#partage-results .card-link').evaluateAll((l) => l.map((x) => x.getAttribute('href')));
      eq(new Set(hrefs).size, hrefs.length, 'aucun doublon'); assert(new RegExp('^' + total + ' contributions').test(await a.page.locator('#partage-status').textContent()), 'total annoncé');
      eq(a.errors, [], 'erreurs');
    } finally { await a.context.close(); }
  },
  'circuit → Planner : « Ajouter à mon Planner » et « Créer mon circuit » font une copie locale, l\'original et le catalogue restent intacts': async () => {
    const U = await user('Circuiteur');
    const c = await rpc(U, 'save_item', { p: { type: 'circuit', title: 'Côte catalane en cinq étapes', summary: 'De Perpignan à Cadaqués par la côte, routes étroites au cap.', distance_km: 210, days_done: 5, seasons: ['printemps'], status: 'pending',
      stops: [{ name: 'Perpignan', lat: 42.7, lon: 2.9 }, { name: 'Collioure', lat: 42.53, lon: 3.08, nights: 2 }, { name: 'Barcelone', place_id: 82, lat: 41.39, lon: 2.17 }, { name: 'Étape sans position' }] } });
    await publish(c.data.id);
    const before = JSON.stringify((await rpc(null, 'get_item', { p_slug: c.data.slug })).data);
    const a = await open(site.url, 'partage/contribution/index.html?c=' + c.data.slug);
    try {
      await a.page.waitForSelector('#partage-item:not([aria-busy])');
      eq(await a.page.locator('.stops-numbered > li').count(), 4, 'étapes affichées');
      await a.page.click('text=Ajouter à mon Planner'); await a.page.waitForFunction(() => typeof journalReady !== 'undefined' && journalReady === true, null, { timeout: 20000 });
      await a.page.waitForSelector('dialog[open]');
      const text = await a.page.locator('dialog[open]').textContent();
      assert(/1 étape\(s\) reconnue\(s\)/.test(text) && /2 étape\(s\) ajoutée\(s\) à vos lieux personnels/.test(text) && /1 étape\(s\) sans position/.test(text) && /copie/.test(text), 'résumé : ' + text.slice(0, 300));
      const catalogue = await a.page.evaluate(() => PTS.filter((L) => !L.perso).length);
      await a.page.click('dialog[open] [data-yes]');
      await a.page.waitForFunction(() => { try { return JSON.parse(localStorage.getItem('atlasvan.v3')).route.length === 3; } catch (e) { return false; } }, null, { timeout: 5000 }).catch(() => {});
      const s = await a.page.evaluate(() => ({ route: route.map((i) => byId[i].n), perso: route.filter((i) => byId[i].perso).map((i) => [byId[i].n, byId[i].y, byId[i].x]), hash: location.hash, catalogue: PTS.filter((L) => !L.perso).length, stored: JSON.parse(localStorage.getItem('atlasvan.v3')).route.length }));
      eq([s.route, s.hash, s.catalogue, s.stored], [['Perpignan', 'Collioure', 'Barcelone'], '', catalogue, 3], 'trajet complété, lien consommé, catalogue inchangé, enregistré sur l\'appareil');
      eq(s.perso, [['Perpignan', 42.7, 2.9], ['Collioure', 42.53, 3.08]], 'lieux personnels créés aux positions approximatives');
      // Second import du même circuit : les lieux personnels sont réutilisés, pas dupliqués.
      await a.page.goto(site.url + 'partage/contribution/index.html?c=' + c.data.slug); await a.page.waitForSelector('#partage-item:not([aria-busy])');
      await a.page.click('text=Créer mon circuit à partir de celui-ci'); await a.page.waitForFunction(() => typeof journalReady !== 'undefined' && journalReady === true, null, { timeout: 20000 });
      await a.page.waitForSelector('dialog[open]'); await a.page.click('dialog[open] [data-yes]');
      const t = await a.page.evaluate(() => ({ saved: ST.saved.map((p) => [p.n, p.l.length]), perso: PTS.filter((L) => L.perso).length }));
      eq(t, { saved: [['Côte catalane en cinq étapes (Partage)', 3]], perso: 2 }, 'parcours enregistré, aucun doublon de lieu');
      eq(JSON.stringify((await rpc(null, 'get_item', { p_slug: c.data.slug })).data), before, 'contribution d\'origine inchangée'); eq(a.errors, [], 'erreurs');
    } finally { await a.context.close(); }
  },
  'spot → « Ajouter à mes lieux » : lieu personnel, jamais dans le catalogue ; lien piégé refusé sans effet': async () => {
    const U = await user('Spotteur');
    const s = await rpc(U, 'save_item', { p: { type: 'spot', title: 'Aire de services de test', summary: 'Eau potable et vidange, jeton à la boulangerie.', lat: 43.32, lon: -1.98, spot_kind: 'aire', status: 'pending' } }); await publish(s.data.id);
    const a = await open(site.url, 'partage/contribution/index.html?c=' + s.data.slug);
    try {
      await a.page.waitForSelector('#partage-item:not([aria-busy])'); await a.page.click('text=Ajouter à mes lieux');
      await a.page.waitForFunction(() => typeof journalReady !== 'undefined' && journalReady === true, null, { timeout: 20000 }); await a.page.waitForSelector('dialog[open]'); await a.page.click('dialog[open] [data-yes]');
      const r = await a.page.evaluate(() => { const L = PTS.filter((p) => p.perso)[0]; return { n: L.n, c: L.c, y: L.y, x: L.x, perso: L.perso, note: L.v, inData: DATA.lieux.some((p) => p.n === 'Aire de services de test') }; });
      eq([r.n, r.c, r.y, r.x, r.perso, r.inData], ['Aire de services de test', 'perso', 43.32, -1.98, true, false], 'lieu personnel');
      assert(/Position approximative/.test(r.note) && /réglementation/.test(r.note), 'note de prudence : ' + r.note);
      // Lien piégé : JSON hors format, champs hostiles, coordonnées absurdes.
      for (const bad of ['%%%', Buffer.from('{"v":1,"k":"spot","y":999,"x":0}').toString('base64url'), Buffer.from('{"v":2,"k":"circuit","st":[]}').toString('base64url'), Buffer.from('{"v":1,"k":"circuit","st":[{"n":"<img src=x onerror=window.__x=1>","y":43,"x":2}]}').toString('base64url')]) {
        await a.page.evaluate((h) => { location.hash = 'partage=' + h; }, bad); await a.page.waitForTimeout(250);
        const st = await a.page.evaluate(() => ({ x: window.__x || 0, dialogs: document.querySelectorAll('dialog[open]').length, img: document.querySelectorAll('dialog img[src="x"]').length, text: document.querySelector('dialog[open]')?.textContent || '' }));
        eq([st.x, st.img], [0, 0], 'lien piégé sans effet');
        if (st.dialogs) await a.page.click('dialog[open] [data-no]');
      }
      eq(a.errors, [], 'erreurs');
    } finally { await a.context.close(); }
  },
  'Planner → Partage : aperçu, étapes décochables, lieu de base jamais partagé, notes absentes, rien d\'envoyé sans confirmation': async () => {
    const U = await user('Partageuse');
    const a = await open(site.url, 'app/index.html', { session: asSession(U) });
    try {
      await a.page.waitForFunction(() => typeof journalReady !== 'undefined' && journalReady === true, null, { timeout: 20000 });
      const ids = await a.page.evaluate(() => { const pick = PTS.filter((L) => L.p === 'Espagne' && !L.perso).slice(0, 3).map((L) => L.i); route = pick; ST.notes = ST.notes || {}; ST.notes[pick[0]] = { txt: 'NOTE-PRIVEE-A-NE-PAS-PARTAGER' }; paint(); return pick; });
      await a.page.evaluate(() => { tab('p2'); document.getElementById('shareGroup').open = true; });
      assert(await a.page.locator('#shareGroup').isVisible(), 'action visible dans le Planner du site');
      await a.page.click('#shareCommunity'); await a.page.waitForSelector('dialog[open] .share-list');
      eq(await a.page.locator('dialog[open] input[data-k]').count(), 3, 'une case par étape');
      await a.page.locator('dialog[open] input[data-k]').nth(1).uncheck();
      await Promise.all([a.page.waitForURL(/partage\/proposer\/index\.html/), a.page.click('dialog[open] [data-yes]')]);
      await a.page.waitForSelector('#pp-from-planner:not([hidden])');
      const s = await a.page.evaluate(() => ({ hash: location.hash, type: document.querySelector('input[name=type]:checked').value, stops: [...document.querySelectorAll('#pp-stops [data-stop=name]')].map((i) => i.value), info: document.querySelector('#pp-from-planner').textContent }));
      eq([s.hash, s.type, s.stops.length], ['', 'circuit', 2], 'formulaire prérempli, ancre effacée');
      assert(/Rien n’est envoyé avant votre confirmation/.test(s.info), 'information : ' + s.info);
      assert(!a.requests.some((r) => /NOTE-PRIVEE/.test(decodeURIComponent(r))), 'note privée jamais transmise');
      eq(a.requests.filter((r) => /save_item/.test(r)).length, 0, 'aucun envoi sans confirmation');
      eq(a.errors, [], 'erreurs');
    } finally { await a.context.close(); }
    // Version personnelle : une base (lieu privé) n'est jamais cochable.
    const persoContent = path.join(tmp, 'content-perso'); fs.cpSync(content, persoContent, { recursive: true });
    const r = spawnSync(process.execPath, [path.join(ROOT, 'build.mjs'), '--mode', 'personal', '--content', persoContent, '--dir', path.join(tmp, 'perso')], { encoding: 'utf8', cwd: ROOT }); assert(r.status === 0, 'construction personnelle');
    const perso = await serve(path.join(tmp, 'perso')), b = await open(perso.url, 'app/index.html');
    try {
      await b.page.waitForFunction(() => typeof journalReady !== 'undefined' && journalReady === true, null, { timeout: 20000 });
      await b.page.evaluate(() => { route = [PTS.find((L) => L.c === 'base').i, PTS.find((L) => L.p === 'Espagne').i, PTS.find((L) => L.p === 'France').i]; paint(); shareRouteDialog(); });
      const boxes = await b.page.evaluate(() => [...document.querySelectorAll('dialog[open] input[data-k]')].map((c) => [c.checked, c.disabled]));
      eq(boxes[0], [false, true], 'lieu de base décoché et verrouillé'); eq(b.errors, [], 'erreurs');
    } finally { await b.context.close(); await perso.close(); }
  },
  'favoris, « utile », signalement depuis la fiche ; trois signalements retirent la contribution': async () => {
    const author = await user('Auteure'), it = await rpc(author, 'save_item', { p: tip({ title: 'Astuce à signaler trois fois' }) }); await publish(it.data.id);
    const readers = [await user('Lecteur'), await user('Lectrice'), await user('Lecteur')];
    for (const [k, r] of readers.entries()) {
      const a = await open(site.url, 'partage/contribution/index.html?c=' + it.data.slug, { session: asSession(r) });
      try {
        await a.page.waitForSelector('#partage-item:not([aria-busy])');
        if (k === 0) {
          await a.page.click('button:has-text("Utile")'); await a.page.waitForFunction(() => /Utile ✓ \(1\)/.test([...document.querySelectorAll('.item-actions button')].map((b) => b.textContent).join(' ')));
          await a.page.click('button:has-text("Ajouter aux favoris")'); await a.page.waitForFunction(() => /Ajoutée à vos favoris/.test(document.querySelector('#pi-status').textContent));
        }
        await a.page.click('button:has-text("Signaler")'); await a.page.waitForSelector('#pi-report[open]');
        await a.page.selectOption('#pi-reason', 'faux'); await a.page.fill('#pi-details', 'périmé'); await a.page.click('#pi-report-send');
        await a.page.waitForFunction(() => /Merci/.test(document.querySelector('#pi-status').textContent)); eq(a.errors, [], 'erreurs');
      } finally { await a.context.close(); }
    }
    eq((await rpc(null, 'get_item', { p_slug: it.data.slug })).data, null, 'retirée du public après trois signalements');
    // Le favori reste enregistré, mais la contribution retirée n'apparaît plus dans la liste (elle n'est plus visible).
    eq((await call('/rest/v1/community_bookmarks?select=item_id', { token: readers[0].token })).data, [{ item_id: it.data.id }], 'favori enregistré');
    eq((await rpc(readers[0], 'my_bookmarks')).data, [], 'contribution retirée absente de la liste des favoris');
  },
  'sans droits côté navigateur : page de modération inutilisable sans rôle serveur, jeton forgé refusé, attaques directes de l\'API refusées': async () => {
    const U = await user('Curieux'), V = await user('Victime'), it = await rpc(V, 'save_item', { p: tip({ title: 'Contribution de la victime' }) }); await publish(it.data.id);
    const a = await open(site.url, 'partage/moderation/index.html', { session: asSession(U) });
    try { await a.page.waitForFunction(() => /Réservé aux comptes de modération/.test(document.querySelector('#pm-status').textContent)); eq(await a.page.locator('.mod-card').count(), 0, 'aucune contribution en attente montrée'); }
    finally { await a.context.close(); }
    const forged = api.forge({ sub: U.id, role: 'authenticated', app_metadata: { role: 'moderator' }, exp: Math.floor(Date.now() / 1000) + 600 });
    eq((await call('/rest/v1/rpc/moderation_queue', { method: 'POST', token: forged, body: { p_status: 'pending' } })).status, 401, 'jeton signé par une autre clé');
    const unsigned = Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url') + '.' + Buffer.from(JSON.stringify({ sub: U.id, role: 'authenticated', app_metadata: { role: 'moderator' } })).toString('base64url') + '.';
    eq((await call('/rest/v1/rpc/moderation_queue', { method: 'POST', token: unsigned, body: { p_status: 'pending' } })).status, 401, 'jeton non signé (alg none)');
    eq((await call('/rest/v1/rpc/moderation_queue', { method: 'POST', token: U.token, body: { p_status: 'pending' } })).status, 403, 'compte ordinaire');
    eq((await call('/rest/v1/rpc/list_items', { method: 'POST', apikey: 'mauvaise-cle', body: {} })).status, 401, 'clé publique absente ou fausse');
    eq((await call(`/rest/v1/community_items?id=eq.${it.data.id}`, { method: 'PATCH', token: U.token, body: { title: 'Piraté par Curieux' } })).data, { affected: 0 }, 'PATCH sur la contribution d\'un autre (IDOR)');
    eq((await call(`/rest/v1/community_items?id=eq.${it.data.id}`, { method: 'DELETE', token: U.token })).data, { affected: 0 }, 'DELETE sur la contribution d\'un autre');
    assert((await call('/rest/v1/community_items', { method: 'POST', token: U.token, body: { owner_id: V.id, type: 'astuce', title: 'Signée au nom de la victime', summary: 'Contribution au nom de quelqu’un d’autre.' } })).status === 403, 'owner_id usurpé');
    assert((await call('/rest/v1/community_items', { method: 'POST', token: U.token, body: { owner_id: U.id, type: 'astuce', status: 'published', title: 'Je me publie seul', summary: 'Contournement de la modération.' } })).status === 403, 'statut publié forcé');
    assert([401, 403].includes((await call('/rest/v1/moderation_log', { token: U.token })).status), 'journal de modération');
    assert((await call('/rest/v1/profiles?select=trust_level', { token: U.token })).status === 403, 'niveau de confiance');
    eq((await call(`/rest/v1/community_items?id=eq.${it.data.id}`, { method: 'PATCH', body: { title: 'Anonyme' } })).status, 403, 'écriture anonyme');
    eq((await rpc(null, 'get_item', { p_slug: it.data.slug })).data.title, 'Contribution de la victime', 'contribution intacte');
  },
  'photos (stockage imité) : dossier d\'un autre compte, faux type, SVG, HTML et taille refusés ; lecture seulement si la contribution est visible': async () => {
    const U = await user('Photographe'), V = await user('Autre');
    const png = fs.readFileSync(path.join(ROOT, 'tests/fixtures/content/media/test/photo.png')), uuid = () => crypto.randomUUID();
    const put = (who, p, body, type) => fetch(api.url + '/storage/v1/object/community-media/' + p, { method: 'POST', headers: { apikey: api.anonKey, authorization: 'Bearer ' + who.token, 'content-type': type }, body }).then((r) => r.status);
    const mine = `${U.id}/${uuid()}.png`;
    eq(await put(U, mine, png, 'image/png'), 200, 'dépôt dans son dossier');
    eq(await put(U, `${V.id}/${uuid()}.png`, png, 'image/png'), 403, 'dossier d\'un autre compte');
    eq(await put(U, `${U.id}/${uuid()}.png`, Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>'), 'image/png'), 415, 'SVG déguisé');
    eq(await put(U, `${U.id}/${uuid()}.png`, Buffer.from('<html><script>alert(1)</script>'), 'text/html'), 415, 'HTML');
    eq(await put(U, `${U.id}/${uuid()}.svg`, Buffer.from('<svg/>'), 'image/svg+xml'), 400, 'extension .svg');
    assert([400, 404].includes(await put(U, `${U.id}/../../${uuid()}.png`, png, 'image/png')), 'chemin « ../ » : jamais accepté');
    eq(await put(U, `${U.id}%2F..%2F..%2F${uuid()}.png`, png, 'image/png'), 400, 'chemin « ../ » encodé');
    assert([413, 400].includes(await put(U, `${U.id}/${uuid()}.png`, Buffer.concat([png, Buffer.alloc(6 * 1024 * 1024)]), 'image/png').catch(() => 413)), 'plus de 5 Mo');
    const get = (who) => fetch(api.url + '/storage/v1/object/community-media/' + mine, { headers: { apikey: api.anonKey, ...(who ? { authorization: 'Bearer ' + who.token } : {}) } }).then((r) => r.status);
    eq(await get(null), 404, 'photo rattachée à rien : illisible');
    const it = await rpc(U, 'save_item', { p: tip({ title: 'Astuce illustrée en attente' }) });
    eq((await call('/rest/v1/community_media', { method: 'POST', token: U.token, body: { item_id: it.data.id, owner_id: U.id, path: mine, alt: 'Photo de test' } })).status, 201, 'photo rattachée à sa contribution');
    eq((await call('/rest/v1/community_media', { method: 'POST', token: V.token, body: { item_id: it.data.id, owner_id: V.id, path: `${V.id}/${uuid()}.png` } })).status, 403, 'photo rattachée à la contribution d\'un autre');
    eq([await get(null), await get(U)], [404, 200], 'en attente : lisible par l\'auteur seulement');
    await publish(it.data.id); eq(await get(null), 200, 'publiée : lisible par tous');
  },
  'photos depuis le formulaire : recompressées sur l\'appareil (GPS retiré), description obligatoire, visibles seulement une fois publiées': async () => {
    const { hasGpsPosition } = await import('../build/content.mjs');
    // JPEG portant une position GPS (bloc EXIF ajouté au fichier de test).
    const jpg = fs.readFileSync(path.join(ROOT, 'tests/fixtures/images/photo.jpg')), t = Buffer.alloc(68);
    t.write('II', 0, 'ascii'); t.writeUInt16LE(42, 2); t.writeUInt32LE(8, 4); t.writeUInt16LE(1, 8); t.writeUInt16LE(0x8825, 10); t.writeUInt16LE(4, 12); t.writeUInt32LE(1, 14); t.writeUInt32LE(26, 18);
    const exif = Buffer.concat([Buffer.from('Exif\0\0', 'ascii'), t]), seg = Buffer.alloc(4); seg.writeUInt16BE(0xffe1, 0); seg.writeUInt16BE(exif.length + 2, 2);
    const withGps = Buffer.concat([jpg.subarray(0, 2), seg, exif, jpg.subarray(2)]), file = path.join(tmp, 'photo-gps.jpg'); fs.writeFileSync(file, withGps);
    assert(hasGpsPosition(withGps), 'le fichier de départ porte une position');
    const U = await user('Illustratrice'), a = await open(site.url, 'partage/proposer/index.html', { session: asSession(U) });
    try {
      await a.page.check('input[name=type][value=technique]'); await a.page.fill('#pp-title', 'Fixer un panneau solaire souple');
      await a.page.fill('#pp-summary', 'Colle polyuréthane et rails, sans percer le toit : retour après deux ans.');
      await a.page.setInputFiles('#pp-photos', file); await a.page.waitForSelector('#pp-photo-list .photo-row');
      await a.page.click('#pp-preview'); await a.page.waitForFunction(() => /Photo 1 : une description/.test(document.querySelector('#pp-status').textContent));
      await a.page.fill('#pp-alt-0', 'Panneau solaire collé sur le toit du fourgon');
      await a.page.click('#pp-preview'); await a.page.waitForSelector('#pp-confirm[open]');
      assert(/Panneau solaire collé/.test(await a.page.locator('#pp-preview-body').textContent()), 'photo dans l\'aperçu');
      await a.page.click('#pp-send'); await a.page.waitForFunction(() => /relecture/.test(document.querySelector('#pp-status').textContent), null, { timeout: 15000 });
      const stored = [...api.storage.entries()].filter(([k]) => k.startsWith(U.id + '/'));
      eq(stored.length, 1, 'une photo déposée dans le dossier du compte'); eq([stored[0][1].type, hasGpsPosition(stored[0][1].body)], ['image/jpeg', false], 'JPEG sans position GPS');
      const slug = new URL(await a.page.locator('#pp-status a').getAttribute('href'), site.url).searchParams.get('c'), media = (await rpc(U, 'get_item', { p_slug: slug })).data.media;
      eq([media.length, media[0].alt], [1, 'Panneau solaire collé sur le toit du fourgon'], 'photo rattachée, avec sa description');
      const anon = (who) => fetch(api.url + '/storage/v1/object/authenticated/community-media/' + media[0].path, { headers: { apikey: api.anonKey, authorization: 'Bearer ' + (who ? who.token : api.anonKey) } }).then((r) => r.status);
      eq([await anon(null), await anon(U)], [404, 200], 'en attente : photo invisible du public, visible de l\'auteure');
      await publish((await rpc(U, 'get_item', { p_slug: slug })).data.id); eq(await anon(null), 200, 'publiée : photo visible');
      const v = await open(site.url, 'partage/contribution/index.html?c=' + slug);
      try {
        await v.page.waitForFunction(() => { const i = document.querySelector('.partage-gallery img'); return i && i.complete && i.naturalWidth > 0; });
        eq(await v.page.evaluate(() => [document.querySelector('.partage-gallery img').alt, /^blob:/.test(document.querySelector('.partage-gallery img').src)]), ['Panneau solaire collé sur le toit du fourgon', true], 'photo affichée avec sa description');
        eq([v.errors, v.csp], [[], []], 'erreurs et CSP');
      } finally { await v.context.close(); }
      eq(a.errors, [], 'erreurs');
    } finally { await a.context.close(); }
  },
  'débit : inscriptions et tentatives de connexion limitées par adresse (serveur imité) ; contributions limitées par la base': async () => {
    const small = await startServer({ origin: '*', rate: { signup: 2, login: 3 } });
    try {
      const up = (k) => fetch(small.url + '/auth/v1/signup', { method: 'POST', headers: { apikey: small.anonKey, 'content-type': 'application/json' }, body: JSON.stringify({ email: `debit${k}@exemple.test`, password: 'motdepasse-solide' }) }).then((r) => r.status);
      eq([await up(1), await up(2), await up(3)], [200, 200, 429], 'troisième inscription refusée');
      const login = () => fetch(small.url + '/auth/v1/token?grant_type=password', { method: 'POST', headers: { apikey: small.anonKey, 'content-type': 'application/json' }, body: JSON.stringify({ email: 'debit1@exemple.test', password: 'mauvais-mot-de-passe' }) }).then((r) => r.status);
      eq([await login(), await login(), await login(), await login()], [400, 400, 400, 429], 'quatrième tentative de connexion refusée');
    } finally { await small.close(); }
    const W = await user('Prolifique');
    for (let i = 0; i < 5; i++) eq((await rpc(W, 'save_item', { p: tip({ title: 'Contribution rapide ' + i }) })).status, 200, 'contribution ' + (i + 1));
    const sixth = await rpc(W, 'save_item', { p: tip({ title: 'Contribution de trop' }) }); eq([sixth.status, /rate_limit/.test(sixth.data.message)], [429, true], 'sixième contribution dans l\'heure : 429');
  },
  'serveur injoignable : bandeau, pages lisibles, blog intact, aucune relance automatique': async () => {
    const down = await startServer({ origin: '*' }); const url = down.url; await down.close();
    const c = path.join(tmp, 'content-down'); fs.cpSync(content, c, { recursive: true });
    const j = JSON.parse(fs.readFileSync(path.join(c, 'site.json'), 'utf8')); j.community = { url, anonKey: api.anonKey }; fs.writeFileSync(path.join(c, 'site.json'), JSON.stringify(j));
    const dir = build(path.join(tmp, 'site-down'), c), s = await serve(dir);
    try {
      const a = await open(s.url, 'partage/index.html');
      try {
        await a.page.waitForSelector('[data-partage-offline]:not([hidden])', { timeout: 12000 });
        await a.page.waitForTimeout(2500);
        const calls = a.requests.filter((r) => r.includes(url)).length;
        eq(calls, 1, 'une seule tentative, pas de relance en boucle');
        assert(/ne répond pas/.test(await a.page.locator('#partage-status').textContent()) && await a.page.locator('h1').textContent() === 'Partage', 'message et page lisible');
        await a.page.click('[data-partage-retry]'); await a.page.waitForTimeout(800); eq(a.requests.filter((r) => r.includes(url)).length, 2, 'relance seulement à la demande');
        eq(a.errors, [], 'erreurs');
      } finally { await a.context.close(); }
      const h = await open(s.url, 'index.html');
      try { eq([await h.page.locator('h1').textContent(), h.requests.filter((r) => r.includes(url)).length], ['Titre d’accueil de test', 0], 'accueil du blog : intact, aucune requête vers Partage'); eq(h.errors, [], 'erreurs (accueil)'); }
      finally { await h.context.close(); }
    } finally { await s.close(); }
  },
  'CSP : seule l\'origine du serveur communautaire est joignable, et seulement depuis les pages de Partage': async () => {
    const a = await open(site.url, 'partage/index.html');
    try {
      await a.page.waitForSelector('#partage-results');
      const blocked = await a.page.evaluate(() => fetch('https://exemple.org/').then(() => 'ok', () => 'bloqué'));
      eq(blocked, 'bloqué', 'requête vers une autre origine'); assert(a.csp.some((t) => /connect-src/.test(t)), 'violation de CSP signalée');
    } finally { await a.context.close(); }
    const h = await open(site.url, 'index.html');
    try { eq(await h.page.evaluate((u) => fetch(u + '/rest/v1/rpc/list_items', { method: 'POST' }).then(() => 'ok', () => 'bloqué'), api.url), 'bloqué', 'accueil : le serveur communautaire est hors de portée'); }
    finally { await h.context.close(); }
    for (const f of walk(SITE).filter((x) => x.endsWith('.html') && !x.startsWith('app'))) {
      const body = fs.readFileSync(path.join(SITE, f), 'utf8'), csp = /Content-Security-Policy" content="([^"]+)"/.exec(body)[1];
      const partage = f.startsWith('partage' + path.sep) && !f.startsWith(path.join('partage', 'regles'));
      assert(partage ? csp.includes('connect-src ' + api.url) : csp.includes("connect-src 'none'"), f + ' : ' + csp);
      assert(!/\*|unsafe-inline|unsafe-eval/.test(csp) && /object-src 'none'/.test(csp), f + ' : CSP trop large');
    }
  },
  'dist : aucune clé de service, aucun secret, aucun outil de développement publié ; seule la clé anon est présente': async () => {
    const files = walk(SITE).filter((f) => /\.(html|js|css|json|xml|txt)$/.test(f));
    for (const f of files) {
      const body = fs.readFileSync(path.join(SITE, f), 'utf8');
      assert(!/service_role|sb_secret_|SUPABASE_SERVICE|PGLITE|pglite|startServer|encrypted_password|BEGIN [A-Z ]*PRIVATE KEY/.test(body), f + ' : motif interdit');
      for (const m of body.matchAll(/eyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g)) eq(JSON.parse(Buffer.from(m[0].split('.')[1], 'base64url')).role, 'anon', f + ' : jeton présent');
    }
    assert(!walk(SITE).some((f) => /backend|\.sql$|server\.mjs|db\.mjs/.test(f)), 'aucun fichier du dossier backend/');
  },
  'compte : export de ses données, déconnexion, suppression du compte confirmée par le pseudo': async () => {
    const U = await user('Partante'); await rpc(U, 'save_item', { p: tip({ title: 'Astuce de la partante' }) });
    const a = await open(site.url, 'partage/compte/index.html', { session: asSession(U) });
    try {
      await a.page.waitForFunction(() => /Inscrit le/.test(document.querySelector('#pc-since').textContent));
      const [download] = await Promise.all([a.page.waitForEvent('download'), a.page.click('#pc-export')]);
      const data = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
      eq([data.account.email, data.profile.pseudo, data.items.length], [U.email, U.pseudo, 1], 'export');
      await a.page.click('#pc-delete'); await a.page.fill('#pc-delete-pseudo', 'pas le bon'); await a.page.click('#pc-delete-go');
      await a.page.waitForFunction(() => /rien n’a été supprimé/.test(document.querySelector('#pc-status').textContent));
      await a.page.click('#pc-delete'); await a.page.fill('#pc-delete-pseudo', U.pseudo); await a.page.click('#pc-delete-go');
      await a.page.waitForFunction(() => /Compte et contributions supprimés/.test(document.querySelector('#pc-status').textContent));
      eq([await a.page.evaluate(() => localStorage.getItem('atlasvan.partage.session')), (await call('/auth/v1/token?grant_type=password', { method: 'POST', body: { email: U.email, password: U.password } })).status], [null, 400], 'session oubliée, compte supprimé');
      eq(a.errors, [], 'erreurs');
    } finally { await a.context.close(); }
  },
  'accessibilité et mobile : champs nommés, pas de débordement à 320 px, cibles de 44 px': async () => {
    for (const f of ['partage/index.html', 'partage/proposer/index.html', 'partage/compte/index.html', 'partage/regles/index.html']) {
      for (const width of [320, 390, 1280]) {
        const a = await open(site.url, f, { width, height: 800, mobile: width < 1024 });
        try {
          await a.page.waitForTimeout(300);
          const s = await a.page.evaluate(() => ({ overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
            unnamed: [...document.querySelectorAll('main input:not([type=hidden]), main select, main textarea')].filter((e) => !e.closest('[hidden]') && !(e.labels && e.labels.length) && !e.getAttribute('aria-label')).map((e) => e.id || e.name),
            small: [...document.querySelectorAll('main a, main button, main input[type=checkbox], main input[type=radio], main summary')].filter((e) => { const r = e.getBoundingClientRect(); return r.width && !e.closest('[hidden]') && !e.closest('.prose') && !e.closest('p') && Math.max(r.height, (e.closest('label') || e).getBoundingClientRect().height) < 44; }).map((e) => (e.textContent || e.name || e.tagName).trim().slice(0, 20)) }));
          eq(s.overflow <= 0, true, `${f} à ${width} px : débordement ${s.overflow}`); eq(s.unnamed, [], `${f} : champs sans nom`);
          if (width < 1024) eq(s.small, [], `${f} à ${width} px : cibles trop petites`);
          eq(a.errors, [], f + ' : erreurs');
        } finally { await a.context.close(); }
      }
    }
  }
};
function walk(dir, base = '') { return fs.readdirSync(path.join(dir, base), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(dir, path.join(base, e.name)) : [path.join(base, e.name)])); }

const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
try {
  for (const [title, fn] of Object.entries(TESTS)) {
    if (only && !title.includes(only)) continue;
    const t0 = Date.now(); let status = 'PASS', detail = '';
    try { await fn(); } catch (e) { status = 'FAIL'; detail = String(e.message).split('\n')[0].slice(0, 600); }
    results.push({ title, status, detail, ms: Date.now() - t0 });
    console.log(`${status}  ${title}${detail ? '\n        ' + detail : ''}`);
  }
} finally { await browser.close(); await site.close(); await closed.close(); await api.close(); fs.rmSync(tmp, { recursive: true, force: true }); }
const pass = results.filter((r) => r.status === 'PASS').length;
writeJson(out, { generatedAt: new Date().toISOString(), engine: 'Chromium + serveur de développement (PGlite)', totals: { tests: results.length, pass, fail: results.length - pass }, results });
console.log(`\npartage (bout en bout) : ${pass}/${results.length} PASS → ${path.relative(ROOT, out)}`);
process.exitCode = pass === results.length ? 0 : 1;
