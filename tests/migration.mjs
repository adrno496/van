// Compatibilité des données : ce que l'ancienne version a enregistré doit être relu à l'identique par la nouvelle,
// et un retour à l'ancienne version doit rester possible (les formats de stockage n'ont pas changé).
//   node tests/migration.mjs --old <ancien index.html> [--new <nouvel index.html>] [--out <rapport.json>]
// Les deux versions sont servies tour à tour à la même adresse : même origine, donc mêmes données de navigateur.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ROOT, loadPlaywright, serve, writeJson } from './lib/harness.mjs';

const args = process.argv.slice(2);
const opt = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
const oldFile = path.resolve(opt('--old', path.join(ROOT, 'audit-refonte/baseline/index.baseline.html')));
const newFile = path.resolve(opt('--new', path.join(ROOT, 'index.html')));
const out = path.resolve(opt('--out', 'test-results/migration.json'));
const results = [];
const assert = (c, m) => { if (!c) throw new Error(m); };
const eq = (a, b, m) => assert(JSON.stringify(a) === JSON.stringify(b), `${m} — attendu ${JSON.stringify(b).slice(0, 300)}, obtenu ${JSON.stringify(a).slice(0, 300)}`);
async function test(title, fn) {
  let status = 'PASS', detail = '';
  try { await fn(); } catch (e) { status = 'FAIL'; detail = String(e.message).split('\n')[0].slice(0, 600); }
  results.push({ title, status, detail }); console.log(`${status}  ${title}${detail ? '\n        ' + detail : ''}`);
}

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-migration-'));
// Le fichier de référence est en lecture seule : on recopie son contenu plutôt que le fichier et ses droits.
const install = (file) => { const dest = path.join(dir, 'index.html'); fs.rmSync(dest, { force: true }); fs.writeFileSync(dest, fs.readFileSync(file)); };
const { chromium } = loadPlaywright();
const server = await serve(dir);
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'fr-FR', acceptDownloads: true });
await context.route('**/*', (r) => (/^(http:\/\/127\.0\.0\.1|data:|blob:)/.test(r.request().url()) ? r.continue() : r.abort()));
const page = await context.newPage();
const errors = []; page.on('pageerror', (e) => errors.push(e.message));
const open = async () => { await page.goto(server.url, { waitUntil: 'load' }); await page.waitForFunction(() => typeof journalReady !== 'undefined' && journalReady, null, { timeout: 20000 }); };
const download = async (trigger) => { const [d] = await Promise.all([page.waitForEvent('download'), trigger()]); return fs.readFileSync(await d.path(), 'utf8'); };
// Instantané de tout ce que l'utilisateur possède, lu de la même façon dans les deux versions.
const snapshot = () => page.evaluate(() => ({
  route: route.slice(), notes: JSON.parse(JSON.stringify(ST.notes)), custom: PTS.filter((p) => p.perso).map((p) => ({ i: p.i, n: p.n, x: p.x, y: p.y, c: p.c, d: p.d, s: p.s, pe: p.pe || 0 })),
  edited: Object.keys(ST.edits).map((id) => [Number(id), byId[id].n, byId[id].d, byId[id].s]), saved: (ST.saved || []).map((p) => [p.n, p.d, p.l]),
  opts: ['oConso', 'oRythme', 'oNuits', 'oJour', 'oNuit', 'oVis', 'oPax', 'oDate'].map((id) => document.querySelector('#' + id).value), cSeq,
  km: document.querySelector('#sKm').textContent.replace(/\D/g, ''), budget: document.querySelector('#sBud').textContent.replace(/\D/g, ''),
  journal: { title: J.title, subtitle: J.subtitle, author: J.author, posts: J.posts.map((p) => ({ id: p.id, title: p.title, date: p.date, text: p.text, status: p.status, placeId: p.placeId, location: p.location, photos: p.photos.map((ph) => [ph.caption, ph.src.length, ph.src.slice(0, 40)]) })) },
  privacy: localStorage.getItem('atlasvan.privacy'), blurredP2: document.querySelector('#p2').classList.contains('is-blurred'), keys: Object.keys(localStorage).sort()
}));

