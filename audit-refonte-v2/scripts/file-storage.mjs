// Deux fichiers locaux de dossiers différents partagent-ils le stockage du navigateur ? (oui dans les trois moteurs : la version publique,
// ouverte en fichier local sur le même appareil, lit les données de la version personnelle.)   node audit-refonte-v2/scripts/file-storage.mjs
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { loadPlaywright } from '../../tests/lib/harness.mjs';
const pw = loadPlaywright(); const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-'));
fs.mkdirSync(path.join(dir, 'a')); fs.mkdirSync(path.join(dir, 'b'));
fs.writeFileSync(path.join(dir, 'a/index.html'), '<!doctype html><title>a</title>'); fs.writeFileSync(path.join(dir, 'b/index.html'), '<!doctype html><title>b</title>');
for (const name of ['chromium', 'firefox', 'webkit']) {
  const b = await pw[name].launch(); const c = await b.newContext(); const p = await c.newPage();
  await p.goto('file://' + path.join(dir, 'a/index.html')); await p.evaluate(() => localStorage.setItem('k', 'depuis-a'));
  await p.goto('file://' + path.join(dir, 'b/index.html')); console.log(name, 'fichier b lit :', await p.evaluate(() => localStorage.getItem('k')));
  await b.close();
}
