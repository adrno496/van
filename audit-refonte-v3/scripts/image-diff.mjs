// Comparaison pixel à pixel de deux dossiers de captures (mêmes noms de fichiers), dans un navigateur : aucune dépendance.
//   node audit-refonte-v3/scripts/image-diff.mjs <dossier avant> <dossier après> [--only 01-carte,04-trajet] [--out rapport.json]
// Un pixel compte comme différent quand une de ses composantes s'écarte de plus de 16 (sur 255) : l'anticrénelage n'est pas compté.
import fs from 'node:fs';
import path from 'node:path';
import { loadPlaywright, writeJson } from '../../tests/lib/harness.mjs';
const args = process.argv.slice(2), opt = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
const before = path.resolve(args[0]), after = path.resolve(args[1]), only = opt('--only', null)?.split(','), out = opt('--out', null);
const names = fs.readdirSync(after).filter((f) => f.endsWith('.png') && fs.existsSync(path.join(before, f)) && (!only || only.some((o) => f.includes(o)))).sort();
const { chromium } = loadPlaywright(); const browser = await chromium.launch(); const page = await browser.newPage(); const rows = [];
for (const name of names) {
  const a = 'data:image/png;base64,' + fs.readFileSync(path.join(before, name)).toString('base64'), b = 'data:image/png;base64,' + fs.readFileSync(path.join(after, name)).toString('base64');
  rows.push({ name, ...(await page.evaluate(async ([a, b]) => {
    const load = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
    const [x, y] = await Promise.all([load(a), load(b)]);
    if (x.width !== y.width || x.height !== y.height) return { sameSize: false, sizes: [[x.width, x.height], [y.width, y.height]], differentShare: null };
    const data = (img) => { const c = new OffscreenCanvas(img.width, img.height), g = c.getContext('2d'); g.drawImage(img, 0, 0); return g.getImageData(0, 0, img.width, img.height).data; };
    const p = data(x), q = data(y); let n = 0;
    for (let i = 0; i < p.length; i += 4) if (Math.abs(p[i] - q[i]) > 16 || Math.abs(p[i + 1] - q[i + 1]) > 16 || Math.abs(p[i + 2] - q[i + 2]) > 16) n++;
    return { sameSize: true, pixels: p.length / 4, different: n, differentShare: Number((n / (p.length / 4) * 100).toFixed(3)) };
  }, [a, b])) });
}
await browser.close();
if (out) writeJson(path.resolve(out), { before, after, generatedAt: new Date().toISOString(), rows });
for (const r of rows) console.log(r.name.padEnd(48), r.sameSize ? `${r.differentShare} % de pixels différents` : 'tailles différentes ' + JSON.stringify(r.sizes));
