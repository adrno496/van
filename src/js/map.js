/* Carte : dessin des pays et des lieux, vue, zoom, déplacement, sélection, infobulle. */
var svg = $('#map'), wrap = $('.mapwrap');
// Ordre des calques : pays, noms de pays, trajet, fil du carnet, halos des bases, lieux, noms des lieux, numéros d'étape, position.
// Les gestes sont écoutés sur la carte entière : aucun calque n'a besoin de recevoir le pointeur.
// Pays et noms de pays sont déjà dans la page (dessinés à la construction) ; les autres calques sont créés ici.
var gP = $('#mapCountries'), gL = $('#mapCountryNames'), gR = el('g', { 'aria-hidden': 'true', 'pointer-events': 'none' }),
  journalLayer = el('g', { 'aria-hidden': 'true', 'pointer-events': 'none' }), gH = el('g', { 'aria-hidden': 'true', 'pointer-events': 'none' }),
  gM = el('g', { 'aria-hidden': 'true', 'pointer-events': 'none' }), gT = el('g', { 'aria-hidden': 'true', 'pointer-events': 'none' }),
  gN = el('g', { 'aria-hidden': 'true', 'pointer-events': 'none' }), geoLayer = el('g', { 'aria-hidden': 'true', 'pointer-events': 'none' });
[gR, journalLayer, gH, gM, gT, gN, geoLayer].forEach(function (g) { svg.appendChild(g); });
var countryLabels = Array.prototype.slice.call(gL.children), countryShown = [];

/* ── Lieux ──
   Un seul élément SVG par lieu : une forme propre à sa catégorie (la couleur ne porte pas l'information à elle seule),
   dessinée directement à sa place et à sa taille, en coordonnées de carte. Les noms vivent dans un calque à part et ne
   sont créés que s'ils s'affichent.
   Pas de « transform » par marqueur : avec 3 400 lieux, un nœud de transformation par élément obligeait le navigateur à
   recomposer chaque marqueur à chaque image d'un déplacement (étapes Layerize et Paint) ; un chemin en coordonnées
   absolues ne coûte rien de plus quand seule la vue (viewBox) change. */
