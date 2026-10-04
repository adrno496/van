/* Trajet : étapes, calculs, annulation, exports, imports, parcours prêts et enregistrés. */
var route = [], hist = [], future = [], insertion = 'end';

/* ── Opérations sur les étapes (chacune peut être annulée) ── */
function snap() { future = []; hist.push(route.slice()); if (hist.length > 60) hist.shift(); }
function undo() { if (!hist.length) return; future.push(route.slice()); route = hist.pop(); paint(); toast('Annulé'); }
function redo() { if (!future.length) return; hist.push(route.slice()); route = future.pop(); paint(); toast('Rétabli'); }
function addTo(i) {
  if (!byId[i]) return;
  if (route.indexOf(i) < 0) { snap(); route.push(i); paint(); toast('Ajouté au trajet : ' + byId[i].n); }
  else toast('Déjà dans le trajet');
}
function removeAt(k) { if (k < 0 || k >= route.length) return; snap(); route.splice(k, 1); paint(); }
function move(k, d) { var j = k + d; if (j < 0 || j >= route.length) return; snap(); var t = route[k]; route[k] = route[j]; route[j] = t; paint(); }
function relocate(k, j) { if (k === j) return; snap(); route.splice(j, 0, route.splice(k, 1)[0]); paint(); }

/* ── Calculs ── */
function legKm(a, b) { return hav(a, b) * 1.25; }          // vol d'oiseau majoré de 25 % : estimation de la route
function totalKm() { var s = 0; for (var k = 1; k < route.length; k++) s += legKm(byId[route[k - 1]], byId[route[k]]); return s; }
function prKm(l) { var s = 0; for (var k = 1; k < l.length; k++) { var a = byId[l[k - 1]], b = byId[l[k]]; if (a && b) s += legKm(a, b); } return Math.round(s); }
function fuelPrice(p) { return (DATA.meta[p] && DATA.meta[p].g) || 2.0; }
function numericOption(id, fallback, min, max) { var v = $('#' + id).value, n = v === '' ? fallback : Number(v); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback; }
function opts() {
  return { conso: numericOption('oConso', 9, 0, 100), ryt: numericOption('oRythme', 250, 1, 20000), nuits: numericOption('oNuits', 2, 0, 365), vie: numericOption('oJour', 26, 0, 100000),
    nuit: numericOption('oNuit', 8, 0, 100000), vis: numericOption('oVis', 100, 0, 200) / 100, pax: numericOption('oPax', 1, 1, 100) };
}
function distanceFromRoute(p) {
  if (!route.length) return Infinity;
  if (route.length === 1) return hav(p, byId[route[0]]);
  var min = Infinity;
  for (var i = 1; i < route.length; i++) min = Math.min(min, segmentDistanceKm(p, byId[route[i - 1]], byId[route[i]]));
  return min;
}

