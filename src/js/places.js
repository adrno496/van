/* Lieux : fiche détaillée, aperçu sur petit écran, modification, lieux personnels. */
var sel = null;

/* ── Liens externes : ouverts à la demande, dans un nouvel onglet ── */
function enc(s) { return encodeURIComponent(s); }
function gSearch(q) { return 'https://www.google.com/search?q=' + enc(q); }
function gImg(q) { return 'https://www.google.com/search?tbm=isch&q=' + enc(q); }
function gMapsAt(L) { return 'https://www.google.com/maps/search/?api=1&query=' + enc(L.y + ',' + L.x); }
function gMapsQ(q) { return 'https://www.google.com/maps/search/?api=1&query=' + enc(q); }
function gDir(a, b) { return 'https://www.google.com/maps/dir/?api=1&origin=' + enc(a.y + ',' + a.x) + '&destination=' + enc(b.y + ',' + b.x) + '&travelmode=driving'; }
function gRoute(list) {
  var u = 'https://www.google.com/maps/dir/?api=1&travelmode=driving&origin=' + enc(list[0].y + ',' + list[0].x) + '&destination=' + enc(list[list.length - 1].y + ',' + list[list.length - 1].x);
  if (list.length > 2) u += '&waypoints=' + list.slice(1, -1).map(function (L) { return enc(L.y + ',' + L.x); }).join('%7C');
  return u;
}
function place(L) { return L.n + (L.p && L.p !== 'Perso' ? ', ' + L.p : ''); }
function extLink(href, label, cls) { return '<a' + (cls ? ' class="' + cls + '"' : '') + ' target="_blank" rel="noopener noreferrer" href="' + esc(href) + '">' + esc(label) + '</a>'; }
// Liens directs vérifiés vers un office de tourisme ; tous les autres liens sont des recherches.
var official = { 610: 'https://www.rochefortenterre-tourisme.bzh/', 611: 'https://www.brive-tourisme.com/fr/visites/top-14/collonges-la-rouge/', 640: 'https://www.spain.info/es/destino/cudillero/' };

function visitsNearPlace(L) {
  return PTS.filter(function (p) { return p.i !== L.i && p.c !== 'boulot' && p.c !== 'perso'; }).map(function (p) { return { place: p, km: hav(L, p) }; })
    .filter(function (r) { return r.km <= 50; }).sort(function (a, b) { return a.km - b.km; }).slice(0, 12);
}

/* ── Choisir un lieu ──
   Grand écran : la fiche s'ouvre dans le panneau. Petit écran, depuis la carte : un aperçu se pose
   en bas de la carte, qui reste visible ; « Voir la fiche » ouvre la fiche complète. */
function show(i, options) {
  var L = byId[i];
  if (!L) return;
  sel = i;
  renderPlace(L);
  document.body.classList.add('has-place');
  if (isMobile() && document.body.dataset.mobileView === 'map' && !(options && options.full)) { renderPeek(L); paintSel(); return; }
  hidePeek();
  tab('p1');
  $('#p1').scrollTop = 0;
  paintSel();
}

