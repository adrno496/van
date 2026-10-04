// Espace communautaire « Partage » : pages statiques du site. Les contributions viennent du serveur communautaire
// (Supabase ou compatible), lues par le navigateur ; ces pages n'en contiennent aucune et restent lisibles quand le serveur
// est absent, injoignable ou pas encore configuré.
//
// Sécurité : seules ces pages reçoivent une politique de sécurité qui autorise une connexion, et seulement vers le serveur
// communautaire déclaré dans content/site.json (« community.url »). Le reste du site garde connect-src 'none'.
// Aucun secret ici : la clé publique « anon » est faite pour être publiée ; les droits sont contrôlés par la base (RLS).

export const TYPES = [
  ['circuit', 'Circuit', 'Un itinéraire parcouru, étape par étape, avec distance, durée, saison et difficultés.'],
  ['spot', 'Spot', 'Un lieu utile : aire, parking, point d’eau, vue… Position approximative, date de dernière vérification.'],
  ['astuce', 'Astuce', 'Un conseil pratique de la route, court et vérifiable.'],
  ['technique', 'Technique', 'Aménagement, énergie, mécanique : une solution expliquée.'],
  ['retour', 'Retour d’expérience', 'Un récit de voyage, ce qui a marché et ce qui n’a pas marché.']
];
export const CATEGORIES = [['itineraire', 'Itinéraire'], ['bivouac', 'Bivouac'], ['aire', 'Aire de services'], ['camping', 'Camping'], ['eau-vidange', 'Eau et vidange'], ['point-de-vue', 'Point de vue'],
  ['nature', 'Nature'], ['patrimoine', 'Patrimoine'], ['ville', 'Ville'], ['cuisine', 'Cuisine'], ['energie', 'Énergie'], ['mecanique', 'Mécanique'], ['amenagement', 'Aménagement'],
  ['administratif', 'Administratif'], ['budget', 'Budget'], ['securite', 'Sécurité'], ['autre', 'Autre']];
export const SEASONS = [['printemps', 'Printemps'], ['ete', 'Été'], ['automne', 'Automne'], ['hiver', 'Hiver']];
export const DIFFICULTIES = [['facile', 'Facile'], ['moyen', 'Moyen'], ['difficile', 'Difficile']];
export const SPOT_KINDS = [['bivouac', 'Bivouac'], ['aire', 'Aire de services'], ['camping', 'Camping'], ['parking', 'Parking'], ['point-de-vue', 'Point de vue'], ['eau', 'Point d’eau'], ['vidange', 'Vidange'], ['autre', 'Autre']];
export const REASONS = [['spam', 'Publicité ou spam'], ['dangereux', 'Conseil dangereux'], ['illegal', 'Illégal (stationnement interdit, propriété privée…)'], ['vie-privee', 'Atteinte à la vie privée'], ['faux', 'Information fausse ou périmée'], ['offensant', 'Propos offensant'], ['autre', 'Autre']];
export const DISCLAIMER = 'Contribution de la communauté — à vérifier selon votre situation et la réglementation locale.';

// Politique propre aux pages de Partage : la seule origine autorisée est celle du serveur communautaire.
export function partageCsp(url) {
  const origin = new URL(url).origin;
  if (!/^https?:\/\/[a-z0-9.-]+(:\d+)?$/i.test(origin)) throw new Error('adresse du serveur communautaire invalide');
  return `default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data: blob: ${origin}; font-src 'none'; connect-src ${origin}; object-src 'none'; base-uri 'none'; form-action 'none'`;
}

