/* Explorer : filtres de la carte, liste des lieux, recherche principale. */
var offCat = {}, offW = {}, paysF = '', moisF = 0, onlyFav = false, hideDone = false, onlyNote = false;
var nearRouteOnly = false, nearRouteKm = 25;
var discoverNew = false, discoverVisible = false, discoveryLimit = 24;
// « Nouveautés » : les lieux du lot le plus récent du catalogue (v9, v10…), calculé une fois.
var NEWEST_BATCH = DATA.lieux.reduce(function (best, L) { return L.batch && (!best || +L.batch.slice(1) > +best.slice(1)) ? L.batch : best; }, '');

/* ── Filtres : une seule passe sur les 1 600 lieux, puis la carte et la liste sont mises à jour une fois ── */
function activeFilterCount() {
  return Object.keys(offCat).filter(function (k) { return offCat[k]; }).length + Object.keys(offW).filter(function (k) { return offW[k]; }).length +
    (paysF ? 1 : 0) + (moisF ? 1 : 0) + (onlyFav ? 1 : 0) + (hideDone ? 1 : 0) + (onlyNote ? 1 : 0) + (nearRouteOnly ? 1 : 0);
}
function applyFilters() {
  var shown = 0, around = aroundActive && geoPosition;
  PTS.forEach(function (L) {
    var st = statOf(L.i), fixed = L.c === 'base' || L.c === 'perso';   // bases et lieux personnels : toujours visibles
    var hide = (offCat[L.c] && !fixed) || (offW[L.w] && !fixed) || (paysF && L.p !== paysF && L.c !== 'base') || (onlyFav && st !== 'fav') || (hideDone && st === 'done') || (onlyNote && !hasNote(L.i));
    var dim = !hide && moisF && L.m.indexOf(moisF) < 0 && !fixed;
    if (!hide && around && hav(L, geoPosition) > aroundKm) hide = true;
    if (!hide && nearRouteOnly && route.indexOf(L.i) < 0 && distanceFromRoute(L) > nearRouteKm) hide = true;
    L._off = !!hide; L._dim = !!dim; syncMarker(L);
    if (!hide && !dim) shown++;
  });
  var active = activeFilterCount();
  $('#counter').textContent = fmt(shown) + ' lieux affichés sur ' + fmt(PTS.length) + (moisF ? ' · en ' + MFULL[moisF - 1] : '');
  $('#mapFiltersLabel').textContent = 'Filtres' + (active ? ' · ' + active : '');
  $('#mapFiltersButton').classList.toggle('on', active > 0);
  $('#searchAround').classList.toggle('on', !!aroundActive);
  $('#searchAroundLabel').textContent = aroundActive ? 'Près de moi · ' + aroundKm + ' km' : 'Près de moi';
  renderDiscovery();
  rescale();
}
function resetFilters() {
  offCat = {}; offW = {}; paysF = ''; moisF = 0; onlyFav = false; hideDone = false; onlyNote = false; nearRouteOnly = false; aroundActive = false; discoverNew = false; discoverVisible = false;
  $('#discoverQuery').value = ''; $('#paysSel').value = ''; $('#mSlider').value = '0'; $('#mLabel').textContent = 'Tous les mois'; $('#nearRouteOnly').checked = false;
  $$('[data-cat],[data-w]').forEach(function (b) { setPressed(b, true); });
  ['fOnlyFav', 'fHideDone', 'fOnlyNote', 'onlyNew', 'visiblePlaces'].forEach(function (id) { setPressed($('#' + id), false); });
  discoveryLimit = 24;
  applyFilters();
}