function placeBadges(L) {
  return '<span class="badge t">' + esc(L.s) + '</span>' + (L.du ? '<span class="badge">' + esc(L.du) + '</span>' : '') +
    (L.pe ? '<span class="badge g">~' + esc(L.pe) + ' € l’entrée</span>' : (L.pe === 0 && L.e ? '<span class="badge g">gratuit ou presque</span>' : '')) +
    (L.q ? '<span class="badge">' + esc(L.q) + '</span>' : '');
}
function renderPlace(L) {
  var i = L.i, M = DATA.meta[L.p], N = ST.notes[i] || {}, pl = place(L), st = statOf(i), nearby = visitsNearPlace(L), source = L.source ? safeURL(L.source) : '';
  var h = '<button class="btn sm quiet back-explore" id="backExplore" type="button" title="Retour à la liste des lieux">' + ic('back') + 'Tous les lieux</button>';

  // En-tête : l'essentiel et une seule action principale.
  h += '<article class="place-head"><div class="meta"><i class="dot ' + esc(L.c) + '"></i>' + esc(CATN[L.c] || L.c) + ' · ' + esc(L.p) + (WN[L.w] ? ' · ' + WN[L.w] : '') + '</div>' +
    '<h2>' + esc(L.n) + (st === 'fav' ? '<span class="mk fav">★ favori</span>' : '') + (st === 'done' ? '<span class="mk done">fait</span>' : '') + '</h2>' +
    '<p class="summary">' + esc(L.t || L.d) + '</p><div class="badges">' + placeBadges(L) + '</div>' +
    '<div class="place-actions"><button class="btn" id="addBtn" type="button">Ajouter au trajet</button>' +
      '<div class="secondary"><button class="btn" id="zoomBtn" type="button">' + ic('map') + 'Voir sur la carte</button><button class="btn" id="writeAtPlace" type="button">' + ic('edit') + 'Raconter l’étape</button></div>' +
      '<div class="place-more"><button class="btn quiet" id="nearBtn" type="button">Lieux à moins de 100 km</button><button class="btn quiet" id="editBtn" type="button">Modifier la fiche</button>' +
      (L.perso ? '<button class="btn quiet danger" id="delBtn" type="button">Supprimer ce lieu</button>' : '') + '</div></div>' +
    '<div class="stg" role="group" aria-label="Mon suivi de ce lieu">' +
      '<button type="button" data-st="" aria-pressed="' + (st === '') + '" class="' + (st === '' ? 'on' : '') + '">À voir</button>' +
      '<button type="button" data-st="fav" aria-pressed="' + (st === 'fav') + '" class="' + (st === 'fav' ? 'on' : '') + '">' + ic('star') + 'Favori</button>' +
      '<button type="button" data-st="done" aria-pressed="' + (st === 'done') + '" class="' + (st === 'done' ? 'on' : '') + '">' + ic('check') + 'Fait</button></div>' +
    (official[i] ? '<p class="place-links">' + extLink(official[i], 'Office de tourisme ↗') + '</p>' : '') +
    (source ? '<p class="place-links">' + extLink(source, 'Source du lieu ↗') + ' · Coordonnées de repérage, pas une entrée ni un parking.</p>' :
      L.coordinateNote ? '<p class="place-links">Coordonnées de repérage, pas une entrée ni un parking.</p>' : '') +
    '</article>';

  // À voir sur place
  h += '<section class="place-section"><h3 class="meta"><span>À voir sur place</span>' + (L.du ? '<span class="badge">' + esc(L.du) + '</span>' : '') + '</h3>';
  if (L.v) h += '<ul class="vlist">' + String(L.v).split(' · ').map(function (x) {
    x = x.trim();
    return '<li>' + esc(x) + '<span class="vlinks">' + extLink(gMapsQ(x + ' ' + pl), 'Carte ↗') + extLink(gSearch(x + ' ' + pl + ' site officiel horaires billets'), 'Infos et billets ↗') + '</span></li>';
  }).join('') + '</ul>';
  h += '<div class="lk row"><a class="g" id="googleAroundPlace" target="_blank" rel="noopener noreferrer" href="' + esc(gSearch('que voir visiter aux alentours de ' + L.n + ' ' + L.p + ' monuments nature villages insolites')) +
    '" aria-label="Chercher quoi voir autour de ' + esc(L.n) + ' sur Google, nouvel onglet">Chercher aux alentours ↗</a></div>';
  if (L.visitSources && L.visitSources.length) h += '<details class="visit-sources"><summary>Sources des idées de visite</summary><ul>' + L.visitSources.filter(safeURL).map(function (url) {
    return '<li>' + extLink(safeURL(url), new URL(url).hostname.replace(/^www\./, '') + ' ↗') + '</li>';
  }).join('') + '</ul></details>';
  h += '</section>';

  if (L.e) h += '<section class="place-section"><h3 class="meta">Tarifs indicatifs</h3><p>' + esc(L.e) + '</p><div class="lk">' +
    extLink(gSearch(L.n + ' ' + L.p + ' horaires tarifs billets site officiel'), 'Horaires et billets', 'g') + extLink(gSearch('réserver billet ' + L.n + ' ' + L.p), 'Réserver') + '</div></section>';

  // Mes notes : ce que j'ajoute moi-même à la fiche
  h += '<section class="place-section"><h3 class="meta">Mes notes</h3>' +
    '<div class="fld"><label for="nTxt">Ma note</label><textarea id="nTxt" maxlength="20000" placeholder="Où je me suis garé, ce qu’il faut refaire, le resto à retenir…">' + esc(N.txt || '') + '</textarea></div>' +
    '<div class="fld2"><div class="fld"><label for="nBud">Mon budget sur place (€)</label><input id="nBud" type="number" inputmode="decimal" min="0" step="5" value="' + esc(N.bud || '') + '"></div>' +
    '<div class="fld"><label for="nDate">Ma date de passage</label><input id="nDate" type="date" value="' + esc(N.date || '') + '"></div></div></section>';

  // Dans les environs : lieux du catalogue à moins de 50 km
  if (nearby.length) h += '<section class="place-section visits-nearby"><h3 class="meta">Dans les environs</h3><p class="note">Lieux du catalogue à moins de 50 km, à vol d’oiseau.</p><div class="visit-near-list"></div>' +
    (nearby.length > 6 ? '<button class="btn sm visit-near-more" type="button">Voir plus de lieux proches</button>' : '') + '</section>';

  // Liens pratiques
  h += '<section class="place-section"><div class="link-group"><h3 class="meta">Chercher sur place</h3><div class="lk">' +
    extLink(gMapsAt(L), 'Google Maps', 'g') + extLink(gMapsQ('restaurants ' + pl), 'Restaurants', 'g') + extLink(gMapsQ('bars cafés ' + pl), 'Bars et cafés') +
    extLink(gSearch('que voir à ' + pl + ' incontournables'), 'Que voir') + extLink(gSearch('meilleurs spots photo ' + pl), 'Spots photo') + extLink(gImg(pl), 'Photos') +
    extLink(gSearch('météo ' + pl + ' 15 jours'), 'Météo') + extLink('https://fr.wikipedia.org/w/index.php?search=' + enc(L.n), 'Wikipédia') + '</div></div>' +
    '<div class="link-group"><h3 class="meta">Logistique van</h3><div class="lk">' +
    extLink(gMapsQ('aire camping-car ' + pl), 'Aires', 'g') + extLink(gSearch('park4night ' + pl), 'Park4Night') + extLink(gMapsQ('camping ' + pl), 'Campings') + extLink(gMapsQ('parking gratuit ' + pl), 'Parking') +
    extLink(gMapsQ('station service ' + pl), 'Carburant') + extLink(gMapsQ('supermarché ' + pl), 'Courses') + extLink(gMapsQ('laverie automatique ' + pl), 'Laverie') + extLink(gMapsQ('garage réparation ' + pl), 'Garage') + '</div></div>' +
    (L.c === 'boulot' ? '<div class="link-group"><h3 class="meta">Trouver le contrat</h3><div class="lk">' + extLink(gSearch('emploi saisonnier ' + L.n + ' recrutement ' + L.p), 'Offres', 'g') +
      extLink(gSearch('agence intérim ' + L.n), 'Agences') + extLink(gMapsQ('agence intérim ' + pl), 'Sur la carte') + '</div></div>' : '') + '</section>';

  if (M) h += '<section class="place-section"><h3 class="meta">' + esc(L.p) + ' — pratique</h3><p><strong>Gazole</strong> ~' + esc(M.g.toFixed(2)) + ' €/L<br><strong>Route</strong> ' + esc(M.v) + '<br><strong>Bivouac</strong> ' + esc(M.b) + '</p><div class="lk">' +
    extLink(gSearch('réglementation bivouac camping-car ' + L.p + ' ' + new Date().getFullYear()), 'Règles à jour') + extLink(gSearch('prix carburant ' + L.p + ' aujourd’hui'), 'Prix carburant') +
    extLink(gSearch('péages vignette ' + L.p + ' camping-car tarif'), 'Péages') + '</div></section>';

  var detail = $('#detail');
  detail.innerHTML = h;
  syncAddButtons();
  $('#addBtn').onclick = function () { toggleInRoute(i); };
  $('#zoomBtn').onclick = function () { setMobileView('map'); flyTo(L, 60); };
  $('#nearBtn').onclick = function () { near(L); };
  $('#editBtn').onclick = function () { edit(L); };
  $('#writeAtPlace').onclick = function () { openJournalEditor(null, i); };
  $('#backExplore').onclick = function () { document.body.classList.remove('has-place'); renderDiscovery(); $('#p1').scrollTop = 0; };
  if (L.perso) $('#delBtn').onclick = function () {
    askConfirm({ title: 'Supprimer ce lieu ?', text: '« ' + L.n + ' » sera retiré de la carte, du trajet et des parcours enregistrés.', ok: 'Supprimer', danger: true }).then(function (yes) { if (yes) delCustom(L.i); });
  };
  detail.querySelectorAll('.stg button').forEach(function (b) { b.onclick = function () { nt(i).st = b.dataset.st; save(); markStat(L); applyFilters(); show(i, { full: true }); }; });
  $('#nTxt').onchange = function () { nt(i).txt = this.value.trim(); save(); toast('Note enregistrée'); };
  $('#nBud').onchange = function () { nt(i).bud = Math.max(0, +this.value || 0); save(); paint(); };
  $('#nDate').onchange = function () { nt(i).date = this.value; save(); };
  var section = detail.querySelector('.visits-nearby');
  if (section) {
    var limit = 6;
    var draw = function () {
      section.querySelector('.visit-near-list').innerHTML = nearby.slice(0, limit).map(function (r) {
        return '<div class="visit-near-row"><button class="place-open" type="button" data-visit-near="' + esc(r.place.i) + '">' + esc(r.place.n) + '</button><small>' + esc(CATN[r.place.c] || r.place.c) + ' · ' + r.km.toFixed(1).replace('.', ',') + ' km</small><p>' + esc(r.place.d) + '</p></div>';
      }).join('');
    };
    draw();
    section.onclick = function (e) {
      var b = e.target.closest('[data-visit-near]');
      if (b) return show(idValue(b.dataset.visitNear), { full: true });
      if (e.target.closest('.visit-near-more')) { limit = 12; draw(); section.querySelector('.visit-near-more').remove(); }
    };
  }
}

