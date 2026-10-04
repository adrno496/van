/* Navigation : rubriques du panneau, vue carte ou rubrique sur petit écran, discrétion, dialogues permanents. */
var navNames = { p2: 'Mon trajet', p3: 'Idées de parcours', pBlog: 'Mon carnet' };

// Affiche une rubrique. Sur petit écran, la rubrique passe devant la carte.
function tab(id) {
  if (!$('#' + id)) return;
  if ($('#settingsDialog').open) $('#settingsDialog').close();
  if (id !== 'p3') document.body.classList.remove('preset-preview');
  $$('.tabs button').forEach(function (b) { var on = b.dataset.p === id; b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on)); });
  $$('.pane').forEach(function (p) { p.classList.toggle('on', p.id === id); });
  setMobileView('panel');
  if (id === 'pBlog' && journalReady && !journalEditing) renderJournal();
  applyPrivacy();
}
function setMobileView(view) {
  document.body.dataset.mobileView = view;
  if (view === 'map') requestAnimationFrame(function () { resize(); vb[3] = vb[2] * H / W; applyVB(); });
  else hidePeek();
  syncNav();
}
function syncNav() {
  var pane = $('.pane.on'), id = pane ? pane.id : '', isMap = document.body.dataset.mobileView === 'map';
  $$('.mobile-nav button').forEach(function (b) {
    var on = b.dataset.mobile === 'map' ? (isMap || id === 'p1') : (!isMap && b.dataset.p === id);
    b.classList.toggle('on', on);
    if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
}

/* ── Discrétion : flouter une rubrique quand quelqu'un regarde l'écran ── */
function applyPrivacy() {
  Object.keys(navNames).forEach(function (id) {
    var pane = $('#' + id), content = pane.querySelector('.privacy-content'), blurred = !!privacyPrefs[id], cover = pane.querySelector('.privacy-cover');
    pane.classList.toggle('is-blurred', blurred);
    content.inert = blurred;
    if (blurred && !cover) {
      cover = document.createElement('div'); cover.className = 'privacy-cover';
      cover.innerHTML = '<p>« ' + esc(navNames[id]) + ' » est flouté.</p><button class="btn" type="button">Afficher cette rubrique</button>';
      cover.querySelector('button').onclick = function () { privacyPrefs[id] = false; savePrivacy(); applyPrivacy(); };
      pane.prepend(cover);
    } else if (!blurred && cover) cover.remove();
  });
}

/* ── Dialogues permanents : paramètres, filtres ── */
function openAtlasSettings() {
  var d = $('#settingsDialog');
  if (d.open) return;
  d.querySelectorAll('[data-blur-pane]').forEach(function (box) { box.checked = !!privacyPrefs[box.dataset.blurPane]; });
  $('#autoGeo').checked = geoAutostart;
  geoStatusText(geoStateLabel());
  showDialog(d);
}
function openMapFilters() { var d = $('#filtersDialog'); if (!d.open) showDialog(d); }

/* ── Liens d'entrée depuis le site : #pays=italie · #lieu=31 · #parcours=balkans-en-six-semaines · #q=lac ──
   Chaque valeur est comparée à ce que l'application connaît déjà (pays, identifiants, parcours du catalogue).
   Rien de ce qui vient de l'adresse n'est écrit dans la page ; une valeur inconnue est ignorée. */
function readDeepLink() {
  var raw = location.hash.replace(/^#/, ''), out = {};
  // Lien venu de Partage : une seule clé, plus longue (circuit encodé), contrôlée champ par champ dans community.js.
  if (/^partage=[A-Za-z0-9_-]{1,16000}$/.test(raw)) return { partage: raw.slice(8) };
  if (!raw || raw.length > 300) return out;
  raw.split('&').forEach(function (part) {
    var i = part.indexOf('='), key = i > 0 ? part.slice(0, i) : '';
    if (['pays', 'lieu', 'parcours', 'q'].indexOf(key) < 0) return;
    try { out[key] = decodeURIComponent(part.slice(i + 1)).slice(0, 120); } catch (e) { /* encodage invalide : ignoré */ }
  });
  return out;
}
function applyDeepLink() {
  var link = readDeepLink();
  if (!Object.keys(link).length) return;
  // Le lien a servi : l'adresse redevient celle de l'application (un rechargement ne le rejoue pas).
  try { history.replaceState(history.state, '', location.pathname + location.search); } catch (e) { /* adresse non modifiable : sans gravité */ }
  if (link.partage != null) return applyPartageLink(link.partage);
  if (link.lieu != null && /^(\d{1,6}|c\d{1,9})$/.test(link.lieu)) {
    var id = idValue(link.lieu);
    if (Object.prototype.hasOwnProperty.call(byId, id)) { setMobileView('map'); show(id); flyTo(byId[id], 80); }
    return;
  }
  if (link.pays != null) {
    var country = $$('#paysSel option').map(function (o) { return o.value; }).filter(function (v) { return v && slugOf(v) === link.pays; })[0];
    if (country) { $('#paysSel').value = country; paysF = country; applyFilters(); setMobileView('map'); fitPts(PTS.filter(function (L) { return L.p === country; }), .18); toast('Carte filtrée : ' + country); }
    return;
  }
  if (link.parcours != null) {
    var index = -1;
    DATA.parcours.forEach(function (p, k) { if (index < 0 && slugOf(p.n) === link.parcours) index = k; });
    if (index < 0) return;
    // Proposition contrôlée : un trajet déjà commencé n'est jamais remplacé sans accord.
    if (!route.length) return loadPreset(index);
    askConfirm({ title: 'Charger ce parcours ?', text: '« ' + DATA.parcours[index].n + ' » remplacera votre trajet actuel (' + route.length + ' étape' + (route.length > 1 ? 's' : '') + '). Vous pourrez annuler.', ok: 'Charger le parcours', cancel: 'Garder mon trajet' })
      .then(function (yes) { if (yes) loadPreset(index); else { tab('p3'); } });
    return;
  }
  if (link.q != null) { var q = $('#q'); q.value = link.q.replace(/[\u0000-\u001f]/g, ' ').slice(0, 80); setMobileView('map'); runSearch(); q.focus(); }
}

/* ── Bouton « retour » du téléphone ──
   Sans cela, « retour » quitte l'application même quand une fiche, une rubrique ou une fenêtre est ouverte.
   Dès qu'on s'éloigne de la carte, une entrée (une seule) est ajoutée à l'historique ; « retour » referme alors ce qui est au premier plan.
   L'adresse de la page ne change pas, rien n'est écrit dans l'historique sur grand écran. */
var backArmed = false, backSilent = false;
function awayFromMap() { return document.body.dataset.mobileView !== 'map' || !$('#peek').hidden || !!document.querySelector('dialog[open]'); }
function closeTopLayer() {
  var dialogs = $$('dialog[open]');
  if (dialogs.length) return dialogs[dialogs.length - 1].close();
  if (!$('#peek').hidden) { hidePeek(); sel = null; paintSel(); rescale(); return; }
  if (journalEditing && $('#pBlog').classList.contains('on')) return closeJournalEditor();   // le brouillon est enregistré, retour à la liste des articles
  document.body.classList.remove('preset-preview'); setMobileView('map');
}
function syncBack() {
  if (!isMobile()) return;
  var away = awayFromMap();
  if (away && !backArmed) { backArmed = true; history.pushState({ atlas: 'layer' }, ''); }
  else if (!away && backArmed) { backArmed = false; backSilent = true; history.back(); }   // refermé depuis l'interface : l'entrée ajoutée est retirée
}
function wireBackButton() {
  if (!window.history || !history.pushState || typeof MutationObserver === 'undefined') return;
  window.addEventListener('popstate', function () {
    if (backSilent) { backSilent = false; return; }
    backArmed = false;
    if (isMobile() && awayFromMap()) closeTopLayer();
    syncBack();
  });
  // Rubrique affichée, aperçu d'un lieu, fenêtre ouverte ou fermée : tout passe par ces trois attributs.
  new MutationObserver(syncBack).observe(document.body, { attributes: true, subtree: true, attributeFilter: ['data-mobile-view', 'hidden', 'open'] });
}

function wireShell() {
  wireBackButton();
  // Onglets : clic, tabulation, et flèches gauche/droite.
  $$('.tabs button').forEach(function (b) {
    b.onclick = function () {
      // Revenir sur « Explorer » alors qu'une fiche est ouverte ramène à la liste des lieux.
      if (b.dataset.p === 'p1' && b.classList.contains('on') && document.body.classList.contains('has-place')) { document.body.classList.remove('has-place'); renderDiscovery(); }
      tab(b.dataset.p);
    };
  });
  $('.tabs').addEventListener('keydown', function (e) {
    var tabs = $$('.tabs button'), i = tabs.indexOf(document.activeElement);
    if (i < 0) return;
    var next = e.key === 'ArrowRight' ? tabs[(i + 1) % tabs.length] : e.key === 'ArrowLeft' ? tabs[(i - 1 + tabs.length) % tabs.length] : e.key === 'Home' ? tabs[0] : e.key === 'End' ? tabs[tabs.length - 1] : null;
    if (next) { e.preventDefault(); next.focus(); next.click(); }
  });
  $$('.mobile-nav [data-p]').forEach(function (b) { b.onclick = function () { tab(b.dataset.p); }; });
  $('.mobile-nav [data-mobile]').onclick = function () { document.body.classList.remove('preset-preview'); setMobileView('map'); };

  wireStaticDialog($('#settingsDialog')); wireStaticDialog($('#filtersDialog'));
  $('#openSettings').onclick = openAtlasSettings; $('#openSettingsFromMore').onclick = openAtlasSettings;
  $('#mapFiltersButton').onclick = openMapFilters; $('#openFilters').onclick = openMapFilters;
  $('#applyMapFilters').onclick = function () { $('#filtersDialog').close(); document.body.classList.remove('preset-preview'); setMobileView('map'); };
  $$('#settingsDialog [data-blur-pane]').forEach(function (box) { box.onchange = function () { privacyPrefs[box.dataset.blurPane] = box.checked; savePrivacy(); applyPrivacy(); }; });

  // Mes données
  $('#backupAllFromInfo').onclick = backupEverything;
  $('#bkExp').onclick = function () { dl('atlas-van-sauvegarde.json', JSON.stringify({ app: 'atlas-van', version: 3, date: new Date().toISOString(), data: captureState() }, null, 2)); toast('Sauvegarde légère préparée (sans le carnet)'); };
  $('#bkImpBtn').onclick = function () { $('#bkImp').click(); };
  $('#bkImp').onchange = function (e) { var f = e.target.files[0]; e.target.value = ''; if (f) importBackupFile(f); };
  $('#bkReset').onclick = function () {
    askConfirm({ title: 'Réinitialiser trajets et fiches ?', text: 'Vos modifications de fiches, notes, statuts, lieux personnels, trajets et réglages seront effacés de cet appareil. Le carnet et ses photos sont conservés.', ok: 'Tout effacer', danger: true }).then(function (yes) {
      if (!yes) return;
      clearTimeout(saveTimer); booted = false;
      try { localStorage.removeItem(KEY); } catch (e) { /* stockage indisponible */ }
      location.reload();
    });
  };
  // Données mises de côté au démarrage parce qu'elles étaient illisibles : téléchargeables, jamais détruites en silence.
  var recovery = null;
  try { recovery = localStorage.getItem(RECOVERY_KEY); } catch (e) { /* stockage indisponible */ }
  $('#recoveryBox').hidden = !recovery;
  $('#recoveryDownload').onclick = function () { dl('atlas-van-donnees-a-recuperer.json', recovery || '', 'application/json'); };
  $('#recoveryDrop').onclick = function () {
    askConfirm({ title: 'Supprimer ces données ?', text: 'La copie des données illisibles sera effacée de cet appareil.', ok: 'Supprimer', danger: true }).then(function (yes) {
      if (!yes) return;
      try { localStorage.removeItem(RECOVERY_KEY); } catch (e) { /* stockage indisponible */ }
      $('#recoveryBox').hidden = true;
    });
  };
}