let before, backupV5, backupV3, routeFile;
try {
  install(oldFile); await open();
  await test('ancienne version : création d\'un jeu de données complet', async () => {
    await page.evaluate(async () => {
      const id = (n) => PTS.find((p) => p.n === n).i;
      route = ['Nantes', 'Paris', 'Annecy', 'Lisbonne', 'Porto'].map(id); paint();
      Object.assign(nt(id('Paris')), { st: 'fav', txt: 'Parking Bercy — 12 €/nuit', bud: 85, date: '2026-05-03' }); nt(id('Annecy')).st = 'done'; nt(id('Porto')).txt = 'Francesinha !';
      const L = { i: 'c' + (++cSeq), n: 'Bivouac du col', y: 45.0312, x: 6.4071, p: 'Perso', c: 'nature', w: 1, d: 'Vue sur la vallée', s: 'juin-sept', v: 'Lever de soleil · source à 200 m', du: '1 nuit', e: '', pe: 0, perso: true };
      L.m = months(L.s); register(L); route.push(L.i); paint();
      show(id('Annecy')); edit(byId[id('Annecy')]); document.querySelector('#eD').value = 'Lac, vieille ville et Semnoz'; document.querySelector('#eS').value = 'mai-oct'; document.querySelector('#eOk').click();
      ST.saved = [{ n: 'Boucle test', d: 'France puis Portugal', l: route.slice(0, 3) }]; ST.prAppend = true;
      for (const [k, v] of [['oConso', '10.5'], ['oRythme', '300'], ['oNuits', '3'], ['oPax', '2'], ['oDate', '2026-04-15']]) { const e = document.querySelector('#' + k); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); }
      localStorage.setItem('atlasvan.privacy', JSON.stringify({ p2: true, p3: false }));
      const png = (c) => { const k = document.createElement('canvas'); k.width = 320; k.height = 200; const x = k.getContext('2d'); x.fillStyle = c; x.fillRect(0, 0, 320, 200); return k.toDataURL('image/jpeg', .8); };
      J.title = 'Printemps 2026'; J.subtitle = 'De la Loire au Douro'; J.author = 'A.';
      J.posts = [{ id: 'post-a', title: 'Premier soir', date: '2026-04-16', text: 'La Loire au couchant.\nPremière nuit en van.', placeId: id('Nantes'), location: { n: 'Nantes', p: 'France', x: -1.554, y: 47.218 }, status: 'ready', created: 1, updated: 2, photos: [{ id: 'ph1', src: png('#3f8ea3'), caption: 'Quai de la Fosse' }, { id: 'ph2', src: png('#bd5228'), caption: '' }] },
        { id: 'post-b', title: 'Brouillon', date: '2026-04-20', text: 'À finir.', placeId: null, location: null, status: 'draft', created: 3, updated: 4, photos: [] }];
      await persistJournal(); save();
    });
    await page.waitForTimeout(900);
    before = await snapshot(); eq([before.route.length, before.custom.length, before.journal.posts.length, before.saved.length], [6, 1, 2, 1], 'jeu de données');
    backupV5 = await download(() => page.evaluate(() => backupEverything()));
    backupV3 = await download(() => page.evaluate(() => document.querySelector('#bkExp').click()));
    routeFile = await download(() => page.evaluate(() => document.querySelector('#expJson').click()));
  });

  install(newFile); await open();
  let after;
  await test('nouvelle version : trajet, notes, lieux personnels, fiches et parcours relus à l\'identique', async () => {
    after = await snapshot();
    for (const k of ['route', 'notes', 'custom', 'edited', 'saved', 'opts', 'cSeq', 'km', 'budget']) eq(after[k], before[k], k);
  });
  await test('nouvelle version : carnet et photos relus à l\'identique (IndexedDB)', async () => eq(after.journal, before.journal, 'carnet'));
  await test('nouvelle version : préférence de discrétion conservée et appliquée', async () => { eq(after.blurredP2, true, 'rubrique floutée'); eq(JSON.parse(after.privacy).p2, true, 'préférence'); });
  await test('nouvelle version : aucune erreur, aucune donnée mise de côté', async () => { eq(errors, [], 'erreurs'); eq(await page.evaluate(() => [stateRepaired, localStorage.getItem('atlasvan.v3.recovery')]), [false, null], 'réparation'); });
  await test('nouvelle version : une modification s\'enregistre et se relit', async () => {
    await page.evaluate(() => { addTo(PTS.find((p) => p.n === 'Bordeaux').i); nt(PTS.find((p) => p.n === 'Nantes').i).txt = 'Ajout après migration'; save(); }); await page.waitForTimeout(700); await page.reload(); await page.waitForFunction(() => typeof journalReady !== 'undefined' && journalReady);
    eq(await page.evaluate(() => [route.length, ST.notes[PTS.find((p) => p.n === 'Nantes').i].txt]), [7, 'Ajout après migration'], 'après rechargement');
  });

  install(oldFile); await open();
  await test('retour à l\'ancienne version : elle relit les données écrites par la nouvelle', async () => {
    const back = await snapshot();
    eq([back.route.length, back.custom, back.edited, back.saved, back.journal], [7, before.custom, before.edited, before.saved, before.journal], 'données après retour arrière'); eq(errors, [], 'erreurs');
  });

  // Fichiers produits par l'ancienne version, importés dans la nouvelle sur un navigateur vierge.
  install(newFile);
  const fresh = async () => { const c = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'fr-FR' }); const p = await c.newPage(); await p.goto(server.url); await p.waitForFunction(() => typeof journalReady !== 'undefined' && journalReady); return { c, p }; };
  await test('sauvegarde complète de l\'ancienne version restaurée par la nouvelle', async () => {
    const { c, p } = await fresh();
    try { await p.setInputFiles('#bkImp', { name: 'atlas.json', mimeType: 'application/json', buffer: Buffer.from(backupV5) }); await p.waitForSelector('#confirmJournalImport');
      await Promise.all([p.waitForNavigation({ waitUntil: 'load' }), p.click('#confirmJournalImport')]); await p.waitForFunction(() => typeof journalReady !== 'undefined' && journalReady);
      const s = await p.evaluate(() => ({ route: route.slice(), notes: JSON.parse(JSON.stringify(ST.notes)), custom: PTS.filter((x) => x.perso).length, saved: ST.saved.length, posts: J.posts.map((x) => [x.id, x.photos.length]), title: J.title }));
      eq([s.route, s.notes, s.custom, s.saved, s.posts, s.title], [before.route, before.notes, 1, 1, [['post-a', 2], ['post-b', 0]], 'Printemps 2026'], 'contenu restauré');
    } finally { await c.close(); }
  });
  await test('sauvegarde « trajets et fiches » de l\'ancienne version restaurée par la nouvelle', async () => {
    const { c, p } = await fresh();
    try { await p.setInputFiles('#bkImp', { name: 'atlas-v3.json', mimeType: 'application/json', buffer: Buffer.from(backupV3) }); await p.waitForSelector('#confirmJournalImport');
      await Promise.all([p.waitForNavigation({ waitUntil: 'load' }), p.click('#confirmJournalImport')]); await p.waitForFunction(() => typeof journalReady !== 'undefined' && journalReady);
      eq(await p.evaluate(() => [route.slice(), JSON.parse(JSON.stringify(ST.notes)), ST.saved.length, J.posts.length]), [before.route, before.notes, 1, 0], 'contenu restauré');
    } finally { await c.close(); }
  });
  await test('parcours .json de l\'ancienne version importé par la nouvelle', async () => {
    const { c, p } = await fresh();
    try { await p.setInputFiles('#imp', { name: 'mon-parcours.json', mimeType: 'application/json', buffer: Buffer.from(routeFile) }); await p.waitForFunction(() => route.length > 0, null, { timeout: 5000 });
      const s = await p.evaluate(() => ({ names: route.map((i) => byId[i].n), fav: Object.values(ST.notes).filter((n) => n.st === 'fav').length, perso: PTS.filter((x) => x.perso).map((x) => [x.n, x.y, x.x]) }));
      eq(s.names, ['Nantes', 'Paris', 'Annecy', 'Lisbonne', 'Porto', 'Bivouac du col'], 'étapes'); eq([s.fav, s.perso], [1, [['Bivouac du col', 45.0312, 6.4071]]], 'statuts et lieu personnel');
    } finally { await c.close(); }
  });
} finally { await browser.close(); await server.close(); fs.rmSync(dir, { recursive: true, force: true }); }
const pass = results.filter((r) => r.status === 'PASS').length;
writeJson(out, { old: oldFile, new: newFile, generatedAt: new Date().toISOString(), totals: { tests: results.length, pass, fail: results.length - pass }, results });
console.log(`\nmigration : ${pass}/${results.length} PASS`);
process.exitCode = results.length - pass ? 1 : 0;
