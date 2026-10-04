/* Partage : lecture et publication des contributions de la communauté, chargé seulement par les pages de Partage.
   Règles tenues ici :
   - tout texte venu du serveur est écrit avec textContent (jamais innerHTML) ; un lien externe n'est créé que s'il est en https ;
   - chaque requête a un délai (8 s) et n'est jamais relancée automatiquement, sauf une fois après un jeton expiré ;
   - le site reste utilisable quand le serveur ne répond pas (bandeau, bouton « Réessayer ») ;
   - aucun droit n'est décidé ici : le serveur (RLS) contrôle tout ; masquer un bouton n'est qu'une commodité.
   La session (jetons de l'utilisateur) est gardée dans localStorage ; aucune clé secrète n'existe côté navigateur. */
(function () {
  'use strict';
  var doc = document, page = doc.body.getAttribute('data-partage'), cfgEl = doc.getElementById('partage-config');
  if (!page || !cfgEl) return;
  var cfg;
  try { cfg = JSON.parse(cfgEl.textContent); } catch (e) { return; }
  var API = String(cfg.url || '').replace(/\/+$/, ''), KEY = String(cfg.anonKey || ''), APP = String(cfg.app || '../../app/index.html');
  if (!/^https?:\/\//.test(API) || !KEY) return;
  var SESSION_KEY = 'atlasvan.partage.session', RETURN_KEY = 'atlasvan.partage.return', TIMEOUT = 8000;
  var TYPES = { circuit: 'Circuit', spot: 'Spot', astuce: 'Astuce', technique: 'Technique', retour: 'Retour d’expérience' };
  var STATUS = { draft: 'Brouillon', pending: 'En attente de validation', published: 'Publiée', hidden: 'Masquée par la modération', rejected: 'Refusée par la modération' };
  var SEASONS = { printemps: 'printemps', ete: 'été', automne: 'automne', hiver: 'hiver' };
  var DIFF = { facile: 'Facile', moyen: 'Moyen', difficile: 'Difficile' };
  var KINDS = { bivouac: 'Bivouac', aire: 'Aire de services', camping: 'Camping', parking: 'Parking', 'point-de-vue': 'Point de vue', eau: 'Point d’eau', vidange: 'Vidange', autre: 'Autre' };
  var CATS = { itineraire: 'Itinéraire', bivouac: 'Bivouac', aire: 'Aire de services', camping: 'Camping', 'eau-vidange': 'Eau et vidange', 'point-de-vue': 'Point de vue', nature: 'Nature', patrimoine: 'Patrimoine',
    ville: 'Ville', cuisine: 'Cuisine', energie: 'Énergie', mecanique: 'Mécanique', amenagement: 'Aménagement', administratif: 'Administratif', budget: 'Budget', securite: 'Sécurité', autre: 'Autre' };
  var DISCLAIMER = 'Contribution de la communauté — à vérifier selon votre situation et la réglementation locale.';
  var MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

  /* ── Outils ── */
  var $ = function (id) { return doc.getElementById(id); };
  // Élément construit sans HTML : les textes passent par des nœuds texte.
  function el(tag, props, children) {
    var n = doc.createElement(tag);
    if (props) Object.keys(props).forEach(function (k) {
      var v = props[k];
      if (v == null || v === false) return;
      if (k === 'text') n.textContent = String(v);
      else if (k === 'className') n.className = v;
      else n.setAttribute(k, v === true ? '' : String(v));
    });
    (children || []).forEach(function (c) { if (c != null && c !== false) n.appendChild(typeof c === 'string' ? doc.createTextNode(c) : c); });
    return n;
  }
  var clear = function (n) { while (n && n.firstChild) n.removeChild(n.firstChild); };
  var store = {
    get: function (k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } },
    set: function (k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* stockage indisponible : session limitée à la page */ } }
  };
  function dateLabel(iso) {
    var d = new Date(iso); if (isNaN(d)) return '';
    return (d.getDate() === 1 ? '1er' : d.getDate()) + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear();
  }
  var num = function (v) { return String(v).replace('.', ','); };
  var safeHttps = function (u) { try { var x = new URL(u); return x.protocol === 'https:' ? x.href : ''; } catch (e) { return ''; } };
  var SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/, UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  var param = function (k) { try { return new URLSearchParams(location.search).get(k); } catch (e) { return null; } };
  function b64url(obj) {
    var bytes = new TextEncoder().encode(JSON.stringify(obj)), bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function fromB64url(s) {
    var bin = atob(String(s).replace(/-/g, '+').replace(/_/g, '/')), bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return JSON.parse(new TextDecoder().decode(bytes));
  }
  function say(node, text, error) { if (!node) return; node.textContent = text || ''; node.classList.toggle('is-error', !!error); }

  /* ── Réseau ── */
  var offlineBox = doc.querySelector('[data-partage-offline]'), retry = null;
  function offline(on, again) {
    if (!offlineBox) return;
    offlineBox.hidden = !on;
    if (again) retry = again;
  }
  doc.addEventListener('click', function (e) { if (e.target.closest('[data-partage-retry]') && retry) { offline(false); retry(); } });

  var session = store.get(SESSION_KEY);
  function setSession(s) {
    session = s && s.access_token ? { access_token: s.access_token, refresh_token: s.refresh_token, expires_at: Date.now() + (s.expires_in || 3600) * 1000, user: s.user ? { id: s.user.id, email: s.user.email } : null } : null;
    store.set(SESSION_KEY, session);
  }
  var MESSAGES = {
    rate_limit: 'Trop d’envois en peu de temps : réessayez dans une heure.', suspended: 'Ce compte est suspendu : il ne peut plus publier.', status_forbidden: 'Ce changement d’état est réservé à la modération.',
    not_owner: 'Cette contribution n’est pas la vôtre.', moderated: 'Cette contribution a été masquée ou refusée par la modération : elle ne se modifie plus.', profile_required: 'Choisissez d’abord un pseudo dans « Mon compte ».',
    circuit_needs_two_stops: 'Un circuit compte au moins deux étapes.', too_many_stops: '60 étapes au plus.', auth_required: 'Connectez-vous d’abord.', moderator_only: 'Réservé aux comptes de modération.',
    resubmit_required: 'Modifiez le circuit depuis le formulaire : il repassera en validation.', not_found: 'Introuvable, ou ce n’est pas la vôtre.', too_many_media: '8 photos au plus.'
  };
  function errorText(e) {
    if (e && e.offline) return 'Le serveur de Partage ne répond pas. Réessayez plus tard.';
    var m = String((e && (e.message || e.msg || e.error_description)) || '');
    for (var k in MESSAGES) if (m.indexOf(k) >= 0) return MESSAGES[k];
    if (/profiles_pseudo_unique|duplicate key/.test(m)) return 'Ce pseudo est déjà pris.';
    if (/check constraint|violates|invalid input/.test(m)) return 'Un champ ne respecte pas les règles : longueur, balises HTML (interdites), lien en https, position en Europe.';
    if (e && e.status === 401) return 'Session expirée : reconnectez-vous.';
    return m && m.length < 200 ? m : 'La demande n’a pas abouti.';
  }
  function request(path, opts, again) {
    opts = opts || {};
    var ctrl = typeof AbortController === 'function' ? new AbortController() : null, timer = ctrl ? setTimeout(function () { ctrl.abort(); }, TIMEOUT) : null;
    var headers = { apikey: KEY, 'content-type': 'application/json' };
    if (opts.auth !== false && session && session.access_token) headers.authorization = 'Bearer ' + session.access_token;
    return fetch(API + path, { method: opts.method || 'GET', headers: headers, body: opts.body != null ? JSON.stringify(opts.body) : undefined, signal: ctrl ? ctrl.signal : undefined,
      credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store', redirect: 'error' })
      .then(function (res) {
        if (timer) clearTimeout(timer);
        return res.text().then(function (text) {
          var data = null; try { data = text ? JSON.parse(text) : null; } catch (e) { data = null; }
          if (res.ok) { offline(false); return data; }
          // Jeton expiré : une seule tentative de renouvellement, puis la session est oubliée.
          if (res.status === 401 && session && session.refresh_token && !again && opts.auth !== false) return refreshSession().then(function () { return request(path, opts, true); });
          var err = data && typeof data === 'object' ? data : {}; err.status = res.status; throw err;
        });
      }, function () { if (timer) clearTimeout(timer); var e = { offline: true }; throw e; });
  }
  function refreshSession() {
    return request('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: session.refresh_token }, auth: false }, true)
      .then(function (s) { setSession(s); }, function (e) { setSession(null); throw e; });
  }
  var rpc = function (name, args) { return request('/rest/v1/rpc/' + name, { method: 'POST', body: args || {} }); };

  /* ── Photos : compartiment privé ; lecture authentifiée (la base décide qui peut voir), dépôt dans son propre dossier ── */
  var MEDIA_PATH = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp)$/;
  function timed(url, init, ms) {
    var ctrl = typeof AbortController === 'function' ? new AbortController() : null, timer = ctrl ? setTimeout(function () { ctrl.abort(); }, ms || 20000) : null;
    init.signal = ctrl ? ctrl.signal : undefined; init.credentials = 'omit'; init.referrerPolicy = 'no-referrer'; init.cache = 'no-store'; init.redirect = 'error';
    return fetch(url, init).then(function (r) { if (timer) clearTimeout(timer); return r; }, function () { if (timer) clearTimeout(timer); var e = { offline: true }; throw e; });
  }
  function mediaUrl(path) {
    if (!MEDIA_PATH.test(path)) return Promise.reject(new Error('chemin'));
    // Sans session, seule la clé publique est envoyée (en-tête apikey) : le serveur traite la demande comme anonyme.
    var headers = { apikey: KEY }; if (session && session.access_token) headers.authorization = 'Bearer ' + session.access_token;
    return timed(API + '/storage/v1/object/authenticated/community-media/' + path, { headers: headers }, 15000)
      .then(function (r) { return r.ok ? r.blob() : Promise.reject(new Error('photo indisponible')); })
      .then(function (b) { return /^image\/(jpeg|png|webp)$/.test(b.type) ? URL.createObjectURL(b) : Promise.reject(new Error('type')); });
  }
  // Réduction à 1 600 px et réenregistrement en JPEG sur l'appareil : les métadonnées (EXIF, GPS) ne survivent pas à cette étape.
  function reencode(file) {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return Promise.reject(new Error('Format refusé : JPEG, PNG ou WebP.'));
    if (file.size > 15 * 1048576) return Promise.reject(new Error('Photo trop lourde (15 Mo au plus).'));
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var k = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight)), w = Math.max(1, Math.round(img.naturalWidth * k)), h = Math.max(1, Math.round(img.naturalHeight * k));
        var c = doc.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(img, 0, 0, w, h); URL.revokeObjectURL(url);
        c.toBlob(function (blob) { if (!blob || blob.size > 5 * 1048576) return reject(new Error('Photo impossible à réduire sous 5 Mo.')); resolve({ blob: blob, w: w, h: h, url: URL.createObjectURL(blob) }); }, 'image/jpeg', .85);
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('Ce fichier n’est pas une image lisible.')); };
      img.src = url;
    });
  }
  function uploadPhoto(itemId, ph, position) {
    var uid = session && session.user && session.user.id, path = uid + '/' + (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())) + '.jpg';
    if (!MEDIA_PATH.test(path)) return Promise.reject(new Error('compte'));
    return timed(API + '/storage/v1/object/community-media/' + path, { method: 'POST', headers: { apikey: KEY, authorization: 'Bearer ' + session.access_token, 'content-type': 'image/jpeg' }, body: ph.blob })
      .then(function (r) { if (!r.ok) throw { status: r.status, message: 'dépôt de la photo refusé' }; })
      .then(function () { return request('/rest/v1/community_media', { method: 'POST', body: { item_id: itemId, owner_id: uid, path: path, alt: ph.alt, width: ph.w, height: ph.h, position: position } }); });
  }
  function guarded(promise, onError) { return promise.catch(function (e) { if (e && e.offline) offline(true); if (onError) onError(e); else throw e; }); }

  /* ── Rendu commun ── */
  function typeBadges(it) {
    return [el('span', { className: 'badge badge-community', text: 'Communauté' }), el('span', { className: 'badge', text: TYPES[it.type] || it.type })];
  }
  function itemLink(it) { return 'partage/contribution/index.html?c=' + encodeURIComponent(it.slug); }
  function rel(path) { return String(cfg.root || '../') + path; }
  function card(it, extra) {
    var meta = [it.author && it.author.pseudo ? 'par ' + it.author.pseudo : '', it.country || '', it.published_at ? dateLabel(it.published_at) : '', it.useful_count ? it.useful_count + ' utile' + (it.useful_count > 1 ? 's' : '') : '', it.km != null ? '≈ ' + it.km + ' km' : '']
      .filter(Boolean).join(' · ');
    return el('article', { className: 'card card-community' }, [el('a', { className: 'card-link', href: rel(itemLink(it)) }, [el('div', { className: 'card-body' }, [
      el('p', { className: 'badges' }, typeBadges(it).concat(extra && it.status && it.status !== 'published' ? [el('span', { className: 'badge badge-status', text: STATUS[it.status] || it.status })] : [])),
      el('h3', { className: 'card-title', text: it.title }), el('p', { className: 'card-text', text: it.summary }), el('p', { className: 'card-meta', text: meta })])])]);
  }
  function needLogin(target) {
    try { sessionStorage.setItem(RETURN_KEY, location.pathname.split('/').slice(-3).join('/') + location.search); } catch (e) { /* sans retour automatique */ }
    location.href = rel('partage/compte/index.html') + (target ? '#' + target : '');
  }
  // Charge utile pour le Planner : copie locale (le Planner ne modifie jamais la contribution d'origine).
  function plannerLink(it, mode) {
    var data = it.type === 'spot'
      ? { v: 1, k: 'spot', t: it.title, s: it.slug, a: it.author && it.author.pseudo, n: it.title, y: it.lat, x: it.lon, sk: it.spot_kind || '', nt: !!it.night_spot, lv: it.last_verified || '' }
      : { v: 1, k: 'circuit', m: mode, t: it.title, s: it.slug, a: it.author && it.author.pseudo,
          st: (it.stops || []).map(function (s) { var o = { n: s.name }; if (s.place_id != null) o.i = s.place_id; if (s.lat != null && s.lon != null) { o.y = +s.lat; o.x = +s.lon; } if (s.nights != null) o.ni = s.nights; return o; }) };
    return APP + '#partage=' + b64url(data);
  }

  /* ── Liste ── */
  function pageIndex() {
    var form = $('partage-search'), list = $('partage-results'), status = $('partage-status'), moreBtn = $('partage-more'), offset = 0, near = null, total = 0;
    var account = doc.querySelector('[data-partage-account]');
    if (account && session) account.textContent = 'Mon compte';
    function filters() {
      var f = new FormData(form), v = function (k) { var x = String(f.get(k) || '').trim(); return x || null; };
      return { q: v('q'), p_type: v('type'), p_country: v('country'), p_region: v('region'), p_season: v('season'), p_category: v('category'), p_difficulty: v('difficulty'), p_sort: v('sort') || 'recent' };
    }
    function load(append) {
      var args = filters();
      if (args.p_sort === 'distance' && near) { args.p_near_lat = near[0]; args.p_near_lon = near[1]; }
      args.p_limit = 12; args.p_offset = append ? offset : 0;
      list.setAttribute('aria-busy', 'true'); say(status, 'Chargement…');
      return guarded(rpc('list_items', args).then(function (r) {
        if (!append) { clear(list); offset = 0; }
        total = r && r.total || 0;
        (r && r.items || []).forEach(function (it) { list.appendChild(card(it)); });
        offset += (r && r.items || []).length;
        moreBtn.hidden = offset >= total;
        say(status, total ? total + ' contribution' + (total > 1 ? 's' : '') + (offset < total ? ' — ' + offset + ' affichée' + (offset > 1 ? 's' : '') : '') : 'Aucune contribution ne correspond pour l’instant.');
      }), function (e) { say(status, errorText(e), true); offline(!!(e && e.offline), function () { load(append); }); }).then(function () { list.removeAttribute('aria-busy'); });
    }
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var sort = form.elements.sort.value;
      $('partage-near-note').hidden = sort !== 'distance';
      if (sort === 'distance' && !near) {
        if (!navigator.geolocation) { say(status, 'Position indisponible sur cet appareil : tri par date.', true); form.elements.sort.value = 'recent'; return load(false); }
        say(status, 'Demande de votre position…');
        return navigator.geolocation.getCurrentPosition(function (p) { near = [Math.round(p.coords.latitude * 10) / 10, Math.round(p.coords.longitude * 10) / 10]; load(false); },
          function () { say(status, 'Position refusée : tri par date.', true); form.elements.sort.value = 'recent'; load(false); }, { maximumAge: 600000, timeout: 10000 });
      }
      load(false);
    });
    moreBtn.addEventListener('click', function () { load(true); });
    load(false);
  }

  /* ── Contribution ── */
  function pageItem() {
    var root = $('partage-item'), status = $('pi-status'), slug = param('c');
    if (!slug || !SLUG.test(slug) || slug.length > 80) { say(status, 'Adresse de contribution invalide.', true); root.removeAttribute('aria-busy'); return; }
    function load() {
      guarded(rpc('get_item', { p_slug: slug }).then(function (it) {
        root.removeAttribute('aria-busy');
        if (!it) { $('pi-title').textContent = 'Contribution introuvable'; say(status, 'Elle n’existe pas, ou elle n’est plus publiée.'); return; }
        render(it);
      }), function (e) { root.removeAttribute('aria-busy'); say(status, errorText(e), true); offline(!!(e && e.offline), load); });
    }
    function render(it) {
      doc.title = it.title + ' — Partage';
      clear(root);
      var head = el('header', { className: 'page-head' }, [
        el('p', { className: 'badges' }, typeBadges(it).concat(it.status !== 'published' ? [el('span', { className: 'badge badge-status', text: STATUS[it.status] || it.status })] : [])),
        el('h1', { className: 'page-title', id: 'pi-title', text: it.title }),
        el('p', { className: 'story-meta' }, ['Proposé par ', it.author && UUID.test(it.author.id) ? el('a', { href: rel('partage/auteur/index.html?id=' + it.author.id), text: it.author.pseudo }) : (it.author && it.author.pseudo) || 'un membre',
          it.published_at ? ' · publié le ' + dateLabel(it.published_at) : '', it.updated_at && it.published_at && it.updated_at.slice(0, 10) !== it.published_at.slice(0, 10) ? ' · mis à jour le ' + dateLabel(it.updated_at) : '']),
        el('p', { className: 'page-lead', text: it.summary })]);
      root.appendChild(head);
      if (it.type === 'astuce' || it.type === 'technique' || it.type === 'spot') root.appendChild(el('p', { className: 'caveat', text: DISCLAIMER }));
      if (it.night_spot) root.appendChild(el('p', { className: 'caveat caveat-strong', text: 'Spot de nuit : la tolérance change d’un lieu et d’une saison à l’autre. Vérifiez la signalisation et la réglementation sur place ; respectez les riverains et ne laissez rien derrière vous.' }));
      var facts = [];
      var fact = function (k, v, note) { if (v) facts.push(el('div', null, [el('dt', { text: k }), el('dd', { text: v }, note ? [el('small', { text: note })] : [])])); };
      fact('Pays', [it.country, it.region].filter(Boolean).join(' — '));
      fact('Catégorie', CATS[it.category]);
      if (it.type === 'circuit') { fact('Distance', it.distance_km != null ? it.distance_km + ' km' : ''); fact('Durée effectuée', it.days_done ? it.days_done + ' jours' : ''); fact('Durée conseillée', it.days_suggested ? it.days_suggested + ' jours' : ''); fact('Véhicule', it.vehicle); }
      if (it.type === 'spot') { fact('Genre de lieu', KINDS[it.spot_kind]); fact('Position', it.lat != null ? num(it.lat) + ' N, ' + num(it.lon) + ' E' : '', 'approximative, environ 1 km'); fact('Dernière vérification', it.last_verified ? dateLabel(it.last_verified) : 'non indiquée'); }
      fact('Saisons', (it.seasons || []).map(function (s) { return SEASONS[s] || s; }).join(', '));
      fact('Difficulté', DIFF[it.difficulty]);
      if (facts.length) root.appendChild(el('dl', { className: 'facts' }, facts));
      var actions = el('div', { className: 'item-actions' });
      if (it.type === 'circuit' && (it.stops || []).length) {
        actions.appendChild(el('a', { className: 'btn btn-primary', href: plannerLink(it, 'add'), text: 'Ajouter à mon Planner' }));
        actions.appendChild(el('a', { className: 'btn btn-ghost', href: plannerLink(it, 'copy'), text: 'Créer mon circuit à partir de celui-ci' }));
      }
      if (it.type === 'spot' && it.lat != null) actions.appendChild(el('a', { className: 'btn btn-primary', href: plannerLink(it), text: 'Ajouter à mes lieux' }));
      var useful = el('button', { className: 'btn btn-ghost btn-small', type: 'button', 'aria-pressed': String(!!it.useful), text: (it.useful ? 'Utile ✓ ' : 'Utile ') + '(' + (it.useful_count || 0) + ')' });
      var mark = el('button', { className: 'btn btn-ghost btn-small', type: 'button', 'aria-pressed': String(!!it.bookmarked), text: it.bookmarked ? 'Dans mes favoris' : 'Ajouter aux favoris' });
      var report = el('button', { className: 'btn btn-ghost btn-quiet btn-small', type: 'button', text: 'Signaler' });
      if (!it.mine && it.status === 'published') { actions.appendChild(useful); actions.appendChild(mark); actions.appendChild(report); }
      if (it.mine) {
        actions.appendChild(el('a', { className: 'btn btn-ghost', href: rel('partage/proposer/index.html?id=' + encodeURIComponent(it.slug)), text: 'Modifier' }));
        var del = el('button', { className: 'btn btn-danger', type: 'button', text: 'Supprimer' });
        del.addEventListener('click', function () {
          if (!window.confirm('Supprimer définitivement cette contribution ?')) return;
          guarded(rpc('delete_item', { p_item: it.id }).then(function () { location.href = rel('partage/compte/index.html'); }), function (e) { say(status, errorText(e), true); });
        });
        actions.appendChild(del);
      }
      root.appendChild(actions);
      var status = el('p', { className: 'search-status', id: 'pi-status', role: 'status', 'aria-live': 'polite' });
      root.appendChild(status);
      useful.addEventListener('click', function () {
        if (!session) return needLogin();
        var on = useful.getAttribute('aria-pressed') !== 'true';
        guarded(rpc('set_useful', { p_item: it.id, p_on: on }).then(function (n) { useful.setAttribute('aria-pressed', String(on)); useful.textContent = (on ? 'Utile ✓ ' : 'Utile ') + '(' + (n || 0) + ')'; }), function (e) { say(status, errorText(e), true); });
      });
      mark.addEventListener('click', function () {
        if (!session) return needLogin();
        var on = mark.getAttribute('aria-pressed') !== 'true';
        guarded(rpc('set_bookmark', { p_item: it.id, p_on: on }).then(function () { mark.setAttribute('aria-pressed', String(on)); mark.textContent = on ? 'Dans mes favoris' : 'Ajouter aux favoris'; say(status, on ? 'Ajoutée à vos favoris.' : 'Retirée de vos favoris.'); }), function (e) { say(status, errorText(e), true); });
      });
      report.addEventListener('click', function () {
        if (!session) return needLogin();
        var d = $('pi-report'); d.returnValue = ''; d.showModal();
        d.addEventListener('close', function onClose() {
          d.removeEventListener('close', onClose);
          if (d.returnValue !== 'send') return;
          guarded(rpc('report_item', { p_item: it.id, p_reason: $('pi-reason').value, p_details: $('pi-details').value.trim().slice(0, 500) || null })
            .then(function (ok) { say(status, ok ? 'Merci : le signalement sera lu par un modérateur.' : 'Vous avez déjà signalé cette contribution.'); report.disabled = true; }), function (e) { say(status, errorText(e), true); });
        });
      });
      if ((it.media || []).length) {
        var gallery = el('div', { className: 'gallery partage-gallery' });
        it.media.forEach(function (m) {
          if (!MEDIA_PATH.test(m.path)) return;
          var img = el('img', { alt: m.alt || '', width: m.width || null, height: m.height || null, loading: 'lazy', decoding: 'async' }), fig = el('figure', null, [img]);
          gallery.appendChild(fig);
          mediaUrl(m.path).then(function (u) { img.src = u; }, function () { fig.appendChild(el('figcaption', { text: 'Photo indisponible.' })); });
        });
        root.appendChild(gallery);
      }
      if (it.body) { var body = el('div', { className: 'prose partage-body' }); String(it.body).split(/\n{2,}/).forEach(function (p) { if (p.trim()) body.appendChild(el('p', { text: p })); }); root.appendChild(body); }
      if (it.type === 'circuit' && (it.stops || []).length) {
        root.appendChild(el('h2', { className: 'section-title', text: 'Les étapes' }));
        root.appendChild(el('ol', { className: 'stops stops-numbered' }, it.stops.map(function (s) {
          return el('li', null, [el('h3', { className: 'stop-title', text: s.name }), el('p', { className: 'stop-meta', text: [s.nights != null ? s.nights + ' nuit' + (s.nights > 1 ? 's' : '') : '', s.lat != null ? '≈ ' + num(s.lat) + ', ' + num(s.lon) : ''].filter(Boolean).join(' · ') }), s.note ? el('p', { text: s.note }) : null]);
        })));
      }
      [['hard_parts', 'Difficultés rencontrées'], ['roads_avoid', 'Routes déconseillées']].forEach(function (f) { if (it[f[0]]) { root.appendChild(el('h2', { className: 'section-title', text: f[1] })); root.appendChild(el('p', { className: 'partage-body', text: it[f[0]] })); } });
      var src = safeHttps(it.source_url);
      if (src) root.appendChild(el('p', null, ['Source citée : ', el('a', { href: src, rel: 'noopener noreferrer nofollow ugc', text: new URL(src).hostname })]));
      root.appendChild(el('p', { className: 'note', text: 'Cette page affiche une contribution de la communauté ; elle n’est pas écrite par l’auteur du blog.' }));
    }
    load();
  }

  /* ── Proposer ── */
  function pageProposer() {
    var form = $('pp-form'), status = $('pp-status'), stops = $('pp-stops'), editing = null, wantDraft = false, photos = [], removed = [];
    function renderPhotos() {
      var list = $('pp-photo-list'); clear(list);
      photos.forEach(function (ph, i) {
        var id = 'pp-alt-' + i, img = el('img', { alt: '', width: '96', height: '72', className: 'photo-thumb' });
        if (ph.url) img.src = ph.url; else if (ph.path) mediaUrl(ph.path).then(function (u) { img.src = u; }, function () { /* aperçu indisponible */ });
        var alt = el('input', { id: id, type: 'text', maxlength: '300', required: true, value: ph.alt || '' });
        alt.addEventListener('input', function () { ph.alt = alt.value; });
        var rm = el('button', { className: 'btn btn-small btn-ghost', type: 'button', text: 'Retirer', 'aria-label': 'Retirer la photo ' + (i + 1) });
        rm.addEventListener('click', function () { if (ph.id) removed.push(ph); photos.splice(i, 1); renderPhotos(); });
        list.appendChild(el('li', { className: 'photo-row' }, [img, el('div', { className: 'field' }, [el('label', { for: id, text: 'Description de la photo ' + (i + 1) })]), rm]));
        list.lastChild.querySelector('.field').appendChild(alt);
      });
    }
    $('pp-photos').addEventListener('change', function (e) {
      var files = [].slice.call(e.target.files || []), room = 4 - photos.length; e.target.value = '';
      if (files.length > room) say(status, '4 photos au plus : ' + Math.max(room, 0) + ' de plus possible(s).', true);
      files.slice(0, Math.max(room, 0)).reduce(function (p, f) { return p.then(function () { return reencode(f).then(function (r) { photos.push({ blob: r.blob, url: r.url, w: r.w, h: r.h, alt: '' }); renderPhotos(); }, function (err) { say(status, f.name.slice(0, 60) + ' : ' + err.message, true); }); }); }, Promise.resolve());
    });
    if (!session) $('pp-login').hidden = false;
    var stopSeq = 0;
    function addStop(s) {
      if (stops.children.length >= 60) return say(status, '60 étapes au plus.', true);
      var k = ++stopSeq, li = el('li', { className: 'stop-row' });
      var field = function (name, label, attrs) { var id = 'pp-s' + k + '-' + name; return el('div', { className: 'field field-' + name }, [el('label', { for: id, text: label }), el(attrs.tag || 'input', Object.assign({ id: id, 'data-stop': name }, attrs.props))]); };
      li.appendChild(field('name', 'Étape', { props: { type: 'text', maxlength: '120', required: true } }));
      li.appendChild(field('lat', 'Latitude', { props: { type: 'text', inputmode: 'decimal', maxlength: '12' } }));
      li.appendChild(field('lon', 'Longitude', { props: { type: 'text', inputmode: 'decimal', maxlength: '12' } }));
      li.appendChild(field('nights', 'Nuits', { props: { type: 'number', min: '0', max: '60', inputmode: 'numeric' } }));
      li.appendChild(field('note', 'Note', { props: { type: 'text', maxlength: '500' } }));
      var tools = el('div', { className: 'stop-tools' }, [el('button', { className: 'btn btn-small btn-ghost', type: 'button', 'data-move': '-1', 'aria-label': 'Monter cette étape', text: '↑' }),
        el('button', { className: 'btn btn-small btn-ghost', type: 'button', 'data-move': '1', 'aria-label': 'Descendre cette étape', text: '↓' }), el('button', { className: 'btn btn-small btn-ghost', type: 'button', 'data-remove': '1', 'aria-label': 'Retirer cette étape', text: 'Retirer' })]);
      li.appendChild(tools);
      if (s) { li.querySelector('[data-stop=name]').value = s.name || ''; if (s.lat != null) li.querySelector('[data-stop=lat]').value = num(s.lat); if (s.lon != null) li.querySelector('[data-stop=lon]').value = num(s.lon); if (s.nights != null) li.querySelector('[data-stop=nights]').value = s.nights; if (s.note) li.querySelector('[data-stop=note]').value = s.note; if (s.place_id != null) li.dataset.place = s.place_id; }
      stops.appendChild(li);
      return li;
    }
    stops.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      var li = b.closest('li');
      if (b.dataset.remove) { li.remove(); return; }
      var to = +b.dataset.move;
      if (to < 0 && li.previousElementSibling) stops.insertBefore(li, li.previousElementSibling);
      if (to > 0 && li.nextElementSibling) stops.insertBefore(li.nextElementSibling, li);
      b.focus();
    });
    $('pp-add-stop').addEventListener('click', function () { addStop().querySelector('input').focus(); });
    function syncType() {
      var type = form.elements.type.value;
      [].forEach.call(form.querySelectorAll('[data-for]'), function (fs) { fs.hidden = fs.getAttribute('data-for') !== type; fs.disabled = fs.hidden; });
      if (type === 'circuit' && !stops.children.length) { addStop(); addStop(); }
    }
    form.addEventListener('change', function (e) { if (e.target.name === 'type') syncType(); });
    var coord = function (v) { var x = String(v || '').trim().replace(',', '.'); if (!x) return null; var n = Number(x); return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN; };
    var int = function (v) { var x = String(v || '').trim(); if (!x) return null; var n = Number(x); return Number.isInteger(n) ? n : NaN; };
    var TAG = /<\s*[a-z\/!?]/i;
    // Ce qui part : seulement ces champs, contrôlés ici (et de nouveau par la base).
    function payload() {
      var f = form.elements, type = f.type.value, errors = [], text = function (name, min, max, label) {
        var v = String(f[name].value || '').trim();
        if (v && TAG.test(v)) errors.push([name, label + ' : les balises HTML ne sont pas acceptées.']);
        if ((min && v.length < min) || v.length > max) errors.push([name, label + ' : ' + (min ? min + ' à ' : 'au plus ') + max + ' caractères.']);
        return v || null;
      };
      var p = { type: type, title: text('title', 5, 120, 'Titre'), summary: text('summary', 10, 400, 'Résumé'), body: text('body', 0, 20000, 'Texte') || '', country: f.country.value || null, region: text('region', 0, 80, 'Région'),
        category: f.category.value || null, difficulty: f.difficulty.value || null, seasons: [].filter.call(f.seasons, function (c) { return c.checked; }).map(function (c) { return c.value; }), source_url: null };
      var src = String(f.source_url.value || '').trim();
      if (src) { if (!safeHttps(src) || src.length > 300) errors.push(['source_url', 'Lien : une adresse https complète.']); else p.source_url = src; }
      if (type === 'circuit') {
        ['distance_km', 'days_done', 'days_suggested'].forEach(function (k) { var v = int(f[k].value); if (Number.isNaN(v)) errors.push([k, 'Nombre entier attendu.']); p[k] = Number.isNaN(v) ? null : v; });
        p.vehicle = text('vehicle', 0, 120, 'Véhicule'); p.hard_parts = text('hard_parts', 0, 2000, 'Difficultés'); p.roads_avoid = text('roads_avoid', 0, 2000, 'Routes déconseillées');
        p.stops = [].map.call(stops.children, function (li, i) {
          var g = function (n) { return li.querySelector('[data-stop=' + n + ']').value; }, name = String(g('name')).trim(), lat = coord(g('lat')), lon = coord(g('lon')), nights = int(g('nights'));
          if (!name || name.length > 120 || TAG.test(name)) errors.push(['pp-stops', 'Étape ' + (i + 1) + ' : un nom (120 caractères au plus, sans HTML).']);
          if ((lat == null) !== (lon == null) || Number.isNaN(lat) || Number.isNaN(lon) || (lat != null && (lat < 34 || lat > 72 || lon < -25 || lon > 45))) errors.push(['pp-stops', 'Étape ' + (i + 1) + ' : latitude et longitude en Europe, ou aucune des deux.']);
          var o = { name: name, lat: lat, lon: lon, nights: Number.isNaN(nights) ? null : nights, note: String(g('note')).trim().slice(0, 500) || null };
          if (li.dataset.place) o.place_id = +li.dataset.place;
          return o;
        });
        if (p.stops.length < 2 && !wantDraft) errors.push(['pp-stops', 'Un circuit compte au moins deux étapes.']);
        var first = p.stops.filter(function (s) { return s.lat != null; })[0]; if (first) { p.lat = first.lat; p.lon = first.lon; }
      }
      if (type === 'spot') {
        p.lat = coord(f.lat.value); p.lon = coord(f.lon.value); p.spot_kind = f.spot_kind.value || null; p.night_spot = f.night_spot.checked; p.last_verified = f.last_verified.value || null;
        if (p.lat == null || p.lon == null || Number.isNaN(p.lat) || Number.isNaN(p.lon) || p.lat < 34 || p.lat > 72 || p.lon < -25 || p.lon > 45) errors.push(['lat', 'Position : latitude et longitude en Europe (par exemple 43,12 et -1,98).']);
      }
      photos.forEach(function (ph, i) { var a = String(ph.alt || '').trim(); if (!a || a.length > 300 || TAG.test(a)) errors.push(['pp-alt-' + i, 'Photo ' + (i + 1) + ' : une description (300 caractères au plus, sans HTML).']); });
      if (editing) p.id = editing.id;
      return { p: p, errors: errors };
    }
    function showErrors(errors) {
      say(status, errors.map(function (e) { return e[1]; }).join(' '), true);
      var first = form.elements[errors[0][0]] || $(errors[0][0]); if (first && first.focus) first.focus();
    }
    function preview(p) {
      var box = $('pp-preview-body'); clear(box);
      var row = function (k, v) { if (v == null || v === '' || (Array.isArray(v) && !v.length)) return; box.appendChild(el('div', { className: 'preview-row' }, [el('strong', { text: k }), el('span', { text: Array.isArray(v) ? v.join(', ') : String(v) })])); };
      row('Type', TYPES[p.type]); row('Titre', p.title); row('Résumé', p.summary); row('Texte', p.body); row('Pays', p.country); row('Région', p.region); row('Catégorie', CATS[p.category]); row('Saisons', p.seasons.map(function (s) { return SEASONS[s]; }));
      row('Difficulté', DIFF[p.difficulty]); row('Source', p.source_url);
      if (p.type === 'circuit') { row('Distance', p.distance_km != null ? p.distance_km + ' km' : null); row('Durée effectuée', p.days_done); row('Durée conseillée', p.days_suggested); row('Véhicule', p.vehicle); row('Difficultés', p.hard_parts); row('Routes déconseillées', p.roads_avoid);
        row('Étapes', p.stops.map(function (s, i) { return (i + 1) + '. ' + s.name + (s.lat != null ? ' (≈ ' + num(s.lat) + ', ' + num(s.lon) + ')' : ''); })); }
      if (p.type === 'spot') { row('Position (arrondie)', num(p.lat) + ', ' + num(p.lon)); row('Genre', KINDS[p.spot_kind]); row('Nuit', p.night_spot ? 'oui' : 'non'); row('Dernière vérification', p.last_verified); }
      row('Photos', photos.map(function (ph, i) { return (i + 1) + '. ' + String(ph.alt || '').trim(); }));
    }
    function send(p, draft) {
      if (!session) return needLogin();
      p.status = draft ? 'draft' : 'pending';
      say(status, 'Envoi…');
      return guarded(rpc('save_item', { p: p }).then(function (r) {
        editing = { id: r.id };
        // Photos : retraits, puis dépôts dans l'ordre. Une photo refusée n'empêche pas la contribution d'exister.
        var chain = removed.reduce(function (q, ph) { return q.then(function () { return request('/rest/v1/community_media?id=eq.' + encodeURIComponent(ph.id), { method: 'DELETE' }).catch(function () {}); }); }, Promise.resolve());
        removed = [];
        photos.forEach(function (ph, i) { if (!ph.id) chain = chain.then(function () { return uploadPhoto(r.id, ph, i + 1).then(function () { ph.id = 'envoyée'; }); }); });
        return chain.then(function () { return r; }, function (e) { say(status, 'Contribution enregistrée, mais une photo n’a pas pu être envoyée : ' + errorText(e), true); return r; });
      }).then(function (r) {
        var link = el('a', { href: rel(itemLink(r)), text: 'Voir la contribution' });
        clear(status); status.classList.remove('is-error');
        status.appendChild(doc.createTextNode(r.status === 'published' ? 'Publiée. ' : r.status === 'draft' ? 'Brouillon enregistré (visible de vous seul). ' : 'Envoyée : elle paraîtra après relecture par un modérateur. '));
        status.appendChild(link);
      }), function (e) { say(status, errorText(e), true); });
    }
    form.addEventListener('submit', function (e) {
      e.preventDefault(); wantDraft = false;
      var r = payload(); if (r.errors.length) return showErrors(r.errors);
      if (!session) return needLogin();
      preview(r.p); $('pp-confirm').showModal(); $('pp-send').focus();
      $('pp-send').onclick = function () { $('pp-confirm').close(); send(r.p, false); };
    });
    $('pp-cancel').addEventListener('click', function () { $('pp-confirm').close(); });
    $('pp-draft').addEventListener('click', function () { wantDraft = true; var r = payload(); wantDraft = false; if (r.errors.filter(function (x) { return x[0] !== 'pp-stops'; }).length) return showErrors(r.errors); send(r.p, true); });

    // Étapes reprises du Planner (lien « Partager dans Partage ») : lues dans l'ancre, jamais envoyées sans confirmation.
    var m = /^#depuis-planner=([A-Za-z0-9_-]{1,16000})$/.exec(location.hash);
    if (m) {
      try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* sans gravité */ }
      try {
        var d = fromB64url(m[1]);
        if (!d || d.v !== 1 || !Array.isArray(d.st) || !d.st.length || d.st.length > 60) throw new Error('format');
        form.elements.type.value = 'circuit'; clear(stops);
        d.st.forEach(function (s) {
          if (!s || typeof s.n !== 'string') return;
          var lat = Number.isFinite(s.y) ? Math.round(s.y * 100) / 100 : null, lon = Number.isFinite(s.x) ? Math.round(s.x * 100) / 100 : null;
          addStop({ name: s.n.slice(0, 120), lat: lat, lon: lon, place_id: Number.isInteger(s.i) && s.i >= 0 ? s.i : null });
        });
        var info = $('pp-from-planner'); info.hidden = false;
        info.textContent = stops.children.length + ' étapes reprises de votre Planner, positions arrondies à environ 1 km. Vos notes, dates, budgets et favoris n’ont pas été repris. Rien n’est envoyé avant votre confirmation.';
      } catch (e) { say(status, 'Les étapes venues du Planner sont illisibles.', true); }
    }
    syncType();
    var editSlug = param('id');
    if (editSlug && SLUG.test(editSlug) && session) {
      guarded(rpc('get_item', { p_slug: editSlug }).then(function (it) {
        if (!it || !it.mine) return say(status, 'Cette contribution n’est pas la vôtre, ou elle n’existe plus.', true);
        editing = it; var f = form.elements;
        f.type.value = it.type; [].forEach.call(f.type, function (r) { r.disabled = r.value !== it.type; });
        ['title', 'summary', 'body', 'region', 'vehicle', 'hard_parts', 'roads_avoid', 'source_url', 'last_verified', 'distance_km', 'days_done', 'days_suggested'].forEach(function (k) { if (f[k] && it[k] != null) f[k].value = it[k]; });
        ['country', 'category', 'difficulty', 'spot_kind'].forEach(function (k) { if (f[k] && it[k]) f[k].value = it[k]; });
        [].forEach.call(f.seasons, function (c) { c.checked = (it.seasons || []).indexOf(c.value) >= 0; });
        if (it.lat != null) { f.lat.value = num(it.lat); f.lon.value = num(it.lon); }
        f.night_spot.checked = !!it.night_spot;
        clear(stops); (it.stops || []).forEach(addStop); syncType();
        photos = (it.media || []).filter(function (m) { return MEDIA_PATH.test(m.path); }).map(function (m) { return { id: m.id, path: m.path, alt: m.alt, w: m.width, h: m.height }; }); renderPhotos();
        say(status, 'Modification de « ' + it.title + ' » (' + (STATUS[it.status] || it.status) + ').');
      }), function (e) { say(status, errorText(e), true); });
    }
  }

  /* ── Compte ── */
  function pageCompte() {
    var status = $('pc-status');
    function show() { $('pc-out').hidden = !!session; $('pc-in').hidden = !session; if (session) loadAccount(); }
    function afterLogin() {
      var back = null; try { back = sessionStorage.getItem(RETURN_KEY); sessionStorage.removeItem(RETURN_KEY); } catch (e) { back = null; }
      // Retour seulement vers une page de Partage de ce site.
      if (back && /^partage\/(contribution|proposer|auteur)\/index\.html(\?[a-z]{1,2}=[a-z0-9-]{1,80})?$/.test(back)) { location.href = rel(back); return; }
      show();
    }
    function credentials() {
      var email = $('pc-email').value.trim(), password = $('pc-password').value;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { say(status, 'Adresse e-mail invalide.', true); $('pc-email').focus(); return null; }
      if (password.length < 10) { say(status, 'Mot de passe : 10 caractères au moins.', true); $('pc-password').focus(); return null; }
      return { email: email, password: password };
    }
    $('pc-login').addEventListener('submit', function (e) {
      e.preventDefault(); var c = credentials(); if (!c) return;
      say(status, 'Connexion…');
      guarded(request('/auth/v1/token?grant_type=password', { method: 'POST', body: c, auth: false }).then(function (s) { setSession(s); $('pc-password').value = ''; say(status, 'Connecté.'); afterLogin(); }),
        function (err) { say(status, err && err.status === 400 ? 'Adresse ou mot de passe incorrect.' : errorText(err), true); });
    });
    $('pc-signup').addEventListener('click', function () {
      var c = credentials(); if (!c) return;
      say(status, 'Création du compte…');
      guarded(request('/auth/v1/signup', { method: 'POST', body: c, auth: false }).then(function (s) {
        $('pc-password').value = '';
        if (s && s.access_token) { setSession(s); say(status, 'Compte créé. Choisissez maintenant votre pseudo public.'); show(); $('pc-pseudo').focus(); }
        else say(status, 'Compte créé : confirmez votre adresse avec le lien reçu par e-mail, puis connectez-vous.');
      }), function (err) { say(status, errorText(err), true); });
    });
    function loadAccount() {
      guarded(rpc('my_profile').then(function (p) {
        if (!p) { say(status, 'Choisissez un pseudo pour publier : il sera affiché avec vos contributions.'); $('pc-since').textContent = ''; return; }
        $('pc-pseudo').value = p.pseudo; $('pc-bio').value = p.bio || '';
        $('pc-since').textContent = 'Inscrit le ' + dateLabel(p.created_at) + ' · ' + p.contributions + ' contribution' + (p.contributions > 1 ? 's' : '') + ' publiée' + (p.contributions > 1 ? 's' : '') +
          (p.trust_level < 1 ? ' · vos contributions sont relues avant publication' : '') + (p.suspended ? ' · compte suspendu' : '');
        $('pc-moderator').hidden = !p.moderator;
        $('pc-delete-pseudo').setAttribute('data-expected', p.pseudo);
      }), function (e) { if (e && e.status === 401) { setSession(null); show(); } say(status, errorText(e), true); });
      guarded(rpc('my_items').then(function (list) { var box = $('pc-items'); clear(box); if (!list || !list.length) box.appendChild(el('p', { className: 'note', text: 'Aucune contribution pour l’instant.' })); (list || []).forEach(function (it) { box.appendChild(card(it, true)); }); }), function () {});
      guarded(rpc('my_bookmarks').then(function (list) { var box = $('pc-bookmarks'); clear(box); if (!list || !list.length) box.appendChild(el('p', { className: 'note', text: 'Aucun favori.' })); (list || []).forEach(function (it) { box.appendChild(card(it)); }); }), function () {});
    }
    $('pc-profile').addEventListener('submit', function (e) {
      e.preventDefault();
      var pseudo = $('pc-pseudo').value.trim(), bio = $('pc-bio').value.trim();
      if (pseudo.length < 3 || pseudo.length > 30 || /[<>]/.test(pseudo)) { say(status, 'Pseudo : 3 à 30 caractères, lettres, chiffres, espaces, . _ - et apostrophe.', true); return $('pc-pseudo').focus(); }
      guarded(rpc('save_profile', { p_pseudo: pseudo, p_bio: bio || null }).then(function () { say(status, 'Profil enregistré.'); loadAccount(); }), function (err) { say(status, errorText(err), true); });
    });
    $('pc-logout').addEventListener('click', function () {
      var done = function () { setSession(null); say(status, 'Déconnecté.'); show(); };
      request('/auth/v1/logout', { method: 'POST' }).then(done, done);
    });
    $('pc-export').addEventListener('click', function () {
      guarded(rpc('export_my_data').then(function (data) {
        var url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })), a = el('a', { href: url, download: 'partage-mes-donnees.json' });
        doc.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
        say(status, 'Vos données sont téléchargées.');
      }), function (e) { say(status, errorText(e), true); });
    });
    $('pc-delete').addEventListener('click', function () {
      var d = $('pc-delete-confirm'); d.returnValue = ''; $('pc-delete-pseudo').value = ''; d.showModal();
      d.addEventListener('close', function onClose() {
        d.removeEventListener('close', onClose);
        if (d.returnValue !== 'delete') return;
        var expected = $('pc-delete-pseudo').getAttribute('data-expected');
        if (expected && $('pc-delete-pseudo').value.trim() !== expected) return say(status, 'Le pseudo recopié ne correspond pas : rien n’a été supprimé.', true);
        guarded(rpc('delete_my_account').then(function () { setSession(null); say(status, 'Compte et contributions supprimés.'); show(); }), function (e) { say(status, errorText(e), true); });
      });
    });
    show();
  }

  /* ── Auteur ── */
  function pageAuteur() {
    var id = param('id'), status = $('pa-status'), root = $('pa-profile');
    if (!id || !UUID.test(id)) { say(status, 'Adresse de profil invalide.', true); root.removeAttribute('aria-busy'); return; }
    function load() {
      guarded(rpc('public_profile', { p_id: id }).then(function (p) {
        root.removeAttribute('aria-busy');
        if (!p) { $('pa-title').textContent = 'Profil introuvable'; say(status, ''); return; }
        $('pa-title').textContent = p.pseudo; doc.title = p.pseudo + ' — Partage';
        say(status, 'Membre depuis le ' + dateLabel(p.created_at) + ' · ' + p.items.length + ' contribution' + (p.items.length > 1 ? 's' : '') + ' publiée' + (p.items.length > 1 ? 's' : '') + (p.bio ? ' · ' + p.bio : ''));
        var box = $('pa-items'); clear(box); p.items.forEach(function (it) { box.appendChild(card(it)); });
      }), function (e) { root.removeAttribute('aria-busy'); say(status, errorText(e), true); offline(!!(e && e.offline), load); });
    }
    load();
  }

  /* ── Modération (le serveur vérifie le rôle à chaque appel) ── */
  function pageModeration() {
    var status = $('pm-status'), box = $('pm-queue'), current = 'pending';
    if (!session) { say(status, 'Connectez-vous avec un compte de modération.', true); return; }
    function load() {
      say(status, 'Chargement…');
      guarded(rpc('moderation_queue', { p_status: current }).then(function (list) {
        clear(box); say(status, list.length ? list.length + ' contribution(s).' : 'Rien à traiter.');
        list.forEach(function (it) {
          var reason = el('input', { type: 'text', maxlength: '300', 'aria-label': 'Motif de la décision pour « ' + it.title + ' »', placeholder: 'Motif (consigné au journal)' });
          var act = function (label, fn, cls) { var b = el('button', { className: 'btn btn-small ' + (cls || 'btn-ghost'), type: 'button', text: label }); b.addEventListener('click', function () { fn(reason.value.trim()); }); return b; };
          var decide = function (st) { return function (why) { guarded(rpc('moderate_item', { p_item: it.id, p_status: st, p_reason: why || null }).then(function () { load(); loadLog(); }), function (e) { say(status, errorText(e), true); }); }; };
          box.appendChild(el('article', { className: 'mod-card' }, [el('p', { className: 'badges' }, typeBadges(it).concat([el('span', { className: 'badge badge-status', text: STATUS[it.status] || it.status })])),
            el('h3', { className: 'card-title' }, [el('a', { href: rel(itemLink(it)), text: it.title })]),
            el('p', { className: 'card-meta', text: 'par ' + (it.author && it.author.pseudo) + ' · confiance ' + it.author_trust + (it.author_suspended ? ' · suspendu' : '') + ' · ' + (it.report_count || 0) + ' signalement(s) ouvert(s)' }),
            el('p', { text: it.summary }), it.body ? el('p', { className: 'partage-body mod-excerpt', text: String(it.body).slice(0, 600) }) : null,
            (it.reports || []).length ? el('ul', { className: 'plain-list' }, it.reports.map(function (r) { return el('li', { text: r.reason + (r.details ? ' — ' + r.details : '') + ' (' + dateLabel(r.created_at) + ', ' + r.status + ')' }); })) : null,
            reason, el('div', { className: 'item-actions' }, [act('Publier', decide('published'), 'btn-primary'), act('Masquer', decide('hidden')), act('Refuser', decide('rejected')), act('Remettre en attente', decide('pending')),
              act('Suspendre l’auteur', function (why) { if (!window.confirm('Suspendre ' + (it.author && it.author.pseudo) + ' ? Ses contributions publiées seront retirées.')) return; guarded(rpc('suspend_user', { p_user: it.author.id, p_on: true, p_reason: why || null }).then(function () { load(); loadLog(); }), function (e) { say(status, errorText(e), true); }); }, 'btn-danger')])]));
        });
      }), function (e) { clear(box); say(status, errorText(e), true); offline(!!(e && e.offline), load); });
    }
    function loadLog() {
      guarded(rpc('moderation_history', { p_limit: 50 }).then(function (list) { var ol = $('pm-log'); clear(ol); list.forEach(function (l) { ol.appendChild(el('li', { text: dateLabel(l.at) + ' — ' + l.action + (l.reason ? ' — ' + l.reason : '') + (l.item_id ? ' — contribution ' + String(l.item_id).slice(0, 8) : '') + (l.user_id ? ' — compte ' + String(l.user_id).slice(0, 8) : '') })); }); }), function () {});
    }
    doc.querySelector('.tabs-row').addEventListener('click', function (e) {
      var b = e.target.closest('[data-queue]'); if (!b) return;
      current = b.dataset.queue; [].forEach.call(doc.querySelectorAll('[data-queue]'), function (x) { x.setAttribute('aria-pressed', String(x === b)); }); load();
    });
    load(); loadLog();
  }

  var PAGES = { index: pageIndex, item: pageItem, proposer: pageProposer, compte: pageCompte, auteur: pageAuteur, moderation: pageModeration };
  if (PAGES[page]) PAGES[page]();
})();
