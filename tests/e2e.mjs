// Suite de non-régression fonctionnelle d'Atlas van (parcours 1 à 6 du cahier des charges + données + sécurité).
//   node tests/e2e.mjs [--dir <dossier servi>] [--out <rapport.json>] [--only <groupe,...>] [--label <nom>] [--catalogue public]
// Les tests pilotent l'application par ses identifiants et son état interne : ils s'exécutent à l'identique
// sur la baseline et sur la version refondue. Un test ne passe que si l'effet attendu est observé.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, loadPlaywright, serve, openApp, writeJson } from './lib/harness.mjs';

const args = process.argv.slice(2);
const opt = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
const dir = path.resolve(opt('--dir', ROOT));
const out = path.resolve(opt('--out', 'test-results/e2e.json'));
const only = opt('--only', null)?.split(',');
const label = opt('--label', path.basename(dir));
// Ce qui dépend du catalogue livré. La version publique n'a pas les 5 bases personnelles : 1 595 lieux, premier identifiant 3,
// premier parcours de 45 étapes. Les mêmes 77 tests s'appliquent, avec ces valeurs.
const CAT = opt('--catalogue', 'personal') === 'public' ? { places: 1595, first: 3, preset0: 45, editable: 'Nantes' } : { places: 1600, first: 0, preset0: 51, editable: 'La Roche-sur-Yon' };

const results = [];
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };
const eq = (a, b, msg) => assert(JSON.stringify(a) === JSON.stringify(b), `${msg} — attendu ${JSON.stringify(b)}, obtenu ${JSON.stringify(a)}`);

// ---- aides -----------------------------------------------------------------------------------------------
const ev = (page, fn, arg) => page.evaluate(fn, arg);
const jsClick = (page, sel) => ev(page, (s) => { const e = document.querySelector(s); if (!e) throw new Error('élément absent : ' + s); e.click(); }, sel);
const idOf = (page, name) => ev(page, (n) => { const p = PTS.find((x) => x.n === n); if (!p) throw new Error('lieu inconnu : ' + n); return p.i; }, name);
const routeOf = (page) => ev(page, () => route.slice());
const settle = (page, ms = 120) => page.waitForTimeout(ms);
const setValue = (page, sel, value, event = 'input') => ev(page, ([s, v, e]) => { const el = document.querySelector(s); if (!el) throw new Error('champ absent : ' + s); el.value = v; el.dispatchEvent(new Event(e, { bubbles: true })); }, [sel, value, event]);

// Répond à un dialogue, qu'il soit natif (prompt/confirm de la baseline) ou intégré à la page (<dialog>).
async function answer(page, trigger, { texts = [], accept = true } = {}) {
  let native = 0;
  const handler = async (d) => { const t = texts[native++]; try { accept ? await d.accept(t ?? undefined) : await d.dismiss(); } catch { /* déjà traité */ } };
  page.on('dialog', handler);
  try { await trigger(); await settle(page, 200); } finally { page.off('dialog', handler); }
  if (native) return 'native';
  const dlg = page.locator('dialog[open]').last();
  if (!(await dlg.count())) return 'none';
  const inputs = dlg.locator('[data-dialog-input]');
  for (let i = 0; i < texts.length && i < (await inputs.count()); i++) await inputs.nth(i).fill(String(texts[i]));
  await dlg.locator(accept ? '[data-dialog-ok]' : '[data-dialog-cancel]').first().click();
  await settle(page, 200);
  return 'custom';
}
async function download(page, trigger) {
  const [d] = await Promise.all([page.waitForEvent('download', { timeout: 8000 }), trigger()]);
  const file = await d.path();
  return { name: d.suggestedFilename(), text: fs.readFileSync(file, 'utf8') };
}
async function pngBuffer(page, w = 900, h = 600, color = '#3f8ea3') {
  const url = await ev(page, ([w, h, c]) => { const k = document.createElement('canvas'); k.width = w; k.height = h; const x = k.getContext('2d'); x.fillStyle = c; x.fillRect(0, 0, w, h); x.fillStyle = '#fff'; x.fillRect(40, 40, 200, 120); return k.toDataURL('image/png'); }, [w, h, color]);
  return Buffer.from(url.split(',')[1], 'base64');
}
const screenOf = (page, id) => ev(page, (i) => { const p = byId[i], r = document.querySelector('#map').getBoundingClientRect(); return { x: r.left + (p.px - vb[0]) / vb[2] * r.width, y: r.top + (p.py - vb[1]) / vb[3] * r.height }; }, id);
const waitJournalSaved = (page) => page.waitForFunction(() => journalSaving === 0 && !journalTimer, null, { timeout: 8000 });
const digits = (text) => Number(String(text).replace(/\D/g, '') || NaN);
const firstNumber = (text) => digits((String(text).match(/^[\d\s\u00a0\u202f]+/) || [''])[0]);
const closeDialogs = (page) => ev(page, () => document.querySelectorAll('dialog[open]').forEach((d) => d.close()));

// ---- groupes de tests ------------------------------------------------------------------------------------
const GROUPS = {};
const group = (name, viewport, options, tests) => { GROUPS[name] = { viewport, options, tests }; };