export function partagePages(ctx, h) {
  const { esc, eyebrow, emptyState, plannerBand, more, ICON } = h;
  const community = ctx.content.site.community, open = !!community;
  const opts = (list, first) => (first ? `<option value="">${esc(first)}</option>` : '') + list.map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join('');
  const countries = ctx.d.countries.map((c) => c.name).sort((a, b) => a.localeCompare(b, 'fr'));
  // Configuration lue par le script : un bloc de données (jamais exécuté), échappé pour le HTML.
  const config = (to) => `<script type="application/json" id="partage-config">${JSON.stringify({ url: community.url, anonKey: community.anonKey, app: to('app/index.html'), root: to('index.html').replace(/index\.html$/, ''),
    countries }).replace(/</g, '\\u003c')}</script>`;
  const page = (p) => ({ ...p, path: `partage/${p.slug ? p.slug + '/' : ''}index.html`, crumbs: [['partage/index.html', 'Partage'], ...(p.slug ? [[`partage/${p.slug}/index.html`, p.title]] : [])],
    ...(open && p.app ? { csp: partageCsp(community.url), scripts: ['assets/partage.js'], bodyClass: 'is-partage', data: p.app } : { bodyClass: 'is-partage' }),
    body: (to) => (open && p.app ? config(to) : '') + p.body(to) });
  const closed = (to) => `<section class="section section-tight"><div class="wrap">${emptyState('L’espace Partage n’est pas encore ouvert', 'Il accueillera les circuits, spots, astuces et retours d’expérience de la communauté. Le blog, l’Atlas et le Planner fonctionnent sans lui.', `<p>${more(to('partage/regles/index.html'), 'Lire les règles prévues')}</p>`)}</div></section>`;
  const offline = '<div class="notice notice-warn" data-partage-offline hidden role="status"><p><strong>Le serveur de Partage ne répond pas.</strong> Le blog, l’Atlas et le Planner fonctionnent normalement. <button class="btn btn-small" type="button" data-partage-retry>Réessayer</button></p></div>';
  const noscript = '<noscript><div class="notice"><p>L’espace Partage a besoin de JavaScript pour charger les contributions. Le reste du site se lit sans.</p></div></noscript>';
  const pages = [];

  pages.push(page({ slug: '', title: 'Partage', app: 'index', noindex: !open,
    description: 'Partage : circuits, spots, astuces, techniques et retours d’expérience proposés par la communauté des voyageurs en van. Lecture libre, sans compte.',
    body: (to) => `<header class="page-head wrap">${eyebrow('Communauté')}<h1 class="page-title">Partage</h1>
<p class="page-lead">Circuits, spots, astuces, techniques et retours d’expérience proposés par d’autres voyageurs. Un espace séparé du blog : ce qui s’y trouve n’est pas écrit par l’auteur du site.</p>
${open ? `<div class="head-actions"><a class="btn btn-primary" href="${esc(to('partage/proposer/index.html'))}">Partager une expérience</a><a class="btn btn-ghost" href="${esc(to('partage/compte/index.html'))}" data-partage-account>Mon compte</a></div>` : ''}</header>
${open ? `<section class="section section-tight"><div class="wrap">${offline}${noscript}
<form class="partage-search" id="partage-search" role="search" aria-label="Chercher dans Partage" novalidate>
  <div class="field field-wide"><label for="ps-q">Chercher</label><div class="search-field">${ICON.search}<input id="ps-q" name="q" type="search" maxlength="80" autocomplete="off" placeholder="Par exemple : Douro, bivouac, panneaux solaires"></div></div>
  <div class="field"><label for="ps-type">Type</label><select id="ps-type" name="type">${opts(TYPES.map(([v, l]) => [v, l]), 'Tous les types')}</select></div>
  <div class="field"><label for="ps-country">Pays</label><select id="ps-country" name="country">${opts(countries.map((c) => [c, c]), 'Tous les pays')}</select></div>
  <details class="field-more"><summary>Plus de filtres</summary><div class="field-grid">
    <div class="field"><label for="ps-region">Région</label><input id="ps-region" name="region" type="text" maxlength="80" autocomplete="off"></div>
    <div class="field"><label for="ps-season">Saison</label><select id="ps-season" name="season">${opts(SEASONS, 'Toutes')}</select></div>
    <div class="field"><label for="ps-category">Catégorie</label><select id="ps-category" name="category">${opts(CATEGORIES, 'Toutes')}</select></div>
    <div class="field"><label for="ps-difficulty">Difficulté</label><select id="ps-difficulty" name="difficulty">${opts(DIFFICULTIES, 'Toutes')}</select></div>
  </div></details>
  <div class="field"><label for="ps-sort">Ordre</label><select id="ps-sort" name="sort"><option value="recent">Les plus récents</option><option value="useful">Les plus utiles</option><option value="distance">Les plus proches de moi</option></select></div>
  <div class="field field-submit"><button class="btn btn-primary" type="submit">Chercher</button></div>
</form>
<p class="search-status" id="partage-status" role="status" aria-live="polite">Chargement des contributions…</p>
<p class="note" id="partage-near-note" hidden>Pour trier par distance, votre position approximative (au dixième de degré, environ 10 km) est envoyée au serveur pour ce calcul, sans être enregistrée.</p>
<div class="grid grid-3 partage-list" id="partage-results"></div>
<p class="more-row"><button class="btn btn-ghost" type="button" id="partage-more" hidden>Voir plus</button></p>
</div></section>` : closed(to)}
<section class="section section-quiet"><div class="wrap"><h2 class="section-title">Ce qu’on y partage</h2><ul class="type-list">${TYPES.map(([v, l, d]) => `<li><span class="badge badge-community">${esc(l)}</span><p>${esc(d)}</p></li>`).join('')}</ul>
<p class="caveat">${esc(DISCLAIMER)} Les positions des spots sont approximatives (environ 1 km) et chaque spot indique quand il a été vérifié pour la dernière fois.</p>
<p>${more(to('partage/regles/index.html'), 'Les règles de Partage')}</p></div></section>
${plannerBand(to, { title: 'Préparer votre voyage', text: 'Un circuit ou un spot de Partage s’ajoute à votre Planner en un geste : une copie, sur votre appareil, que vous modifiez librement.' })}` }));

  pages.push(page({ slug: 'contribution', title: 'Contribution', app: 'item', noindex: true,
    description: 'Une contribution de la communauté Partage : circuit, spot, astuce, technique ou retour d’expérience.',
    body: (to) => `${open ? `<div class="wrap">${offline}${noscript}</div>
<article class="partage-item wrap" id="partage-item" aria-busy="true"><header class="page-head"><p class="eyebrow">Communauté</p><h1 class="page-title" id="pi-title">Contribution</h1><p class="search-status" id="pi-status" role="status">Chargement…</p></header></article>
<dialog class="sheet" id="pi-report" aria-labelledby="pi-report-title"><form method="dialog" class="sheet-body" id="pi-report-form"><h2 class="sheet-title" id="pi-report-title">Signaler cette contribution</h2>
<p>Le signalement est lu par un modérateur. Trois signalements retirent la contribution de l’affichage en attendant.</p>
<div class="field"><label for="pi-reason">Motif</label><select id="pi-reason" required>${opts(REASONS)}</select></div>
<div class="field"><label for="pi-details">Précisions (facultatif)</label><textarea id="pi-details" maxlength="500" rows="3"></textarea></div>
<div class="sheet-actions"><button class="btn btn-ghost" value="cancel" type="submit" formnovalidate>Annuler</button><button class="btn btn-primary" value="send" type="submit" id="pi-report-send">Envoyer le signalement</button></div></form></dialog>` : `<header class="page-head wrap">${eyebrow('Communauté')}<h1 class="page-title">Contribution</h1></header>${closed(to)}`}` }));

  pages.push(page({ slug: 'proposer', title: 'Partager une expérience', app: 'proposer', noindex: true,
    description: 'Proposer un circuit, un spot, une astuce, une technique ou un retour d’expérience à la communauté Partage.',
    body: (to) => `<header class="page-head wrap">${eyebrow('Partage')}<h1 class="page-title">Partager une expérience</h1>
<p class="page-lead">Votre contribution sera signée de votre pseudo. Celles des nouveaux comptes sont relues avant publication.</p></header>
${open ? `<section class="section section-tight"><div class="wrap narrow-form">${offline}${noscript}
<div id="pp-login" class="notice" hidden><p>Pour publier, connectez-vous ou créez un compte (pseudo, adresse e-mail jamais affichée). <a class="btn btn-small" href="${esc(to('partage/compte/index.html'))}">Se connecter</a></p></div>
<div id="pp-from-planner" class="notice" hidden role="status"></div>
<form id="pp-form" class="partage-form" novalidate>
<fieldset class="field-group"><legend>Type de contribution</legend><div class="choice-list">${TYPES.map(([v, l, d], i) => `<label class="choice"><input type="radio" name="type" value="${esc(v)}"${i === 0 ? ' checked' : ''}><span><strong>${esc(l)}</strong><small>${esc(d)}</small></span></label>`).join('')}</div></fieldset>
<fieldset class="field-group"><legend>L’essentiel</legend>
  <div class="field"><label for="pp-title">Titre <small>5 à 120 caractères</small></label><input id="pp-title" name="title" type="text" minlength="5" maxlength="120" required></div>
  <div class="field"><label for="pp-summary">Résumé <small>10 à 400 caractères, affiché dans les listes</small></label><textarea id="pp-summary" name="summary" minlength="10" maxlength="400" rows="3" required></textarea></div>
  <div class="field"><label for="pp-body">Texte <small>facultatif, 20 000 caractères au plus, sans HTML</small></label><textarea id="pp-body" name="body" maxlength="20000" rows="8"></textarea></div>
  <div class="field-grid">
    <div class="field"><label for="pp-country">Pays</label><select id="pp-country" name="country">${opts(countries.map((c) => [c, c]), '—')}</select></div>
    <div class="field"><label for="pp-region">Région</label><input id="pp-region" name="region" type="text" maxlength="80"></div>
    <div class="field"><label for="pp-category">Catégorie</label><select id="pp-category" name="category">${opts(CATEGORIES, '—')}</select></div>
    <div class="field"><label for="pp-difficulty">Difficulté</label><select id="pp-difficulty" name="difficulty">${opts(DIFFICULTIES, '—')}</select></div>
  </div>
  <fieldset class="field"><legend>Saisons</legend><div class="chips">${SEASONS.map(([v, l]) => `<label class="chip"><input type="checkbox" name="seasons" value="${esc(v)}"><span>${esc(l)}</span></label>`).join('')}</div></fieldset>
  <div class="field"><label for="pp-source">Lien vers une source <small>facultatif, https seulement</small></label><input id="pp-source" name="source_url" type="url" maxlength="300" placeholder="https://"></div>
</fieldset>
<fieldset class="field-group" data-for="circuit"><legend>Le circuit</legend>
  <div class="field-grid">
    <div class="field"><label for="pp-km">Distance (km)</label><input id="pp-km" name="distance_km" type="number" min="0" max="20000" inputmode="numeric"></div>
    <div class="field"><label for="pp-done">Durée effectuée (jours)</label><input id="pp-done" name="days_done" type="number" min="1" max="365" inputmode="numeric"></div>
    <div class="field"><label for="pp-suggested">Durée conseillée (jours)</label><input id="pp-suggested" name="days_suggested" type="number" min="1" max="365" inputmode="numeric"></div>
    <div class="field"><label for="pp-vehicle">Véhicule</label><input id="pp-vehicle" name="vehicle" type="text" maxlength="120" placeholder="Fourgon 6 m, 3,5 t"></div>
  </div>
  <div class="field"><label for="pp-hard">Difficultés rencontrées</label><textarea id="pp-hard" name="hard_parts" maxlength="2000" rows="3"></textarea></div>
  <div class="field"><label for="pp-avoid">Routes déconseillées</label><textarea id="pp-avoid" name="roads_avoid" maxlength="2000" rows="3"></textarea></div>
  <h3 class="field-title">Étapes <small>2 à 60, dans l’ordre</small></h3>
  <ol class="stop-editor" id="pp-stops"></ol>
  <div class="row-actions"><button class="btn btn-ghost btn-small" type="button" id="pp-add-stop">Ajouter une étape</button></div>
  <p class="note">Position d’une étape : facultative, arrondie à environ 1 km à l’envoi. N’indiquez pas l’endroit exact où vous dormez si vous ne voulez pas le rendre public.</p>
</fieldset>
<fieldset class="field-group" data-for="spot"><legend>Le spot</legend>
  <div class="field-grid">
    <div class="field"><label for="pp-kind">Genre de lieu</label><select id="pp-kind" name="spot_kind">${opts(SPOT_KINDS, '—')}</select></div>
    <div class="field"><label for="pp-lat">Latitude <small>ex. 43,12</small></label><input id="pp-lat" name="lat" type="text" inputmode="decimal" maxlength="12"></div>
    <div class="field"><label for="pp-lon">Longitude <small>ex. -1,98</small></label><input id="pp-lon" name="lon" type="text" inputmode="decimal" maxlength="12"></div>
    <div class="field"><label for="pp-verified">Dernière vérification sur place</label><input id="pp-verified" name="last_verified" type="date"></div>
  </div>
  <label class="check-row"><input type="checkbox" name="night_spot" id="pp-night"><span>Lieu où dormir (nuit en van)</span></label>
  <p class="caveat">La position est arrondie au centième de degré (environ 1 km) avant l’envoi. Un spot de nuit attire du monde : ne partagez pas un lieu fragile, privé ou toléré seulement à condition de rester discret.</p>
</fieldset>
<fieldset class="field-group"><legend>Photos <small>facultatives, 4 au plus</small></legend>
  <div class="field"><label for="pp-photos">Ajouter des photos <small>JPEG, PNG ou WebP. Elles sont réduites (1 600 px) et réenregistrées sur votre appareil avant l’envoi, ce qui retire leurs métadonnées (position GPS, appareil, date).</small></label>
  <input id="pp-photos" type="file" accept="image/jpeg,image/png,image/webp" multiple></div>
  <ul class="photo-list" id="pp-photo-list"></ul>
  <p class="note">Vos propres photos seulement ; pas de visage reconnaissable ni de plaque lisible. Décrivez chaque photo pour les personnes qui ne la voient pas.</p>
</fieldset>
<div class="form-actions"><button class="btn btn-ghost" type="button" id="pp-draft">Enregistrer en brouillon</button><button class="btn btn-primary" type="submit" id="pp-preview">Vérifier avant d’envoyer</button></div>
<p class="search-status" id="pp-status" role="status" aria-live="polite"></p>
</form>
<dialog class="sheet sheet-wide" id="pp-confirm" aria-labelledby="pp-confirm-title"><div class="sheet-body"><h2 class="sheet-title" id="pp-confirm-title">Ce qui sera envoyé</h2>
<p>Relisez : c’est exactement ce que la communauté verra, signé de votre pseudo. Rien d’autre n’est envoyé (ni vos notes, ni vos favoris, ni le reste de votre Planner).</p>
<div id="pp-preview-body" class="preview-box"></div>
<div class="sheet-actions"><button class="btn btn-ghost" type="button" id="pp-cancel">Modifier</button><button class="btn btn-primary" type="button" id="pp-send">Envoyer</button></div></div></dialog>
</div></section>` : closed(to)}` }));

  pages.push(page({ slug: 'compte', title: 'Mon compte', app: 'compte', noindex: true,
    description: 'Compte Partage : connexion, profil, contributions, favoris, export et suppression de vos données.',
    body: (to) => `<header class="page-head wrap">${eyebrow('Partage')}<h1 class="page-title">Mon compte</h1><p class="page-lead">Un compte sert seulement à publier dans Partage, à garder des favoris et à signaler. Lire ne demande rien.</p></header>
${open ? `<section class="section section-tight"><div class="wrap narrow-form">${offline}${noscript}
<div id="pc-out" hidden>
  <form id="pc-login" class="partage-form" novalidate><h2 class="section-title">Se connecter</h2>
    <div class="field"><label for="pc-email">Adresse e-mail</label><input id="pc-email" type="email" autocomplete="email" maxlength="254" required></div>
    <div class="field"><label for="pc-password">Mot de passe <small>10 caractères au moins</small></label><input id="pc-password" type="password" autocomplete="current-password" minlength="10" maxlength="128" required></div>
    <div class="form-actions"><button class="btn btn-ghost" type="button" id="pc-signup">Créer un compte</button><button class="btn btn-primary" type="submit">Se connecter</button></div>
    <p class="note">L’adresse e-mail sert à vous connecter ; elle n’est jamais affichée. Vous choisirez ensuite un pseudo public.</p>
  </form>
</div>
<div id="pc-in" hidden>
  <form id="pc-profile" class="partage-form" novalidate><h2 class="section-title">Profil public</h2>
    <div class="field"><label for="pc-pseudo">Pseudo <small>3 à 30 caractères, visible de tous</small></label><input id="pc-pseudo" type="text" minlength="3" maxlength="30" required autocomplete="nickname"></div>
    <div class="field"><label for="pc-bio">Présentation <small>facultative, 300 caractères</small></label><textarea id="pc-bio" maxlength="300" rows="3"></textarea></div>
    <div class="form-actions"><button class="btn btn-primary" type="submit">Enregistrer le profil</button></div>
    <p class="note" id="pc-since"></p>
  </form>
  <section class="account-block"><h2 class="section-title">Mes contributions</h2><div id="pc-items" class="stack"></div></section>
  <section class="account-block"><h2 class="section-title">Mes favoris</h2><div id="pc-bookmarks" class="stack"></div></section>
  <section class="account-block"><h2 class="section-title">Mes données</h2>
    <p>Télécharger tout ce que Partage garde sur vous (compte, profil, contributions, favoris, signalements), ou supprimer votre compte et vos contributions.</p>
    <div class="form-actions"><button class="btn btn-ghost" type="button" id="pc-export">Télécharger mes données</button><button class="btn btn-ghost" type="button" id="pc-logout">Se déconnecter</button><button class="btn btn-danger" type="button" id="pc-delete">Supprimer mon compte</button></div>
    <p class="note" id="pc-moderator" hidden><a href="${esc(to('partage/moderation/index.html'))}">Ouvrir la modération</a></p>
  </section>
</div>
<p class="search-status" id="pc-status" role="status" aria-live="polite"></p>
<dialog class="sheet" id="pc-delete-confirm" aria-labelledby="pc-delete-title"><form method="dialog" class="sheet-body"><h2 class="sheet-title" id="pc-delete-title">Supprimer le compte ?</h2>
<p>Votre compte, votre profil, vos contributions, leurs étapes et vos favoris seront supprimés. Vos signalements restent, sans votre nom. C’est définitif.</p>
<div class="field"><label for="pc-delete-pseudo">Recopiez votre pseudo pour confirmer</label><input id="pc-delete-pseudo" type="text" autocomplete="off"></div>
<div class="sheet-actions"><button class="btn btn-ghost" value="cancel" type="submit" formnovalidate>Annuler</button><button class="btn btn-danger" value="delete" type="submit" id="pc-delete-go">Supprimer définitivement</button></div></form></dialog>
</div></section>` : closed(to)}` }));

  pages.push(page({ slug: 'auteur', title: 'Auteur', app: 'auteur', noindex: true,
    description: 'Profil public d’un auteur de Partage et ses contributions publiées.',
    body: (to) => `${open ? `<div class="wrap">${offline}${noscript}</div><section class="wrap" id="pa-profile" aria-busy="true"><header class="page-head"><p class="eyebrow">Communauté</p><h1 class="page-title" id="pa-title">Auteur</h1><p class="search-status" id="pa-status" role="status">Chargement…</p></header><div class="grid grid-3" id="pa-items"></div></section>` : `<header class="page-head wrap">${eyebrow('Communauté')}<h1 class="page-title">Auteur</h1></header>${closed(to)}`}` }));

  pages.push(page({ slug: 'moderation', title: 'Modération', app: 'moderation', noindex: true,
    description: 'Outil de modération de Partage, réservé aux comptes de modération.',
    body: (to) => `<header class="page-head wrap">${eyebrow('Partage')}<h1 class="page-title">Modération</h1><p class="page-lead">Réservé aux comptes de modération : le serveur vérifie le rôle à chaque action, cette page n’en donne aucun.</p></header>
${open ? `<section class="section section-tight"><div class="wrap">${offline}${noscript}
<div class="tabs-row" role="group" aria-label="File"><button class="btn btn-small" type="button" data-queue="pending" aria-pressed="true">En attente</button><button class="btn btn-small" type="button" data-queue="reported" aria-pressed="false">Signalées</button><button class="btn btn-small" type="button" data-queue="hidden" aria-pressed="false">Masquées</button><button class="btn btn-small" type="button" data-queue="published" aria-pressed="false">Publiées</button></div>
<p class="search-status" id="pm-status" role="status" aria-live="polite"></p><div id="pm-queue" class="stack"></div>
<h2 class="section-title">Journal</h2><ol id="pm-log" class="log-list"></ol></div></section>` : closed(to)}` }));

  pages.push(page({ slug: 'regles', title: 'Règles de Partage', noindex: false,
    description: 'Les règles de l’espace communautaire Partage : ce qu’on peut publier, modération, signalements, données personnelles et suppression du compte.',
    body: (to) => `<header class="page-head wrap">${eyebrow('Partage')}<h1 class="page-title">Règles de Partage</h1><p class="page-lead">Ce qu’on peut y publier, comment c’est modéré, ce que deviennent vos données.</p></header>
<section class="section section-tight"><div class="wrap prose">
<p class="caveat">Projet de texte, sans valeur de validation juridique : à relire par une personne compétente avant l’ouverture de Partage (HUMAN_REVIEW_REQUIRED).</p>
<h2>Ce qu’on partage</h2>
<ul><li>Ce que vous avez vécu ou vérifié vous-même : circuits parcourus, spots visités, astuces et techniques éprouvées.</li><li>Des informations utiles à d’autres voyageurs, datées : un spot indique sa dernière vérification.</li><li>Vos propres photographies, sans visage reconnaissable ni plaque d’immatriculation lisible.</li></ul>
<h2>Ce qu’on ne partage pas</h2>
<ul><li>Un lieu privé, interdit, ou toléré seulement à condition de rester discret ; un lieu naturel fragile.</li><li>La position exacte d’une personne ou d’un véhicule, une adresse privée, des informations sur quelqu’un d’autre.</li><li>Publicité, liens d’affiliation, contenu copié sans droit, propos offensants.</li><li>Conseils dangereux (gaz, électricité, mécanique) présentés comme sûrs.</li></ul>
<h2>Modération</h2>
<p>Les contributions d’un nouveau compte sont relues avant publication ; après trois contributions validées, elles paraissent directement. Chacun peut signaler une contribution ; trois signalements la retirent de l’affichage en attendant un modérateur. Un modérateur peut masquer ou refuser une contribution et suspendre un compte ; chaque décision est consignée dans un journal.</p>
<h2>Responsabilité</h2>
<p>${esc(DISCLAIMER)} Les contributions n’engagent que leurs auteurs. Le blog et les guides de l’auteur du site sont des contenus distincts, qu’aucun compte de Partage ne peut modifier.</p>
<h2>Données personnelles</h2>
<ul><li>Données gardées : adresse e-mail (connexion seulement, jamais affichée), pseudo, présentation facultative, date d’inscription, contributions, favoris, « utile » et signalements.</li>
<li>Aucune mesure d’audience, aucun traceur publicitaire. Lire Partage ne demande ni compte ni cookie.</li>
<li>Votre position n’est envoyée que si vous demandez un tri « les plus proches », arrondie à environ 10 km, et elle n’est pas enregistrée.</li>
<li>Depuis « Mon compte » : télécharger toutes vos données, les corriger, supprimer votre compte et vos contributions.</li>
<li>Durée de conservation : tant que le compte existe ; les signalements que vous avez faits restent, anonymisés, pour l’historique de modération. Le journal de modération est gardé un an (à confirmer).</li>
<li>Hébergement des données : à préciser selon le prestataire retenu (HUMAN_REVIEW_REQUIRED).</li></ul>
<h2>Contact</h2><p>Pour une demande concernant vos données ou un contenu : à préciser avant l’ouverture (HUMAN_REVIEW_REQUIRED).</p>
</div></section>
${plannerBand(to, { title: 'Le Planner, sans compte', text: 'Préparer un voyage ne demande aucune inscription : tout reste sur votre appareil.' })}` }));
  return pages;
}
