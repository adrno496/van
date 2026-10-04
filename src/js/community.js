/* Partage ↔ Planner.
   - Recevoir : un circuit ou un spot de Partage arrive par le lien « #partage=… » (données dans l'ancre, jamais envoyées).
     Après confirmation, il devient une copie locale : étapes ajoutées au trajet, parcours enregistré, ou lieu personnel.
     La contribution d'origine n'est jamais modifiée ; le catalogue non plus (un lieu inconnu devient un lieu personnel).
   - Envoyer : « Partager dans Partage » prépare un aperçu du trajet ; seules les étapes cochées partent, sous forme de
     noms et de positions arrondies (environ 1 km), vers le formulaire de Partage, où rien n'est publié sans confirmation.
     Les notes, dates, budgets, favoris et lieux de base ne sont jamais repris. atlasvan.v3 n'est jamais envoyé. */
var COMMUNITY_KINDS = { bivouac: 'Bivouac', aire: 'Aire de services', camping: 'Camping', parking: 'Parking', 'point-de-vue': 'Point de vue', eau: 'Point d’eau', vidange: 'Vidange', autre: 'Lieu' };

function fromBase64Url(s) {
  var bin = atob(String(s).replace(/-/g, '+').replace(/_/g, '/')), bytes = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return JSON.parse(new TextDecoder().decode(bytes));
}
function toBase64Url(obj) {
  var bytes = new TextEncoder().encode(JSON.stringify(obj)), bin = '';
  for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
var cleanText = function (v, max) { return typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max) : ''; };

// Contrôle complet de ce qui arrive : une donnée hors format est ignorée, jamais interprétée.
function readPartagePayload(raw) {
  if (typeof raw !== 'string' || raw.length > 16000 || !/^[A-Za-z0-9_-]+$/.test(raw)) return null;
  var d;
  try { d = fromBase64Url(raw); } catch (e) { return null; }
  if (!isPlainObject(d) || d.v !== 1 || (d.k !== 'circuit' && d.k !== 'spot')) return null;
  var out = { kind: d.k, mode: d.m === 'copy' ? 'copy' : 'add', title: cleanText(d.t, 120) || 'Contribution de Partage', author: cleanText(d.a, 30) };
  if (d.k === 'spot') {
    var y = Number(d.y), x = Number(d.x);
    if (!validCoords(x, y)) return null;
    out.spot = { n: cleanText(d.n, 120) || out.title, y: Math.round(y * 100) / 100, x: Math.round(x * 100) / 100, kind: COMMUNITY_KINDS[d.sk] ? d.sk : 'autre', night: d.nt === true, verified: /^\d{4}-\d{2}-\d{2}$/.test(d.lv || '') ? d.lv : '' };
    return out;
  }
  if (!Array.isArray(d.st) || !d.st.length || d.st.length > 60) return null;
  out.stops = d.st.filter(isPlainObject).map(function (s) {
    var o = { n: cleanText(s.n, 120) };
    if (Number.isInteger(s.i) && s.i >= 0) o.i = s.i;
    if (validCoords(Number(s.x), Number(s.y))) { o.y = Math.round(Number(s.y) * 100) / 100; o.x = Math.round(Number(s.x) * 100) / 100; }
    if (Number.isInteger(s.ni) && s.ni >= 0 && s.ni <= 60) o.ni = s.ni;
    return o;
  }).filter(function (s) { return s.n; });
  return out.stops.length ? out : null;
}

// Un lieu personnel identique (même nom, même position à 1 km près) est réutilisé plutôt que dupliqué.
function communityPlace(name, y, x, extra) {
  var same = PTS.filter(function (L) { return L.perso && L.n === name && Math.abs(L.y - y) < .006 && Math.abs(L.x - x) < .006; })[0];
  if (same) return same.i;
  var L = { i: 'c' + (++cSeq), n: name.slice(0, TEXT_LIMITS.n), y: y, x: x, p: 'Perso', c: 'perso', w: 1, d: (extra.d || 'Lieu repris de Partage').slice(0, TEXT_LIMITS.d), s: "toute l'année",
    v: (extra.v || '').slice(0, TEXT_LIMITS.v), du: '', e: '', pe: 0, perso: true };
  L.m = months(L.s); register(L);
  return L.i;
}
function resolveCommunityStops(p) {
  var ids = [], created = 0, skipped = 0, atlas = 0, before = cSeq;
  p.stops.forEach(function (s) {
    if (s.i != null && byId[s.i] && !byId[s.i].perso) { ids.push(s.i); atlas++; return; }
    if (s.y == null) { skipped++; return; }
    ids.push(communityPlace(s.n, s.y, s.x, { d: 'Étape du circuit « ' + p.title + ' » (Partage)', v: 'Repris de Partage' + (p.author ? ', contribution de ' + p.author : '') + '. Position approximative (environ 1 km) : à vérifier sur place.' }));
  });
  created = cSeq - before;
  return { ids: ids, atlas: atlas, created: created, skipped: skipped };
}