group('P1-explorer', 'desktop-1440x900', {}, {
  'chargement initial : carte, 1 600 lieux, aucun message d\'erreur': async ({ page, errors }) => {
    const s = await ev(page, () => ({ pts: PTS.length, nodes: document.querySelectorAll('#map .poi').length, pays: document.querySelectorAll('#map path.pays').length, vb: vb.slice(), title: document.title }));
    eq(s.pts, CAT.places, 'nombre de lieux'); eq(s.nodes, CAT.places, 'marqueurs dessinés'); assert(s.pays >= 40, 'pays dessinés'); assert(s.vb[2] > 0, 'vue initialisée');
    assert(/Atlas van/.test(s.title), 'titre de page'); eq(errors, [], 'erreurs console au chargement');
  },
  'recherche globale : résultats, sélection, fiche affichée': async ({ page }) => {
    await page.fill('#q', 'chambord'); await settle(page);
    const n = await page.locator('#res [data-s]').count(); assert(n >= 1, 'au moins un résultat pour « chambord »');
    await jsClick(page, '#res [data-s]'); await settle(page);
    const s = await ev(page, () => ({ sel, title: document.querySelector('#detail :is(h2,h3)')?.textContent || '', resOpen: document.querySelector('#res').classList.contains('on') }));
    assert(/Chambord/.test(s.title), 'la fiche Chambord est affichée'); eq(s.resOpen, false, 'liste de résultats refermée');
  },
  'recherche sans résultat : message explicite': async ({ page }) => {
    await page.fill('#q', 'zzzzqqq'); await settle(page);
    assert(/Aucun résultat/i.test(await page.locator('#res').innerText()), 'message « Aucun résultat »');
    await page.fill('#q', '');
  },
  'recherche au clavier : flèche bas puis Entrée ouvre la fiche': async ({ page }) => {
    await page.fill('#q', 'lisbonne'); await settle(page);
    await page.focus('#q'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); await settle(page);
    assert(/Lisbonne/.test(await ev(page, () => document.querySelector('#detail :is(h2,h3)')?.textContent || '')), 'fiche Lisbonne ouverte au clavier');
  },
  'zoom : boutons, molette, touches + et -': async ({ page }) => {
    await ev(page, () => { document.querySelector('dialog[open]')?.close(); setMobileView('map'); fitDefault(); }); await settle(page, 250);
    const w0 = await ev(page, () => vb[2]);
    await jsClick(page, '#zin'); await settle(page); const w1 = await ev(page, () => vb[2]); assert(w1 < w0, 'zoom avant réduit la largeur de vue');
    await jsClick(page, '#zout'); await settle(page); const w2 = await ev(page, () => vb[2]); assert(Math.abs(w2 - w0) < 1e-6, 'zoom arrière revient à la vue initiale');
    const box = await page.locator('#map').boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.wheel(0, -300); await settle(page);
    const w3 = await ev(page, () => vb[2]); assert(w3 < w2, 'molette vers le haut : zoom avant');
    await ev(page, () => document.activeElement?.blur()); await page.keyboard.press('-'); await settle(page);
    const w4 = await ev(page, () => vb[2]); assert(w4 > w3, 'touche « - » : zoom arrière');
    await page.keyboard.press('0'); await settle(page); const w5 = await ev(page, () => vb[2]); assert(Math.abs(w5 - w0) < 1e-6, 'touche « 0 » : vue d\'ensemble');
    await jsClick(page, '#zfit'); await settle(page); assert((await ev(page, () => vb[2])) > 0, 'ajuster à tous les lieux');
  },
  'déplacement de la carte à la souris': async ({ page }) => {
    await ev(page, () => fitDefault()); await settle(page, 250);
    const before = await ev(page, () => vb.slice()); const box = await page.locator('#map').boundingBox();
    const cx = box.x + box.width * 0.5, cy = box.y + box.height * 0.5;
    await page.mouse.move(cx, cy); await page.mouse.down(); await page.mouse.move(cx + 120, cy + 60, { steps: 6 }); await page.mouse.up(); await settle(page);
    const after = await ev(page, () => vb.slice());
    assert(after[0] < before[0] && after[1] < before[1], 'la vue suit le glisser'); eq(after[2], before[2], 'le zoom ne change pas pendant le glisser');
  },
  'sélection d\'un lieu par clic sur la carte': async ({ page }) => {
    const id = await idOf(page, 'Lisbonne');
    await ev(page, (i) => { document.body.classList.remove('has-place'); flyTo(byId[i], 30); }, id); await settle(page, 350);
    const pt = await screenOf(page, id); await page.mouse.click(pt.x, pt.y); await settle(page, 250);
    const chooser = page.locator(`dialog[open] [data-choice="${id}"]`); if (await chooser.count()) { await chooser.click(); await settle(page); }
    eq(await ev(page, () => sel), id, 'lieu sélectionné'); assert(/Lisbonne/.test(await ev(page, () => document.querySelector('#detail :is(h2,h3)').textContent)), 'fiche du lieu cliqué');
    assert(await ev(page, (i) => nodes[i].classList.contains('sel'), id), 'marqueur mis en évidence');
  },
  'fiche : contenu, liens externes sûrs, lieux proches': async ({ page }) => {
    const id = await idOf(page, 'Paris'); await ev(page, (i) => show(i), id); await settle(page);
    const s = await ev(page, () => { const d = document.querySelector('#detail'); const links = [...d.querySelectorAll('a[target="_blank"]')];
      return { text: d.innerText, links: links.length, unsafe: links.filter((a) => !/noopener/.test(a.rel)).length, badProto: links.filter((a) => !/^https:/.test(a.href)).length, hasAdd: !!document.querySelector('#addBtn'), hasEdit: !!document.querySelector('#editBtn') }; });
    assert(/Louvre/.test(s.text), 'description du lieu'); assert(s.links >= 10, 'liens pratiques présents'); eq(s.unsafe, 0, 'liens sans rel=noopener'); eq(s.badProto, 0, 'liens hors https');
    assert(s.hasAdd && s.hasEdit, 'actions de la fiche');
    await jsClick(page, '#nearBtn'); await settle(page);
    assert(/moins de 100 km/i.test(await ev(page, () => document.querySelector('#detail').innerText)), 'liste des lieux à moins de 100 km');
  },
  'filtres : catégorie, importance, pays, mois, compteur': async ({ page }) => {
    const vis = () => ev(page, () => ({ ville: document.querySelectorAll('#map .poi.ville:not(.off)').length, all: document.querySelectorAll('#map .poi:not(.off)').length, dim: document.querySelectorAll('#map .poi.dimmed').length, counter: document.querySelector('#counter').textContent }));
    const a = await vis(); eq(a.ville, 418, 'villes visibles au départ'); eq(a.all, CAT.places, 'tous les lieux visibles au départ');
    await jsClick(page, '[data-cat="ville"]'); const b = await vis(); eq(b.ville, 0, 'villes masquées'); eq(b.all, CAT.places - 418, 'total après filtre'); eq(firstNumber(b.counter), CAT.places - 418, 'compteur mis à jour : ' + b.counter);
    await jsClick(page, '[data-cat="ville"]'); eq((await vis()).all, CAT.places, 'filtre catégorie réversible');
    await jsClick(page, '[data-w="3"]'); eq((await vis()).all, CAT.places - 307, 'importance : secondaires masqués'); await jsClick(page, '[data-w="3"]');
    await setValue(page, '#paysSel', 'Portugal', 'change'); eq((await vis()).all, await ev(page, () => PTS.filter((p) => p.p === 'Portugal' || p.c === 'base').length), 'pays : lieux du Portugal et bases'); await setValue(page, '#paysSel', '', 'change');
    await setValue(page, '#mSlider', '1'); const m = await vis(); assert(m.dim > 100, 'mois de janvier : lieux hors saison atténués'); assert(/Janvier/.test(await ev(page, () => document.querySelector('#mLabel').textContent)), 'libellé du mois');
    await setValue(page, '#mSlider', '0'); eq((await vis()).dim, 0, 'tous les mois : rien d\'atténué');
  },
  'découverte : liste, recherche, pagination, « dans cette vue », réinitialisation': async ({ page }) => {
    await ev(page, () => { document.body.classList.remove('has-place'); document.querySelector('#clearExplore').click(); tab('p1'); }); await settle(page);
    eq(await page.locator('#discoverList article').count(), 24, 'premières cartes'); await jsClick(page, '#discoverMore'); eq(await page.locator('#discoverList article').count(), 48, 'pagination');
    await setValue(page, '#discoverQuery', 'lac'); const n = firstNumber(await ev(page, () => document.querySelector('#discoveryCount').textContent)); assert(n > 0 && n < CAT.places, 'recherche de découverte filtrée : ' + n);
    await jsClick(page, '#onlyNew'); const nouveaux = firstNumber(await ev(page, () => { document.querySelector('#discoverQuery').value = ''; renderDiscovery(); return document.querySelector('#discoveryCount').textContent; })); eq(nouveaux, 100, 'les 100 nouveautés');
    await jsClick(page, '#clearExplore'); eq(firstNumber(await ev(page, () => document.querySelector('#discoveryCount').textContent)), CAT.places, '« Tout afficher » rétablit tous les lieux');
    await jsClick(page, '#discoverList [data-discover]'); assert(await ev(page, () => sel != null && document.body.classList.contains('has-place')), 'ouverture d\'une fiche depuis la liste');
  },
  'favoris, statut « fait », note et budget : enregistrés et persistants': async ({ page }) => {
    const id = await idOf(page, 'Porto'); await ev(page, (i) => show(i), id);
    await jsClick(page, '.stg [data-st="fav"]'); assert(await ev(page, (i) => ST.notes[i].st === 'fav' && nodes[i].classList.contains('fav'), id), 'favori enregistré et marqué sur la carte');
    await setValue(page, '#nTxt', 'Parking gratuit près du pont', 'change'); await setValue(page, '#nBud', '45', 'change'); await setValue(page, '#nDate', '2026-05-12', 'change');
    eq(await ev(page, (i) => ST.notes[i], id), { st: 'fav', txt: 'Parking gratuit près du pont', bud: 45, date: '2026-05-12' }, 'note complète');
    await jsClick(page, '#fOnlyFav'); eq(await ev(page, () => document.querySelectorAll('#map .poi:not(.off)').length), 1, 'filtre « favoris » : un seul lieu'); await jsClick(page, '#fOnlyFav');
    await jsClick(page, '#fOnlyNote'); eq(await ev(page, () => document.querySelectorAll('#map .poi:not(.off)').length), 1, 'filtre « avec note »'); await jsClick(page, '#fOnlyNote');
    await settle(page, 500); await page.reload(); await page.waitForFunction(() => typeof journalReady !== 'undefined' && journalReady);
    eq(await ev(page, (i) => ST.notes[i], id), { st: 'fav', txt: 'Parking gratuit près du pont', bud: 45, date: '2026-05-12' }, 'note relue après rechargement');
    await ev(page, (i) => show(i), id); eq(await ev(page, () => document.querySelector('#nTxt').value), 'Parking gratuit près du pont', 'note réaffichée dans la fiche');
    await jsClick(page, '.stg [data-st="done"]'); await jsClick(page, '#fHideDone'); eq(await ev(page, () => document.querySelectorAll('#map .poi:not(.off)').length), CAT.places - 1, '« masquer les faits »'); await jsClick(page, '#fHideDone');
  },
  'affichage : noms, tous les noms, noms de pays': async ({ page }) => {
    await ev(page, () => fitDefault()); await settle(page, 300);
    const shown = () => ev(page, () => [...document.querySelectorAll('#map .poi text, #map text.lbl')].filter((t) => t.style.display !== 'none').length);
    const a = await shown(); assert(a > 0, 'des noms sont affichés'); await jsClick(page, '#lbl'); await settle(page, 200); eq(await shown(), 0, 'noms masqués'); await jsClick(page, '#lbl'); await settle(page, 200);
    await jsClick(page, '#allbl'); await settle(page, 200); assert((await shown()) >= a, '« tous les noms » en affiche au moins autant'); await jsClick(page, '#allbl');
    await jsClick(page, '#cLbl'); await settle(page, 200); eq(await ev(page, () => document.querySelector('.plabel').getAttribute('opacity')), '0', 'noms de pays masqués'); await jsClick(page, '#cLbl');
  },
  'point personnel : création sur la carte, édition, suppression': async ({ page }) => {
    await ev(page, () => { document.body.classList.remove('has-place'); setMobileView('map'); fitDefault(); }); await settle(page, 300);
    await jsClick(page, '#addPt'); const box = await page.locator('#map').boundingBox();
    await page.mouse.click(box.x + box.width * 0.42, box.y + box.height * 0.55); await settle(page, 300);
    const created = await ev(page, () => { const p = PTS.find((x) => x.perso); return p ? { i: p.i, n: p.n, form: !!document.querySelector('#ed') } : null; });
    assert(created && created.form, 'point créé et formulaire ouvert');
    await page.fill('#eN', 'Spot du lac'); await page.fill('#eD', 'Bivouac calme'); await jsClick(page, '#eOk'); await settle(page);
    eq(await ev(page, (i) => ({ n: byId[i].n, d: byId[i].d, label: ([...document.querySelectorAll('#map .poi text, #map text.lbl')].find((t) => t.textContent === byId[i].n && t.style.display !== 'none') || {}).textContent }), created.i), { n: 'Spot du lac', d: 'Bivouac calme', label: 'Spot du lac' }, 'fiche du point mise à jour');
    await settle(page, 500); await page.reload(); await page.waitForFunction(() => typeof journalReady !== 'undefined' && journalReady);
    assert(await ev(page, (i) => byId[i] && byId[i].n === 'Spot du lac', created.i), 'point personnel relu après rechargement');
    await ev(page, (i) => show(i), created.i); await answer(page, () => jsClick(page, '#delBtn'), {}); await settle(page);
    assert(await ev(page, (i) => !byId[i] && !nodes[i], created.i), 'point supprimé');
  },
  'modification d\'une fiche du catalogue, coordonnées invalides refusées': async ({ page }) => {
    const id = await idOf(page, 'Annecy'); await ev(page, (i) => show(i), id); await jsClick(page, '#editBtn');
    await page.fill('#eY', '95'); await jsClick(page, '#eOk'); await settle(page);
    assert(await ev(page, () => !!document.querySelector('#ed')), 'latitude 95 refusée : le formulaire reste ouvert'); eq(await ev(page, (i) => byId[i].y, id), 45.899, 'coordonnée inchangée');
    await page.fill('#eY', '45.899'); await page.fill('#eD', 'Lac et vieille ville'); await jsClick(page, '#eOk'); await settle(page);
    eq(await ev(page, (i) => ST.edits[i].d, id), 'Lac et vieille ville', 'modification enregistrée');
  },
  'mode « clic = ajouter »': async ({ page }) => {
    await ev(page, () => { route = []; paint(); }); const id = await idOf(page, 'Nantes');
    await jsClick(page, '#quick'); await ev(page, (i) => { setMobileView('map'); flyTo(byId[i], 20); }, id); await settle(page, 350);
    const pt = await screenOf(page, id); await page.mouse.click(pt.x, pt.y); await settle(page, 250);
    const chooser = page.locator(`dialog[open] [data-choice="${id}"]`); if (await chooser.count()) { await chooser.click(); await settle(page); }
    eq(await routeOf(page), [id], 'le clic ajoute directement au trajet'); await jsClick(page, '#quick'); await closeDialogs(page);
  }
});