/* ── Affichage du trajet : tracé, numéros, liste, chiffres ── */
function stepButton(action, k, icon, label, disabled) {
  return '<button type="button" data-' + action + '="' + k + '" title="' + label + '" aria-label="' + label + '"' + (disabled ? ' disabled' : '') + '>' + ic(icon) + '</button>';
}
function paint() {
  $('#cnt').textContent = route.length;
  $('#navCnt').textContent = route.length; $('#navCnt').hidden = !route.length;
  var pts = route.map(function (i) { return byId[i]; });
  var d = pts.length > 1 ? 'M' + pts.map(function (L) { return L.px.toFixed(1) + ',' + L.py.toFixed(1); }).join('L') : '';
  routePath.setAttribute('d', d); routeShadow.setAttribute('d', d);
  gN.textContent = ''; routeDots = []; routeNums = [];
  pts.forEach(function (L, k) {
    var g = el('g', {}), c = el('circle', { 'class': 'rbg', cx: L.px, cy: L.py, r: 8 }), t = el('text', { 'class': 'rnum', x: L.px, y: L.py });
    t.textContent = k + 1; g.appendChild(c); g.appendChild(t); gN.appendChild(g); routeDots.push(c); routeNums.push(t);
  });
  var o = opts(), cum = 0, dep = validDay($('#oDate').value) ? new Date($('#oDate').value) : null, list = $('#list');
  if (!route.length) list.innerHTML = '<div class="empty"><h3>Votre trajet est vide</h3><p>Ajoutez une étape avec le champ ci-dessus, depuis la fiche d’un lieu, ou partez d’une idée de parcours.</p><button class="btn" type="button" data-open-ideas>Voir les idées de parcours</button></div>';
  else list.innerHTML = route.map(function (id, k) {
    var it = byId[id], km = k ? legKm(byId[route[k - 1]], it) : 0;
    cum += (k ? km / o.ryt * 7 : 0);
    var dt = dep ? new Date(dep.getTime() + cum * 864e5) : null, mo = dt ? dt.getMonth() + 1 : 0;
    var off = dt && it.m.indexOf(mo) < 0, label = (k + 1) + ', ' + esc(it.n);
    cum += o.nuits;
    return '<div class="item' + (off ? ' warn' : '') + '" draggable="true" data-position="' + k + '"><span class="n" aria-hidden="true">' + (k + 1) + '</span><div class="t">' +
      '<button class="step-name" type="button" data-go="' + esc(id) + '"><i class="dot ' + esc(it.c) + '"></i>' + esc(it.n) + (statOf(id) === 'fav' ? '<span class="mk fav">★</span>' : '') + (statOf(id) === 'done' ? '<span class="mk done">fait</span>' : '') + '</button>' +
      '<em>' + esc(it.p) + ' · ' + esc(it.s) + '</em><div class="leg">' + (k ? fmt(km) + ' km · ' : 'départ · ') +
      (dt ? dt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: '2-digit' }) : 'jour ' + Math.round(cum - o.nuits)) + (it.du ? ' · ' + esc(it.du) : '') + (it.pe ? ' · ~' + esc(it.pe) + ' €' : '') + '</div>' +
      (off ? '<div class="bad">hors saison en ' + MFULL[mo - 1] + '</div>' : '') +
      '<div class="lk">' + (k ? extLink(gDir(byId[route[k - 1]], it), 'Itinéraire') : extLink(gMapsAt(it), 'Carte')) + extLink(gMapsQ('aire camping-car ' + place(it)), 'Aires') + extLink(gMapsQ('restaurants ' + place(it)), 'Restos') + '</div></div>' +
      '<div class="a">' + stepButton('up', k, 'up', 'Monter l’étape ' + label, k === 0) + stepButton('dn', k, 'down', 'Descendre l’étape ' + label, k === route.length - 1) +
      stepButton('position-step', k, 'move', 'Déplacer l’étape ' + label + ' à une position', route.length < 2) + stepButton('edit-step', k, 'edit', 'Modifier la fiche de l’étape ' + label, false) +
      stepButton('rm', k, 'x', 'Retirer l’étape ' + label, false) + '</div></div>';
  }).join('');
  stats();
  var select = $('#insertAt');
  select.innerHTML = '<option value="end">À la fin</option><option value="0">Au départ</option>' + route.map(function (id, k) { return '<option value="' + (k + 1) + '">Après ' + (k + 1) + '. ' + esc(byId[id].n) + '</option>'; }).join('');
  select.value = insertion; if (select.selectedIndex < 0) { insertion = 'end'; select.value = 'end'; }
  $('#undo').disabled = !hist.length; $('#redo').disabled = !future.length;
  $('#clr').disabled = !route.length; $('#rev').disabled = route.length < 2; $('#loop').disabled = route.length < 3; $('#opt').disabled = route.length < 4;
  $('#mapFitRoute').hidden = !route.length;
  ['#mapSegments', '#alongRoute'].forEach(function (s) { if ($(s)) $(s).remove(); });
  syncAddButtons();
  if (nearRouteOnly) applyFilters(); else rescale();
  save();
}
function stats() {
  var o = opts(), km = 0, gaz = 0, vign = {};
  for (var k = 1; k < route.length; k++) { var a = byId[route[k - 1]], b = byId[route[k]], d = legKm(a, b); km += d; gaz += d / 100 * o.conso * (fuelPrice(a.p) + fuelPrice(b.p)) / 2; }
  route.forEach(function (i) { var p = byId[i].p, M = DATA.meta[p]; if (M && /vignette/i.test(M.v)) vign[p] = M.v; });
  var jours = route.length ? Math.round(km / o.ryt * 7 + route.length * o.nuits) : 0, nuit = jours * o.nuit, vie = jours * o.vie * o.pax, vig = Object.keys(vign).length * 13;
  var vis = 0, visN = 0, ferry = 0, ferryN = 0, perso = 0;
  route.forEach(function (i) {
    var it = byId[i], p = +it.pe || 0, N = ST.notes[i];
    if (N && N.bud) perso += +N.bud || 0;
    if (!p) return;
    if (it.c === 'pratique') { ferry += p; ferryN++; } else { vis += p * o.vis * o.pax; visN++; }
  });
  $('#sKm').textContent = fmt(km) + ' km'; $('#sGaz').textContent = fmt(gaz) + ' €'; $('#sJours').textContent = jours + ' j';
  $('#sBud').textContent = fmt(gaz + nuit + vie + vig + vis + ferry + perso) + ' €';
  var rows = [['Gazole', gaz, fmt(km) + ' km · ' + o.conso + ' L/100 · prix par pays'], ['Nuitées', nuit, jours + ' nuits × ' + o.nuit + ' €'], ['Vie courante', vie, jours + ' j × ' + o.vie + ' € × ' + o.pax],
    ['Vignettes et péages', vig, Object.keys(vign).length + ' pays à vignette'], ['Visites et entrées', vis, visN + ' site(s) payant(s) · ' + Math.round(o.vis * 100) + ' % × ' + o.pax],
    ['Ferries et tunnels', ferry, ferryN + ' traversée(s) ou passage(s)'], ['Mes ajouts', perso, 'budgets saisis sur les fiches']]
    .filter(function (r) { return r[1] > 0 || r[0] === 'Gazole' || r[0] === 'Nuitées' || r[0] === 'Vie courante'; });
  var tot = rows.reduce(function (s, r) { return s + r[1]; }, 0);
  $('#bud').innerHTML = '<tr><th scope="col">Poste</th><th scope="col">Détail</th><th scope="col" class="num">€</th></tr>' +
    rows.map(function (r) { return '<tr><td>' + r[0] + '</td><td class="sub">' + esc(r[2]) + '</td><td class="num">' + fmt(r[1]) + '</td></tr>'; }).join('') +
    '<tr class="tot"><td>Total</td><td class="sub">' + (jours ? Math.round(tot / jours) + ' €/jour' : '—') + '</td><td class="num">' + fmt(tot) + '</td></tr>';
}