function applyPartageLink(raw) {
  var p = readPartagePayload(raw);
  if (!p) return toast('Ce lien de Partage est illisible : rien n’a été ajouté.', { error: true });
  if (p.kind === 'spot') {
    var s = p.spot;
    var d = modalShell('Ajouter ce lieu à vos lieux ?', '<p><strong>' + esc(s.n) + '</strong> — ' + esc(COMMUNITY_KINDS[s.kind]) + (s.night ? ', lieu où dormir' : '') + '.</p>' +
      '<p class="note">Une copie est créée dans vos lieux personnels, sur cet appareil. La contribution de Partage n’est pas modifiée. Position approximative (environ 1 km)' + (s.verified ? ', vérifiée le ' + esc(s.verified) : '') + ' : à vérifier sur place.</p>' +
      '<div class="dialog-actions"><button class="btn" type="button" data-no>Annuler</button><button class="btn p" type="button" data-yes>Ajouter à mes lieux</button></div>');
    d.querySelector('[data-no]').onclick = function () { d.close(); };
    d.querySelector('[data-yes]').onclick = function () {
      var id = communityPlace(s.n, s.y, s.x, { d: COMMUNITY_KINDS[s.kind] + (s.night ? ' · nuit' : '') + ' · repris de Partage', v: 'Contribution de ' + (p.author || 'la communauté') + ' sur Partage' + (s.verified ? ', vérifiée le ' + s.verified : '') + '. Position approximative (environ 1 km) : à vérifier sur place, ainsi que la réglementation locale.' });
      d.close(); applyFilters(); save(); setMobileView('map'); show(id); flyTo(byId[id], 80); toast('Lieu ajouté à vos lieux personnels');
    };
    return;
  }
  var known = p.stops.filter(function (s) { return s.i != null && byId[s.i] && !byId[s.i].perso; }).length, placed = p.stops.filter(function (s) { return !(s.i != null && byId[s.i] && !byId[s.i].perso) && s.y != null; }).length;
  var lost = p.stops.length - known - placed;
  var copy = p.mode === 'copy';
  var d2 = modalShell(copy ? 'Créer votre circuit à partir de celui-ci ?' : 'Ajouter ce circuit à votre Planner ?', '<p><strong>' + esc(p.title) + '</strong>' + (p.author ? ' — circuit de ' + esc(p.author) + ' sur Partage' : '') + '.</p>' +
    '<ul class="plain"><li>' + known + ' étape(s) reconnue(s) dans l’Atlas</li><li>' + placed + ' étape(s) ajoutée(s) à vos lieux personnels (position approximative)</li>' + (lost ? '<li>' + lost + ' étape(s) sans position, ignorée(s)</li>' : '') + '</ul>' +
    '<p class="note">C’est une copie, sur cet appareil : vous pourrez la modifier librement. Le circuit de Partage n’est pas modifié.' + (route.length && !copy ? ' Les étapes s’ajoutent à la fin de votre trajet actuel (annulable).' : '') + '</p>' +
    '<div class="dialog-actions"><button class="btn" type="button" data-no>Annuler</button>' + (copy ? '' : '<button class="btn" type="button" data-save>Enregistrer comme parcours</button>') +
    '<button class="btn p" type="button" data-yes>' + (copy ? 'Créer mon circuit' : 'Ajouter à mon trajet') + '</button></div>');
  d2.querySelector('[data-no]').onclick = function () { d2.close(); };
  var saveCopy = function () {
    var r = resolveCommunityStops(p);
    if (!r.ids.length) return toast('Aucune étape de ce circuit n’a de position : rien n’a été ajouté.', { error: true });
    ST.saved = ST.saved || [];
    ST.saved.push({ n: (p.title + ' (Partage)').slice(0, 120), d: ('Copie d’un circuit de Partage' + (p.author ? ', proposé par ' + p.author : '')).slice(0, 300), l: r.ids });
    if (!route.length) { snap(); route = r.ids.slice(); }
    applyFilters(); save(); drawPresets(); paint(); tab('p3');
    toast('Circuit copié dans vos parcours : ' + r.ids.length + ' étape(s)' + (r.skipped ? ', ' + r.skipped + ' ignorée(s)' : ''));
    return r;
  };
  if (!copy) d2.querySelector('[data-save]').onclick = function () { d2.close(); saveCopy(); };
  d2.querySelector('[data-yes]').onclick = function () {
    d2.close();
    if (copy) return saveCopy();
    var r = resolveCommunityStops(p);
    if (!r.ids.length) return toast('Aucune étape de ce circuit n’a de position : rien n’a été ajouté.', { error: true });
    snap(); route = route.concat(r.ids); applyFilters(); save(); paint(); tab('p2');
    toast(r.ids.length + ' étape(s) ajoutée(s) au trajet' + (r.skipped ? ', ' + r.skipped + ' ignorée(s)' : '') + ' — Annuler est possible');
  };
}