group('P2-itineraire', 'desktop-1440x900', {}, {
  'ajout d\'étapes depuis la fiche et depuis la recherche du trajet': async ({ page }) => {
    const ids = []; for (const n of ['Nantes', 'Paris', 'Annecy']) { const id = await idOf(page, n); ids.push(id); await ev(page, (i) => show(i), id); await jsClick(page, '#addBtn'); }
    eq(await routeOf(page), ids, 'trois étapes dans l\'ordre d\'ajout'); eq(await ev(page, () => document.querySelector('#cnt').textContent), '3', 'compteur du trajet');
    await ev(page, () => tab('p2')); await setValue(page, '#routeQuery', 'lisbonne'); await jsClick(page, '#routeResults [data-insert]');
    const lis = await idOf(page, 'Lisbonne'); eq(await routeOf(page), [...ids, lis], 'étape ajoutée à la fin depuis la recherche');
    eq(await page.locator('#list .item').count(), 4, 'quatre étapes listées');
    await ev(page, () => { insertion = '0'; document.querySelector('#insertAt').value = '0'; }); await setValue(page, '#routeQuery', 'porto');
    const first = await ev(page, () => { const b = document.querySelector('#routeResults [data-insert]'); const v = b.dataset.insert; b.click(); return /^c/.test(v) ? v : Number(v); });
    eq((await routeOf(page))[0], first, 'insertion « au départ »');
  },
  'réorganisation : monter, descendre, position, glisser-déposer': async ({ page }) => {
    const r0 = await routeOf(page);
    await jsClick(page, '#list [data-dn="0"]'); let r = await routeOf(page); eq([r[0], r[1]], [r0[1], r0[0]], 'descendre la première étape');
    await jsClick(page, '#list [data-up="1"]'); eq(await routeOf(page), r0, 'remonter rétablit l\'ordre');
    await answer(page, () => jsClick(page, '#list [data-position-step="0"]'), { texts: ['3'] }); r = await routeOf(page); eq(r[2], r0[0], 'déplacement à la position 3');
    await ev(page, () => relocate(2, 0)); eq(await routeOf(page), r0, 'relocate rétablit l\'ordre');
    assert(await ev(page, () => [...document.querySelectorAll('#list .item')].every((i) => i.draggable)), 'étapes déplaçables');
    await ev(page, () => { const items = document.querySelectorAll('#list .item'), dt = new DataTransfer(); const fire = (el, type) => el.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt })); fire(items[0], 'dragstart'); fire(items[2], 'dragover'); fire(items[2], 'drop'); fire(items[0], 'dragend'); }); await settle(page);
    r = await routeOf(page); eq(r[2], r0[0], 'glisser-déposer de la 1re étape vers la 3e'); await ev(page, () => relocate(2, 0));
  },
  'distance, durée, carburant et budget calculés': async ({ page }) => {
    const s = await ev(page, () => { let km = 0; for (let k = 1; k < route.length; k++) km += hav(byId[route[k - 1]], byId[route[k]]) * 1.25; return { km: Math.round(km), shown: document.querySelector('#sKm').textContent, jours: document.querySelector('#sJours').textContent, gaz: document.querySelector('#sGaz').textContent, bud: document.querySelector('#sBud').textContent, rows: document.querySelectorAll('#bud tr').length }; });
    eq(s.shown.replace(/\D/g, ''), String(s.km), 'distance affichée = somme des tronçons × 1,25'); assert(parseInt(s.jours, 10) > 0, 'durée > 0'); assert(parseInt(s.gaz.replace(/\D/g, ''), 10) > 0, 'carburant > 0'); assert(s.rows >= 5, 'tableau du budget');
    const gaz0 = parseInt(s.gaz.replace(/\D/g, ''), 10); await setValue(page, '#oConso', '18');
    const gaz1 = await ev(page, () => parseInt(document.querySelector('#sGaz').textContent.replace(/\D/g, ''), 10)); assert(Math.abs(gaz1 - gaz0 * 2) <= 2, `doubler la consommation double le carburant (${gaz0} → ${gaz1})`); await setValue(page, '#oConso', '9');
    const b0 = await ev(page, () => parseInt(document.querySelector('#sBud').textContent.replace(/\D/g, ''), 10)); await setValue(page, '#oPax', '2');
    const b1 = await ev(page, () => parseInt(document.querySelector('#sBud').textContent.replace(/\D/g, ''), 10)); assert(b1 > b0, 'deux voyageurs augmentent le budget'); await setValue(page, '#oPax', '1');
    await setValue(page, '#oDate', '2026-01-10'); assert(await ev(page, () => /\d{1,2} janv/.test(document.querySelector('#list .item .leg').textContent)), 'date de départ reportée sur la première étape');
    await setValue(page, '#oConso', '-5'); assert(await ev(page, () => opts().conso >= 0), 'consommation négative bornée');  await setValue(page, '#oConso', '9');
  },
  'options persistantes après rechargement': async ({ page }) => {
    await setValue(page, '#oRythme', '300'); await setValue(page, '#oNuits', '3'); const r0 = await routeOf(page); await settle(page, 500);
    await page.reload(); await page.waitForFunction(() => typeof journalReady !== 'undefined' && journalReady);
    eq(await ev(page, () => [document.querySelector('#oRythme').value, document.querySelector('#oNuits').value]), ['300', '3'], 'réglages relus'); eq(await routeOf(page), r0, 'trajet relu');
  },
  'suppression d\'étape, annuler, rétablir (boutons et clavier)': async ({ page }) => {
    const r0 = await routeOf(page);
    await jsClick(page, '#list [data-rm="1"]'); eq((await routeOf(page)).length, r0.length - 1, 'étape retirée');
    await jsClick(page, '#undo'); eq(await routeOf(page), r0, 'annuler'); await jsClick(page, '#redo'); eq((await routeOf(page)).length, r0.length - 1, 'rétablir');
    await ev(page, () => document.activeElement?.blur()); await page.keyboard.press('Control+z'); eq(await routeOf(page), r0, 'Ctrl+Z annule');
    await jsClick(page, '#clr'); eq(await routeOf(page), [], 'vider'); await jsClick(page, '#undo'); eq(await routeOf(page), r0, 'annuler après « vider »');
  },
  'inverser, boucler, optimiser (extrémités conservées)': async ({ page }) => {
    const r0 = await routeOf(page);
    await jsClick(page, '#rev'); eq(await routeOf(page), r0.slice().reverse(), 'inverser'); await jsClick(page, '#rev');
    await jsClick(page, '#loop'); let r = await routeOf(page); eq(r[r.length - 1], r[0], 'boucler ajoute le retour au départ'); await jsClick(page, '#undo');
    await ev(page, (names) => { route = names.map((n) => PTS.find((p) => p.n === n).i); paint(); }, ['Nantes', 'Annecy', 'Paris', 'Lisbonne', 'Porto']);
    const before = await ev(page, () => ({ r: route.slice(), km: prKm(route) })); await jsClick(page, '#opt'); const after = await ev(page, () => ({ r: route.slice(), km: prKm(route) }));
    eq([after.r[0], after.r[after.r.length - 1]], [before.r[0], before.r[before.r.length - 1]], 'départ et arrivée conservés'); assert(after.km < before.km, `trajet raccourci (${before.km} → ${after.km} km)`);
    eq(after.r.slice().sort(), before.r.slice().sort(), 'mêmes étapes après optimisation');
  },
  'exports .json, .gpx, .md et copie': async ({ page, context }) => {
    const n = (await routeOf(page)).length;
    const j = await download(page, () => jsClick(page, '#expJson')); const parsed = JSON.parse(j.text); eq(parsed.etapes.length, n, 'étapes dans le .json'); assert(parsed.etapes[0].lat && parsed.etapes[0].nom, 'champs du .json'); eq(j.name, 'mon-parcours.json', 'nom du fichier');
    const g = await download(page, () => jsClick(page, '#expGpx')); eq((g.text.match(/<wpt /g) || []).length, n, 'points dans le .gpx'); assert(/<gpx version="1.1"/.test(g.text) && /<rte>/.test(g.text), 'structure GPX');
    const m = await download(page, () => jsClick(page, '#expMd')); assert(/^# Carnet de route/.test(m.text) && (m.text.match(/^## /gm) || []).length === n, 'plan .md : un titre par étape');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']); await jsClick(page, '#expTxt'); await settle(page, 200);
    const clip = await ev(page, () => navigator.clipboard.readText()); assert(clip.split('\n').filter((l) => /^\d+\. /.test(l)).length === n, 'liste copiée dans le presse-papiers');
    globalThis.__routeExport = j.text;
  },
  'import d\'un parcours .json exporté': async ({ page }) => {
    const r0 = await routeOf(page); await jsClick(page, '#clr'); eq(await routeOf(page), [], 'trajet vidé avant import');
    await page.setInputFiles('#imp', { name: 'mon-parcours.json', mimeType: 'application/json', buffer: Buffer.from(globalThis.__routeExport) }); await settle(page, 400);
    eq(await routeOf(page), r0, 'trajet réimporté à l\'identique');
  },
  'import d\'un fichier illisible : refus sans casse': async ({ page }) => {
    const r0 = await routeOf(page);
    await answer(page, () => page.setInputFiles('#imp', { name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('{pas du json') }), {}); await settle(page, 300);
    eq(await routeOf(page), r0, 'trajet intact après un import illisible'); await closeDialogs(page);
  },
  'parcours prêts : chargement, filtre, ajout à la suite': async ({ page }) => {
    await ev(page, () => tab('p3')); const total = await page.locator('#presets [data-pr]').count(); eq(total, 25, 'parcours proposés');
    await jsClick(page, '#prFilter [data-pt="hiver"]'); eq(await page.locator('#presets [data-pr]').count(), 3, 'filtre « hiver »'); await jsClick(page, '#prFilter [data-pt=""]');
    await jsClick(page, '#presets [data-pr="0"]'); await settle(page, 300); eq((await routeOf(page)).length, CAT.preset0, 'parcours « Année 1 » chargé');
    assert(await ev(page, () => !document.querySelector('#presetFeedback').hidden && document.querySelector('[data-pr="0"]').classList.contains('chosen-preset')), 'retour visuel du parcours choisi');
    await jsClick(page, '#prAppend'); await jsClick(page, '#presets [data-pr="2"]'); await settle(page, 300); assert((await routeOf(page)).length > CAT.preset0, 'ajout à la suite'); await jsClick(page, '#prAppend');
  },
  'enregistrer, mettre à jour et supprimer un parcours personnel': async ({ page }) => {
    await ev(page, (names) => { route = names.map((n) => PTS.find((p) => p.n === n).i); paint(); tab('p2'); }, ['Nantes', 'Paris', 'Annecy']);
    await answer(page, () => jsClick(page, '#prSave'), { texts: ['Tour test', 'Trois villes'] });
    eq(await ev(page, () => ST.saved.map((p) => [p.n, p.d, p.l.length])), [['Tour test', 'Trois villes', 3]], 'parcours enregistré');
    await ev(page, () => { route.push(PTS.find((p) => p.n === 'Lisbonne').i); paint(); }); await jsClick(page, '#updateSaved'); await page.fill('#savedName', 'Tour test 2'); await jsClick(page, '#commitSaved');
    eq(await ev(page, () => ST.saved.map((p) => [p.n, p.l.length])), [['Tour test 2', 4]], 'parcours mis à jour');
    await ev(page, () => tab('p3')); await jsClick(page, '#prFilter [data-pt="perso"]'); eq(await page.locator('#presets [data-pr]').count(), 1, '« Les miens »');
    await answer(page, () => jsClick(page, '#presets [data-prdel]'), {}); eq(await ev(page, () => ST.saved.length), 0, 'parcours supprimé après confirmation'); await jsClick(page, '#prFilter [data-pt=""]');
  },
  'navigation Google Maps par tronçons et recherche le long du parcours': async ({ page }) => {
    await ev(page, () => { document.querySelector('#presets [data-pr="0"]').click(); tab('p2'); }); await jsClick(page, '#gmapAll'); await settle(page);
    const links = await ev(page, () => [...document.querySelectorAll('#mapSegments a')].map((a) => a.href)); assert(links.length >= Math.floor((await routeOf(page)).length / 4.2), 'tronçons proposés : ' + links.length);
    assert(links.every((h) => h.startsWith('https://www.google.com/maps/dir/?api=1')), 'liens Google Maps valides');
  },
  'ajout groupé : incontournables et boulots du pays': async ({ page }) => {
    await ev(page, () => { route = []; paint(); }); await setValue(page, '#paysSel', 'Portugal', 'change'); await jsClick(page, '#addTop');
    const n = (await routeOf(page)).length; assert(n > 0, 'incontournables du Portugal ajoutés : ' + n);
    assert(await ev(page, () => route.every((i) => byId[i].p === 'Portugal' && byId[i].w === 1)), 'uniquement des incontournables du pays'); await setValue(page, '#paysSel', '', 'change');
  },
  'lieux proches du tracé': async ({ page }) => {
    await ev(page, (names) => { route = names.map((n) => PTS.find((p) => p.n === n).i); paint(); }, ['Nantes', 'Paris']);
    await ev(page, () => { const c = document.querySelector('#nearRouteOnly'); c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); });
    const n = await ev(page, () => document.querySelectorAll('#map .poi:not(.off)').length); assert(n > 2 && n < 400, 'filtre de proximité actif : ' + n + ' lieux');
    await jsClick(page, '#resetMapFilters'); eq(await ev(page, () => document.querySelectorAll('#map .poi:not(.off)').length), CAT.places, 'réinitialisation des filtres');
  }
});

