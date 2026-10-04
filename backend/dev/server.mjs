#!/usr/bin/env node
// TESTS ET DÉVELOPPEMENT SEULEMENT — jamais déployé, jamais copié dans dist/.
// Imitation minimale de Supabase au-dessus de PGlite, pour essayer « Partage » sans compte Supabase et pour les tests
// de bout en bout : les règles d'accès éprouvées sont les vraies (migrations et RLS de backend/), exécutées par PostgreSQL.
//
//   PGLITE_FROM=<dossier> node backend/dev/server.mjs [--port 54321] [--origin http://127.0.0.1:8080]
//
// Imite :
//   /auth/v1/signup, /auth/v1/token?grant_type=password|refresh_token, /auth/v1/user, /auth/v1/logout   (GoTrue)
//   /rest/v1/rpc/<fonction>                                    (PostgREST : appel de fonction, arguments nommés)
//   /rest/v1/<table>?colonne=eq.valeur  GET, POST, PATCH, DELETE (PostgREST, sous-ensemble : sert aux tests d'attaque)
//   /storage/v1/object/community-media/<uid>/<uuid>.<ext>     (Storage, sous-ensemble : dépôt et lecture de photos)
// Comme PostgREST, chaque requête s'exécute dans une transaction avec SET ROLE anon|authenticated et le jeton décodé.
import http from 'node:http';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { openDatabase } from './db.mjs';

const b64url = (buf) => Buffer.from(buf).toString('base64url');
function sign(payload, secret) {
  const head = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' })), body = b64url(JSON.stringify(payload));
  return `${head}.${body}.${b64url(crypto.createHmac('sha256', secret).update(`${head}.${body}`).digest())}`;
}
function verify(token, secret) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) return null;
  const expected = b64url(crypto.createHmac('sha256', secret).update(`${parts[0]}.${parts[1]}`).digest());
  if (expected.length !== parts[2].length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(parts[2]))) return null;
  try { const p = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')); return p.exp && p.exp * 1000 < Date.now() ? null : p; } catch { return null; }
}
const hashPassword = (password, salt = crypto.randomBytes(16).toString('hex')) => `${salt}:${crypto.scryptSync(password, salt, 32).toString('hex')}`;
const checkPassword = (password, stored) => { const [salt, hash] = String(stored).split(':'); const a = Buffer.from(hashPassword(password, salt).split(':')[1], 'hex'), b = Buffer.from(hash || '', 'hex'); return a.length === b.length && crypto.timingSafeEqual(a, b); };

const ERR = { '42501': 403, P0002: 404, '23514': 400, '23502': 400, '22023': 400, '22P02': 400, '22007': 400, '22008': 400, '22003': 400, '54000': 429, '23505': 409, '23503': 409, '42883': 404, '42P01': 404 };
const IDENT = /^[a-z_][a-z0-9_]{0,62}$/;
const TABLES = new Set(['profiles', 'community_items', 'community_route_stops', 'community_bookmarks', 'community_reactions', 'community_reports', 'community_media', 'moderation_log']);
const MEDIA = /^([0-9a-f-]{36})\/[0-9a-f-]{36}\.(jpg|png|webp)$/, MAX_MEDIA = 5 * 1024 * 1024;