/* ── Google Maps ── */
// La navigation s'ouvre par tronçons de cinq points : c'est la limite des liens Google Maps sur mobile.
function openRouteMaps() {
  if (route.length < 2) return toast('Ajoutez au moins deux étapes');
  if ($('#mapSegments')) $('#mapSegments').remove();
  var h = '<div class="card" id="mapSegments"><div class="meta">Navigation par tronçon</div><p class="note">Ouvrez chaque tronçon à votre rythme. Le dernier arrêt est repris au début du suivant.</p><div class="lk stack">';
  for (var k = 0, n = 1; k < route.length - 1; k += 4, n++) {
    var ids = route.slice(k, k + 5);
    h += extLink(gRoute(ids.map(function (id) { return byId[id]; })), n + '. ' + byId[ids[0]].n + ' → ' + byId[ids[ids.length - 1]].n);
  }
  $('#gmapAll').parentElement.insertAdjacentHTML('afterend', h + '</div></div>');
  $('#gmapAll').closest('details').open = true;
}
// Recherche le long du trajet : une liste de liens, un par étape (aucune fenêtre ouverte d'office).
function searchAlongRoute() {
  if (!route.length) return toast('Votre trajet est vide');
  askFields({ title: 'Chercher le long du trajet', text: 'Restaurants, boulangerie, laverie, aire de services…', fields: [{ label: 'Que cherchez-vous ?', value: 'restaurants', maxlength: 80 }], ok: 'Préparer les liens' }).then(function (v) {
    if (!v) return;
    if ($('#alongRoute')) $('#alongRoute').remove();
    $('#gmapAll').parentElement.insertAdjacentHTML('afterend', '<div class="card" id="alongRoute"><div class="meta">« ' + esc(v[0]) + ' » à chaque étape</div><div class="lk stack">' +
      route.slice(0, 60).map(function (id, k) { return extLink(gMapsQ(v[0] + ' ' + place(byId[id])), (k + 1) + '. ' + byId[id].n); }).join('') + '</div></div>');
    $('#gmapAll').closest('details').open = true;
  });
}