/* ── Partager son trajet dans Partage (seulement quand le Planner est dans le site) ── */
function partageUrl() {
  var brand = document.querySelector('.brand a');
  if (!brand || document.documentElement.getAttribute('data-site') !== '1') return null;
  try { return new URL('partage/proposer/index.html', new URL(brand.getAttribute('href'), location.href)).href; } catch (e) { return null; }
}
function shareRouteDialog() {
  var target = partageUrl();
  if (!target) return;
  if (route.length < 2) return toast('Un circuit compte au moins deux étapes : composez d’abord votre trajet.');
  if (route.length > 60) return toast('Partage accepte 60 étapes au plus : raccourcissez le trajet.');
  var rows = route.map(function (id, k) {
    var L = byId[id], privateBase = L.c === 'base';
    return '<li><label class="check-row"><input type="checkbox" data-k="' + k + '"' + (privateBase ? ' disabled' : ' checked') + '><span>' + esc(L.n) + ' <small>' + (privateBase ? 'lieu privé : jamais partagé' : L.perso ? 'lieu personnel : position arrondie à environ 1 km' : esc(L.p)) + '</small></span></label></li>';
  }).join('');
  var d = modalShell('Partager ce trajet dans Partage', '<p>Choisissez les étapes à proposer. Seuls leurs noms et leurs positions (arrondies à environ 1 km) seront repris dans le formulaire de Partage ; vos notes, dates, budgets et favoris ne le sont jamais.</p>' +
    '<ol class="share-list">' + rows + '</ol><p class="note">Rien n’est publié à cette étape : le formulaire s’ouvre, vous relisez, et vous confirmez — connecté à votre compte Partage. Votre trajet ici ne change pas.</p>' +
    '<div class="dialog-actions"><button class="btn" type="button" data-no>Annuler</button><button class="btn p" type="button" data-yes>Continuer vers Partage</button></div>');
  d.querySelector('[data-no]').onclick = function () { d.close(); };
  d.querySelector('[data-yes]').onclick = function () {
    var picked = [].filter.call(d.querySelectorAll('input[data-k]'), function (c) { return c.checked && !c.disabled; }).map(function (c) { return byId[route[+c.dataset.k]]; });
    if (picked.length < 2) return toast('Gardez au moins deux étapes.');
    var st = picked.map(function (L) { var o = { n: String(L.n).slice(0, 120), y: Math.round(L.y * 100) / 100, x: Math.round(L.x * 100) / 100 }; if (!L.perso) o.i = L.i; return o; });
    d.close();
    location.href = target + '#depuis-planner=' + toBase64Url({ v: 1, st: st });
  };
}
function initCommunity() {
  var group = document.getElementById('shareGroup');
  if (group && partageUrl()) { group.hidden = false; document.getElementById('shareCommunity').onclick = shareRouteDialog; }
}