function starPath(outer, inner) {
  var d = '';
  for (var i = 0; i < 10; i++) { var a = Math.PI * (i / 5 - .5), q = i % 2 ? inner : outer; d += (i ? 'L' : 'M') + (Math.cos(a) * q).toFixed(2) + ',' + (Math.sin(a) * q).toFixed(2); }
  return d + 'Z';
}
// Formes dessinées autour de (0,0), pour un rayon de 1 ; EXT = demi-largeur réelle, pour poser le nom juste à côté.
var SHAPES = {
  ville: 'M1,0A1,1 0 1 1 -1,0A1,1 0 1 1 1,0Z',                                      // disque
  patrimoine: 'M0,-1.3L1.3,0L0,1.3L-1.3,0Z',                                        // losange
  nature: 'M0,-1.4L1.25,.7H-1.25Z',                                                 // triangle, pointe en haut
  plage: 'M0,1.4L1.25,-.7H-1.25Z',                                                  // triangle, pointe en bas
  boulot: 'M-.9,-.9H.9V.9H-.9Z',                                                    // carré
  pratique: 'M-.42,-1.25H.42V-.42H1.25V.42H.42V1.25H-.42V.42H-1.25V-.42H-.42Z',     // croix
  base: starPath(1.5, .66),                                                         // étoile
  perso: 'M1.15,0A1.15,1.15 0 1 1 -1.15,0A1.15,1.15 0 1 1 1.15,0ZM.5,0A.5,.5 0 1 0 -.5,0A.5,.5 0 1 0 .5,0Z'   // anneau
};
var EXT = { ville: 1, patrimoine: 1.3, nature: 1.25, plage: 1.25, boulot: .9, pratique: 1.25, base: 1.5, perso: 1.15 };
// Chaque forme est compilée une fois : un point de départ, puis la suite du tracé en commandes relatives (m, l, h, v, a, z).
// Le chemin d'un marqueur = « M » + son point de départ en coordonnées de carte + une suite commune à tous les lieux de
// la même forme et de la même taille, calculée une fois par taille. Chemins courts : moins de texte à écrire et à lire
// pour le navigateur quand les 3 400 marqueurs changent de taille (zoom, démarrage).
var SHAPE_FN = {};
function compileShape(src) {
  var cmds = [], rel = [], cx = 0, cy = 0, sx = 0, sy = 0, x0 = 0, y0 = 0;
  src.replace(/([MLHVAZ])([^MLHVAZ]*)/g, function (m, c, a) { cmds.push([c, a.trim() ? a.trim().split(/[\s,]+/).map(Number) : []]); return m; });
  cmds.forEach(function (cmd, i) {
    var c = cmd[0], v = cmd[1];
    if (c === 'M' && i === 0) { x0 = sx = cx = v[0]; y0 = sy = cy = v[1]; return; }
    if (c === 'M') { rel.push(['m', [v[0] - cx, v[1] - cy]]); sx = cx = v[0]; sy = cy = v[1]; }
    else if (c === 'L') { rel.push(['l', [v[0] - cx, v[1] - cy]]); cx = v[0]; cy = v[1]; }
    else if (c === 'H') { rel.push(['h', [v[0] - cx]]); cx = v[0]; }
    else if (c === 'V') { rel.push(['v', [v[0] - cy]]); cy = v[0]; }
    else if (c === 'A') { rel.push(['a', [v[0], v[1], v[2], v[3], v[4], v[5] - cx, v[6] - cy], true]); cx = v[5]; cy = v[6]; }
    else if (c === 'Z') { rel.push(['z', []]); cx = sx; cy = sy; }
  });
  var tails = {}, q = function (v) { return Math.round(v * 1e4) / 1e4; };
  function tail(r) {
    if (tails[r] == null) {
      var keys = Object.keys(tails); if (keys.length > 40) tails = {};
      tails[r] = rel.map(function (cmd) {
        var v = cmd[1];
        return cmd[0] + (cmd[2] ? q(v[0] * r) + ',' + q(v[1] * r) + ' ' + v[2] + ' ' + v[3] + ' ' + v[4] + ' ' + q(v[5] * r) + ',' + q(v[6] * r) : v.map(function (n) { return q(n * r); }).join(','));
      }).join('');
    }
    return tails[r];
  }
  return function (x, y, r) { return 'M' + Math.round((x + x0 * r) * 1e3) / 1e3 + ',' + Math.round((y + y0 * r) * 1e3) / 1e3 + tail(r); };
}
function shapeKey(L) { return SHAPES[L.c] ? L.c : 'perso'; }
function markerPath(L, r) { var k = shapeKey(L); return (SHAPE_FN[k] || (SHAPE_FN[k] = compileShape(SHAPES[k])))(L.px, L.py, r); }
var byId = {}, nodes = {}, halos = {}, PTS = [], hov = null;
// bulk : création au démarrage ; le chemin est alors écrit par le premier rescale(), qui connaît la taille à l'écran
// (le calculer ici puis le réécrire aussitôt doublait le coût de création des 3 400 marqueurs).
function register(L, bulk) {
  byId[L.i] = L; listOrder = null;
  var q = P(L.x, L.y); L.px = q[0]; L.py = q[1]; L._r = 0; L._off = false; L._dim = false; L._cls = 'poi ' + L.c; PTS.push(L);
  if (L.c === 'base') gH.appendChild(halos[L.i] = el('circle', { 'class': 'halo', cx: q[0], cy: q[1], r: 9 }));
  gM.appendChild(nodes[L.i] = el('path', bulk ? { 'class': L._cls, 'data-i': L.i } : { 'class': L._cls, 'data-i': L.i, d: markerPath(L, 1) }));
}
function unregister(i) {
  gM.removeChild(nodes[i]); delete nodes[i];
  if (halos[i]) { gH.removeChild(halos[i]); delete halos[i]; }
  delete byId[i]; PTS = PTS.filter(function (L) { return L.i !== i; }); listOrder = null;
}
// Après la modification d'une fiche : forme, halo et position suivent la catégorie et les coordonnées.
function redrawMarker(L) {
  var q = P(L.x, L.y); L.px = q[0]; L.py = q[1]; L._r = 0;
  nodes[L.i].setAttribute('d', markerPath(L, 1));
  if (L.c === 'base' && !halos[L.i]) gH.appendChild(halos[L.i] = el('circle', { 'class': 'halo', r: 9 }));
  if (L.c !== 'base' && halos[L.i]) { gH.removeChild(halos[L.i]); delete halos[L.i]; }
  if (halos[L.i]) { halos[L.i].setAttribute('cx', q[0]); halos[L.i].setAttribute('cy', q[1]); }
  L._cls = ''; syncMarker(L);
}
// Met le marqueur en accord avec l'état du lieu (filtré, estompé, favori, fait, choisi, survolé) ; n'écrit dans la page que si quelque chose change.
function syncMarker(L) {
  var s = statOf(L.i), c = 'poi ' + L.c + (L._off ? ' off' : '') + (L._dim ? ' dimmed' : '') + (s === 'fav' ? ' fav' : '') + (s === 'done' ? ' done' : '') + (L.i === sel ? ' sel' : '') + (L.i === hov ? ' hov' : '');
  if (c === L._cls) return;
  L._cls = c; nodes[L.i].setAttribute('class', c);
  if (halos[L.i]) halos[L.i].setAttribute('class', L._off ? 'halo off' : 'halo');
  if (L._r) paintStroke(L);
}
// Contour d'épaisseur constante à l'écran, exprimée en unités de carte : 1,2 px pour tous les lieux, posé une fois sur
// le calque des marqueurs (gM, hérité) ; plus épais pour un lieu survolé, favori ou choisi, posé sur ce seul marqueur.
// Au zoom, une seule écriture pour le cas commun au lieu d'une par lieu.
var strokeShown = 0;
function strokeWidth(f) { return Math.round(f * vb[2] / W * 1e5) / 1e5; }
function paintStroke(L) {
  var f = L.i === sel ? 2.6 : statOf(L.i) === 'fav' ? 2.4 : L.i === hov ? 2 : 0;
  if (!f) { if (L._sw) { L._sw = 0; nodes[L.i].removeAttribute('stroke-width'); } return; }
  var w = strokeWidth(f);
  if (w !== L._sw) { L._sw = w; nodes[L.i].setAttribute('stroke-width', w); }
}
function markStat(L) { if (nodes[L.i]) syncMarker(L); }
var selShown = null;
function paintSel() { var before = byId[selShown], now = byId[sel]; selShown = sel; if (before) syncMarker(before); if (now) syncMarker(now); }