group('P3-carnet', 'desktop-1440x900', {}, {
  'carnet vide : état initial et invitation à écrire': async ({ page }) => {
    await ev(page, () => tab('pBlog')); await settle(page);
    assert(/première histoire/i.test(await page.locator('#journalPosts').innerText()), 'état vide explicite'); assert(await page.locator('#firstStory').count(), 'bouton « Commencer mon carnet »');
  },
  'création d\'un article : lieu, texte, photo, brouillon automatique': async ({ page }) => {
    await jsClick(page, '#journalNew'); await page.fill('#postTitle', 'Un matin à Annecy'); await page.fill('#postDate', '2026-06-14');
    await setValue(page, '#postPlaceSearch', 'annecy'); await jsClick(page, '#postPlaceResults [data-jplace]'); assert(/Annecy/.test(await page.locator('#postPlaceChosen').innerText()), 'lieu associé');
    await page.fill('#postText', 'Le lac était un miroir.\nCafé sur le quai.');
    await page.setInputFiles('#postPhotos', { name: 'lac.png', mimeType: 'image/png', buffer: await pngBuffer(page, 2400, 1600) });
    await page.waitForFunction(() => !photoBusy && document.querySelectorAll('#editorPhotos figure').length === 1, null, { timeout: 10000 });
    await setValue(page, '#caption0', 'Le lac au lever du jour'); await waitJournalSaved(page);
    const p = await ev(page, () => { const x = J.posts[0]; const img = new Image(); img.src = x.photos[0].src; return { n: J.posts.length, title: x.title, status: x.status, place: byId[x.placeId].n, photos: x.photos.length, jpeg: x.photos[0].src.startsWith('data:image/jpeg;base64,'), caption: x.photos[0].caption, bytes: x.photos[0].src.length }; });
    eq([p.n, p.title, p.status, p.place, p.photos, p.jpeg, p.caption], [1, 'Un matin à Annecy', 'draft', 'Annecy', 1, true, 'Le lac au lever du jour'], 'brouillon enregistré');
    const dims = await ev(page, () => new Promise((res) => { const i = new Image(); i.onload = () => res([i.width, i.height]); i.src = J.posts[0].photos[0].src; })); eq(dims, [1600, 1067], 'photo réduite à 1 600 px de large');
    await jsClick(page, '#closeEditor'); await settle(page, 300); assert(/Brouillon privé/.test(await page.locator('#journalPosts').innerText()), 'article listé comme brouillon');
  },
  'titre obligatoire pour « Enregistrer et fermer »': async ({ page }) => {
    await jsClick(page, '#journalNew'); await jsClick(page, '#savePost'); await settle(page);
    assert(await ev(page, () => journalEditing && /titre/i.test(document.querySelector('#draftStatus').textContent)), 'message demandant un titre, éditeur toujours ouvert');
    await page.fill('#postTitle', 'Deuxième étape'); await page.fill('#postText', 'Texte court.'); await jsClick(page, '#savePost'); await settle(page, 400);
    eq(await ev(page, () => [journalEditing, J.posts.length]), [false, 2], 'deuxième article enregistré');
  },
  'modification, publication locale, lecture': async ({ page }) => {
    const id = await ev(page, () => J.posts.find((p) => p.title === 'Un matin à Annecy').id);
    await jsClick(page, `[data-post="${id}"] [data-edit-post]`); await page.fill('#postTitle', 'Un matin au bord du lac'); await ev(page, () => { const c = document.querySelector('#postReady'); c.checked = true; c.dispatchEvent(new Event('input', { bubbles: true })); });
    await jsClick(page, '#savePost'); await settle(page, 400);
    eq(await ev(page, (i) => { const p = J.posts.find((x) => x.id === i); return [p.title, p.status]; }, id), ['Un matin au bord du lac', 'ready'], 'titre modifié et article prêt à partager');
    await jsClick(page, `[data-post="${id}"] [data-read-post]`); await settle(page); assert(/miroir/.test(await page.locator('dialog[open]').innerText()), 'lecture de l\'article'); await closeDialogs(page);
    await jsClick(page, `[data-post="${id}"] [data-photo]`); await settle(page); assert(await page.locator('dialog[open] .photo-view img').count(), 'photo agrandie'); await closeDialogs(page);
  },
  'recherche et filtres du carnet': async ({ page }) => {
    await setValue(page, '#journalSearch', 'lac'); eq(await page.locator('#journalPosts [data-post]').count(), 1, 'recherche « lac »'); await setValue(page, '#journalSearch', '');
    await jsClick(page, '[data-jfilter="draft"]'); eq(await page.locator('#journalPosts [data-post]').count(), 1, 'filtre brouillons'); await jsClick(page, '[data-jfilter="ready"]'); eq(await page.locator('#journalPosts [data-post]').count(), 1, 'filtre à partager'); await jsClick(page, '[data-jfilter="all"]');
  },
  'persistance IndexedDB après rechargement (articles et photo)': async ({ page }) => {
    await waitJournalSaved(page); await page.reload(); await page.waitForFunction(() => typeof journalReady !== 'undefined' && journalReady);
    const s = await ev(page, () => ({ n: J.posts.length, photo: J.posts.find((p) => p.photos.length)?.photos[0].src.slice(0, 23), err: journalError })); eq([s.n, s.photo, s.err], [2, 'data:image/jpeg;base64,', ''], 'carnet relu depuis IndexedDB');
    const db = await ev(page, () => new Promise((res) => { const r = indexedDB.open('atlasvan.journal.v1'); r.onsuccess = () => { const q = r.result.transaction('state').objectStore('state').getAllKeys(); q.onsuccess = () => res(q.result.map(String).sort()); }; }));
    assert(db.includes('meta') && db.filter((k) => k.startsWith('post:')).length === 2, 'enregistrements IndexedDB : ' + db.join(', '));
  },
  'export du blog à partager (HTML autonome, brouillons exclus)': async ({ page }) => {
    await ev(page, () => tab('pBlog')); await jsClick(page, '#journalExport'); await settle(page);
    const f = await download(page, () => jsClick(page, '#exportJournalConfirm'));
    assert(/^<!doctype html>/i.test(f.text) && /Un matin au bord du lac/.test(f.text), 'article prêt inclus'); assert(!/Deuxième étape/.test(f.text), 'brouillon exclu'); assert(/data:image\/jpeg;base64,/.test(f.text), 'photo incluse'); assert(/<svg role="img"/.test(f.text), 'carte des étapes incluse');
    assert(!/<script/i.test(f.text), 'aucun script dans le blog exporté');
  },
  'fil du voyage sur la carte et trajet créé depuis le carnet': async ({ page }) => {
    await jsClick(page, '#journalToRoute'); await settle(page); eq(await routeOf(page), [await idOf(page, 'Annecy')], 'trajet créé dans l\'ordre du carnet');
    assert(await ev(page, () => journalLayer.querySelectorAll('circle').length === 1), 'étape du carnet dessinée sur la carte');
  },
  'suppression d\'un article avec annulation': async ({ page }) => {
    await ev(page, () => tab('pBlog')); const id = await ev(page, () => J.posts.find((p) => p.title === 'Deuxième étape').id);
    await jsClick(page, `[data-post="${id}"] [data-delete-post]`); await jsClick(page, '#confirmDeletePost'); await settle(page, 400); eq(await ev(page, () => J.posts.length), 1, 'article supprimé');
    await jsClick(page, '#restorePost'); await settle(page, 400); eq(await ev(page, () => J.posts.length), 2, 'suppression annulée');
  },
  'personnalisation du carnet (titre, présentation, auteur)': async ({ page }) => {
    await jsClick(page, '#journalSettings'); await page.fill('#jTitle', 'Sur la route'); await page.fill('#jAuthor', 'Axel'); await jsClick(page, '#jSettingsSave'); await settle(page, 400);
    eq(await ev(page, () => [J.title, J.author, document.querySelector('#pBlog h2').textContent]), ['Sur la route', 'Axel', 'Sur la route'], 'carnet personnalisé');
  },
  'photo refusée : format non pris en charge et limite de 12': async ({ page }) => {
    await jsClick(page, '#journalNew'); await page.fill('#postTitle', 'Test photos');
    await page.setInputFiles('#postPhotos', { name: 'note.gif', mimeType: 'image/gif', buffer: Buffer.from('GIF89a') }); await page.waitForFunction(() => !photoBusy); await settle(page, 200);
    assert(/JPEG, PNG ou WebP/.test(await page.locator('#photoStatus').innerText()), 'message de format refusé'); eq(await page.locator('#editorPhotos figure').count(), 0, 'aucune photo ajoutée');
    const png = await pngBuffer(page, 60, 40); await page.setInputFiles('#postPhotos', Array.from({ length: 13 }, (_, i) => ({ name: `p${i}.png`, mimeType: 'image/png', buffer: png }))); await settle(page, 300);
    assert(/Maximum 12/.test(await page.locator('#photoStatus').innerText()), 'limite de 12 photos annoncée'); await jsClick(page, '#closeEditor'); await settle(page, 400);
  }
});