/* ── Exports ── */
function exportRouteJson() {
  dl('mon-parcours.json', JSON.stringify({ version: 3, reglages: opts(), depart: $('#oDate').value, etapes: route.map(function (i) {
    var o = byId[i], N = ST.notes[i] || {};
    return { nom: o.n, lat: o.y, lon: o.x, pays: o.p, categorie: o.c, note: o.d, saison: o.s, duree: o.du || '', a_voir: o.v || '', tarifs: o.e || '', entree_eur: o.pe || 0,
      statut: N.st || '', ma_note: N.txt || '', mon_budget: N.bud || 0, ma_date: N.date || '', google_maps: gMapsAt(o), perso: !!o.perso };
  }) }, null, 2));
}
function exportRouteGpx() {
  var w = route.map(function (i) { var o = byId[i]; return '  <wpt lat="' + esc(o.y) + '" lon="' + esc(o.x) + '"><name>' + esc(o.n) + '</name><desc>' + esc(o.d + (o.v ? ' — ' + o.v : '')) + '</desc></wpt>'; }).join('\n');
  var r = route.map(function (i) { var o = byId[i]; return '    <rtept lat="' + esc(o.y) + '" lon="' + esc(o.x) + '"><name>' + esc(o.n) + '</name></rtept>'; }).join('\n');
  dl('mon-parcours.gpx', '<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Atlas van" xmlns="http://www.topografix.com/GPX/1/1">\n' + w + '\n  <rte><name>Mon parcours</name>\n' + r + '\n  </rte>\n</gpx>', 'application/gpx+xml');
}
function exportRouteMarkdown() {
  var o = opts(), cum = 0, dep = validDay($('#oDate').value) ? new Date($('#oDate').value) : null, out = [];
  out.push('# Carnet de route\n');
  out.push('- Étapes : ' + route.length + '\n- Distance : ' + $('#sKm').textContent + '\n- Durée : ' + $('#sJours').textContent + '\n- Budget estimé : ' + $('#sBud').textContent + '\n');
  if (route.length > 1) out.push('[Ouvrir le début du parcours dans Google Maps](' + gRoute(route.slice(0, 5).map(function (i) { return byId[i]; })) + ')\n');
  route.forEach(function (id, k) {
    var it = byId[id], km = k ? legKm(byId[route[k - 1]], it) : 0, N = ST.notes[id] || {};
    cum += k ? km / o.ryt * 7 : 0; var dt = dep ? new Date(dep.getTime() + cum * 864e5) : null; cum += o.nuits;
    out.push('## ' + (k + 1) + '. ' + it.n + ' (' + it.p + ')' + (N.st === 'fav' ? ' ★' : '') + (N.st === 'done' ? ' ✓ fait' : ''));
    out.push('- ' + it.d);
    out.push('- Saison : ' + it.s + (it.du ? ' · durée conseillée : ' + it.du : ''));
    if (k) out.push('- ' + Math.round(km) + ' km depuis l\'étape ' + k);
    if (dt) out.push('- Vers le ' + dt.toLocaleDateString('fr-FR'));
    if (it.v) { out.push(''); out.push('**À voir sur place**'); it.v.split(' · ').forEach(function (x) { out.push('- ' + x.trim()); }); }
    if (it.e) out.push('\n**Tarifs** — ' + it.e);
    if (N.txt) out.push('\n**Ma note** — ' + N.txt);
    out.push('\n[Carte](' + gMapsAt(it) + ') · [Restaurants](' + gMapsQ('restaurants ' + place(it)) + ') · [Aires](' + gMapsQ('aire camping-car ' + place(it)) + ') · [Que voir](' + gSearch('que voir à ' + place(it)) + ')');
    out.push('');
  });
  out.push('\n---\nTarifs indicatifs, à vérifier avant de partir.');
  dl('carnet-de-route.md', out.join('\n'), 'text/markdown');
}
function copyRouteList() {
  if (!route.length) return toast('Votre trajet est vide');
  var text = route.map(function (i, k) { var o = byId[i]; return (k + 1) + '. ' + o.n + ' (' + o.p + ') — ' + o.d + (o.du ? ' · ' + o.du : '') + '\n   ' + gMapsAt(o); }).join('\n');
  var manual = function () { var d = modalShell('Copier la liste', '<p>Sélectionnez le texte puis copiez-le.</p><div class="fld"><label for="copyArea">Votre trajet</label><textarea id="copyArea" readonly rows="10"></textarea></div>'); d.querySelector('#copyArea').value = text; d.querySelector('#copyArea').select(); };
  if (!navigator.clipboard || !navigator.clipboard.writeText) return manual();
  navigator.clipboard.writeText(text).then(function () { toast('Liste copiée, avec les liens'); }, manual);
}

/* ── Import d'un parcours .json ──
   Le fichier vient de l'extérieur : chaque champ est contrôlé avant d'entrer dans la page. */
