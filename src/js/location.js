/* Localisation : demandée au navigateur seulement quand la personne l'active.
   La position reste en mémoire le temps de la page ; seule la préférence « réactiver à l'ouverture » est enregistrée. */
var GEO_KEY = 'atlasvan.location.enabled';
var geoWatch = null, geoPosition = null, geoFollow = false, geoAutostart = false, geoError = '', geoPending = false;
var aroundKm = 20, aroundActive = false, aroundDialog = null, aroundLimit = 30;
try { geoAutostart = localStorage.getItem(GEO_KEY) === 'yes'; } catch (e) { /* stockage indisponible */ }

function storeGeoPreference() { try { localStorage.setItem(GEO_KEY, geoAutostart ? 'yes' : 'no'); } catch (e) { /* stockage indisponible */ } }
function geoStatusText(text) { $('#geoSettingsState').textContent = text || 'Localisation inactive.'; }
function geoStateLabel() {
  return geoPending ? 'Recherche de votre position…' : geoPosition ? 'Localisation active · précision annoncée : ' + Math.round(geoPosition.accuracy) + ' m.' : geoError || 'Localisation inactive.';
}
function paintGeolocation() {
  if (!geoPosition) return;
  var q = P(geoPosition.x, geoPosition.y), k = vb[2] / Math.max(W, 320), latitudeDelta = Math.min(1, geoPosition.accuracy / 111195), q2 = P(geoPosition.x, Math.min(84.99, geoPosition.y + latitudeDelta));
  geoLayer.style.display = '';
  [geoAccuracy, geoDot].forEach(function (c) { c.setAttribute('cx', q[0]); c.setAttribute('cy', q[1]); });
  geoDot.setAttribute('r', 7 * k);
  geoAccuracy.setAttribute('r', Math.max(k * 9, Math.hypot(q2[0] - q[0], q2[1] - q[1])));
}
function centreOnPosition() {
  if (!geoPosition) return;
  setMobileView('map');
  requestAnimationFrame(function () { var q = P(geoPosition.x, geoPosition.y); flyTo({ px: q[0], py: q[1] }, 55); paintGeolocation(); });
}
function acceptGeolocation(position) {
  var c = position.coords;
  if (!Number.isFinite(c.latitude) || !Number.isFinite(c.longitude) || !Number.isFinite(c.accuracy) || c.accuracy < 0 || Math.abs(c.latitude) >= 85 || Math.abs(c.longitude) > 180) {
    geoPending = false; geoStatusText('Position reçue hors des limites de la carte.'); renderAround(); return;
  }
  var first = !geoPosition;
  geoPosition = { x: c.longitude, y: c.latitude, accuracy: c.accuracy, time: Date.now() };
  geoPending = false; geoError = '';
  $('#geoButton').classList.add('located'); $('#geoButton').setAttribute('aria-label', 'Recentrer sur ma position');
  geoStatusText('Ma position · précision ~' + Math.round(c.accuracy) + ' m');
  paintGeolocation();
  if (geoFollow) centreOnPosition();
  if (first) toast('Position trouvée : le point bleu vous situe sur la carte.');
  if (aroundActive) applyFilters();
  renderAround();
}
function rejectGeolocation(error) {
  geoPending = false;
  var messages = { 1: 'Localisation refusée. Autorisez-la dans les réglages du navigateur, puis réessayez.', 2: 'Position indisponible. Vérifiez les services de localisation de votre appareil.', 3: 'La recherche de position a pris trop de temps. Vous pouvez réessayer.' };
  geoError = messages[error.code] || 'La localisation est indisponible dans ce navigateur.';
  geoStatusText(geoPosition ? 'Position précédente · actualisation indisponible.' : geoError);
  toast(geoError, { error: true });
  // Refus : on ne redemande pas tout seul à la prochaine ouverture.
  if (error.code === 1) { if (geoWatch !== null && navigator.geolocation) navigator.geolocation.clearWatch(geoWatch); geoWatch = null; geoAutostart = false; storeGeoPreference(); }
  renderAround();
}
function startGeolocation(follow) {
  if (!navigator.geolocation) { geoError = 'La localisation n’est pas disponible ici. Essayez un navigateur qui l’autorise.'; geoStatusText(geoError); renderAround(); return toast(geoError, { error: true }); }
  geoFollow = !!follow;
  if (geoWatch !== null && geoError) { navigator.geolocation.clearWatch(geoWatch); geoWatch = null; }
  if (geoWatch !== null) { if (geoPosition && follow) centreOnPosition(); return; }
  geoPending = true; geoError = ''; geoStatusText('Recherche de votre position…');
  try {
    geoWatch = navigator.geolocation.watchPosition(acceptGeolocation, rejectGeolocation, { enableHighAccuracy: true, maximumAge: 30000, timeout: 15000 });
    geoAutostart = true; storeGeoPreference();
  } catch (e) {
    geoPending = false; geoWatch = null; geoError = 'Le navigateur ne permet pas la localisation dans cette page.'; geoStatusText(geoError); toast(geoError, { error: true });
  }
}
function stopGeolocation() {
  if (geoWatch !== null && navigator.geolocation) navigator.geolocation.clearWatch(geoWatch);
  geoWatch = null; geoPosition = null; geoFollow = false; geoPending = false; geoAutostart = false; aroundActive = false;
  storeGeoPreference();
  geoLayer.style.display = 'none';
  $('#geoButton').classList.remove('located'); $('#geoButton').setAttribute('aria-label', 'Me localiser sur la carte');
  geoStatusText(''); toast('Localisation arrêtée');
  applyFilters(); renderAround();
}