group('P4-sauvegarde', 'desktop-1440x900', {}, {
  'sauvegarde complète puis restauration dans un navigateur vierge': async ({ page, browser, url }) => {
    const ids = await ev(page, () => ['Nantes', 'Paris', 'Annecy'].map((n) => PTS.find((p) => p.n === n).i));
    await ev(page, (ids) => { route = ids.slice(); paint(); nt(ids[1]).st = 'fav'; nt(ids[1]).txt = 'Note de test'; nt(ids[1]).bud = 30; ST.saved = [{ n: 'Sauvé', d: 'desc', l: ids.slice() }];
      const L = { i: 'c' + (++cSeq), n: 'Mon spot', y: 44.1, x: 3.2, p: 'Perso', c: 'perso', w: 1, d: 'Point personnel', s: "toute l'année", v: '', du: '', e: '', pe: 0, perso: true }; L.m = months(L.s); register(L); route.push(L.i); paint();
      ST.edits[ids[2]] = { n: 'Annecy', c: 'ville', p: 'France', w: 2, d: 'Résumé modifié', s: 'mai-sept', du: '2 j', v: '', e: '', pe: 0, y: 45.899, x: 6.129, t: '' }; save(); }, ids);
    await ev(page, () => tab('pBlog')); await jsClick(page, '#journalNew'); await page.fill('#postTitle', 'Article sauvegardé'); await page.fill('#postText', 'Contenu.');
    await page.setInputFiles('#postPhotos', { name: 'a.png', mimeType: 'image/png', buffer: await pngBuffer(page, 400, 300) }); await page.waitForFunction(() => !photoBusy && document.querySelectorAll('#editorPhotos figure').length === 1);
    await jsClick(page, '#savePost'); await settle(page, 500);
    const f = await download(page, () => jsClick(page, '#journalBackup')); const payload = JSON.parse(f.text);
    eq([payload.app, payload.version, payload.journal.posts.length, payload.travel.route.length, payload.travel.custom.length], ['atlas-van', 5, 1, 4, 1], 'contenu de la sauvegarde complète');
    assert(/^atlas-van-sauvegarde-\d{4}-\d{2}-\d{2}\.json$/.test(f.name), 'nom du fichier : ' + f.name);
    const fresh = await openApp(browser, url, 'desktop-1440x900');
    try {
      eq(await ev(fresh.page, () => [route.length, J.posts.length]), [0, 0], 'navigateur vierge');
      await ev(fresh.page, () => tab('pBlog')); await fresh.page.setInputFiles('#journalImportFile', { name: f.name, mimeType: 'application/json', buffer: Buffer.from(f.text) }); await settle(fresh.page, 300);
      await Promise.all([fresh.page.waitForNavigation({ waitUntil: 'load' }), jsClick(fresh.page, '#confirmJournalImport')]);
      await fresh.page.waitForFunction(() => typeof journalReady !== 'undefined' && journalReady);
      const s = await ev(fresh.page, (ids) => ({ route: route.length, custom: PTS.filter((p) => p.perso).map((p) => p.n), note: ST.notes[ids[1]], saved: ST.saved.map((p) => p.n), edit: byId[ids[2]].d, posts: J.posts.map((p) => [p.title, p.photos.length]), photo: J.posts[0].photos[0].src.slice(0, 23) }), ids);
      eq(s, { route: 4, custom: ['Mon spot'], note: { st: 'fav', txt: 'Note de test', bud: 30 }, saved: ['Sauvé'], edit: 'Résumé modifié', posts: [['Article sauvegardé', 1]], photo: 'data:image/jpeg;base64,' }, 'tout est restauré');
      eq(fresh.errors, [], 'aucune erreur pendant la restauration');
    } finally { await fresh.context.close(); }
    globalThis.__fullBackup = f.text;
  },
  'sauvegarde « trajets et fiches » (.json v3) puis restauration': async ({ page, browser, url }) => {
    const f = await download(page, () => jsClick(page, '#bkExp')); const payload = JSON.parse(f.text); eq([payload.app, payload.version, payload.data.route.length], ['atlas-van', 3, 4], 'sauvegarde v3');
    const fresh = await openApp(browser, url, 'desktop-1440x900');
    try {
      const nav = fresh.page.waitForNavigation({ waitUntil: 'load', timeout: 8000 });
      await answer(fresh.page, () => fresh.page.setInputFiles('#bkImp', { name: 'atlas-van-sauvegarde.json', mimeType: 'application/json', buffer: Buffer.from(f.text) }), {});
      await nav; await fresh.page.waitForFunction(() => typeof journalReady !== 'undefined' && journalReady);
      eq(await ev(fresh.page, () => [route.length, PTS.filter((p) => p.perso).length, ST.saved.length]), [4, 1, 1], 'trajets et fiches restaurés');
    } finally { await fresh.context.close(); }
  },
  'sauvegarde invalide refusée, données intactes': async ({ page }) => {
    const before = await ev(page, () => [route.length, J.posts.length]); await ev(page, () => tab('pBlog'));
    for (const bad of ['{"journal":{"posts":"x"}}', '{"journal":{"posts":[{"id":1}]}}', 'pas du json', JSON.stringify({ journal: { posts: [] }, travel: { route: [999999], custom: [] } })]) {
      await page.setInputFiles('#journalImportFile', { name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from(bad) }); await settle(page, 300);
      assert(!(await page.locator('#confirmJournalImport').count()), 'import refusé avant confirmation : ' + bad.slice(0, 30));
    }
    eq(await ev(page, () => [route.length, J.posts.length]), before, 'données inchangées');
  },
  'réinitialisation des trajets et fiches': async ({ page }) => {
    const nav = page.waitForNavigation({ waitUntil: 'load', timeout: 8000 }); await answer(page, () => jsClick(page, '#bkReset'), {}); await nav;
    await page.waitForFunction(() => typeof journalReady !== 'undefined' && journalReady);
    eq(await ev(page, () => [route.length, Object.keys(ST.notes).length, PTS.filter((p) => p.perso).length, J.posts.length]), [0, 0, 0, 1], 'trajets effacés, carnet conservé');
  },
  'stockage local corrompu : l\'application démarre quand même': async ({ browser, url }) => {
    for (const corrupt of ['{"route":5,"custom":"x","notes":null,"edits":7}', '{bad json', '{"route":[1,2,"zz",99999],"custom":[{"i":"c1"}],"notes":{"3":"x"},"saved":[{"n":1}],"opts":"?"}']) {
      const a = await openApp(browser, url, 'desktop-1440x900');
      try {
        await ev(a.page, (c) => { window.booted = false; localStorage.setItem('atlasvan.v3', c); }, corrupt); a.errors.length = 0;   // booted = false : la page ne réécrit pas l'état en se fermant
        await a.page.reload(); let ready = true; await a.page.waitForFunction(() => typeof journalReady !== 'undefined' && journalReady, null, { timeout: 6000 }).catch(() => { ready = false; });
        assert(ready, 'application bloquée au démarrage avec : ' + corrupt.slice(0, 40) + ' — ' + a.errors.slice(0, 1).join(''));
        eq(await ev(a.page, (n) => document.querySelectorAll('#map .poi').length >= n, CAT.places), true, 'carte dessinée'); eq(a.errors, [], 'aucune erreur au démarrage');
      } finally { await a.context.close(); }
    }
  },
  'quota de stockage atteint : l\'utilisateur est prévenu': async ({ page }) => {
    await ev(page, () => { window.__setItem = Storage.prototype.setItem; Storage.prototype.setItem = function () { throw new DOMException('quota', 'QuotaExceededError'); }; document.querySelector('#toast').textContent = ''; route = [PTS[10].i, PTS[11].i]; paint(); });
    await settle(page, 700); const s = await ev(page, () => { Storage.prototype.setItem = window.__setItem; return { toast: document.querySelector('#toast').textContent, info: document.querySelector('#bkInfo')?.textContent || '', visible: document.querySelector('#toast').classList.contains('on') }; });
    assert(/impossible|plein|non enregistr/i.test(s.toast), 'message visible quand l\'enregistrement échoue (toast : « ' + s.toast + ' »)');
  }
});

