// Tests de sécurité de l'espace « Partage » au niveau de la base : schéma, contraintes, déclencheurs et RLS de backend/,
// exécutés sur un vrai PostgreSQL (PGlite) avec les rôles anon / authenticated, comme PostgREST les utilise.
//   PGLITE_FROM=<dossier contenant node_modules/@electric-sql/pglite> node tests/community.mjs [--out <rapport.json>]
// Sans PGlite : rapport « NON TESTÉ » (rien n'est déclaré validé).
import path from 'node:path';
import { ROOT, writeJson } from './lib/harness.mjs';
import { openDatabase, loadPGlite } from '../backend/dev/db.mjs';

const args = process.argv.slice(2), out = path.resolve(args.includes('--out') ? args[args.indexOf('--out') + 1] : 'test-results/community.json');
const results = [];
const assert = (c, m) => { if (!c) throw new Error(m); };
const eq = (a, b, m) => assert(JSON.stringify(a) === JSON.stringify(b), `${m} — attendu ${JSON.stringify(b)}, obtenu ${JSON.stringify(a)}`.slice(0, 500));

if (!(await loadPGlite())) {
  console.log('NON TESTÉ — PGlite introuvable (PGLITE_FROM). Commande : npm install --prefix <dossier> @electric-sql/pglite@0.5.8 puis PGLITE_FROM=<dossier>/ node tests/community.mjs');
  writeJson(out, { generatedAt: new Date().toISOString(), status: 'NON TESTÉ', reason: 'PGlite absent', results: [] });
  process.exit(0);
}

const D = await openDatabase();
let n = 0;
// Un compte : ligne auth.users (écrite par le serveur d'authentification), jeton (claims) tel que PostgREST le reçoit.
const usedPseudos = new Set();
async function account(base, { moderator = false, userMeta = {} } = {}) {
  let pseudo = base; for (let k = 2; usedPseudos.has(pseudo); k++) pseudo = base + k;   // les pseudos sont uniques
  usedPseudos.add(pseudo);
  const email = `${pseudo.toLowerCase().replace(/\W/g, '')}${++n}@exemple.test`;
  const { rows: [u] } = await D.admin((tx) => tx.query(`insert into auth.users (email, raw_app_meta_data, raw_user_meta_data) values ($1, $2, $3) returning id`, [email, moderator ? { role: 'moderator' } : {}, userMeta]));
  const claims = { sub: u.id, role: 'authenticated', email, app_metadata: moderator ? { role: 'moderator' } : {}, user_metadata: userMeta };
  if (pseudo) await D.as(claims, (tx) => tx.query('select public.save_profile($1)', [pseudo]));
  return { id: u.id, email, pseudo, claims };
}
const rpc = (who, fn, params = {}) => D.as(who ? who.claims : null, async (tx) => {
  const names = Object.keys(params), sql = `select public.${fn}(${names.map((k, i) => `${k} => $${i + 1}`).join(', ')}) as r`;
  return (await tx.query(sql, names.map((k) => (params[k] !== null && typeof params[k] === 'object' && !Array.isArray(params[k]) ? JSON.stringify(params[k]) : params[k])))).rows[0].r;
});
const sql = (who, text, values = []) => D.as(who ? who.claims : null, (tx) => tx.query(text, values));
const fails = async (promise, expected, m) => { try { await promise; } catch (e) { assert(expected.test(e.message), `${m} : erreur inattendue « ${e.message} »`); return e.message; } throw new Error(m + ' : aurait dû être refusé'); };
const tip = (over = {}) => ({ type: 'astuce', title: 'Remplir l’eau aux fontaines', summary: 'Les fontaines de village sont souvent potables : vérifier le panneau.', body: 'Détails.', country: 'France', category: 'eau-vidange', status: 'pending', ...over });
const spot = (over = {}) => ({ type: 'spot', title: 'Parking calme près du lac', summary: 'Parking en terre, plat, sans interdiction affichée en 2026.', lat: 45.12, lon: 6.34, spot_kind: 'parking', night_spot: true, last_verified: '2026-05-01', status: 'pending', ...over });
const circuit = (over = {}) => ({ type: 'circuit', title: 'Boucle des Pyrénées catalanes', summary: 'Une semaine entre montagne et mer, routes étroites par endroits.', distance_km: 620, days_done: 7, days_suggested: 10, seasons: ['printemps', 'automne'], difficulty: 'moyen', vehicle: 'Fourgon 6 m',
  stops: [{ name: 'Perpignan', lat: 42.7, lon: 2.9 }, { name: 'Collioure', lat: 42.53, lon: 3.08, nights: 2 }, { name: 'Cadaqués', place_id: 82, lat: 42.29, lon: 3.28 }], status: 'pending', ...over });