/* Bouton « Ajouter au trajet / Retirer du trajet » : toujours fidèle à l'état du trajet. */
function toggleInRoute(i) { var k = route.indexOf(i); if (k >= 0) removeAt(k); else addTo(i); }
function syncAddButtons() {
  if (sel == null || !byId[sel]) return;
  var inRoute = route.indexOf(sel) >= 0;
  ['#addBtn', '#peekAdd'].forEach(function (s) {
    var b = $(s); if (!b) return;
    b.classList.toggle('p', !inRoute);
    b.innerHTML = inRoute ? 'Retirer du trajet' : ic('plus') + 'Ajouter au trajet';
  });
}

/* ── Aperçu sur la carte (petit écran) ── */
function renderPeek(L) {
  var peek = $('#peek');
  peek.innerHTML = '<button class="icon-btn peek-close" id="peekClose" type="button" aria-label="Fermer l’aperçu">' + ic('x') + '</button>' +
    '<div class="meta"><i class="dot ' + esc(L.c) + '"></i>' + esc(CATN[L.c] || L.c) + ' · ' + esc(L.p) + '</div><h2>' + esc(L.n) + '</h2><p>' + esc(L.t || L.d) + '</p>' +
    '<div class="row"><button class="btn" id="peekAdd" type="button">Ajouter au trajet</button><button class="btn" id="peekOpen" type="button">Voir la fiche</button></div>';
  peek.hidden = false; document.body.classList.add('has-peek');
  syncAddButtons();
  $('#peekAdd').onclick = function () { toggleInRoute(L.i); };
  $('#peekOpen').onclick = function () { show(L.i, { full: true }); };
  $('#peekClose').onclick = function () { hidePeek(); sel = null; paintSel(); rescale(); };
}
function hidePeek() { var peek = $('#peek'); if (peek.hidden) return; peek.hidden = true; peek.innerHTML = ''; document.body.classList.remove('has-peek'); }