group('P5-geolocalisation', 'desktop-1440x900', { geolocation: { latitude: 47.218, longitude: -1.554, accuracy: 25 }, permissions: ['geolocation'] }, {
  'autorisée : point bleu, centrage, état annoncé': async ({ page }) => {
    await jsClick(page, '#geoButton'); await page.waitForFunction(() => geoPosition !== null, null, { timeout: 8000 });
    const s = await ev(page, () => ({ pos: [geoPosition.y, geoPosition.x], shown: geoLayer.style.display !== 'none', located: document.querySelector('#geoButton').classList.contains('located'), stored: localStorage.getItem('atlasvan.location.enabled') }));
    eq(s, { pos: [47.218, -1.554], shown: true, located: true, stored: 'yes' }, 'position affichée'); assert(!(await ev(page, () => JSON.stringify(localStorage).includes('47.218'))), 'la position n\'est pas écrite dans le stockage');
  },
  'aux alentours : lieux du catalogue proches de la position': async ({ page }) => {
    await jsClick(page, '#searchAround'); await settle(page, 300); const n = await page.locator('#aroundResults article').count(); assert(n >= 1, 'lieux proches listés : ' + n);
    assert(/à moins de 20 km/.test(await page.locator('#aroundSummary').innerText()), 'résumé du rayon'); await jsClick(page, '#aroundMap'); await settle(page, 300);
    const v = await ev(page, () => document.querySelectorAll('#map .poi:not(.off)').length); assert(v >= 1 && v < 100, 'carte filtrée autour de la position : ' + v); await ev(page, () => { aroundActive = false; applyFilters(); });
  },
  'arrêt manuel : position effacée, préférence retirée': async ({ page }) => {
    await ev(page, () => openAtlasSettings()); await jsClick(page, '#disableGeo'); await settle(page);
    eq(await ev(page, () => [geoPosition, geoWatch, geoLayer.style.display, localStorage.getItem('atlasvan.location.enabled')]), [null, null, 'none', 'no'], 'localisation arrêtée'); await closeDialogs(page);
  },
  'refusée : message clair, pas de nouvelle demande automatique': async ({ browser, url }) => {
    const a = await openApp(browser, url, 'desktop-1440x900', { permissions: [] });
    try { await jsClick(a.page, '#geoButton'); await a.page.waitForFunction(() => geoError !== '', null, { timeout: 8000 });
      const s = await ev(a.page, () => ({ err: geoError, toast: document.querySelector('#toast').textContent, auto: localStorage.getItem('atlasvan.location.enabled'), watch: geoWatch })); assert(/refusée/i.test(s.err) && /refusée/i.test(s.toast), 'message de refus : ' + s.err); eq([s.auto, s.watch], ['no', null], 'réactivation automatique désactivée');
    } finally { await a.context.close(); }
  },
  'indisponible et délai dépassé : messages distincts': async ({ browser, url }) => {
    for (const [code, re] of [[2, /indisponible/i], [3, /trop de temps/i]]) {
      const a = await openApp(browser, url, 'desktop-1440x900');
      try { await ev(a.page, (c) => { navigator.geolocation.watchPosition = (ok, ko) => { setTimeout(() => ko({ code: c, message: 'x' }), 30); return 7; }; navigator.geolocation.clearWatch = () => {}; }, code);
        await jsClick(a.page, '#geoButton'); await a.page.waitForFunction(() => geoError !== '', null, { timeout: 5000 }); assert(re.test(await ev(a.page, () => geoError)), `message pour le code ${code}`);
      } finally { await a.context.close(); }
    }
  },
  'navigateur sans géolocalisation : message, pas d\'erreur': async ({ browser, url }) => {
    const a = await openApp(browser, url, 'desktop-1440x900');
    try { await ev(a.page, () => { Object.defineProperty(navigator, 'geolocation', { value: undefined, configurable: true }); }); await jsClick(a.page, '#geoButton'); await settle(a.page, 200);
      assert(/pas disponible/i.test(await ev(a.page, () => geoError)), 'message d\'indisponibilité'); eq(a.errors, [], 'aucune erreur');
    } finally { await a.context.close(); }
  }
});