export async function startServer({ port = 0, origin = '*', rate = { signup: 20, login: 30 } } = {}) {
  const D = await openDatabase(), secret = crypto.randomBytes(32).toString('hex');
  const anonKey = sign({ role: 'anon', iss: 'atlas-dev', iat: Math.floor(Date.now() / 1000) }, secret);
  const refresh = new Map(), storage = new Map(), hits = new Map();
  const limited = (key, max) => { const now = Date.now(), list = (hits.get(key) || []).filter((t) => now - t < 3600e3); list.push(now); hits.set(key, list); return list.length > max; };

  async function session(userId) {
    const { rows: [u] } = await D.admin((tx) => tx.query('select id, email, raw_app_meta_data a, raw_user_meta_data m, created_at from auth.users where id = $1', [userId]));
    const now = Math.floor(Date.now() / 1000), rt = crypto.randomBytes(24).toString('hex');
    refresh.set(rt, u.id);
    // app_metadata vient de la base (posé par le serveur) ; user_metadata est recopié mais ne donne aucun droit.
    const access = sign({ sub: u.id, role: 'authenticated', aud: 'authenticated', email: u.email, app_metadata: u.a || {}, user_metadata: u.m || {}, iat: now, exp: now + 3600 }, secret);
    return { access_token: access, token_type: 'bearer', expires_in: 3600, refresh_token: rt, user: { id: u.id, email: u.email, created_at: u.created_at } };
  }
  const claimsOf = (req) => {
    const h = req.headers.authorization || '', token = h.startsWith('Bearer ') ? h.slice(7) : null;
    if (!token) return { ok: true, claims: null };
    const c = verify(token, secret);
    if (!c) return { ok: false };
    return { ok: true, claims: c.role === 'authenticated' ? c : null };
  };
  const send = (res, status, body, headers = {}) => {
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': origin, 'access-control-allow-headers': 'apikey, authorization, content-type, prefer, x-client-info, x-upsert',
      'access-control-allow-methods': 'GET, POST, PATCH, DELETE, OPTIONS', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...headers });
    // undefined : réponse vide (204) ; null est une réponse JSON valable (fonction qui ne trouve rien), comme PostgREST.
    res.end(body === undefined ? '' : Buffer.isBuffer(body) ? body : JSON.stringify(body));
  };
  const pgError = (res, e) => send(res, ERR[e.code] || 400, { code: e.code || 'PGRST', message: e.message, details: null, hint: null });
  const readBody = (req, max = 1024 * 1024) => new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    req.on('data', (c) => { size += c.length; if (size > max) { reject(Object.assign(new Error('payload_too_large'), { status: 413 })); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks))); req.on('error', reject);
  });
  const json = async (req) => { const b = await readBody(req); if (!b.length) return {}; try { return JSON.parse(b.toString('utf8')); } catch { throw Object.assign(new Error('invalid_json'), { status: 400 }); } };
  const ip = (req) => req.socket.remoteAddress || 'local';

  // Filtres PostgREST « colonne=eq.valeur » (seul opérateur imité) ; noms de colonnes contrôlés, valeurs passées en paramètres.
  function where(url, values) {
    const parts = [];
    for (const [k, v] of url.searchParams) {
      if (k === 'select' || k === 'order' || k === 'limit') continue;
      if (!IDENT.test(k) || !v.startsWith('eq.')) throw Object.assign(new Error('filtre non pris en charge'), { status: 400 });
      values.push(v.slice(3)); parts.push(`${k} = $${values.length}`);
    }
    return parts.length ? ' where ' + parts.join(' and ') : '';
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    if (req.method === 'OPTIONS') return send(res, 204, undefined);
    if (req.headers.apikey !== anonKey) return send(res, 401, { message: 'clé publique (apikey) absente ou invalide' });
    try {
      // ── Authentification ──
      if (url.pathname === '/auth/v1/signup' && req.method === 'POST') {
        if (limited('signup:' + ip(req), rate.signup)) return send(res, 429, { msg: 'Trop d’inscriptions depuis cette adresse, réessayer plus tard.' });
        const b = await json(req), email = String(b.email || '').trim().toLowerCase(), password = String(b.password || '');
        if (!/^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,}$/i.test(email)) return send(res, 400, { msg: 'Adresse e-mail invalide' });
        if (password.length < 10 || password.length > 128) return send(res, 400, { msg: 'Mot de passe : 10 caractères au moins' });
        try {
          const { rows: [u] } = await D.admin((tx) => tx.query('insert into auth.users (email, encrypted_password) values ($1, $2) returning id', [email, hashPassword(password)]));
          return send(res, 200, await session(u.id));
        } catch (e) { if (e.code === '23505') return send(res, 400, { msg: 'Un compte existe déjà avec cette adresse' }); throw e; }
      }
      if (url.pathname === '/auth/v1/token' && req.method === 'POST') {
        const b = await json(req), grant = url.searchParams.get('grant_type');
        if (grant === 'password') {
          if (limited('login:' + ip(req), rate.login)) return send(res, 429, { msg: 'Trop de tentatives, réessayer plus tard.' });
          const { rows: [u] } = await D.admin((tx) => tx.query('select id, encrypted_password from auth.users where email = $1', [String(b.email || '').trim().toLowerCase()]));
          if (!u || !checkPassword(String(b.password || ''), u.encrypted_password)) return send(res, 400, { error: 'invalid_grant', error_description: 'Identifiants invalides' });
          return send(res, 200, await session(u.id));
        }
        if (grant === 'refresh_token') {
          const id = refresh.get(String(b.refresh_token || ''));
          if (!id) return send(res, 400, { error: 'invalid_grant', error_description: 'Session expirée' });
          refresh.delete(String(b.refresh_token));
          const { rows } = await D.admin((tx) => tx.query('select 1 from auth.users where id = $1', [id]));
          return rows.length ? send(res, 200, await session(id)) : send(res, 400, { error: 'invalid_grant' });
        }
        return send(res, 400, { error: 'unsupported_grant_type' });
      }
      const who = claimsOf(req);
      if (!who.ok) return send(res, 401, { code: 'PGRST301', message: 'jeton invalide ou expiré' });
      if (url.pathname === '/auth/v1/user' && req.method === 'GET') {
        if (!who.claims) return send(res, 401, { msg: 'non connecté' });
        return send(res, 200, { id: who.claims.sub, email: who.claims.email, app_metadata: who.claims.app_metadata });
      }
      if (url.pathname === '/auth/v1/logout' && req.method === 'POST') {
        if (who.claims) for (const [k, v] of refresh) if (v === who.claims.sub) refresh.delete(k);
        return send(res, 204, undefined);
      }

      // ── Fonctions ──
      const rpc = /^\/rest\/v1\/rpc\/([a-z_][a-z0-9_]{0,62})$/.exec(url.pathname);
      if (rpc && req.method === 'POST') {
        const args = await json(req);
        if (!args || typeof args !== 'object' || Array.isArray(args)) return send(res, 400, { message: 'arguments invalides' });
        const names = Object.keys(args);
        if (!names.every((k) => IDENT.test(k))) return send(res, 400, { message: 'argument invalide' });
        const values = names.map((k) => (args[k] !== null && typeof args[k] === 'object' ? JSON.stringify(args[k]) : args[k]));
        const result = await D.as(who.claims, (tx) => tx.query(`select public.${rpc[1]}(${names.map((k, i) => `${k} => $${i + 1}`).join(', ')}) as r`, values));
        return send(res, 200, result.rows[0].r);
      }
      // ── Tables (sous-ensemble) ──
      const table = /^\/rest\/v1\/([a-z_]+)$/.exec(url.pathname);
      if (table) {
        if (!TABLES.has(table[1])) return send(res, 404, { message: 'table inconnue' });
        const values = [], name = `public.${table[1]}`;
        const cols = (url.searchParams.get('select') || '*').split(',').map((c) => c.trim());
        if (!cols.every((c) => c === '*' || IDENT.test(c))) return send(res, 400, { message: 'colonnes invalides' });
        let sql;
        if (req.method === 'GET') sql = `select ${cols.join(', ')} from ${name}${where(url, values)} limit 1000`;
        else if (req.method === 'DELETE') sql = `delete from ${name}${where(url, values)} returning 1`;
        else if (req.method === 'POST' || req.method === 'PATCH') {
          const body = await json(req);
          if (!body || typeof body !== 'object' || Array.isArray(body) || !Object.keys(body).every((k) => IDENT.test(k))) return send(res, 400, { message: 'corps invalide' });
          const keys = Object.keys(body), start = values.length;
          keys.forEach((k) => values.push(body[k] !== null && typeof body[k] === 'object' ? JSON.stringify(body[k]) : body[k]));
          sql = req.method === 'POST' ? `insert into ${name} (${keys.join(', ')}) values (${keys.map((_, i) => `$${start + i + 1}`).join(', ')}) returning 1`
            : `update ${name} set ${keys.map((k, i) => `${k} = $${start + i + 1}`).join(', ')}${where(url, values)} returning 1`;
        } else return send(res, 405, { message: 'méthode non prise en charge' });
        const result = await D.as(who.claims, (tx) => tx.query(sql, values));
        return send(res, req.method === 'POST' ? 201 : 200, req.method === 'GET' ? result.rows : { affected: result.rows.length });
      }
      // ── Stockage des photos (sous-ensemble) : règles du compartiment privé « community-media » ──
      const obj = /^\/storage\/v1\/object\/(?:(authenticated|public)\/)?community-media\/(.+)$/.exec(url.pathname);
      if (obj) {
        const path = obj[2], m = MEDIA.exec(path);
        if (!m) return send(res, 400, { message: 'chemin refusé' });
        if (req.method === 'POST' || req.method === 'PUT') {
          if (!who.claims || who.claims.sub !== m[1]) return send(res, 403, { message: 'dossier d’un autre compte' });
          const type = String(req.headers['content-type'] || '');
          if (!['image/jpeg', 'image/png', 'image/webp'].includes(type)) return send(res, 415, { message: 'type refusé' });
          const body = await readBody(req, MAX_MEDIA);
          const magic = body[0] === 0xff && body[1] === 0xd8 ? 'image/jpeg' : body.readUInt32BE(0) === 0x89504e47 ? 'image/png' : body.toString('ascii', 8, 12) === 'WEBP' ? 'image/webp' : null;
          if (magic !== type) return send(res, 415, { message: 'contenu différent du type annoncé' });
          if (storage.has(path)) return send(res, 409, { message: 'existe déjà' });
          storage.set(path, { type, body });
          return send(res, 200, { Key: 'community-media/' + path });
        }
        if (req.method === 'GET') {
          const f = storage.get(path);
          if (!f) return send(res, 404, { message: 'absent' });
          // Lecture : seulement si la photo est rattachée à une contribution visible pour ce visiteur (même règle que la RLS).
          const visible = await D.as(who.claims, (tx) => tx.query('select 1 from public.community_media where path = $1', [path]));
          if (!visible.rows.length) return send(res, 404, { message: 'absent' });
          return send(res, 200, f.body, { 'content-type': f.type });
        }
        if (req.method === 'DELETE') {
          if (!who.claims || who.claims.sub !== m[1]) return send(res, 403, { message: 'dossier d’un autre compte' });
          storage.delete(path); return send(res, 200, {});
        }
      }
      return send(res, 404, { message: 'introuvable' });
    } catch (e) {
      if (e.status) return send(res, e.status, { message: e.message });
      if (e.code) return pgError(res, e);
      return send(res, 500, { message: 'erreur interne' });
    }
  });
  await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  return {
    url, anonKey, db: D, storage,
    // Outils de test côté serveur (jamais exposés par HTTP) : rôle de modérateur posé comme le ferait la console Supabase.
    promote: (email) => D.admin((tx) => tx.query(`update auth.users set raw_app_meta_data = raw_app_meta_data || '{"role":"moderator"}' where email = $1`, [email.toLowerCase()])),
    forge: (payload) => sign(payload, crypto.randomBytes(32).toString('hex')),   // jeton signé par une autre clé : doit être refusé
    close: async () => { await new Promise((r) => server.close(r)); await D.close(); }
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), opt = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
  const s = await startServer({ port: +opt('--port', 54321), origin: opt('--origin', '*') });
  console.log(`Serveur Partage de développement : ${s.url}\nÀ mettre dans content/site.json (essais locaux seulement) :\n  "community": { "url": "${s.url}", "anonKey": "${s.anonKey}" }\nModérateur : node -e … (voir backend/README.md). Ctrl+C pour arrêter.`);
}
