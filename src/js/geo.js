/* Géométrie : projection de la carte, distances, saisons. Fonctions pures, sans DOM. */

// Projection conique conforme de Lambert, centrée sur l'Europe.
var d2r = Math.PI / 180, p1 = 40 * d2r, p2 = 58 * d2r, p0 = 46 * d2r, l0 = 10 * d2r;
var nn = Math.log(Math.cos(p1) / Math.cos(p2)) / Math.log(Math.tan(Math.PI / 4 + p2 / 2) / Math.tan(Math.PI / 4 + p1 / 2));
var FF = Math.cos(p1) * Math.pow(Math.tan(Math.PI / 4 + p1 / 2), nn) / nn;
var rr0 = FF / Math.pow(Math.tan(Math.PI / 4 + p0 / 2), nn), KK = 1400;
function P(lon, lat) {
  var r = FF / Math.pow(Math.tan(Math.PI / 4 + lat * d2r / 2), nn), t = nn * (lon * d2r - l0);
  return [r * Math.sin(t) * KK, (r * Math.cos(t) - rr0) * KK];
}
function invP(X, Y) {
  X /= KK; Y /= KK;
  var yy = Y + rr0, r = Math.sqrt(X * X + yy * yy) * (nn < 0 ? -1 : 1), t = Math.atan2(X, yy);
  return [(t / nn + l0) / d2r, (2 * Math.atan(Math.pow(FF / r, 1 / nn)) - Math.PI / 2) / d2r];
}
// Distance à vol d'oiseau en kilomètres entre deux points {x: longitude, y: latitude}.
function hav(a, b) {
  var R = 6371, dA = (b.y - a.y) * d2r, dO = (b.x - a.x) * d2r;
  var s = Math.sin(dA / 2) * Math.sin(dA / 2) + Math.cos(a.y * d2r) * Math.cos(b.y * d2r) * Math.sin(dO / 2) * Math.sin(dO / 2);
  return 2 * R * Math.asin(Math.sqrt(s));
}
// Distance en kilomètres d'un point au segment [a, b] (approximation plane, suffisante à l'échelle d'un trajet).
function segmentDistanceKm(p, a, b) {
  var c = Math.cos((a.y + b.y) * Math.PI / 360), dx = (b.x - a.x) * c, dy = b.y - a.y, px = (p.x - a.x) * c, py = p.y - a.y, len = dx * dx + dy * dy;
  var t = len ? Math.max(0, Math.min(1, (px * dx + py * dy) / len)) : 0;
  return Math.hypot(px - t * dx, py - t * dy) * 111.195;
}

/* Saisons : « mai-sept », « avr-juin, sept-oct », « toute l'année » → liste des mois (1 à 12). */
var MN = ['jan', 'fev', 'mars', 'avr', 'mai', 'juin', 'juil', 'aout', 'sept', 'oct', 'nov', 'dec'];
var MFULL = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
var ALL_MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
function noac(s) { return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
// Forme d'adresse d'un nom : « Mac. du Nord » → « mac-du-nord ». La même règle sert à la construction du site (build/site.mjs).
function slugOf(s) { return noac(s).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }
// Textes d'un lieu prêts pour la recherche (sans accents, en minuscules) : calculés une fois, refaits si la fiche change (L._k = null).
function searchKeys(L) {
  if (!L._k) { var n = noac(L.n), p = noac(L.p), d = noac(L.d), v = noac(L.v || ''); L._k = { n: n, p: p, d: d, v: v, e: noac(L.e || ''), np: n + ' ' + p, all: n + ' ' + p + ' ' + d + ' ' + v }; }
  return L._k;
}
// Mémorisé par texte de saison : quelques dizaines de textes différents pour des milliers de lieux.
// Chaque lieu reçoit sa propre copie du tableau.
var monthsMemo = {};
function months(s) {
  var key = String(s == null ? '' : s);
  if (!Object.prototype.hasOwnProperty.call(monthsMemo, key)) monthsMemo[key] = monthsOf(key);
  return monthsMemo[key].slice();
}
function monthsOf(s) {
  var t = noac(s || '');
  if (!t || /toute/.test(t)) return ALL_MONTHS.slice();
  var out = {}, segs = t.replace(/→/g, '-').split(/[,;·]/);
  segs.forEach(function (sg) {
    var m = sg.match(/jan|fev|mars|avr|mai|juin|juil|aout|sept|oct|nov|dec/g);
    if (!m) return;
    var a = MN.indexOf(m[0]) + 1, b = MN.indexOf(m[m.length - 1]) + 1;
    if (m.length === 1) { out[a] = 1; return; }
    var k = a;
    for (var i = 0; i < 12; i++) { out[k] = 1; if (k === b) break; k = k % 12 + 1; }
  });
  var r = Object.keys(out).map(Number);
  return r.length ? r : ALL_MONTHS.slice();
}

/* Dates au format AAAA-MM-JJ. */
var DAY = /^\d{4}-\d{2}-\d{2}$/;
function validDay(s) {
  return typeof s === 'string' && DAY.test(s) && Number.isFinite(new Date(s + 'T12:00:00Z').getTime()) && new Date(s + 'T12:00:00Z').toISOString().slice(0, 10) === s;
}
function dateToday() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function dateLabel(s) { if (!DAY.test(s || '')) return ''; return new Date(s + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }); }