// Les fiches modifiées s'appliquent au catalogue avant le dessin. Appelé une fois, au démarrage.
// Les calques des marqueurs et des halos sont remplis hors de la page, puis remis à leur place en une fois :
// 3 400 insertions dans un calque détaché coûtent bien moins que dans la carte affichée.
function drawPlaces() {
  mark('markers-start');
  var next = gM.nextSibling; svg.removeChild(gH); svg.removeChild(gM);
  DATA.lieux.forEach(function (L) { var e = ST.edits[L.i]; if (e) for (var k in e) L[k] = e[k]; L.m = months(L.s); register(L, true); });
  ST.custom.forEach(function (o) { if (byId[o.i]) return; var L = {}; for (var k in o) L[k] = o[k]; L.perso = true; L.m = months(L.s); register(L, true); });
  svg.insertBefore(gH, next); svg.insertBefore(gM, next);
  mark('markers-end');
}

var routeShadow = el('path', { id: 'routeShadow' }), routePath = el('path', { id: 'route' }), routeDots = [], routeNums = [];
gR.appendChild(routeShadow); gR.appendChild(routePath);
var journalPath = el('path', { 'class': 'journal-path' }), journalStops = [];
journalLayer.appendChild(journalPath);
var geoAccuracy = el('circle', { 'class': 'geo-accuracy' }), geoDot = el('circle', { 'class': 'geo-dot' });
geoLayer.appendChild(geoAccuracy); geoLayer.appendChild(geoDot); geoLayer.style.display = 'none';