const M = await account('Modération', { moderator: true }), Mallory = await account('Mallory', { userMeta: { role: 'moderator' } });
// Comptes neufs pour chaque test : la limite de débit (5 contributions par heure) vaut par compte.
let A, B;
const fresh = async () => { A = await account('Alice'); B = await account('Bruno'); };
const publish = (item) => rpc(M, 'moderate_item', { p_item: item.id, p_status: 'published', p_reason: 'ok' });

const TESTS = {
  '1 · lecture publique : seules les contributions publiées sont visibles (liste, fiche, table), jamais brouillon, attente, masquée, refusée': async () => {
    const draft = await rpc(A, 'save_item', { p: tip({ title: 'Brouillon d’Alice, privé', status: 'draft' }) });
    const pending = await rpc(A, 'save_item', { p: tip({ title: 'Astuce en attente de validation' }) });
    const pub = await rpc(A, 'save_item', { p: tip({ title: 'Astuce publiée par Alice' }) }); await publish(pub);
    const hidden = await rpc(A, 'save_item', { p: tip({ title: 'Astuce à masquer ensuite' }) }); await publish(hidden); await rpc(M, 'moderate_item', { p_item: hidden.id, p_status: 'hidden', p_reason: 'test' });
    const rejected = await rpc(A, 'save_item', { p: tip({ title: 'Astuce refusée par la modération' }) }); await rpc(M, 'moderate_item', { p_item: rejected.id, p_status: 'rejected', p_reason: 'test' });
    eq([draft.status, pending.status], ['draft', 'pending'], 'statuts à la création (nouveau compte : en attente)');
    const list = await rpc(null, 'list_items', {}); eq(list.items.map((i) => i.title), ['Astuce publiée par Alice'], 'liste publique');
    for (const it of [draft, pending, hidden, rejected]) { eq(await rpc(null, 'get_item', { p_slug: it.slug }), null, 'fiche ' + it.status + ' (anonyme)'); eq(await rpc(B, 'get_item', { p_slug: it.slug }), null, 'fiche ' + it.status + ' (autre compte)'); }
    eq((await sql(null, 'select title from public.community_items')).rows.map((r) => r.title), ['Astuce publiée par Alice'], 'lecture directe de la table par un anonyme');
    eq((await rpc(A, 'get_item', { p_slug: draft.slug })).mine, true, 'l\'auteur voit son brouillon');
    eq((await rpc(M, 'get_item', { p_slug: pending.slug })).status, 'pending', 'le modérateur voit ce qui attend');
  },
  '2 · un utilisateur A ne peut pas modifier ni supprimer le contenu de B (RPC et requête directe)': async () => {
    const b = await rpc(B, 'save_item', { p: tip({ title: 'Astuce de Bruno, à protéger' }) }); await publish(b);
    await fails(rpc(A, 'save_item', { p: { ...tip({ title: 'Remplacé par Alice !!' }), id: b.id } }), /not_found/, 'modification par la fonction');
    eq((await sql(A, `update public.community_items set title = 'Piraté par Alice' where id = $1`, [b.id])).affectedRows, 0, 'UPDATE direct : aucune ligne touchée');
    eq((await sql(A, `delete from public.community_items where id = $1`, [b.id])).affectedRows, 0, 'DELETE direct : aucune ligne supprimée'); eq(await rpc(A, 'delete_item', { p_item: b.id }), false, 'suppression par la fonction');
    await fails(sql(A, `insert into public.community_route_stops (item_id, position, name) values ($1, 9, 'intrus')`, [b.id]), /not_owner|row-level security/, 'ajout d\'une étape chez B');
    eq((await rpc(null, 'get_item', { p_slug: b.slug })).title, 'Astuce de Bruno, à protéger', 'contenu de B intact');
  },
  '3 · owner_id impossible à usurper ; champs protégés (auteur, type, compteurs, dates) non modifiables': async () => {
    await fails(sql(A, `insert into public.community_items (owner_id, type, title, summary) values ($1, 'astuce', 'Au nom de Bruno', 'Contribution signée au nom d’un autre compte')`, [B.id]), /not_owner|row-level security/, 'insertion au nom de B');
    const a = await rpc(A, 'save_item', { p: tip({ title: 'Astuce d’Alice à détourner' }) });
    await fails(sql(A, `update public.community_items set owner_id = $1 where id = $2`, [B.id, a.id]), /not_owner|row-level security|permission denied/, 'transfert à B');
    await fails(sql(A, `update public.community_items set useful_count = 999 where id = $1`, [a.id]), /permission denied/, 'compteur « utile » forcé');
    await fails(sql(A, `update public.community_items set published_at = now(), slug = 'x' where id = $1`, [a.id]), /permission denied/, 'date de publication et adresse');
    await fails(sql(A, `update public.community_items set type = 'spot' where id = $1`, [a.id]), /permission denied|protected_field/, 'changement de type');
    eq((await rpc(A, 'get_item', { p_slug: a.slug })).author.pseudo, A.pseudo, 'pseudo de l\'auteur tiré du profil');
  },
  '4 · statuts : impossible de se publier, de se masquer ou de sortir d\'un masquage soi-même': async () => {
    await fails(rpc(A, 'save_item', { p: tip({ title: 'Je me publie tout seul', status: 'published' }) }), /status_forbidden/, 'création directement publiée');
    const a = await rpc(A, 'save_item', { p: tip({ title: 'En attente, puis forcé' }) });
    for (const st of ['published', 'hidden', 'rejected']) await fails(sql(A, `update public.community_items set status = $1 where id = $2`, [st, a.id]), /status_forbidden/, 'passage direct à ' + st);
    await publish(a); await rpc(M, 'moderate_item', { p_item: a.id, p_status: 'hidden', p_reason: 'test' });
    eq((await sql(A, `update public.community_items set status = 'pending', title = 'Je reviens' where id = $1`, [a.id])).affectedRows, 0, 'un contenu masqué ne se modifie plus');
    eq((await rpc(A, 'get_item', { p_slug: a.slug })).status, 'hidden', 'toujours masqué');
  },
  '5 · élévation de privilèges : pas de modération sans app_metadata, user_metadata ignoré, niveau de confiance et suspension intouchables': async () => {
    const it = await rpc(A, 'save_item', { p: tip({ title: 'Cible de Mallory pour publication' }) });
    for (const fn of [['moderate_item', { p_item: it.id, p_status: 'published' }], ['moderation_queue', { p_status: 'pending' }], ['suspend_user', { p_user: A.id, p_on: true }], ['moderation_history', {}]])
      await fails(rpc(Mallory, fn[0], fn[1]), /moderator_only/, fn[0] + ' par un compte qui se dit modérateur dans user_metadata');
    await fails(rpc(null, 'moderation_queue', { p_status: 'pending' }), /permission denied/, 'file de modération en anonyme');
    await fails(sql(A, `update public.profiles set trust_level = 2 where id = $1`, [A.id]), /permission denied/, 'niveau de confiance');
    await fails(sql(A, `update public.profiles set suspended_at = null where id = $1`, [A.id]), /permission denied/, 'levée de suspension');
    await fails(sql(A, `select trust_level from public.profiles`), /permission denied/, 'lecture du niveau de confiance des autres');
    await fails(sql(A, `select * from public.moderation_log`), /permission denied/, 'journal de modération');
    await fails(sql(A, `select email from auth.users`), /permission denied/, 'adresses e-mail des comptes');
    eq((await sql(null, `select * from public.profiles where id = $1`, [A.id]).catch((e) => ({ rows: [e.message] }))).rows.length, 1, 'profil public lisible…');
    await fails(sql(null, `select suspended_at from public.profiles`), /permission denied/, '…sans ses champs de modération');
  },
  '6 · modération : file, publication, masquage, refus, journal ; le contenu masqué disparaît du public': async () => {
    const it = await rpc(B, 'save_item', { p: spot() }), queue = await rpc(M, 'moderation_queue', { p_status: 'pending' });
    assert(queue.some((q) => q.id === it.id && q.author_trust === 0), 'contribution dans la file, avec le niveau de confiance de l\'auteur');
    await publish(it); eq((await rpc(null, 'get_item', { p_slug: it.slug })).status, 'published', 'publiée');
    await rpc(M, 'moderate_item', { p_item: it.id, p_status: 'hidden', p_reason: 'position trop précise' }); eq(await rpc(null, 'get_item', { p_slug: it.slug }), null, 'masquée : absente du public');
    const log = await rpc(M, 'moderation_history', {}); assert(log.some((l) => l.item_id === it.id && l.action === 'hide' && l.reason === 'position trop précise' && l.actor_id === M.id), 'journal : action, motif, auteur');
    await fails(rpc(M, 'moderate_item', { p_item: it.id, p_status: 'n-importe-quoi' }), /invalid_status/, 'statut inconnu');
  },
  '7 · XSS stockée et HTML : balises refusées dans tous les champs texte, adresse javascript: ou http refusée': async () => {
    const attempts = [{ title: '<script>alert(1)</script> titre' }, { summary: 'Résumé <img src=x onerror=alert(1)> piégé ici' }, { body: 'Texte <svg onload=alert(1)>' }, { body: '<iframe src="https://evil.example">' },
      { region: '<b>gras</b>' }, { source_url: 'javascript:alert(1)' }, { source_url: 'http://exemple.org/page' }, { source_url: 'https://exemple.org/"onmouseover="x' }, { title: 'Titre avec contrôle \u0007 caché' }];
    for (const over of attempts) await fails(rpc(A, 'save_item', { p: tip(over) }), /check constraint|violates/, 'refus de ' + JSON.stringify(over).slice(0, 60));
    await fails(rpc(B, 'save_profile', { p_pseudo: '<b>Bruno</b>' }), /check constraint/, 'pseudo avec balise');
    const ok = await rpc(A, 'save_item', { p: tip({ title: 'Signe inférieur < 3 m accepté', body: 'Hauteur < 3 m et 2 > 1 : du texte, pas du HTML.', source_url: 'https://www.service-public.fr/' }) });
    eq((await rpc(A, 'get_item', { p_slug: ok.slug })).body, 'Hauteur < 3 m et 2 > 1 : du texte, pas du HTML.', 'texte ordinaire avec < et > accepté tel quel');
  },
  '8 · coordonnées : position arrondie au centième (≈ 1 km), hors d\'Europe refusée, spot sans position refusé': async () => {
    const s = await rpc(A, 'save_item', { p: spot({ title: 'Spot précis à arrondir', lat: 45.123456, lon: 6.345678 }) }), got = await rpc(A, 'get_item', { p_slug: s.slug });
    eq([got.lat, got.lon], [45.12, 6.35], 'arrondi par la fonction');
    // Requête directe, sans la fonction : la colonne elle-même ne garde que deux décimales.
    await sql(A, `insert into public.community_items (owner_id, type, status, title, summary, lat, lon) values ($1, 'spot', 'pending', 'Spot inséré directement', 'Position trop précise envoyée sans la fonction', 45.123456, 6.300001)`, [A.id]);
    eq((await sql(A, `select lat::text, lon::text from public.community_items where title = 'Spot inséré directement'`)).rows[0], { lat: '45.12', lon: '6.30' }, 'position fine insérée directement : arrondie par la base');
    await fails(rpc(A, 'save_item', { p: spot({ lat: 10.5, lon: 6.3 }) }), /position_coarse/, 'hors d\'Europe');
    await fails(rpc(A, 'save_item', { p: spot({ lat: null, lon: null }) }), /spot_has_position/, 'spot sans position');
    await fails(rpc(A, 'save_item', { p: tip({ night_spot: true }) }), /night_only_spot/, 'nuit sur une astuce');
  },
  '9 · tailles : titre, texte, étapes, saisons, contrôles de longueur': async () => {
    await fails(rpc(A, 'save_item', { p: tip({ title: 'x'.repeat(121) }) }), /check constraint/, 'titre trop long');
    await fails(rpc(A, 'save_item', { p: tip({ body: 'x'.repeat(20001) }) }), /check constraint/, 'texte trop long');
    await fails(rpc(A, 'save_item', { p: tip({ title: 'abc' }) }), /check constraint/, 'titre trop court');
    await fails(rpc(A, 'save_item', { p: circuit({ stops: Array.from({ length: 61 }, (_, i) => ({ name: 'É' + i })) }) }), /too_many_stops/, '61 étapes');
    await fails(rpc(A, 'save_item', { p: circuit({ stops: [{ name: 'Seule' }] }) }), /circuit_needs_two_stops/, 'circuit d\'une étape');
    await fails(rpc(A, 'save_item', { p: tip({ seasons: ['ete', 'mousson'] }) }), /check constraint/, 'saison inconnue');
    await fails(rpc(A, 'save_item', { p: tip({ type: 'publicite' }) }), /check constraint/, 'type inconnu');
  },
  '10 · débit : au plus 5 contributions par heure et par compte': async () => {
    const C = await account('Charlie');
    for (let i = 0; i < 5; i++) await rpc(C, 'save_item', { p: tip({ title: 'Contribution numéro ' + (i + 1) }) });
    await fails(rpc(C, 'save_item', { p: tip({ title: 'Contribution de trop' }) }), /rate_limit/, 'sixième contribution');
  },
  '11 · signalements : un par personne, seulement sur du publié, retrait automatique à trois signalements': async () => {
    const it = await rpc(B, 'save_item', { p: tip({ title: 'Astuce qui sera signalée' }) });
    await fails(rpc(A, 'report_item', { p_item: it.id, p_reason: 'spam' }), /row-level security/, 'signalement d\'un contenu non publié');
    await publish(it);
    eq(await rpc(A, 'report_item', { p_item: it.id, p_reason: 'spam', p_details: 'publicité' }), true, 'premier signalement'); eq(await rpc(A, 'report_item', { p_item: it.id, p_reason: 'spam' }), false, 'doublon ignoré');
    await fails(rpc(A, 'report_item', { p_item: it.id, p_reason: 'je-n-aime-pas' }), /check constraint/, 'motif inconnu');
    const X = await account('Xavier'), Y = await account('Yasmine');
    await rpc(X, 'report_item', { p_item: it.id, p_reason: 'faux' }); eq((await rpc(null, 'get_item', { p_slug: it.slug })).status, 'published', 'deux signalements : encore visible');
    await rpc(Y, 'report_item', { p_item: it.id, p_reason: 'dangereux' }); eq(await rpc(null, 'get_item', { p_slug: it.slug }), null, 'trois signalements : retiré en attendant la modération');
    const q = await rpc(M, 'moderation_queue', { p_status: 'reported' }); assert(q.some((x) => x.id === it.id && x.report_count === 3), 'file des signalements');
    await fails(sql(B, `select * from public.community_reports where item_id = $1`, [it.id]).then((r) => { if (r.rows.length) throw new Error('lisible'); }), /lisible/, 'B ne lit pas qui l\'a signalé').catch(() => {});
    eq((await sql(B, `select reporter_id from public.community_reports where item_id = $1`, [it.id])).rows, [], 'l\'auteur ne voit pas les signalements des autres');
  },
  '12 · « utile » et favoris : compteur tenu par la base, pas sur sa propre contribution, pas en anonyme': async () => {
    const it = await rpc(A, 'save_item', { p: tip({ title: 'Astuce à trouver utile' }) }); await publish(it);
    await fails(rpc(A, 'set_useful', { p_item: it.id, p_on: true }), /row-level security/, 'sur sa propre contribution');
    eq(await rpc(B, 'set_useful', { p_item: it.id, p_on: true }), 1, 'B la trouve utile'); eq(await rpc(B, 'set_useful', { p_item: it.id, p_on: true }), 1, 'deux fois : compté une fois');
    await fails(rpc(null, 'set_useful', { p_item: it.id, p_on: true }), /permission denied/, 'anonyme');
    eq(await rpc(B, 'set_bookmark', { p_item: it.id, p_on: true }), true, 'favori'); eq((await rpc(B, 'my_bookmarks', {})).map((x) => x.id), [it.id], 'mes favoris');
    eq(await rpc(A, 'my_bookmarks', {}), [], 'les favoris de B ne sont pas ceux de A');
    const hidden = await rpc(A, 'save_item', { p: tip({ title: 'Brouillon non favorisable', status: 'draft' }) });
    await fails(rpc(B, 'set_bookmark', { p_item: hidden.id, p_on: true }), /row-level security/, 'favori sur le brouillon d\'un autre (IDOR)');
  },
  '13 · confiance : trois contributions validées → publication directe ; un nouveau compte qui modifie du publié repasse en attente': async () => {
    const T = await account('Thérèse'), items = [];
    for (let i = 0; i < 3; i++) { const it = await rpc(T, 'save_item', { p: tip({ title: 'Validée numéro ' + (i + 1) }) }); items.push(it); }
    await publish(items[0]);
    const firstEdit = await rpc(T, 'save_item', { p: { ...tip({ title: 'Validée numéro 1 (corrigée)', status: 'published' }), id: items[0].id } });
    eq(firstEdit.status, 'pending', 'nouveau compte : la modification d\'un contenu publié repasse en attente');
    eq(await rpc(null, 'get_item', { p_slug: items[0].slug }), null, 'et quitte l\'affichage public jusqu\'à validation');
    for (const it of items) await publish(it);
    eq((await rpc(T, 'my_profile', {})).trust_level, 1, 'compte passé en confiance');
    eq((await rpc(T, 'save_item', { p: tip({ title: 'Publiée directement' }) })).status, 'published', 'publication directe');
    const c = await rpc(A, 'save_item', { p: circuit() }); await publish(c);
    await fails(sql(A, `insert into public.community_route_stops (item_id, position, name) values ($1, 4, 'Ajout discret')`, [c.id]), /resubmit_required/, 'étape ajoutée à un circuit publié sans revalidation');
  },
  '14 · suspension : plus de contribution, contenus publiés retirés, levée par un modérateur seulement': async () => {
    const S = await account('Sam'), it = await rpc(S, 'save_item', { p: tip({ title: 'Avant la suspension de Sam' }) }); await publish(it);
    await rpc(M, 'suspend_user', { p_user: S.id, p_on: true, p_reason: 'spam' });
    await fails(rpc(S, 'save_item', { p: tip({ title: 'Après la suspension de Sam' }) }), /suspended/, 'contribution d\'un compte suspendu');
    eq(await rpc(null, 'get_item', { p_slug: it.slug }), null, 'contenu retiré du public'); eq((await rpc(S, 'my_profile', {})).suspended, true, 'le compte voit sa suspension');
    await fails(rpc(S, 'suspend_user', { p_user: S.id, p_on: false }), /moderator_only/, 'auto-levée');
  },
  '15 · RGPD : export de ses seules données, suppression du compte et de ses contenus, signalements anonymisés': async () => {
    const R = await account('Rita'), it = await rpc(R, 'save_item', { p: circuit({ title: 'Circuit de Rita à supprimer' }) }), other = await rpc(B, 'save_item', { p: tip({ title: 'Astuce que Rita signale' }) }); await publish(other);
    await rpc(R, 'report_item', { p_item: other.id, p_reason: 'faux' });
    const data = await rpc(R, 'export_my_data', {});
    eq([data.account.email, data.profile.pseudo, data.items.length, data.items[0].stops.length, data.reports.length], [R.email, R.pseudo, 1, 3, 1], 'export complet');
    assert(!JSON.stringify(data).includes(A.email) && !JSON.stringify(data).includes(B.email), 'aucune donnée d\'un autre compte');
    eq(await rpc(R, 'delete_my_account', {}), true, 'suppression');
    eq((await D.admin((tx) => tx.query(`select (select count(*) from auth.users where id = $1)::int u, (select count(*) from public.profiles where id = $1)::int p, (select count(*) from public.community_items where id = $2)::int i,
      (select count(*) from public.community_route_stops where item_id = $2)::int s, (select count(*) from public.community_reports where item_id = $3 and reporter_id is null)::int r`, [R.id, it.id, other.id]))).rows[0], { u: 0, p: 0, i: 0, s: 0, r: 1 }, 'compte, profil, contributions et étapes supprimés ; signalement anonymisé');
    await fails(rpc(null, 'delete_my_account', {}), /permission denied/, 'suppression en anonyme');
  },
  '16 · surface anonyme : aucune écriture possible, aucune fonction de compte ni de modération ; le blog n\'est pas dans la base': async () => {
    const it = (await rpc(null, 'list_items', {})).items[0];
    await fails(rpc(null, 'save_item', { p: tip() }), /permission denied/, 'création'); await fails(rpc(null, 'set_bookmark', { p_item: it.id, p_on: true }), /permission denied/, 'favori');
    await fails(rpc(null, 'report_item', { p_item: it.id, p_reason: 'spam' }), /permission denied/, 'signalement'); await fails(rpc(null, 'export_my_data', {}), /permission denied/, 'export');
    await fails(sql(null, `insert into public.profiles (id, pseudo) values (gen_random_uuid(), 'Fantôme')`), /permission denied/, 'profil');
    await fails(sql(null, `update public.community_items set title = 'x'`), /permission denied/, 'modification');
    await fails(sql(null, `select public.community_items_guard()`), /permission denied|trigger/, 'fonction de déclencheur');
    // Le blog du propriétaire n'est pas dans cette base : aucune table ni fonction ne porte sur les voyages, articles, guides ou réglages du site.
    eq((await D.admin((tx) => tx.query(`select (select count(*) from information_schema.tables where table_schema = 'public' and table_name ~ '(voyage|article|guide|site|blog|content)')::int t,
      (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname ~ '(voyage|article|guide|blog|content)')::int f`))).rows[0], { t: 0, f: 0 }, 'aucune prise sur le blog');
  },
  '17 · recherche et filtres : texte, type, pays, saison, tri « utile », distance, pagination bornée, motifs SQL neutralisés': async () => {
    const U = await account('Ulysse'), items = [];
    for (const [i, p] of [spot({ title: 'Aire au bord du Douro', country: 'Portugal', lat: 41.1, lon: -8.6, seasons: ['ete'] }), spot({ title: 'Parking de la plage Nazaré', country: 'Portugal', lat: 39.6, lon: -9.07 }), circuit({ title: 'Route des vins du Douro', country: 'Portugal', lat: 41.16, lon: -7.79 })].entries()) {
      const it = await rpc(U, 'save_item', { p }); await publish(it); items.push(it);
    }
    eq((await rpc(null, 'list_items', { q: 'douro' })).items.map((i) => i.title).sort(), ['Aire au bord du Douro', 'Route des vins du Douro'], 'texte');
    eq((await rpc(null, 'list_items', { q: 'douro', p_type: 'spot' })).total, 1, 'type'); eq((await rpc(null, 'list_items', { p_country: 'Portugal', p_season: 'ete' })).total, 1, 'pays et saison');
    eq((await rpc(null, 'list_items', { p_country: 'Portugal', p_sort: 'distance', p_near_lat: 39.7, p_near_lon: -9 })).items[0].title, 'Parking de la plage Nazaré', 'tri par distance');
    eq((await rpc(null, 'list_items', { q: '%' })).total, (await rpc(null, 'list_items', {})).total, 'joker « % » sans effet');
    eq((await rpc(null, 'list_items', { p_limit: 5000 })).items.length <= 50, true, 'au plus 50 par page');
    eq((await rpc(null, 'list_items', { q: "'; drop table public.profiles; --" })).total, 0, 'injection : simple texte'); eq((await sql(null, 'select count(*)::int c from public.profiles')).rows[0].c > 0, true, 'table intacte');
  }
};

for (const [title, fn] of Object.entries(TESTS)) {
  const t0 = Date.now(); let status = 'PASS', detail = '';
  try { await fresh(); await fn(); } catch (e) { status = 'FAIL'; detail = String(e.message).split('\n')[0].slice(0, 600); }
  results.push({ title, status, detail, ms: Date.now() - t0 });
  console.log(`${status}  ${title}${detail ? '\n        ' + detail : ''}`);
}
await D.close();
const pass = results.filter((r) => r.status === 'PASS').length;
writeJson(out, { generatedAt: new Date().toISOString(), engine: 'PGlite (PostgreSQL WebAssembly)', totals: { tests: results.length, pass, fail: results.length - pass }, results });
console.log(`\ncommunauté (base) : ${pass}/${results.length} PASS → ${path.relative(ROOT, out)}`);
process.exitCode = pass === results.length ? 0 : 1;
