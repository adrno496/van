/* Site Atlas Van : menu, apparition au défilement, recherche locale. Sans ce script, les pages restent lisibles et navigables. */
(function () {
  'use strict';
  var doc = document, root = doc.documentElement;

  /* ── Menu (petits écrans) : fenêtre native — le focus y est retenu, Échap la ferme, le focus revient au bouton ── */
  var menu = doc.getElementById('menu'), opener = doc.querySelector('[data-menu-open]');
  if (menu && opener && typeof menu.showModal === 'function') {
    opener.addEventListener('click', function () { menu.showModal(); opener.setAttribute('aria-expanded', 'true'); });
    // « cancel » (touche Échap) arrive avant « close » : l'état annoncé est juste dès la frappe.
    menu.addEventListener('cancel', function () { opener.setAttribute('aria-expanded', 'false'); });
    menu.addEventListener('close', function () { opener.setAttribute('aria-expanded', 'false'); });
    menu.addEventListener('click', function (e) { if (e.target.closest('[data-menu-close]') || e.target.closest('a')) menu.close(); });
    opener.setAttribute('aria-expanded', 'false');
    // Passage à un grand écran pendant que le menu est ouvert : il n'a plus lieu d'être.
    window.matchMedia('(min-width: 1020px)').addEventListener('change', function (m) { if (m.matches && menu.open) menu.close(); });
  }

  /* ── Apparition discrète : seulement si le mouvement est accepté et l'observation disponible ── */
  var still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!still && 'IntersectionObserver' in window) {
    var items = doc.querySelectorAll('.reveal');
    var seen = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) { if (entry.isIntersecting) { entry.target.classList.add('in'); seen.unobserve(entry.target); } });
    }, { rootMargin: '0px 0px -8% 0px' });
    // Ce qui est déjà à l'écran apparaît tout de suite ; le reste, à l'approche.
    for (var i = 0; i < items.length; i++) { if (items[i].getBoundingClientRect().top < window.innerHeight) items[i].classList.add('in'); else seen.observe(items[i]); }
    root.classList.add('motion');
  }

  /* ── Recherche : l'index est dans la page, rien n'est envoyé ── */
  var field = doc.getElementById('site-q'), list = doc.getElementById('site-results'), status = doc.getElementById('site-results-status'), source = doc.getElementById('site-index');
  if (field && list && status && source) {
    var index = [];
    try { index = JSON.parse(source.textContent); } catch (e) { index = []; }
    var plain = function (s) { return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); };
    index.forEach(function (item) { item.key = plain(item.t); item.more = plain(item.s); });
    var order = { Destination: 0, 'Road trip': 1, Voyage: 2, 'Récit': 3, Guide: 4, Lieu: 5 };
    var arrow = doc.querySelector('.more .ic, .btn .ic');
    var render = function () {
      var q = plain(field.value.trim());
      list.textContent = '';
      if (q.length < 2) { status.textContent = 'La recherche se fait sur votre appareil, sans rien envoyer.'; return; }
      var hits = index.filter(function (item) { return item.key.indexOf(q) >= 0 || item.more.indexOf(q) >= 0; })
        .sort(function (a, b) { return (a.key.indexOf(q) < 0) - (b.key.indexOf(q) < 0) || order[a.k] - order[b.k] || a.key.localeCompare(b.key); });
      status.textContent = hits.length ? hits.length + (hits.length > 1 ? ' résultats' : ' résultat') + (hits.length > 40 ? ' — les 40 premiers sont affichés' : '') : 'Aucun résultat pour « ' + field.value.trim() + ' ».';
      hits.slice(0, 40).forEach(function (item) {
        // Les éléments sont créés un à un : aucun texte de l'index n'est interprété comme du HTML.
        var li = doc.createElement('li'), a = doc.createElement('a'), title = doc.createElement('span'), text = doc.createElement('span'), kind = doc.createElement('span');
        a.href = '../' + item.u;
        kind.className = 'link-kind'; kind.textContent = item.k;
        title.className = 'link-title'; title.textContent = item.t;
        text.className = 'link-text'; text.textContent = item.s || '';
        title.insertBefore(kind, title.firstChild); title.insertBefore(doc.createTextNode(' '), kind.nextSibling);
        a.appendChild(title); a.appendChild(text);
        if (arrow) a.appendChild(arrow.cloneNode(true));
        li.appendChild(a); list.appendChild(li);
      });
    };
    field.addEventListener('input', render);
    // Un terme peut arriver par l'adresse (recherche/index.html#q=…) : il est placé dans le champ, jamais dans le HTML.
    var fromHash = /(?:^|[#&])q=([^&]*)/.exec(location.hash);
    if (fromHash) { try { field.value = decodeURIComponent(fromHash[1]).slice(0, 80); } catch (e) { field.value = ''; } render(); }
  }
})();
