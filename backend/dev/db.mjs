// TESTS ET DÉVELOPPEMENT SEULEMENT — base PostgreSQL locale (PGlite, PostgreSQL compilé en WebAssembly) avec le schéma de
// « Partage » et une imitation minimale de Supabase (backend/test/supabase-shim.sql). Jamais utilisée par le site publié.
//
// PGlite n'est pas une dépendance du dépôt : l'installer à part et indiquer son dossier,
//   npm install --prefix /chemin/outils @electric-sql/pglite@0.5.8
//   PGLITE_FROM=/chemin/outils/ node tests/community.mjs
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url)), BACKEND = path.resolve(HERE, '..');
export const SQL_FILES = ['test/supabase-shim.sql', 'migrations/0001_community.sql', 'policies/0001_rls.sql'].map((f) => path.join(BACKEND, f));

export async function loadPGlite() {
  const from = process.env.PGLITE_FROM;
  if (!from) return null;
  const require = createRequire(path.join(path.resolve(from), 'x.js'));
  let entry;
  try { entry = require.resolve('@electric-sql/pglite'); } catch { return null; }
  return (await import(pathToFileURL(entry).href)).PGlite;
}

// Base neuve, migrations appliquées. Renvoie { db, as, admin, close }.
//   as(claims, fn) : exécute fn(tx) dans une transaction, avec le rôle et le jeton donnés (claims null : visiteur anonyme)
//   admin(fn)      : exécute fn(tx) avec les droits du propriétaire (comme la console Supabase ou le rôle de service)
export async function openDatabase() {
  const PGlite = await loadPGlite();
  if (!PGlite) throw new Error('PGlite introuvable : définir PGLITE_FROM (voir backend/dev/db.mjs)');
  const db = new PGlite();
  await db.waitReady;
  for (const f of SQL_FILES) await db.exec(fs.readFileSync(f, 'utf8'));
  const as = (claims, fn) => db.transaction(async (tx) => {
    const role = claims && claims.role === 'authenticated' ? 'authenticated' : 'anon';
    await tx.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify(claims || { role: 'anon' })]);
    await tx.exec(`set local role ${role}`);
    return fn(tx);
  });
  const admin = (fn) => db.transaction(async (tx) => fn(tx));
  return { db, as, admin, close: () => db.close() };
}
