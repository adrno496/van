// Vérification rapide sur plusieurs moteurs de navigateur et en ouverture directe du fichier (file://).
//   node tests/smoke.mjs [--file <index.html>] [--out <rapport.json>] [--places <nombre de lieux attendu>]
// Chaque moteur déroule le même mini-parcours : démarrage, recherche, fiche, trajet, carnet, rechargement.
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, loadPlaywright, serve, writeJson, shippedCatalogue } from './lib/harness.mjs';

const args = process.argv.slice(2);
const opt = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
const file = path.resolve(opt('--file', path.join(ROOT, 'index.html')));
const out = path.resolve(opt('--out', 'test-results/smoke.json'));
const places = Number(opt('--places', shippedCatalogue(file).places));   // par défaut : le nombre de lieux contenus dans le fichier testé
const pw = loadPlaywright();
const server = await serve(path.dirname(file));
const results = [];

async function journey(engine, url, label) {
  const row = { engine, mode: label, status: 'PASS', steps: [], errors: [] };
  let browser;
  try {
    browser = await pw[engine].launch();
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'fr-FR' });
    await context.route('**/*', (r) => (/^(http:\/\/127\.0\.0\.1|file:|data:|blob:)/.test(r.request().url()) ? r.continue() : r.abort()));
    const page = await context.newPage();
    page.on('pageerror', (e) => row.errors.push('pageerror: ' + e.message.slice(0, 200)));
    page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|ERR_FAILED/.test(m.text())) row.errors.push('console: ' + m.text().slice(0, 200)); });
    const step = async (name, fn) => { try { await fn(); row.steps.push(name + ' : ok'); } catch (e) { row.status = 'FAIL'; row.steps.push(name + ' : ÉCHEC — ' + String(e.message).split('\n')[0].slice(0, 160)); } };
    await page.goto(url, { waitUntil: 'load' });
    await step('démarrage', async () => { await page.waitForFunction(() => typeof journalReady !== 'undefined' && journalReady, null, { timeout: 20000 }); const n = await page.evaluate(() => [PTS.length, document.querySelectorAll('#map .poi').length, journalError]); if (n[0] !== places || n[1] !== places) throw new Error('lieux : ' + n.join(' / ')); if (n[2]) throw new Error('carnet : ' + n[2]); });
    await step('recherche et fiche', async () => { await page.fill('#q', 'chambord'); await page.locator('#res [data-s]').first().click(); await page.waitForSelector('#detail :is(h2,h3)'); if (!/Chambord/.test(await page.locator('#detail :is(h2,h3)').first().innerText())) throw new Error('fiche absente'); });
    await step('ajout au trajet', async () => { await page.locator('#addBtn').click(); const n = await page.evaluate(() => route.length); if (n !== 1) throw new Error('trajet : ' + n); });
    await step('dialogue des filtres', async () => { await page.locator('#mapFiltersButton').click(); await page.waitForSelector('#filtersDialog[open]'); await page.locator('#filtersDialog [data-cat="nature"]').click(); const n = await page.evaluate(() => document.querySelectorAll('#map .poi.nature:not(.off)').length); await page.locator('#resetMapFilters').click(); await page.locator('#applyMapFilters').click(); if (n !== 0) throw new Error('filtre sans effet'); });
    await step('zoom et carte', async () => { const a = await page.evaluate(() => vb[2]); await page.locator('#zin').click(); await page.waitForTimeout(250); const b = await page.evaluate(() => vb[2]); if (!(b < a)) throw new Error('zoom sans effet'); });
    await step('carnet : écrire et enregistrer', async () => { await page.locator('#tab-pBlog').click(); await page.locator('#firstStory, #journalNew:not([hidden])').first().click(); await page.fill('#postTitle', 'Essai ' + engine); await page.fill('#postText', 'Texte.'); await page.locator('#savePost').click(); await page.waitForFunction(() => !journalEditing && J.posts.length === 1, null, { timeout: 8000 }); });
    await step('rechargement : données relues', async () => { await page.waitForTimeout(500); await page.reload({ waitUntil: 'load' }); await page.waitForFunction(() => typeof journalReady !== 'undefined' && journalReady, null, { timeout: 20000 }); const s = await page.evaluate(() => [route.length, J.posts.length, journalError]); if (s[0] !== 1 || s[1] !== 1 || s[2]) throw new Error('après rechargement : ' + JSON.stringify(s)); });
    await step('politique de sécurité respectée', async () => { const v = row.errors.filter((e) => /Content Security Policy|Refused to/i.test(e)); if (v.length) throw new Error(v[0]); });
    row.version = browser.version();
    await context.close();
  } catch (e) { row.status = 'NON TESTÉ'; row.steps.push('lancement impossible : ' + String(e.message).split('\n')[0].slice(0, 200)); }
  finally { if (browser) await browser.close().catch(() => {}); }
  if (row.errors.length && row.status === 'PASS') row.status = 'FAIL';
  results.push(row);
  console.log(`${row.status.padEnd(9)} ${engine.padEnd(8)} ${label.padEnd(9)} ${row.version || ''}${row.status === 'PASS' ? '' : '\n   ' + row.steps.filter((s) => !s.endsWith(': ok')).concat(row.errors).join('\n   ')}`);
}

try {
  for (const engine of ['chromium', 'firefox', 'webkit']) await journey(engine, server.url, 'serveur');
  for (const engine of ['chromium', 'firefox', 'webkit']) await journey(engine, pathToFileURL(file).href, 'fichier');
} finally { await server.close(); }
writeJson(out, { file, generatedAt: new Date().toISOString(), results });
process.exitCode = results.some((r) => r.status === 'FAIL') ? 1 : 0;