/* ── Vue ── */
var W = 0, H = 0, vb = [0, 0, 1000, 700], viewFrame = 0, detailTimer = 0, nearBox = [-Infinity, -Infinity, Infinity, Infinity];
// Le cadrage suit le geste image par image ; tailles et noms sont recalculés une fois le geste posé.
function applyVB() {
  if (!viewFrame) viewFrame = requestAnimationFrame(function () {
    viewFrame = 0; svg.setAttribute('viewBox', vb.join(' ')); svg.classList.remove('loading'); scaleBar();
    // La vue sort de la zone où les marqueurs sont prêts (saut vers un lieu, long geste) : tout est recalculé tout de suite.
    if (vb[0] < nearBox[0] || vb[1] < nearBox[1] || vb[0] + vb[2] > nearBox[2] || vb[1] + vb[3] > nearBox[3]) rescale();
  });
  clearTimeout(detailTimer); detailTimer = setTimeout(rescale, 140);
}
function fitBox(x0, y0, x1, y1, pad) {
  pad = pad || .12;
  var w = Math.max(x1 - x0, 25), h = Math.max(y1 - y0, 20), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, ar = W / H;
  w *= 1 + pad * 2; h *= 1 + pad * 2; if (w / h < ar) w = h * ar; else h = w / ar;
  vb = [cx - w / 2, cy - h / 2, w, h]; applyVB();
}
function fitPts(list, pad) {
  if (!list.length) return;
  fitBox(Math.min.apply(0, list.map(function (l) { return l.px; })), Math.min.apply(0, list.map(function (l) { return l.py; })),
    Math.max.apply(0, list.map(function (l) { return l.px; })), Math.max.apply(0, list.map(function (l) { return l.py; })), pad);
}
function fitAll() { fitPts(PTS, .05); }
function fitDefault() {
  var mob = W < 700, a = P(mob ? -10 : -11, mob ? 36 : 35.5), b = P(mob ? 20 : 28, mob ? 52 : 55.5);
  fitBox(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1]), .02);
}
function resize() { var r = wrap.getBoundingClientRect(); W = r.width || W || 800; H = r.height || H || 600; svg.setAttribute('width', W); svg.setAttribute('height', H); }
function flyTo(L, w) { w = w || 70; vb = [L.px - w / 2, L.py - (w * H / W) / 2, w, w * H / W]; applyVB(); }
function zoomAt(cx, cy, f) {
  var nw = Math.min(Math.max(vb[2] * f, 12), 3000); f = nw / vb[2];
  vb[0] = cx - (cx - vb[0]) * f; vb[1] = cy - (cy - vb[1]) * f; vb[2] = nw; vb[3] = nw * H / W; applyVB();
}
function toWorld(cx, cy) { var r = svg.getBoundingClientRect(); return [vb[0] + (cx - r.left) / r.width * vb[2], vb[1] + (cy - r.top) / r.height * vb[3]]; }

/* Tailles à l'écran et noms affichés.
   Les marqueurs gardent une taille constante à l'écran, réduite en vue d'ensemble pour ne pas saturer la carte.
   Les noms sont placés par ordre de priorité, sans chevauchement ; les lieux moins importants se nomment en zoomant. */