group('P6-mobile', 'mobile-390x844', {}, {
  'navigation inférieure : carte, idées, trajet, carnet': async ({ page, errors }) => {
    eq(await ev(page, () => document.body.dataset.mobileView), 'map', 'vue carte au démarrage');
    for (const [p, re] of [['p3', /Idées de parcours/], ['p2', /Mon trajet/], ['pBlog', /carnet/i]]) { await page.locator(`.mobile-nav [data-p="${p}"]`).tap(); await settle(page, 200);
      eq(await ev(page, () => [document.body.dataset.mobileView, document.querySelector('.pane.on').id]), ['panel', p], 'onglet ' + p); assert(re.test(await page.locator(`#${p}`).innerText()), 'contenu ' + p);
      assert(await ev(page, (p) => document.querySelector(`.mobile-nav [data-p="${p}"]`).classList.contains('on'), p), 'onglet actif signalé'); }
    await page.locator('.mobile-nav [data-mobile="map"]').tap(); await settle(page, 200); eq(await ev(page, () => document.body.dataset.mobileView), 'map', 'retour à la carte'); eq(errors, [], 'aucune erreur');
  },
  'toucher un lieu sur la carte ouvre sa fiche': async ({ page }) => {
    const id = await idOf(page, 'Lisbonne'); await ev(page, (i) => flyTo(byId[i], 25), id); await settle(page, 400);
    const pt = await screenOf(page, id); await page.touchscreen.tap(pt.x, pt.y); await settle(page, 300);
    const chooser = page.locator(`dialog[open] [data-choice="${id}"]`); if (await chooser.count()) { await chooser.tap(); await settle(page, 200); }
    eq(await ev(page, () => sel), id, 'lieu sélectionné au toucher');
    if (await page.locator('#peek:not([hidden])').count()) { assert(/Lisbonne/.test(await page.locator('#peek h2').innerText()), 'aperçu du lieu sur la carte'); eq(await ev(page, () => document.body.dataset.mobileView), 'map', 'la carte reste visible'); await page.locator('#peekOpen').tap(); await settle(page, 200); }
    assert(await page.locator('#detail :is(h2,h3)').first().isVisible(), 'fiche visible à l\'écran');
  },
  'ajout au trajet puis consultation du trajet': async ({ page }) => {
    await page.locator('#addBtn').tap(); await settle(page); eq((await routeOf(page)).length, 1, 'étape ajoutée');
    await page.locator('.mobile-nav [data-p="p2"]').tap(); await settle(page, 200); assert(await page.locator('#list .item').first().isVisible(), 'étape visible dans « Mon trajet »');
  },
  'pincement : zoom à deux doigts': async ({ page }) => {
    await page.locator('.mobile-nav [data-mobile="map"]').tap(); await ev(page, () => fitDefault()); await settle(page, 300);
    const w0 = await ev(page, () => vb[2]);
    await ev(page, () => { const s = document.querySelector('#map'), r = s.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const f = (type, id, x, y) => s.dispatchEvent(new PointerEvent(type, { pointerId: id, clientX: x, clientY: y, bubbles: true, pointerType: 'touch', isPrimary: id === 11 }));
      s.setPointerCapture = () => {}; f('pointerdown', 11, cx - 30, cy); f('pointerdown', 12, cx + 30, cy); f('pointermove', 11, cx - 90, cy); f('pointermove', 12, cx + 90, cy); f('pointerup', 11, cx - 90, cy); f('pointerup', 12, cx + 90, cy); });
    await settle(page, 250); const w1 = await ev(page, () => vb[2]); assert(w1 < w0 * 0.5, `écarter les doigts zoome (${Math.round(w0)} → ${Math.round(w1)})`);
  },
  'filtres depuis la carte (dialogue)': async ({ page }) => {
    await page.locator('#mapFiltersButton').tap(); await settle(page, 250); assert(await page.locator('dialog[open] [data-cat="nature"]').isVisible(), 'filtres visibles dans le dialogue');
    await page.locator('dialog[open] [data-cat="nature"]').tap(); eq(await ev(page, () => document.querySelectorAll('#map .poi.nature:not(.off)').length), 0, 'filtre appliqué');
    assert(/· 1/.test(await ev(page, () => document.querySelector('#mapFiltersButton').textContent)), 'nombre de filtres actifs affiché'); await page.locator('#applyMapFilters').tap(); await settle(page, 200);
    eq(await ev(page, () => [document.querySelectorAll('dialog[open]').length, document.querySelectorAll('#map .poi.nature:not(.off)').length, document.body.dataset.mobileView]), [0, 0, 'map'], 'dialogue fermé, filtre conservé, retour à la carte'); await ev(page, () => document.querySelector('#clearExplore').click());
    eq(await ev(page, () => document.querySelectorAll('#map .poi.nature:not(.off)').length), 522, 'filtres réinitialisés');
  },
  'paramètres : discrétion (flou) et contenu complet': async ({ page }) => {
    if (await page.locator('#openSettings').isVisible()) await page.locator('#openSettings').tap(); else { await page.locator('.mobile-nav [data-p="p4"]').tap(); await settle(page, 200); await page.locator('#openSettingsFromMore').tap(); }
    await settle(page, 250); assert(await page.locator('dialog[open]').isVisible(), 'dialogue des paramètres');
    await ev(page, () => { const c = document.querySelector('[data-blur-pane="p2"]'); c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); });
    eq(await ev(page, () => [document.querySelector('#p2').classList.contains('is-blurred'), JSON.parse(localStorage.getItem('atlasvan.privacy')).p2]), [true, true], 'onglet flouté et réglage mémorisé');
    assert(await ev(page, () => ['#bkExp', '#metaTab', '#check', '#bkImpBtn', '#bkReset'].every((s) => document.querySelector('dialog[open] ' + s) || document.querySelector('#p4 ' + s))), 'sauvegardes, fiches pays et checklist présentes');
    eq(await ev(page, () => [document.querySelectorAll('#metaTab tr').length > 30, document.querySelectorAll('#check .item').length]), [true, 7], 'fiches pays et checklist remplies');
    await closeDialogs(page); await settle(page, 200); assert(await ev(page, () => !!document.querySelector('#p4 #bkExp')), 'contenu rendu à son emplacement à la fermeture');
    await ev(page, () => tab('p2')); await page.locator('#p2 .privacy-cover button').tap(); eq(await ev(page, () => document.querySelector('#p2').classList.contains('is-blurred')), false, 'flou retiré depuis l\'onglet');
  },
  'carnet sur mobile : écrire et enregistrer': async ({ page }) => {
    await page.locator('.mobile-nav [data-p="pBlog"]').tap(); await settle(page, 200); await page.locator((await page.locator('#journalNew').isVisible()) ? '#journalNew' : '#firstStory').tap(); await page.locator('#postTitle').fill('Sur mobile'); await page.locator('#postText').fill('Texte.');
    await page.locator('#savePost').scrollIntoViewIfNeeded(); await page.locator('#savePost').tap(); await settle(page, 500); eq(await ev(page, () => J.posts.map((p) => p.title)), ['Sur mobile'], 'article enregistré');
  },
  'aucun débordement horizontal sur les écrans principaux': async ({ page }) => {
    const bad = [];
    for (const go of ['setMobileView("map")', 'tab("p3")', 'tab("p2")', 'tab("pBlog")', 'show(PTS.find(p=>p.n==="Paris").i)']) { await page.evaluate(go); await settle(page, 200);
      const o = await ev(page, () => { const w = document.documentElement.clientWidth; return [...document.querySelectorAll('.pane.on *, .top *, .mobile-nav *')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.right > w + 1 || r.left < -1) && !e.closest('svg') && getComputedStyle(e).position !== 'fixed'; }).slice(0, 3).map((e) => e.tagName + '#' + e.id + '.' + String(e.className).slice(0, 30)); });
      if (o.length) bad.push(go + ' → ' + o.join(', ')); }
    eq(bad, [], 'éléments qui dépassent la largeur de l\'écran');
  }
});

group('accessibilite-clavier', 'desktop-1440x900', {}, {
  'dialogues : rôle, fermeture par Échap, retour du focus': async ({ page }) => {
    await page.focus('#openSettings'); await page.keyboard.press('Enter'); await settle(page, 250);
    const s = await ev(page, () => { const d = document.querySelector('dialog[open]'); return { open: !!d, modal: d?.matches(':modal'), inside: d?.contains(document.activeElement), label: d?.getAttribute('aria-label') || d?.getAttribute('aria-labelledby') || d?.querySelector('h2,h3')?.textContent }; });
    assert(s.open && s.modal && s.inside, 'dialogue modal ouvert, focus à l\'intérieur'); assert(s.label, 'dialogue nommé');
    await page.keyboard.press('Escape'); await settle(page, 200); eq(await ev(page, () => [document.querySelectorAll('dialog[open]').length, document.activeElement?.id]), [0, 'openSettings'], 'Échap ferme et rend le focus au bouton');
  },
  'onglets du panneau utilisables au clavier': async ({ page }) => {
    await page.focus('.tabs [data-p="p3"]'); await page.keyboard.press('Enter'); await settle(page); eq(await ev(page, () => document.querySelector('.pane.on').id), 'p3', 'onglet activé par Entrée');
    const first = page.locator('#presets [data-pr]').first(); await first.focus(); await page.keyboard.press('Enter'); await settle(page, 300); assert((await routeOf(page)).length > 0, 'parcours chargé au clavier');
  },
  'champs de formulaire nommés': async ({ page }) => {
    await ev(page, () => { tab('p2'); show(PTS.find((p) => p.n === 'Paris').i); });
    const unnamed = await ev(page, () => [...document.querySelectorAll('input:not([type=hidden]):not([type=file]),select,textarea')].filter((e) => !(e.labels && e.labels.length) && !e.getAttribute('aria-label') && !e.getAttribute('aria-labelledby') && !e.title).map((e) => e.id || e.className || e.tagName));
    eq(unnamed, [], 'champs sans nom accessible');
  },
  'focus visible sur les commandes': async ({ page }) => {
    const missing = await ev(page, () => { const out = []; for (const s of ['#q', '#openSettings', '#zin', '.tabs button', '#mapFiltersButton']) { const e = document.querySelector(s); e.focus(); const c = getComputedStyle(e); if ((c.outlineStyle === 'none' || parseFloat(c.outlineWidth) === 0) && c.boxShadow === 'none') out.push(s); } return out; });
    eq(missing, [], 'commandes sans indicateur de focus');
  }
});

