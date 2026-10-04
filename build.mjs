#!/usr/bin/env node
// Assemble src/ en un seul fichier index.html autonome (aucune dépendance, aucun appel réseau).
//   node build.mjs                         → index.html : le Planner seul, en un fichier (tout le catalogue)
//   node build.mjs --mode personal         → dist/personal/ : le site éditorial + le Planner (app/index.html), tout le contenu
//   node build.mjs --mode public           → dist/public/ : la même chose sans rien de personnel (voir PERSONAL et build/site.mjs)
//   node build.mjs --mode public --out f   → le Planner public seul, dans le fichier f
//   node build.mjs --tokens <tokens.css> --out <fichier.html>   → variante de thème (exploration visuelle)
//   node build.mjs --split <dossier>       → variante à fichiers séparés, pour un hébergement web
//   node build.mjs --check                 → vérifie que le fichier de sortie correspond aux sources
// Le Planner est assemblé par build/planner.mjs, le site éditorial par build/site.mjs, le contenu est lu par build/content.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, buildSplit } from './build/planner.mjs';
import { buildSite } from './build/site.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (flag, fallback) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : fallback; };

const mode = opt('--mode', null), tokens = opt('--tokens', null), check = args.includes('--check');
const ko = (n) => (n / 1024).toFixed(1) + ' Ko';
try {
  if (opt('--split', null)) {
    const dir = path.resolve(opt('--split')), b = buildSplit(dir, { tokens, mode: mode || 'personal' });
    console.log(`${path.relative(ROOT, dir) || dir}/ (${mode || 'personal'}, ${b.places} lieux) : index.html ${ko(b.html)}, assets/app.css ${ko(b.css)}, assets/app.js ${ko(b.js)}, assets/places.js ${ko(b.data)}`);
    process.exit(0);
  }
  if (mode && !opt('--out', null)) {
    // Site complet : pages éditoriales + Planner dans app/.
      const outDir = path.resolve(opt('--dir', path.join(ROOT, 'dist', mode)));
    const result = buildSite({ mode, outDir, check, direction: opt('--direction', null), contentDir: opt('--content', null), siteUrl: opt('--site-url', null), demo: args.includes('--demo') });
    if (check) { console.log(result.same ? `OK — ${path.relative(ROOT, outDir)}/ correspond aux sources (${result.files} fichiers)` : `DIFFÉRENT — ${result.different.slice(0, 5).join(', ')} : relancer « node build.mjs --mode ${mode} »`); process.exit(result.same ? 0 : 1); }
    console.log(`${path.relative(ROOT, outDir)}/ : ${result.files} fichiers, ${result.pages} pages, ${ko(result.bytes)} — mode ${mode}, ${result.places} lieux` + (mode === 'public' ? `, contrôle de confidentialité réussi` : ''));
    for (const w of result.warnings) console.log('  à savoir : ' + w);
    process.exit(0);
  }
  const m = mode || 'personal';
  const out = path.resolve(opt('--out', path.join(ROOT, 'index.html')));
  const { html, bytes, places, removed } = build({ tokens, mode: m });
  if (check) {
    const same = fs.existsSync(out) && fs.readFileSync(out, 'utf8') === html;
    console.log(same ? `OK — ${path.relative(ROOT, out)} correspond aux sources` : `DIFFÉRENT — relancer « node build.mjs »`);
    process.exit(same ? 0 : 1);
  }
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, html);
  console.log(`${path.relative(ROOT, out)} : ${ko(bytes.html)} (CSS ${ko(bytes.css)}, JS ${ko(bytes.js)}, données ${ko(bytes.data)}) — mode ${m}, ${places} lieux` +
    (m === 'public' ? `, ${removed} fiche(s) personnelle(s) retirée(s), contrôle de confidentialité réussi` : ''));
} catch (error) { console.error(error.message); process.exit(1); }