/* ── Modifier une fiche ── */
function edit(L) {
  var pays = Object.keys(DATA.meta).concat(['Perso']).sort();
  if (pays.indexOf(L.p) < 0) pays.push(L.p);
  if ($('#ed')) $('#ed').remove();
  var field = function (id, label, value, attrs) { return '<div class="fld"><label for="' + id + '">' + label + '</label><input id="' + id + '" value="' + esc(value) + '"' + (attrs || '') + '></div>'; };
  $('#backExplore').insertAdjacentHTML('afterend', '<form class="card" id="ed" novalidate><h3 class="meta">Modifier la fiche</h3>' +
    field('eN', 'Nom', L.n, ' maxlength="200" required') +
    '<div class="fld2"><div class="fld"><label for="eC">Catégorie</label><select id="eC">' + Object.keys(CATN).map(function (c) { return '<option value="' + c + '"' + (c === L.c ? ' selected' : '') + '>' + esc(CATN[c]) + '</option>'; }).join('') + '</select></div>' +
    '<div class="fld"><label for="eP">Pays</label><select id="eP">' + pays.map(function (p) { return '<option value="' + esc(p) + '"' + (p === L.p ? ' selected' : '') + '>' + esc(p) + '</option>'; }).join('') + '</select></div></div>' +
    '<div class="fld2"><div class="fld"><label for="eW">Importance</label><select id="eW">' + [1, 2, 3].map(function (w) { return '<option value="' + w + '"' + (w === L.w ? ' selected' : '') + '>' + WN[w] + '</option>'; }).join('') + '</select></div>' +
    field('eDu', 'Durée conseillée', L.du || '', ' maxlength="60" placeholder="½ j, 2 j…"') + '</div>' +
    field('eD', 'Résumé court', L.d, ' maxlength="500"') +
    field('eS', 'Saison (ex. : mai-sept, ou « toute l’année »)', L.s, ' maxlength="100"') +
    '<div class="fld"><label for="eV">À voir sur place — séparer les points par «  ·  »</label><textarea id="eV" maxlength="6000">' + esc(L.v || '') + '</textarea></div>' +
    '<div class="fld"><label for="eE">Tarifs</label><textarea id="eE" maxlength="3000">' + esc(L.e || '') + '</textarea></div>' +
    '<div class="fld2">' + field('ePe', 'Entrée € (budget)', L.pe || 0, ' type="number" inputmode="decimal" min="0" step="1"') + field('eT', 'Détail long (facultatif)', L.t || '', ' maxlength="1000"') + '</div>' +
    '<div class="fld2">' + field('eY', 'Latitude', L.y, ' type="number" inputmode="decimal" step="0.0001"') + field('eX', 'Longitude', L.x, ' type="number" inputmode="decimal" step="0.0001"') + '</div>' +
    '<p class="field-error" id="edError" role="alert" hidden></p>' +
    '<div class="row"><button class="btn p" id="eOk" type="submit">Enregistrer</button><button class="btn" id="eCancel" type="button">Annuler</button>' +
    (ST.edits[L.i] ? '<button class="btn quiet" id="eReset" type="button">Rétablir l’original</button>' : '') + '</div></form>');
  $('#p1').scrollTop = 0;
  $('#eCancel').onclick = function () { show(L.i, { full: true }); };
  if ($('#eReset')) $('#eReset').onclick = function () { delete ST.edits[L.i]; writeState(); location.reload(); };
  $('#ed').onsubmit = function (e) {
    e.preventDefault();
    var lat = Number($('#eY').value), lon = Number($('#eX').value);
    if (!$('#eN').value.trim() || !$('#eY').value.trim() || !$('#eX').value.trim() || !Number.isFinite(lat) || !Number.isFinite(lon) || lat <= -85 || lat >= 85 || Math.abs(lon) > 180) {
      var message = 'Vérifiez le nom et les coordonnées : latitude entre −85 et 85, longitude entre −180 et 180.';
      $('#edError').textContent = message; $('#edError').hidden = false; toast(message, { error: true });
      return;
    }
    var moved = L.y !== lat || L.x !== lon;
    L.n = $('#eN').value.trim(); L.c = CATN[$('#eC').value] ? $('#eC').value : L.c; L.p = $('#eP').value; L.w = +$('#eW').value;
    L.d = $('#eD').value.trim(); L.s = $('#eS').value.trim() || "toute l'année"; L.du = $('#eDu').value.trim();
    L.v = $('#eV').value.trim(); L.e = $('#eE').value.trim(); L.pe = Math.max(0, +$('#ePe').value || 0);
    var longText = $('#eT').value.trim(); if (longText) L.t = longText; else delete L.t;
    L.y = lat; L.x = lon; L.m = months(L.s); L._k = null; listOrder = null;
    if (!L.perso) { var d = {}; ['n', 'c', 'p', 'w', 'd', 's', 'du', 'v', 'e', 'pe', 'y', 'x'].forEach(function (k) { d[k] = L[k]; }); d.t = L.t || ''; ST.edits[L.i] = d; }
    redrawMarker(L);
    save(); applyFilters(); paint(); show(L.i, { full: true }); toast('Fiche mise à jour');
  };
}

