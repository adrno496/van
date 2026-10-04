/* Démarrage : dessine les lieux, restaure le trajet et les réglages, branche les commandes, puis remplit les listes.
   Le travail est découpé en étapes courtes ; entre deux étapes, le navigateur peut afficher la page et répondre à un geste. */
(function boot() {
  // Navigateur trop ancien pour les dialogues natifs : le dire clairement plutôt que de mal fonctionner.
  if (typeof HTMLDialogElement === 'undefined' || !('inert' in document.documentElement)) {
    document.body.insertAdjacentHTML('afterbegin', '<p class="noscript" role="alert">Ce navigateur est trop ancien pour Atlas van : certaines fenêtres ne s’ouvriront pas. Mettez-le à jour pour tout utiliser.</p>');
  }
  var steps = [
    // 1. Les lieux sur la carte.
    drawPlaces,
    // 2. L'état enregistré, la première vue, puis les commandes : rien n'est cliquable avant que l'état soit en place.
    function () {
      mark('boot-start');
      var o = ST.opts || {};
      if (o.conso) $('#oConso').value = o.conso; if (o.ryt) $('#oRythme').value = o.ryt; if (o.nuits) $('#oNuits').value = o.nuits; if (o.vie) $('#oJour').value = o.vie;
      if (o.nuit) $('#oNuit').value = o.nuit; if (o.vis) $('#oVis').value = o.vis; if (o.pax) $('#oPax').value = o.pax;
      $('#oDate').value = o.date || dateToday();
      cSeq = ST.cSeq || 0;
      prAppend = !!ST.prAppend; $('#prAppend').checked = prAppend;
      route = (ST.route || []).filter(function (i) { return !!byId[i]; });
      wireMapGestures(); wireExplore(); wireRoute(); wireJournal(); wireLocation(); wireShell();
      booted = true;
      mark('wired');
      resize(); fitDefault();
      mark('view');
      applyFilters();            // filtre et tailles des marqueurs ; la liste des lieux attend l'étape suivante
      setMobileView('map');
      applyPrivacy();
      // Dernière modification enregistrée même si la page est fermée dans la demi-seconde qui suit.
      window.addEventListener('pagehide', function () { if (booted && !saveFailed) writeState(); });
      mark('filter');
    },
    // 3. Les listes : trajet et chiffres, idées de parcours, fiches pays, lieux à explorer.
    function () {
      mark('deferred-start');
      paint();
      drawReferenceLists(); drawPresets(); updateBackupInfo();
      listsReady = true; renderDiscovery();
      mark('deferred-end');
    },
    // 4. Le carnet (IndexedDB) et les messages d'accueil.
    function () {
      initJournal();
      if (stateRepaired) toast('Certaines données enregistrées étaient illisibles : elles ont été mises de côté (rubrique Plus › Mes données).', { error: true });
      else if (route.length) toast(route.length + ' étape' + (route.length > 1 ? 's' : '') + ' de votre trajet retrouvée' + (route.length > 1 ? 's' : ''));
      if (geoAutostart && navigator.geolocation) startGeolocation(false);
      initCommunity();
      applyDeepLink();
      window.addEventListener('hashchange', applyDeepLink);
      mark('boot-end');
      // Index de recherche (textes sans accents de chaque fiche) préparé par petits paquets pendant les temps morts :
      // la première frappe dans la recherche n'a plus à le construire pour les 3 400 lieux.
      var k = 0, later = window.requestIdleCallback || function (f) { return setTimeout(f, 50); };
      (function index() { var end = Math.min(PTS.length, k + 400); for (; k < end; k++) searchKeys(PTS[k]); if (k < PTS.length) later(index); })();
    }
  ];
  // Une étape par tâche du navigateur. MessageChannel plutôt qu'un minuteur : pas de ralentissement quand l'onglet est en arrière-plan.
  var channel = typeof MessageChannel !== 'undefined' ? new MessageChannel() : null, at = 0;
  function next() {
    steps[at++]();
    if (at >= steps.length) { if (channel) channel.port1.close(); return; }
    if (channel) channel.port2.postMessage(0); else setTimeout(next, 0);
  }
  if (channel) channel.port1.onmessage = next;
  next();
})();