function importRouteFile(file) {
  readTextFile(file, 5 * 1048576).then(function (text) {
    var j = JSON.parse(text), ids = [], created = 0, skipped = 0;
    if (!isPlainObject(j) || !Array.isArray(j.etapes) || j.etapes.length > 2000) throw new Error('Ce fichier ne contient pas de parcours.');
    var text200 = function (v, max, fallback) { return typeof v === 'string' && v.trim() ? v.slice(0, max) : fallback; };
    j.etapes.forEach(function (s) {
      if (!isPlainObject(s) || !validCoords(s.lon, s.lat)) { skipped++; return; }
      var id = null;
      if (s.perso === true) {
        var L = { i: 'c' + (++cSeq), n: text200(s.nom, TEXT_LIMITS.n, 'Lieu importé'), y: s.lat, x: s.lon, p: 'Perso', c: CATN[s.categorie] ? s.categorie : 'perso', w: 1, d: text200(s.note, TEXT_LIMITS.d, ''),
          s: text200(s.saison, TEXT_LIMITS.s, "toute l'année"), du: text200(s.duree, TEXT_LIMITS.du, ''), v: text200(s.a_voir, TEXT_LIMITS.v, ''), e: text200(s.tarifs, TEXT_LIMITS.e, ''),
          pe: Number.isFinite(s.entree_eur) && s.entree_eur >= 0 ? s.entree_eur : 0, perso: true };
        L.m = months(L.s); register(L); id = L.i; created++;
      } else {
        var best = null, bd = 9e9;
        PTS.forEach(function (o) { var d = Math.abs(o.y - s.lat) + Math.abs(o.x - s.lon); if (d < bd) { bd = d; best = o; } });
        if (best && bd < .4) id = best.i;
      }
      if (id == null) { skipped++; return; }
      ids.push(id);
      var N = nt(id);
      if (s.statut === 'fav' || s.statut === 'done') N.st = s.statut;
      if (typeof s.ma_note === 'string' && s.ma_note) N.txt = s.ma_note.slice(0, 20000);
      if (Number.isFinite(s.mon_budget) && s.mon_budget > 0) N.bud = s.mon_budget;
      if (validDay(s.ma_date)) N.date = s.ma_date;
    });
    if (!ids.length) throw new Error('Aucune étape de ce fichier n’a pu être reconnue.');
    if (validDay(j.depart)) $('#oDate').value = j.depart;
    snap(); route = ids; applyFilters(); paint(); tab('p2');
    toast('Parcours importé : ' + ids.length + ' étape(s)' + (skipped ? ', ' + skipped + ' ignorée(s)' : ''));
  }).catch(function (err) { toast('Import impossible : ' + (err instanceof SyntaxError ? 'ce fichier n’est pas un parcours lisible.' : err.message), { error: true }); });
}