var showLabels = true, allLabels = false, showCountry = true, labels = [], labelsUsed = 0;
// Largeur réelle d'un nom, pour une taille de police de 1 : mesurée une fois dans la police des noms (canevas hors page),
// elle remplace l'estimation « nombre de lettres × 0,56 » qui sous-estimait les noms larges et laissait des noms se chevaucher.
var labelCtx = null;
// Police des noms lue dans la feuille de style (jeton --font-body), sans getComputedStyle : lire un style calculé
// forcerait le navigateur à recalculer toute la page au démarrage, juste après la création des marqueurs.
function labelFont() {
  try {
    for (var i = 0; i < document.styleSheets.length; i++) {
      var rules = document.styleSheets[i].cssRules;
      for (var j = 0; j < rules.length; j++) { var v = rules[j].style && rules[j].style.getPropertyValue('--font-body'); if (v) return v.trim(); }
    }
  } catch (e) { /* feuille illisible : police générique */ }
  return 'sans-serif';
}
function labelWidth(L) {
  if (L._twn !== L.n) {
    L._twn = L.n; L._tw = L.n.length * .56;
    try {
      if (!labelCtx) { labelCtx = document.createElement('canvas').getContext('2d'); labelCtx.font = '600 100px ' + labelFont(); }
      var w = labelCtx.measureText(L.n).width / 100; if (w > 0) L._tw = w;
    } catch (e) { /* estimation conservée */ }
  }
  return L._tw;
}
function rescale() {
  if (!gest) svg.classList.remove('zooming');   // fin d'un zoom à la molette : le liseré des marqueurs revient
  var k = vb[2] / Math.max(W, 320), fs = k * 12, kept = [], order = [], inRoute = new Set(route);
  // k = unités de carte par pixel : grand en vue d'ensemble (surtout sur petit écran), petit quand on zoome.
  var dense = Math.min(1, Math.max(.5, .62 / k + .22));
  var mx = vb[0] - vb[2] * .05, MX = vb[0] + vb[2] * 1.05, my = vb[1] - vb[3] * .05, MY = vb[1] + vb[3] * 1.05;
  // Marqueurs lointains : au-delà d'une marge d'un écran et demi autour de la vue, ils sont masqués et leur taille n'est
  // pas recalculée (elle le sera dès qu'ils reviennent près de la vue). Un geste ordinaire ne sort jamais de cette marge ;
  // en vue rapprochée, la carte n'a plus à redessiner les marqueurs de toute l'Europe à chaque zoom.
  var fx0 = vb[0] - vb[2] * 1.5, fx1 = vb[0] + vb[2] * 2.5, fy0 = vb[1] - vb[3] * 1.5, fy1 = vb[1] + vb[3] * 2.5;
  nearBox = [fx0, fy0, fx1, fy1];
  var lim = allLabels ? 9 : (vb[2] > 700 ? 2 : vb[2] > 350 ? 3 : 4);
  var common = strokeWidth(1.2);
  if (common !== strokeShown) { strokeShown = common; gM.setAttribute('stroke-width', common); }
  for (var n = 0; n < PTS.length; n++) {
    var L = PTS[n];
    if (L._off) continue;
    var far = L.px < fx0 || L.px > fx1 || L.py < fy0 || L.py > fy1;
    if (far !== !!L._far) { L._far = far; nodes[L.i].style.display = far ? 'none' : ''; }
    if (far) continue;
    var routed = inRoute.has(L.i), r = (L.c === 'base' ? k * 6 : (L.w === 1 ? k * 5.2 : (L.w === 2 ? k * 4 : k * 3.3))) * (L.i === sel ? 1.35 : routed ? 1 : dense);
    // Un déplacement de la carte ne change aucune taille : rien n'est réécrit dans ce cas.
    if (r !== L._r) {
      L._r = r; nodes[L.i].setAttribute('d', markerPath(L, r));
      if (halos[L.i]) halos[L.i].setAttribute('r', k * 11);
    }
    paintStroke(L);
    if (!showLabels || L._dim) continue;
    // Candidats à un nom : assez importants pour ce niveau de zoom, et dans la vue.
    L._prio = (L.c === 'base' || L.c === 'perso') ? 0 : (L.i === sel || routed) ? 1 : L.w + 1;
    if (L._prio <= lim && L.px >= mx && L.px <= MX && L.py >= my && L.py <= MY) order.push(L);
  }
  order.sort(function (a, b) { return a._prio - b._prio; });
  var used = 0, h = fs * 1.15;
  gT.setAttribute('font-size', fs); gT.setAttribute('stroke-width', k * 2.4);
  for (var o = 0; o < order.length; o++) {
    var p = order[o], ext = p._r * (EXT[p.c] || 1.15);
    var x0 = p.px + ext, y0 = p.py - h * .62, x1 = x0 + labelWidth(p) * fs + ext + k * 5, y1 = y0 + h, clash = false;
    for (var j = 0; j < kept.length; j++) { var q = kept[j]; if (x0 < q[2] && x1 > q[0] && y0 < q[3] && y1 > q[1]) { clash = true; break; } }
    if (clash && p._prio > 1 && !allLabels) continue;
    kept.push([x0, y0, x1, y1]);
    var t = labels[used] || (labels[used] = gT.appendChild(el('text', { 'class': 'lbl' })));
    used++;
    if (t._n !== p.n) { t.textContent = p.n; t._n = p.n; }
    var cls = 'lbl' + (p.i === sel ? ' sel' : '') + (statOf(p.i) === 'done' ? ' done' : '');
    if (t._c !== cls) { t.setAttribute('class', cls); t._c = cls; }
    t.setAttribute('x', p.px + ext + k * 3.5); t.setAttribute('y', p.py + fs * .35);
    if (t._hidden) { t.style.display = ''; t._hidden = false; }
  }
  for (var u = used; u < labelsUsed; u++) { labels[u].style.display = 'none'; labels[u]._hidden = true; }
  labelsUsed = used;
  var countrySize = Math.min(k * 10, 15), countryOpacity = (!showCountry || k > 4) ? 0 : .75;
  if (countrySize !== countryShown[0] || countryOpacity !== countryShown[1]) {
    countryShown = [countrySize, countryOpacity];
    countryLabels.forEach(function (t) { t.setAttribute('font-size', countrySize); t.setAttribute('opacity', countryOpacity); });
  }
  routeDots.forEach(function (c) { c.setAttribute('r', k * 8); });
  routeNums.forEach(function (t) { t.setAttribute('font-size', k * 9); });
  journalStops.forEach(function (c) { c.setAttribute('r', k * 7); });
  paintGeolocation();
}
function scaleBar() {
  var c1 = invP(vb[0] + vb[2] * .1, vb[1] + vb[3] * .5), c2 = invP(vb[0] + vb[2] * .1 + vb[2] / W * 100, vb[1] + vb[3] * .5);
  var km = hav({ x: c1[0], y: c1[1] }, { x: c2[0], y: c2[1] }), nice = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000], pick = nice[0];
  nice.forEach(function (v) { if (v <= km * 2) pick = v; });
  $('#scaleBar').style.width = Math.round(100 * pick / km) + 'px';
  $('#scaleTxt').textContent = pick >= 1 ? pick + ' km' : '';
}