group('securite', 'desktop-1440x900', {}, {
  'import de parcours piégé : aucun script exécuté': async ({ page }) => {
    const x = '<img src=x onerror="window.__xss=(window.__xss||0)+1">';
    const evil = { version: 3, etapes: [{ nom: 'Piège ' + x, lat: 46.5, lon: 2.5, pays: x, categorie: 'perso"><img src=x onerror="window.__xss=1', note: x, saison: x, duree: x, a_voir: x, tarifs: x, entree_eur: x, statut: 'fav', ma_note: x, mon_budget: '"><img src=x onerror="window.__xss=1">', ma_date: x, perso: true }] };
    await answer(page, () => page.setInputFiles('#imp', { name: 'evil.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(evil)) }), {}); await settle(page, 400);
    await ev(page, () => { const p = PTS.find((q) => q.perso); if (p) { show(p.i); tip({ clientX: 100, clientY: 100 }, p); near(p); tab('p2'); document.querySelector('#q').value = 'piège'; document.querySelector('#q').dispatchEvent(new Event('input')); } });
    await settle(page, 500); eq(await ev(page, () => window.__xss || 0), 0, 'exécutions de script injecté'); await closeDialogs(page);
  },
  'sauvegarde v3 piégée : aucun script exécuté': async ({ browser, url }) => {
    const x = '<img src=x onerror="window.__xss=(window.__xss||0)+1">';
    const evil = { app: 'atlas-van', version: 3, data: { edits: { [CAT.first]: { n: 'Base ' + x, q: x, t: x, c: 'base"><img src=x onerror="window.__xss=1', p: x, s: x, du: x, pe: x } }, notes: { [CAT.first]: { st: 'fav', txt: x, bud: '"><img src=x onerror="window.__xss=1">', date: x } }, custom: [{ i: 'c1"><img src=x onerror="window.__xss=1">', n: x, y: 46, x: 2, p: x, c: 'perso', w: 1, d: x, s: x, du: x, pe: x, perso: true }], route: [CAT.first], saved: [{ n: x, d: x, l: [CAT.first] }], opts: {}, cSeq: 1 } };
    const a = await openApp(browser, url, 'desktop-1440x900');
    try {
      const nav = a.page.waitForNavigation({ waitUntil: 'load', timeout: 6000 }).catch(() => null);
      await answer(a.page, () => a.page.setInputFiles('#bkImp', { name: 'evil.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(evil)) }), {}); await nav; await settle(a.page, 600);
      const alive = await ev(a.page, (n) => typeof PTS !== 'undefined' && document.querySelectorAll('#map .poi').length >= n, CAT.places).catch(() => false); assert(alive, 'l\'application reste utilisable après la restauration');
      await ev(a.page, (first) => { show(first); tip({ clientX: 100, clientY: 100 }, byId[first]); tab('p2'); tab('p3'); openAtlasSettings(); PTS.filter((p) => p.perso).forEach((p) => { show(p.i); tip({ clientX: 100, clientY: 100 }, p); }); document.querySelector('#q').value = 'base'; document.querySelector('#q').dispatchEvent(new Event('input')); }, CAT.first);
      await settle(a.page, 500); eq(await ev(a.page, () => window.__xss || 0), 0, 'exécutions de script injecté');
    } finally { await a.context.close(); }
    // Même attaque avec des types valides partout : la sauvegarde est acceptée, le texte doit rester du texte.
    const typed = { app: 'atlas-van', version: 3, data: { edits: { [CAT.first]: { n: 'Base ' + x, t: x, p: x, s: x, du: x, d: x, v: x + ' · ' + x, e: x } }, notes: { [CAT.first]: { st: 'fav', txt: x, bud: 12, date: '2026-01-02' } }, custom: [{ i: 'c1', n: x, y: 46, x: 2, p: x, c: 'perso', w: 1, d: x, s: x, du: x, v: x, e: x, t: x, pe: 3, perso: true }], route: [CAT.first, 'c1'], saved: [{ n: x, d: x, l: [CAT.first, 'c1'] }], opts: {}, cSeq: 1 } };
    const b = await openApp(browser, url, 'desktop-1440x900');
    try {
      const nav = b.page.waitForNavigation({ waitUntil: 'load', timeout: 8000 }).catch(() => null);
      await answer(b.page, () => b.page.setInputFiles('#bkImp', { name: 'typed.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(typed)) }), {}); await nav; await settle(b.page, 700);
      eq(await ev(b.page, () => [route.length, PTS.filter((p) => p.perso).length, ST.saved.length]), [2, 1, 1], 'sauvegarde aux types valides restaurée');
      await ev(b.page, (first) => { [first, 'c1'].forEach((i) => { show(i); tip({ clientX: 100, clientY: 100 }, byId[i]); near(byId[i]); edit(byId[i]); }); tab('p2'); tab('p3'); document.querySelector('#gmapAll').click(); openAtlasSettings(); document.querySelector('#q').value = 'base'; document.querySelector('#q').dispatchEvent(new Event('input')); renderDiscovery(); }, CAT.first);
      await settle(b.page, 600); eq(await ev(b.page, () => window.__xss || 0), 0, 'exécutions de script injecté (types valides)');
      assert(await ev(b.page, () => document.querySelector('#p3').innerHTML.includes('&lt;img')), 'le texte piégé est affiché comme du texte');
    } finally { await b.context.close(); }
  },
  'saisie utilisateur piégée dans une fiche : aucun script exécuté': async ({ page }) => {
    const x = '<img src=x onerror="window.__xss=(window.__xss||0)+1">'; const id = await idOf(page, CAT.editable);
    await ev(page, ([i, x]) => { show(i); edit(byId[i]); for (const f of ['eN', 'eD', 'eS', 'eDu', 'eV', 'eE', 'eT']) document.querySelector('#' + f).value = 'x ' + x; document.querySelector('#eOk').click(); tip({ clientX: 100, clientY: 100 }, byId[i]); }, [id, x]);
    await settle(page, 600); await page.reload(); await page.waitForFunction(() => typeof journalReady !== 'undefined' && journalReady).catch(() => {}); await ev(page, (i) => { show(i); tip({ clientX: 100, clientY: 100 }, byId[i]); openAtlasSettings(); tab('p3'); }, id); await settle(page, 400);
    eq(await ev(page, () => window.__xss || 0), 0, 'exécutions de script injecté');
  },
  'aucune requête vers un tiers au chargement': async ({ browser, url }) => {
    const a = await openApp(browser, url, 'desktop-1440x900');
    try { await settle(a.page, 500); eq([...new Set(a.remote.map((u) => new URL(u).hostname))], [], 'hôtes tiers contactés au chargement'); } finally { await a.context.close(); }
  },
  'politique de sécurité du contenu présente et sans violation': async ({ page, errors }) => {
    const csp = await ev(page, () => document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.content || ''); assert(csp, 'balise Content-Security-Policy absente');
    assert(/default-src 'none'/.test(csp) && !/script-src[^;]*'unsafe-inline'/.test(csp), 'politique stricte attendue : ' + csp.slice(0, 120)); eq(errors.filter((e) => /Content Security Policy/i.test(e)), [], 'violations de la politique');
  }
});

// ---- exécution -------------------------------------------------------------------------------------------
const { chromium } = loadPlaywright();
const server = await serve(dir);
const browser = await chromium.launch();
const started = Date.now();
try {
  for (const [name, g] of Object.entries(GROUPS)) {
    if (only && !only.some((o) => name.includes(o))) continue;
    const app = await openApp(browser, server.url, g.viewport, g.options);
    for (const [title, fn] of Object.entries(g.tests)) {
      const t0 = Date.now(); let status = 'PASS', detail = '';
      try { await fn({ page: app.page, context: app.context, errors: app.errors, browser, url: server.url }); }
      catch (e) { status = 'FAIL'; detail = String(e.message).split('\n')[0].slice(0, 400); await closeDialogs(app.page).catch(() => {}); }
      results.push({ group: name, title, status, detail, ms: Date.now() - t0 });
      console.log(`${status}  ${name} › ${title}${detail ? '\n        ' + detail : ''}`);
    }
    if (app.errors.length) results.push({ group: name, title: 'console sans erreur pendant tout le groupe', status: 'FAIL', detail: [...new Set(app.errors)].slice(0, 4).join(' | ').slice(0, 500), ms: 0 });
    else results.push({ group: name, title: 'console sans erreur pendant tout le groupe', status: 'PASS', detail: '', ms: 0 });
    await app.context.close();
  }
} finally { await browser.close(); await server.close(); }
const pass = results.filter((r) => r.status === 'PASS').length, fail = results.length - pass;
writeJson(out, { label, dir, generatedAt: new Date().toISOString(), durationS: Math.round((Date.now() - started) / 1000), totals: { tests: results.length, pass, fail }, results });
console.log(`\n${label} : ${pass}/${results.length} PASS, ${fail} FAIL → ${path.relative(ROOT, out)}`);
process.exitCode = fail ? 1 : 0;