/* ── Parcours prêts et parcours enregistrés ── */
var PTN = { long: 'Année', hiver: 'Hiver', printemps: 'Printemps', 'été': 'Été', automne: 'Automne', 'thème': 'Thème', court: 'Court', perso: 'Le mien' };
var RN = { long: 'séjours longs', moyen: 'séjours moyens + travail', court: 'halte 5-7 jours' };
var prFilter = '', prAppend = false, chosenPreset = -1;
function allRoutes() { return DATA.parcours.concat((ST.saved || []).map(function (p) { return { n: p.n, d: p.d, l: p.l, t: 'perso', mine: true }; })); }
function drawPresets() {
  $('#presets').innerHTML = allRoutes().map(function (p, k) {
    if (prFilter && p.t !== prFilter) return '';
    var ok = p.l.filter(function (i) { return !!byId[i]; }), chosen = k === chosenPreset;
    return '<div class="preset-wrap"><button class="preset' + (chosen ? ' chosen-preset' : '') + '" type="button" data-pr="' + k + '" aria-pressed="' + chosen + '"><span class="badge tg">' + (PTN[p.t] || '') + '</span><b>' + esc(p.n) + '</b>' +
      '<em>' + esc(p.d || '') + '</em><span class="facts">' + ok.length + ' étapes · ' + fmt(prKm(ok)) + ' km</span></button>' +
      (p.mine ? '<button class="btn sm quiet" type="button" data-prdel="' + (k - DATA.parcours.length) + '" aria-label="Supprimer le parcours ' + esc(p.n) + '">Supprimer</button>' : '') + '</div>';
  }).join('') || '<div class="empty">Aucun parcours dans cette catégorie.' + (prFilter === 'perso' ? '<br>Composez un trajet, puis « Enregistrer ce parcours » dans la rubrique Trajet.' : '') + '</div>';
}
function loadPreset(index) {
  var p = allRoutes()[index]; if (!p) return;
  var l = p.l.filter(function (i) { return !!byId[i]; });
  snap();
  if (prAppend) l.forEach(function (i) { if (route.indexOf(i) < 0) route.push(i); }); else route = l.slice();
  chosenPreset = index;
  paint(); fitPts(route.map(function (i) { return byId[i]; }), .1); tab('p3'); previewPreset(p, index);
}
// Petit écran : la carte reste visible au-dessus des idées, pour voir le circuit choisi sans quitter la liste.
function previewPreset(p, index) {
  document.body.classList.add('preset-preview');
  var feedback = $('#presetFeedback');
  feedback.hidden = false;
  feedback.innerHTML = '<strong>' + esc(p ? p.n : 'Parcours sélectionné') + '</strong><p>' + route.length + ' étapes affichées sur la carte et placées dans votre trajet.</p><div class="row"><button class="btn sm" id="editChosenRoute" type="button">Modifier ce trajet</button><button class="btn sm" id="fullChosenMap" type="button">Agrandir la carte</button></div>';
  $('#editChosenRoute').onclick = function () { tab('p2'); };
  $('#fullChosenMap').onclick = function () { document.body.classList.remove('preset-preview'); setMobileView('map'); requestAnimationFrame(function () { fitPts(route.map(function (i) { return byId[i]; }), .15); }); };
  $$('#presets [data-pr]').forEach(function (card) { var on = +card.dataset.pr === index; card.classList.toggle('chosen-preset', on); card.setAttribute('aria-pressed', String(on)); });
  requestAnimationFrame(function () { resize(); fitPts(route.map(function (i) { return byId[i]; }), .15); });
  syncNav(); applyPrivacy();
}
function saveCurrentRoute() {
  if (route.length < 2) return toast('Ajoutez au moins deux étapes');
  askFields({ title: 'Enregistrer ce parcours', fields: [{ label: 'Nom du parcours', value: byId[route[0]].n + ' → ' + byId[route[route.length - 1]].n }, { label: 'Description (facultatif)', value: '', maxlength: 500 }], ok: 'Enregistrer' }).then(function (v) {
    if (!v) return;
    ST.saved = ST.saved || []; ST.saved.push({ n: v[0], d: v[1], l: route.slice() });
    save(); drawPresets(); toast('Parcours enregistré dans Idées › Les miens');
  });
}
function editSavedRoute() {
  if (!ST.saved.length) return toast('Enregistrez d’abord un parcours');
  if (!route.length) return toast('Votre trajet est vide');
  if ($('#savedEditor')) $('#savedEditor').remove();
  $('#saveRow').insertAdjacentHTML('afterend', '<div class="card" id="savedEditor"><div class="fld"><label for="savedChoice">Parcours enregistré</label><select id="savedChoice">' +
    ST.saved.map(function (p, k) { return '<option value="' + k + '">' + esc(p.n) + '</option>'; }).join('') + '</select></div>' +
    '<div class="fld"><label for="savedName">Nom</label><input id="savedName" maxlength="200"></div><div class="fld"><label for="savedDescription">Description</label><input id="savedDescription" maxlength="500"></div>' +
    '<p class="note">Ses étapes seront remplacées par celles du trajet affiché.</p><div class="row"><button class="btn p" id="commitSaved" type="button">Enregistrer les modifications</button><button class="btn" id="cancelSaved" type="button">Annuler</button></div></div>');
  $('#saveRow').closest('details').open = true;
  var fill = function () { var p = ST.saved[+$('#savedChoice').value]; $('#savedName').value = p.n; $('#savedDescription').value = p.d || ''; };
  $('#savedChoice').onchange = fill; fill();
  $('#cancelSaved').onclick = function () { $('#savedEditor').remove(); };
  $('#commitSaved').onclick = function () {
    var n = $('#savedName').value.trim();
    if (!n) return toast('Indiquez un nom');
    ST.saved[+$('#savedChoice').value] = { n: n, d: $('#savedDescription').value.trim(), l: route.slice() };
    save(); drawPresets(); $('#savedEditor').remove(); toast('Parcours mis à jour');
  };
}
function addWholeCountry(test, label) {
  if (!paysF) return toast('Choisissez d’abord un pays dans les filtres de la carte.');
  var added = PTS.filter(function (L) { return L.p === paysF && test(L) && route.indexOf(L.i) < 0; });
  if (!added.length) return toast('Aucun lieu à ajouter pour ' + paysF + '.');
  snap(); added.forEach(function (L) { route.push(L.i); }); paint(); tab('p2'); toast(added.length + ' ' + label + ' ajouté(s) : ' + paysF);
}