/* ── Infobulle (souris uniquement) ── */
var tp = $('#tip');
function tip(e, L) {
  tp.innerHTML = '<b>' + esc(L.n) + '</b>' + esc(L.d) + '<br><span>' + esc(L.p) + ' · ' + esc(L.s) + (L.du ? ' · ' + esc(L.du) : '') + (L.pe ? ' · ~' + esc(L.pe) + ' €' : '') + '</span>';
  tp.classList.add('on');
  tp.style.left = Math.max(8, Math.min(e.clientX + 14, innerWidth - 272)) + 'px';
  tp.style.top = Math.max(8, Math.min(e.clientY + 16, innerHeight - 110)) + 'px';
}
function hideTip() { tp.classList.remove('on'); hoverXY = null; paintHover(null); }
// Survol à la souris : le lieu désigné est le plus proche du pointeur, le même que celui qu'un clic choisirait.
var hoverXY = null, hoverFrame = 0;
function paintHover(L) {
  var id = L ? L.i : null;
  if (id === hov) return;
  var before = byId[hov]; hov = id;
  if (before) syncMarker(before);
  if (L) syncMarker(L);
  svg.classList.toggle('over', !!L);
}
function hoverAt(x, y) {
  hoverXY = [x, y];
  if (hoverFrame) return;
  hoverFrame = requestAnimationFrame(function () {
    hoverFrame = 0;
    if (!hoverXY) return;
    var found = pointCandidates(hoverXY[0], hoverXY[1], touchRadius)[0];
    if (found) { paintHover(found.p); tip({ clientX: hoverXY[0], clientY: hoverXY[1] }, found.p); } else hideTip();
  });
}