function near(L) {
  var list = PTS.map(function (o) { return [hav(L, o), o]; }).filter(function (a) { return a[0] > .5 && a[0] < 100; }).sort(function (a, b) { return a[0] - b[0]; }).slice(0, 16);
  if ($('#nearList')) $('#nearList').remove();
  $('#detail').insertAdjacentHTML('beforeend', '<section class="place-section" id="nearList"><h3 class="meta">Lieux à moins de 100 km</h3>' + (list.length ? list.map(function (a) {
    return '<div class="item plain"><span class="n">' + Math.round(a[0]) + '</span><div class="t"><button class="step-name" type="button" data-go="' + esc(a[1].i) + '"><i class="dot ' + esc(a[1].c) + '"></i>' + esc(a[1].n) + '</button><em>' + esc(a[1].d) + '</em></div>' +
      '<div class="a"><button type="button" data-add="' + esc(a[1].i) + '" aria-label="Ajouter ' + esc(a[1].n) + ' au trajet" title="Ajouter au trajet">' + ic('plus') + '</button></div></div>';
  }).join('') : '<div class="empty">Aucun autre lieu à moins de 100 km.</div>') + '</section>');
  $('#nearList').scrollIntoView({ block: 'start' });
}

/* ── Lieux personnels ── */
var addMode = false, cSeq = 0, quick = false;
// Bandeau sur la carte tant qu'un mode de saisie est actif : on sait toujours ce qu'un toucher va faire.
function mapModeHint() {
  var hint = $('#mapHint');
  if (!addMode && !quick) { if (hint) hint.remove(); return; }
  if (!hint) { wrap.insertAdjacentHTML('beforeend', '<div class="map-hint" id="mapHint" role="status"><span></span><button class="btn sm" type="button">Arrêter</button></div>'); hint = $('#mapHint'); }
  hint.querySelector('span').textContent = addMode ? 'Touchez la carte pour placer votre lieu.' : 'Ajout rapide : chaque lieu touché rejoint le trajet.';
  hint.querySelector('button').onclick = function () { if (addMode) setAddMode(false); else setQuick(false); };
}
function setAddMode(on) { addMode = !!on; $('#addPt').setAttribute('aria-pressed', String(addMode)); svg.classList.toggle('addmode', addMode); if (addMode && quick) setQuick(false); mapModeHint(); }
function setQuick(on) { quick = !!on; $('#quick').setAttribute('aria-pressed', String(quick)); if (quick && addMode) setAddMode(false); mapModeHint(); }
function placeCustom(cx, cy) {
  var w = toWorld(cx, cy), ll = invP(w[0], w[1]);
  if (!validCoords(ll[0], ll[1])) return toast('Ce point est hors de la carte.', { error: true });
  var L = { i: 'c' + (++cSeq), n: 'Mon lieu ' + cSeq, y: +ll[1].toFixed(4), x: +ll[0].toFixed(4), p: 'Perso', c: 'perso', w: 1, d: 'Lieu personnel', s: "toute l'année", v: '', du: '', e: '', pe: 0, perso: true };
  L.m = months(L.s); register(L); setAddMode(false); applyFilters(); save();
  show(L.i, { full: true }); edit(L);
  toast('Lieu créé : complétez sa fiche');
}
function delCustom(i) {
  var without = function (list) { return list.filter(function (id) { return id !== i; }); };
  route = without(route); hist = hist.map(without); future = future.map(without);
  (ST.saved || []).forEach(function (p) { p.l = without(p.l); });
  unregister(i); delete ST.notes[i];
  sel = null; hidePeek();
  $('#detail').innerHTML = '';
  document.body.classList.remove('has-place');
  save(); paint(); applyFilters(); drawPresets(); toast('Lieu supprimé');
}