/* ── Liste des lieux à explorer : la version accessible de la carte ── */
// L'ordre de la liste (travail saisonnier en dernier, puis importance, puis nom) ne dépend pas des filtres :
// il est calculé une fois, et refait seulement quand un lieu est ajouté, retiré ou modifié (listOrder = null).
var listOrder = null, frCompare = new Intl.Collator('fr').compare;
function placesInListOrder() {
  if (!listOrder) listOrder = PTS.slice().sort(function (a, b) { return (a.c === 'boulot' ? 1 : 0) - (b.c === 'boulot' ? 1 : 0) || a.w - b.w || frCompare(a.n, b.n); });
  return listOrder;
}
function discoverMatches() {
  var query = noac($('#discoverQuery').value.trim());
  return placesInListOrder().filter(function (p) {
    return !p._off && !p._dim && (!discoverNew || p.batch === NEWEST_BATCH) &&
      (!discoverVisible || (p.px >= vb[0] && p.px <= vb[0] + vb[2] && p.py >= vb[1] && p.py <= vb[1] + vb[3])) &&
      (!query || searchKeys(p).all.includes(query));
  });
}
var listsReady = false;   // la liste se remplit après la carte, au démarrage
function renderDiscovery() {
  if (!listsReady) return;
  var places = discoverMatches();
  $('#discoveryCount').textContent = fmt(places.length) + (places.length > 1 ? ' lieux' : ' lieu') + (discoverVisible ? ' dans la vue actuelle de la carte' : ' à explorer');
  $('#discoverList').innerHTML = places.slice(0, discoveryLimit).map(function (p) {
    return '<article class="discover-card"><small><i class="dot ' + esc(p.c) + '"></i>' + esc(CATN[p.c] || p.c) + ' · ' + esc(p.p) + '</small><button class="place-open" type="button" data-discover="' + esc(p.i) + '">' + esc(p.n) + '</button><p>' + esc(p.d) + '</p>' +
      '<div class="row"><button class="btn sm" type="button" data-discover-add="' + esc(p.i) + '" aria-label="Ajouter ' + esc(p.n) + ' au trajet">' + ic('plus') + 'Au trajet</button></div></article>';
  }).join('') || '<div class="empty"><h3>Aucun lieu ne correspond</h3><p>Essayez un autre mot, ou retirez des filtres.</p><button class="btn" type="button" data-reset-filters>Tout afficher</button></div>';
  $('#discoverMore').hidden = places.length <= discoveryLimit;
}

/* ── Recherche principale : nom, pays, résumé, puis contenu des fiches ── */
function runSearch() {
  var q = $('#q'), res = $('#res'), v = noac(q.value.trim());
  if (v.length < 2) return closeSearch();
  var hits = PTS.map(function (L) {
    var score = -1, k = searchKeys(L);
    if (k.n.indexOf(v) >= 0) score = 0; else if (k.p.indexOf(v) >= 0) score = 1; else if (k.d.indexOf(v) >= 0) score = 2;
    else if (k.v.indexOf(v) >= 0) score = 3; else if (k.e.indexOf(v) >= 0) score = 4;
    return score < 0 ? null : [score, L];
  }).filter(Boolean).sort(function (a, b) { return a[0] - b[0] || a[1].w - b[1].w; }).slice(0, 20);
  res.innerHTML = hits.length ? hits.map(function (a) {
    var L = a[1];
    return '<div data-s="' + esc(L.i) + '" role="option" tabindex="0" aria-selected="false"><i class="dot ' + esc(L.c) + '"></i><span class="res-name">' + esc(L.n) + (a[0] >= 3 ? ' <span class="res-hint">· dans la fiche</span>' : '') + '</span><small>' + esc(L.p) + '</small></div>';
  }).join('') : '<div class="res-empty" role="option" aria-selected="false" aria-disabled="true">Aucun résultat pour « ' + esc(q.value.trim()) + ' »</div>';
  res.classList.add('on'); q.setAttribute('aria-expanded', 'true'); q.setAttribute('aria-controls', 'res');
}
function setToolsMenu(open) {
  var b = $('#mapToolsButton'); $('#mapToolsMenu').hidden = !open; b.setAttribute('aria-expanded', String(!!open));
  if (open) b.setAttribute('aria-controls', 'mapToolsMenu'); else b.removeAttribute('aria-controls');
}
function closeSearch() { var q = $('#q'); $('#res').classList.remove('on'); q.setAttribute('aria-expanded', 'false'); q.removeAttribute('aria-controls'); }