/* ── Listes fixes : bases, fiches pays, checklist ── */
function drawReferenceLists() {
  var bases = DATA.lieux.filter(function (L) { return L.c === 'base'; });
  $('#baselist').closest('details').hidden = !bases.length;   // catalogue sans base (version publique) : la rubrique disparaît
  $('#baselist').innerHTML = bases.map(function (L) {
    return '<div class="item plain"><span class="n" aria-hidden="true">◆</span><div class="t"><button class="step-name" type="button" data-go="' + esc(L.i) + '">' + esc(L.n) + '</button><em>' + esc(L.q || '') + (RN[L.r] ? ' — ' + RN[L.r] : '') + '</em><div class="leg">' + esc(L.t || '') + '</div></div></div>';
  }).join('');
  $('#metaTab').innerHTML = '<tr><th scope="col">Pays</th><th scope="col" class="num">Gazole €/L</th><th scope="col">Route</th><th scope="col">Bivouac</th></tr>' + Object.keys(DATA.meta).map(function (p) {
    var m = DATA.meta[p];
    return '<tr><td><strong>' + esc(p) + '</strong></td><td class="num">' + esc(m.g.toFixed(2)) + '</td><td>' + esc(m.v) + '</td><td class="sub">' + esc(m.b) + '</td></tr>';
  }).join('');
  $('#check').innerHTML = (DATA.checklist || []).map(function (r) { return '<div class="item plain"><span class="n" aria-hidden="true">☐</span><div class="t"><strong>' + esc(r[0]) + '</strong><em>' + esc(r[1]) + '</em></div></div>'; }).join('');
}