/* ── Sélection au clic ou au toucher : le lieu le plus proche dans un rayon confortable pour le doigt ── */
var touchRadius = 26;
function pointCandidates(cx, cy, radius) {
  var r = svg.getBoundingClientRect();
  if (!r.width || !r.height) return [];
  var sx = r.width / vb[2], sy = r.height / vb[3], found = [];
  for (var n = 0; n < PTS.length; n++) {
    var p = PTS[n];
    if (p._off || p._dim) continue;
    var d = Math.hypot(r.left + (p.px - vb[0]) * sx - cx, r.top + (p.py - vb[1]) * sy - cy);
    if (d <= radius) found.push({ p: p, d: d });
  }
  return found.sort(function (a, b) { return a.d - b.d; });
}
function selectPointAt(cx, cy) {
  var candidates = pointCandidates(cx, cy, touchRadius);
  if (!candidates.length) { if (isMobile()) hidePeek(); return; }
  hideTip();
  function choose(i) { if (quick) addTo(i); else show(i); }
  if (candidates.length === 1) return choose(candidates[0].p.i);
  var d = modalShell('Quel lieu ?', '<p>' + candidates.length + ' lieux se touchent ici. Choisissez-en un, ou zoomez pour les séparer.</p>' +
    candidates.slice(0, 10).map(function (o) {
      return '<button class="choose-place" type="button" data-choice="' + esc(o.p.i) + '"><strong>' + esc(o.p.n) + '</strong><small>' + esc(CATN[o.p.c] || o.p.c) + ' · ' + esc(o.p.p) + '</small></button>';
    }).join('') + '<div class="dialog-actions"><button class="btn" type="button" data-zoom-cluster>Zoomer ici</button></div>');
  d.addEventListener('click', function (e) {
    var b = e.target.closest('[data-choice]');
    if (b) { d.close(); choose(idValue(b.dataset.choice)); return; }
    if (e.target.closest('[data-zoom-cluster]')) { d.close(); var w = toWorld(cx, cy); zoomAt(w[0], w[1], .45); }
  });
}