function wireExplore() {
  // Catégories : les pastilles de la carte et celles du dialogue pilotent le même état.
  $$('[data-cat]').forEach(function (b) {
    b.onclick = function () { var c = b.dataset.cat; offCat[c] = !offCat[c]; $$('[data-cat="' + c + '"]').forEach(function (x) { setPressed(x, !offCat[c]); }); applyFilters(); };
  });
  $$('[data-w]').forEach(function (b) { b.onclick = function () { offW[b.dataset.w] = !offW[b.dataset.w]; setPressed(b, !offW[b.dataset.w]); applyFilters(); }; });
  var sp = $('#paysSel'), countries = [];
  DATA.lieux.forEach(function (L) { if (countries.indexOf(L.p) < 0) countries.push(L.p); });
  countries.sort(function (a, b) { return a.localeCompare(b, 'fr'); }).forEach(function (p) { var o = document.createElement('option'); o.value = p; o.textContent = p; sp.appendChild(o); });
  sp.onchange = function () { paysF = sp.value; applyFilters(); if (paysF) fitPts(PTS.filter(function (L) { return L.p === paysF; }), .18); };
  $('#mSlider').oninput = function () {
    moisF = +this.value;
    $('#mLabel').textContent = moisF ? MFULL[moisF - 1].charAt(0).toUpperCase() + MFULL[moisF - 1].slice(1) : 'Tous les mois';
    this.setAttribute('aria-valuetext', $('#mLabel').textContent);
    applyFilters();
  };
  $('#fOnlyFav').onclick = function () { onlyFav = !onlyFav; setPressed(this, onlyFav); applyFilters(); };
  $('#fHideDone').onclick = function () { hideDone = !hideDone; setPressed(this, hideDone); applyFilters(); };
  $('#fOnlyNote').onclick = function () { onlyNote = !onlyNote; setPressed(this, onlyNote); applyFilters(); };
  $('#lbl').onclick = function () { showLabels = !showLabels; setPressed(this, showLabels); rescale(); };
  $('#allbl').onclick = function () { allLabels = !allLabels; setPressed(this, allLabels); rescale(); };
  $('#cLbl').onclick = function () { showCountry = !showCountry; setPressed(this, showCountry); rescale(); };
  $('#nearRouteOnly').onchange = function () {
    if (this.checked && !route.length) { this.checked = false; return toast('Composez d’abord un trajet, ou choisissez une idée de parcours.'); }
    nearRouteOnly = this.checked; applyFilters();
  };
  $('#nearRouteKm').onchange = function () { nearRouteKm = Number(this.value) || 25; applyFilters(); };
  $('#resetMapFilters').onclick = resetFilters;
  $('#clearExplore').onclick = resetFilters;

  // Liste des lieux
  $('#discoverQuery').oninput = function () { discoveryLimit = 24; renderDiscovery(); };
  $('#discoverMore').onclick = function () { discoveryLimit += 24; renderDiscovery(); };
  $('#onlyNew').onclick = function () { discoverNew = !discoverNew; setPressed(this, discoverNew); discoveryLimit = 24; renderDiscovery(); };
  $('#visiblePlaces').onclick = function () { discoverVisible = !discoverVisible; setPressed(this, discoverVisible); discoveryLimit = 24; renderDiscovery(); };
  $('#discoverList').onclick = function (e) {
    var b = e.target.closest('[data-discover]'); if (b) return show(idValue(b.dataset.discover), { full: true });
    b = e.target.closest('[data-discover-add]'); if (b) return addTo(idValue(b.dataset.discoverAdd));
    if (e.target.closest('[data-reset-filters]')) resetFilters();
  };
  $('#createCustom').onclick = function () { setMobileView('map'); setAddMode(true); };
  $('#mapToolsButton').onclick = function () { setToolsMenu($('#mapToolsMenu').hidden); };
  $('#addPt').onclick = function () { setToolsMenu(false); setAddMode(!addMode); };
  $('#quick').onclick = function () { setToolsMenu(false); setQuick(!quick); };
  $('#mapExplore').onclick = function () { document.body.classList.remove('has-place'); hidePeek(); renderDiscovery(); tab('p1'); };

  // Recherche principale : souris, toucher et clavier (flèches, Entrée, Échap).
  var q = $('#q'), res = $('#res');
  q.addEventListener('input', runSearch);
  q.addEventListener('focus', function () { if (q.value.trim().length >= 2) runSearch(); });
  var pick = function (node) {
    var id = idValue(node.dataset.s); if (!byId[id]) return;
    closeSearch(); q.value = '';
    if (isMobile()) { document.body.classList.remove('preset-preview'); setMobileView('map'); }
    show(id); flyTo(byId[id], 80);
  };
  res.addEventListener('click', function (e) { var d = e.target.closest('[data-s]'); if (d) pick(d); });
  res.addEventListener('keydown', function (e) {
    var node = e.target.closest('[data-s]'); if (!node) return;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(node); }
    if (e.key === 'ArrowDown') { e.preventDefault(); if (node.nextElementSibling) node.nextElementSibling.focus(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); if (node.previousElementSibling) node.previousElementSibling.focus(); else q.focus(); }
    if (e.key === 'Escape') { closeSearch(); q.focus(); }
  });
  q.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown') { var first = res.querySelector('[data-s]'); if (first) { first.focus(); e.preventDefault(); } }
    if (e.key === 'Enter') { var only = res.querySelector('[data-s]'); if (only && res.classList.contains('on')) { e.preventDefault(); pick(only); } }
    if (e.key === 'Escape') closeSearch();
  });
  document.addEventListener('click', function (e) { if (!e.target.closest('.search')) closeSearch(); });
  // Le menu d'outils de la carte se referme quand on clique ailleurs ou avec Échap.
  document.addEventListener('click', function (e) { if (!$('#mapToolsMenu').hidden && !e.target.closest('#mapTools')) setToolsMenu(false); });
  $('#mapTools').addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$('#mapToolsMenu').hidden) { setToolsMenu(false); $('#mapToolsButton').focus(); } });
}