/* ── Branchement des commandes du trajet ── */
function wireRoute() {
  ['oConso', 'oRythme', 'oNuits', 'oJour', 'oNuit', 'oDate', 'oVis', 'oPax'].forEach(function (id) { $('#' + id).addEventListener('input', function () { paint(); }); });
  $('#undo').onclick = undo; $('#redo').onclick = redo;
  $('#rev').onclick = function () { if (route.length < 2) return; snap(); route.reverse(); paint(); };
  $('#loop').onclick = function () { if (route.length > 2 && route[0] !== route[route.length - 1]) { snap(); route.push(route[0]); paint(); } else toast(route.length > 2 ? 'Le trajet revient déjà à son départ' : 'Ajoutez au moins trois étapes'); };
  $('#clr').onclick = function () { if (!route.length) return; snap(); route = []; paint(); toast('Trajet vidé — « Annuler » le rétablit'); };
  // Optimisation 2-opt : le départ et l'arrivée restent en place, y compris un retour explicite au départ.
  $('#opt').onclick = function () {
    if (route.length < 4) return toast('Ajoutez au moins quatre étapes');
    var out = route.slice(), before = prKm(out), changed = true, passes = 0;
    while (changed && passes++ < 12) {
      changed = false;
      for (var i = 1; i < out.length - 2; i++) for (var j = i + 1; j < out.length - 1; j++) {
        var a = byId[out[i - 1]], b = byId[out[i]], c = byId[out[j]], d = byId[out[j + 1]];
        if (hav(a, c) + hav(b, d) + .001 < hav(a, b) + hav(c, d)) { out.splice.apply(out, [i, j - i + 1].concat(out.slice(i, j + 1).reverse())); changed = true; }
      }
    }
    var after = prKm(out);
    if (after >= before) return toast('Aucun raccourci trouvé en gardant le départ et l’arrivée');
    snap(); route = out; paint(); toast('Environ ' + fmt(before - after) + ' km économisés');
  };
  $('#list').addEventListener('click', function (e) {
    var b;
    if ((b = e.target.closest('[data-up]'))) return move(+b.dataset.up, -1);
    if ((b = e.target.closest('[data-dn]'))) return move(+b.dataset.dn, 1);
    if ((b = e.target.closest('[data-rm]'))) return removeAt(+b.dataset.rm);
    if ((b = e.target.closest('[data-edit-step]'))) { var id = route[+b.dataset.editStep]; show(id, { full: true }); edit(byId[id]); return; }
    if ((b = e.target.closest('[data-position-step]'))) {
      var k = +b.dataset.positionStep;
      askFields({ title: 'Déplacer l’étape', fields: [{ label: 'Nouvelle position (1 à ' + route.length + ')', value: k + 1, type: 'number', inputmode: 'numeric' }], ok: 'Déplacer',
        validate: function (v) { var j = Number(v[0]) - 1; return Number.isInteger(j) && j >= 0 && j < route.length ? '' : 'Indiquez un nombre entre 1 et ' + route.length + '.'; } }).then(function (v) { if (v) relocate(k, Number(v[0]) - 1); });
      return;
    }
    if (e.target.closest('[data-open-ideas]')) tab('p3');
  });
  // Glisser-déposer à la souris ; au doigt, les boutons de chaque étape font le même travail.
  var dragStep = null;
  $('#list').addEventListener('dragstart', function (e) {
    if (e.target.closest && e.target.closest('button,a,input')) { e.preventDefault(); return; }
    var it = e.target.closest ? e.target.closest('.item') : null;
    if (it) { dragStep = +it.dataset.position; e.dataTransfer.setData('text/plain', String(dragStep)); e.dataTransfer.effectAllowed = 'move'; }
  });
  $('#list').addEventListener('dragover', function (e) { if (dragStep !== null) e.preventDefault(); });
  $('#list').addEventListener('drop', function (e) { e.preventDefault(); var it = e.target.closest('.item'); if (it && dragStep !== null) relocate(dragStep, +it.dataset.position); dragStep = null; });
  $('#list').addEventListener('dragend', function () { dragStep = null; });

  // Ajouter une étape par la recherche, à la position choisie.
  $('#insertAt').onchange = function () { insertion = this.value; };
  $('#routeQuery').oninput = function () {
    var q = noac(this.value.trim());
    $('#routeResults').innerHTML = q.length < 2 ? '' : PTS.filter(function (p) { var k = searchKeys(p); return (k.np + ' ' + k.v).includes(q); }).slice(0, 12).map(function (p) {
      return '<div class="result"><span>' + esc(p.n) + ' <small>' + esc(p.p) + '</small></span><button class="btn sm" type="button" data-insert="' + esc(p.i) + '" aria-label="Ajouter ' + esc(p.n) + ' au trajet">Ajouter</button></div>';
    }).join('') || '<p class="note">Aucun lieu trouvé.</p>';
  };
  $('#routeResults').onclick = function (e) {
    var b = e.target.closest('[data-insert]'); if (!b) return;
    var id = idValue(b.dataset.insert); if (!byId[id]) return;
    snap(); route.splice(insertion === 'end' ? route.length : Math.min(+insertion, route.length), 0, id); paint(); toast('Étape ajoutée : ' + byId[id].n);
  };

  $('#gmapAll').onclick = openRouteMaps; $('#gmapSearch').onclick = searchAlongRoute;
  $('#expJson').onclick = exportRouteJson; $('#expGpx').onclick = exportRouteGpx; $('#expMd').onclick = exportRouteMarkdown; $('#expTxt').onclick = copyRouteList;
  $('#impBtn').onclick = function () { $('#imp').click(); };
  $('#imp').onchange = function (e) { var f = e.target.files[0]; e.target.value = ''; if (f) importRouteFile(f); };
  $('#prSave').onclick = saveCurrentRoute; $('#updateSaved').onclick = editSavedRoute;
  $('#routeOnMap').onclick = showRouteOnMap; $('#mapFitRoute').onclick = showRouteOnMap;
  $('#routeInJournal').onclick = function () { openJournalEditor(null, route[0]); };

  // Idées de parcours
  $('#prFilter').addEventListener('click', function (e) {
    var b = e.target.closest('[data-pt]'); if (!b) return;
    $$('#prFilter button').forEach(function (x) { setPressed(x, x === b); });
    prFilter = b.dataset.pt; drawPresets();
  });
  $('#prAppend').checked = prAppend;
  $('#prAppend').onchange = function () { prAppend = this.checked; ST.prAppend = prAppend; save(); toast(prAppend ? 'Les parcours s’ajouteront à la suite de votre trajet' : 'Les parcours remplaceront votre trajet'); };
  $('#presets').addEventListener('click', function (e) {
    var x = e.target.closest('[data-prdel]');
    if (x) {
      var index = +x.dataset.prdel, saved = ST.saved[index];
      if (!saved) return;
      askConfirm({ title: 'Supprimer ce parcours ?', text: '« ' + saved.n + ' » sera retiré de vos parcours enregistrés. Votre trajet en cours n’est pas modifié.', ok: 'Supprimer', danger: true }).then(function (yes) {
        if (!yes) return;
        ST.saved.splice(index, 1); chosenPreset = -1; save(); drawPresets(); toast('Parcours supprimé');
      });
      return;
    }
    var d = e.target.closest('[data-pr]'); if (d) loadPreset(+d.dataset.pr);
  });
  $('#addTop').onclick = function () { addWholeCountry(function (L) { return L.w === 1; }, 'incontournable(s)'); };
  $('#addJobs').onclick = function () { addWholeCountry(function (L) { return L.c === 'boulot'; }, 'boulot(s)'); };

  // Liens internes « ouvrir ce lieu » et « ajouter ce lieu », où qu'ils soient dans la page.
  document.addEventListener('click', function (e) {
    var a = e.target.closest('[data-add]'); if (a) { addTo(idValue(a.dataset.add)); return; }
    var g = e.target.closest('[data-go]'); if (g) { var id = idValue(g.dataset.go); if (byId[id]) { show(id, { full: true }); flyTo(byId[id], 90); } }
  });
}
function showRouteOnMap() {
  if (!route.length) return toast('Ajoutez des étapes depuis la carte ou la liste des lieux');
  document.body.classList.remove('preset-preview'); setMobileView('map');
  requestAnimationFrame(function () { fitPts(route.map(function (i) { return byId[i]; }), .18); });
}