/* ── Près de moi : les lieux du catalogue proches de ma position ── */
function nearbyPlaces() {
  return geoPosition ? PTS.filter(function (p) { return hav(p, geoPosition) <= aroundKm; }).sort(function (a, b) { return hav(a, geoPosition) - hav(b, geoPosition); }) : [];
}
function renderAround() {
  if (!aroundDialog) return;
  var list = nearbyPlaces();
  $('#aroundSummary').textContent = geoPosition ? list.length + ' lieu(x) du catalogue à moins de ' + aroundKm + ' km, à vol d’oiseau.' : geoPending ? 'Recherche de votre position…' : geoError || 'Activez votre localisation pour trouver les lieux proches de vous.';
  $('#aroundResults').innerHTML = list.slice(0, aroundLimit).map(function (p) {
    return '<article class="discover-card"><small><i class="dot ' + esc(p.c) + '"></i>' + esc(CATN[p.c] || p.c) + ' · ' + hav(p, geoPosition).toFixed(1).replace('.', ',') + ' km</small><button class="place-open" type="button" data-around-open="' + esc(p.i) + '">' + esc(p.n) + '</button><p>' + esc(p.d) + '</p>' +
      '<div class="row"><button class="btn sm" type="button" data-around-add="' + esc(p.i) + '" aria-label="Ajouter ' + esc(p.n) + ' au trajet">' + ic('plus') + 'Au trajet</button></div></article>';
  }).join('');
  $('#aroundMore').hidden = list.length <= aroundLimit;
  $('#aroundMap').disabled = !geoPosition;
  $('#aroundClear').hidden = !aroundActive;
  $('#aroundLocate').textContent = geoPending ? 'Recherche en cours…' : geoPosition ? 'Actualiser ma position' : 'Activer ma localisation';
  $('#aroundLocate').disabled = geoPending;
}
function openAround() {
  if (aroundDialog) return;
  aroundLimit = 30;
  var d = modalShell('Près de moi', '<p class="note">Les lieux du catalogue autour de votre position. Elle n’est ni enregistrée ni envoyée.</p>' +
    '<div class="fld"><label for="aroundRadius">Rayon de recherche</label><select class="input" id="aroundRadius"><option value="20">20 km</option><option value="50">50 km</option><option value="100">100 km</option></select></div>' +
    '<div class="row"><button class="btn" id="aroundLocate" type="button">Activer ma localisation</button><button class="btn p" id="aroundMap" type="button">Afficher sur la carte</button><button class="btn quiet" id="aroundClear" type="button">Retirer ce filtre</button></div>' +
    '<p id="aroundSummary" class="count" role="status"></p><div id="aroundResults"></div><button class="btn block" id="aroundMore" type="button">Voir 30 lieux de plus</button>');
  aroundDialog = d;
  $('#aroundRadius').value = String(aroundKm);
  $('#aroundRadius').onchange = function () { aroundKm = Number(this.value) || 20; aroundLimit = 30; renderAround(); if (aroundActive) applyFilters(); };
  $('#aroundLocate').onclick = function () { startGeolocation(false); renderAround(); };
  $('#aroundMore').onclick = function () { aroundLimit += 30; renderAround(); };
  $('#aroundMap').onclick = function () {
    if (!geoPosition) return;
    aroundActive = true; nearRouteOnly = false; $('#nearRouteOnly').checked = false; applyFilters();
    d.close(); setMobileView('map');
    var q = P(geoPosition.x, geoPosition.y), edge = P(geoPosition.x + aroundKm / (111.195 * Math.cos(geoPosition.y * Math.PI / 180)), geoPosition.y);
    requestAnimationFrame(function () { flyTo({ px: q[0], py: q[1] }, Math.max(12, Math.abs(edge[0] - q[0]) * 2.5)); });
    toast('Lieux à moins de ' + aroundKm + ' km de vous. Les autres filtres restent actifs.');
  };
  $('#aroundClear').onclick = function () { aroundActive = false; applyFilters(); d.close(); };
  $('#aroundResults').onclick = function (e) {
    var open = e.target.closest('[data-around-open]'), add = e.target.closest('[data-around-add]');
    if (open) { d.close(); show(idValue(open.dataset.aroundOpen)); }
    if (add) addTo(idValue(add.dataset.aroundAdd));
  };
  d.addEventListener('close', function () { aroundDialog = null; });
  renderAround();
  if (!geoPosition && !geoPending) { startGeolocation(false); renderAround(); }
}

function wireLocation() {
  $('#geoButton').onclick = function () { startGeolocation(true); };
  $('#searchAround').onclick = openAround;
  $('#enableGeo').onclick = function () { $('#settingsDialog').close(); setMobileView('map'); startGeolocation(true); };
  $('#disableGeo').onclick = function () { stopGeolocation(); geoStatusText('Localisation arrêtée.'); $('#autoGeo').checked = false; };
  $('#autoGeo').onchange = function () { geoAutostart = this.checked; storeGeoPreference(); if (geoAutostart && geoWatch === null) startGeolocation(false); };
  window.addEventListener('pagehide', function () { if (geoWatch !== null && navigator.geolocation) navigator.geolocation.clearWatch(geoWatch); geoWatch = null; });
  window.addEventListener('pageshow', function (e) { if (e.persisted && geoAutostart && geoWatch === null) startGeolocation(false); });
}