/* ── Gestes : molette, glisser, pincer, double-clic, clavier ── */
var ptrs = {}, gest = null;
function wireMapGestures() {
  svg.addEventListener('wheel', function (e) {
    e.preventDefault(); geoFollow = false; svg.classList.add('zooming');
    var w = toWorld(e.clientX, e.clientY);
    zoomAt(w[0], w[1], Math.exp(Math.max(-100, Math.min(100, e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? H : 1))) * .002));
  }, { passive: false });
  svg.addEventListener('pointerdown', function (e) {
    geoFollow = false;
    ptrs[e.pointerId] = { x: e.clientX, y: e.clientY }; svg.setPointerCapture(e.pointerId);
    var ks = Object.keys(ptrs);
    if (ks.length === 1) { gest = { mode: 'pan', x: e.clientX, y: e.clientY, vx: vb[0], vy: vb[1], moved: 0 }; svg.classList.add('drag'); }
    else if (ks.length === 2) {
      var a = ptrs[ks[0]], b = ptrs[ks[1]];
      gest = { mode: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y), vb0: vb.slice(), c0: toWorld((a.x + b.x) / 2, (a.y + b.y) / 2) };
      svg.classList.remove('drag'); svg.classList.add('zooming');
    }
    hideTip();
  });
  svg.addEventListener('pointermove', function (e) {
    if (!ptrs[e.pointerId]) {
      // Survol sans bouton enfoncé : infobulle du lieu sous le pointeur.
      if (e.pointerType === 'mouse') hoverAt(e.clientX, e.clientY);
      return;
    }
    ptrs[e.pointerId] = { x: e.clientX, y: e.clientY };
    var ks = Object.keys(ptrs), r = svg.getBoundingClientRect();
    if (gest && gest.mode === 'pinch' && ks.length >= 2) {
      var a = ptrs[ks[0]], b = ptrs[ks[1]], d = Math.hypot(a.x - b.x, a.y - b.y);
      if (!d) return;
      var nw = Math.min(Math.max(gest.vb0[2] * gest.d0 / d, 12), 3000);
      vb[2] = nw; vb[3] = nw * H / W;
      vb[0] = gest.c0[0] - ((a.x + b.x) / 2 - r.left) / r.width * vb[2];
      vb[1] = gest.c0[1] - ((a.y + b.y) / 2 - r.top) / r.height * vb[3];
      applyVB();
    } else if (gest && gest.mode === 'pan') {
      var dx = (e.clientX - gest.x) / r.width * vb[2], dy = (e.clientY - gest.y) / r.height * vb[3];
      gest.moved = Math.max(gest.moved, Math.abs(e.clientX - gest.x) + Math.abs(e.clientY - gest.y));
      vb[0] = gest.vx - dx; vb[1] = gest.vy - dy; applyVB();
    }
  });
  function up(e) {
    var tap = e.type !== 'pointercancel' && gest && gest.mode === 'pan' && gest.moved < 9;
    delete ptrs[e.pointerId];
    if (!Object.keys(ptrs).length) {
      if (tap && addMode) placeCustom(e.clientX, e.clientY); else if (tap) selectPointAt(e.clientX, e.clientY);
      gest = null; svg.classList.remove('drag'); svg.classList.remove('zooming'); rescale(); scaleBar();
    } else { var rem = ptrs[Object.keys(ptrs)[0]]; gest = { mode: 'pan', x: rem.x, y: rem.y, vx: vb[0], vy: vb[1], moved: 99 }; }
  }
  svg.addEventListener('pointerup', up); svg.addEventListener('pointercancel', up);
  svg.addEventListener('pointerleave', hideTip);
  svg.addEventListener('dblclick', function (e) { var w = toWorld(e.clientX, e.clientY); zoomAt(w[0], w[1], 1 / 1.9); });

  $('#zin').onclick = function () { zoomAt(vb[0] + vb[2] / 2, vb[1] + vb[3] / 2, 1 / 1.5); };
  $('#zout').onclick = function () { zoomAt(vb[0] + vb[2] / 2, vb[1] + vb[3] / 2, 1.5); };
  $('#zfit').onclick = fitAll;
  $('#fit').onclick = function () { setToolsMenu(false); fitDefault(); };

  // Carte au clavier : flèches pour se déplacer quand elle a le focus.
  svg.addEventListener('keydown', function (e) {
    var step = vb[2] * .15;
    if (e.key === 'ArrowLeft') vb[0] -= step; else if (e.key === 'ArrowRight') vb[0] += step; else if (e.key === 'ArrowUp') vb[1] -= step; else if (e.key === 'ArrowDown') vb[1] += step; else return;
    e.preventDefault(); applyVB();
  });
  // Raccourcis généraux, inactifs pendant une saisie ou quand un dialogue est ouvert.
  document.addEventListener('keydown', function (e) {
    if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) || document.querySelector('dialog[open]')) return;
    if (e.key === 'Escape' && !$('#peek').hidden) { hidePeek(); sel = null; paintSel(); rescale(); }
    if (e.key === '+' || e.key === '=') $('#zin').onclick();
    if (e.key === '-') $('#zout').onclick();
    if (e.key === '0') fitDefault();
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
  });
  window.addEventListener('resize', function () { resize(); vb[3] = vb[2] * H / W; applyVB(); });
}
