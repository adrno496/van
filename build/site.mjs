// Site éditorial Atlas Van : pages statiques produites à partir du catalogue et du contenu de content/.
//   dist/<mode>/index.html, destinations/, road-trips/, voyages/, carnet/, guides/, a-propos/, …, app/index.html (le Planner)
// Les pages s'ouvrent aussi bien depuis un serveur que par double-clic : tous les liens sont relatifs et nomment index.html.
// Aucune donnée n'est inventée : ce qui n'existe pas dans le catalogue ou dans content/ n'apparaît pas.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build as buildPlanner, catalogue, evaluate, PERSONAL, privacyGate } from './planner.mjs';
import { loadContent, visibleContent, privateStrings, isServiceKey } from './content.mjs';
import { partagePages } from './partage.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
const read = (...p) => fs.readFileSync(path.join(...p), 'utf8');

/* ───────────── Outils ───────────── */
export const slug = (s) => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const nb = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');
const plural = (n, one, many) => `${nb(n)} ${n > 1 ? many : one}`;
const clip = (s, max) => { const t = String(s || '').replace(/\s+/g, ' ').trim(); return t.length <= max ? t : t.slice(0, max - 1).replace(/\s+\S*$/, '') + '…'; };
const jsonForHtml = (v) => JSON.stringify(v).replace(/</g, '\\u003c');
const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const MONTHS_FULL = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const dateLabel = (d) => { const [y, m, j] = d.split('-').map(Number); return `${j === 1 ? '1er' : j} ${MONTHS_FULL[m - 1]} ${y}`; };
const CATEGORIES = { ville: ['ville', 'villes'], patrimoine: ['site de patrimoine', 'sites de patrimoine'], nature: ['site naturel', 'sites naturels'], plage: ['lieu de côte', 'lieux de côte'],
  boulot: ['piste de travail saisonnier', 'pistes de travail saisonnier'], pratique: ['halte pratique', 'haltes pratiques'], base: ['base', 'bases'] };
const TRIP_TYPES = { long: 'Long voyage', 'thème': 'Thématique', hiver: 'Hiver', printemps: 'Printemps', 'été': 'Été', automne: 'Automne', court: 'Court séjour' };
// Noms des pays dans les contours (anglais) quand le libellé de la carte ne suffit pas à les retrouver.
const GEO_NAMES = { Luxembourg: 'Luxembourg', Lituanie: 'Lithuania', Estonie: 'Estonia', Lettonie: 'Latvia', Finlande: 'Finland', Andorre: 'Andorra' };

/* ───────────── Géométrie : contours simplifiés pour les cartes illustrées ───────────── */
// Douglas-Peucker, sans récursion (certains contours ont plusieurs milliers de points).
function simplify(points, tolerance) {
  if (points.length < 5) return points;
  const keep = new Uint8Array(points.length); keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]], t2 = tolerance * tolerance;
  while (stack.length) {
    const [a, b] = stack.pop(); let max = 0, at = -1;
    const [ax, ay] = points[a], [bx, by] = points[b], dx = bx - ax, dy = by - ay, len = dx * dx + dy * dy;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = points[i]; let t = len ? ((px - ax) * dx + (py - ay) * dy) / len : 0; t = Math.max(0, Math.min(1, t));
      const d = (px - ax - t * dx) ** 2 + (py - ay - t * dy) ** 2;
      if (d > max) { max = d; at = i; }
    }
    if (max > t2 && at > 0) { keep[at] = 1; stack.push([a, at], [at, b]); }
  }
  return points.filter((_, i) => keep[i]);
}
function geometry(pays, P) {
  return pays.map((c) => {
    const rings = c.r.map((r) => r.map((p) => P(p[0], p[1])));
    const xs = rings.flat().map((p) => p[0]), ys = rings.flat().map((p) => p[1]);
    const level = (tol, min) => rings.map((r) => simplify(r, tol)).filter((r) => r.length >= min);
    return { name: c.n, label: c.l || '', box: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)], fine: level(.9, 4), mid: level(2.2, 4), coarse: level(5, 4) };
  });
}
// Fond de carte partagé par toutes les cartes illustrées d'une page.
const worldDefs = (geo) => (geo.used.size ? `<svg class="sprite" width="0" height="0" aria-hidden="true" focusable="false"><defs>${[...geo.used].map((level) =>
  `<path id="fond-${level}" class="pl-land" d="${geo.map((g) => pathOf(g[level], level === 'mid' ? 1 : 0)).join('')}"/>`).join('')}</defs></svg>` : '');
const pathOf = (rings, d = 1) => rings.map((r) => 'M' + r.map((p) => p[0].toFixed(d) + ' ' + p[1].toFixed(d)).join('L') + 'Z').join('');
const overlaps = (a, b) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
// Cadre : la boîte des points, élargie d'une marge puis mise au rapport largeur / hauteur voulu.
function frame(box, ratio, pad = .1) {
  let [x0, y0, x1, y1] = box, w = Math.max(x1 - x0, 30), h = Math.max(y1 - y0, 30);
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2; w *= 1 + pad * 2; h *= 1 + pad * 2;
  if (w / h < ratio) w = h * ratio; else h = w / ratio;
  return [cx - w / 2, cy - h / 2, w, h];
}
const boxOf = (pts) => [Math.min(...pts.map((p) => p[0])), Math.min(...pts.map((p) => p[1])), Math.max(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[1]))];

// Carte illustrée : terres voisines, pays mis en avant, lieux (un seul tracé pour tous les points), itinéraire.
// Ce sont des dessins tirés des données de l'Atlas, pas des photographies : ils tiennent la place d'une image tant qu'aucune n'est fournie.
function plate(geo, { view, hi = [], dots = [], strong = [], route = null, planned = null, last = null, detail = 'mid', label = null, cls = '', scale = 1 }) {
  // u : centième de la plus petite dimension utile du cadre ; les points et les traits gardent la même taille relative quel que soit le format.
  const [x, y, w, h] = view, u = Math.min(w, h * 1.5) / 100 * scale, d = w > 1500 ? 0 : 1;
  // Le fond de carte (tous les pays) n'est écrit qu'une fois par page ; chaque carte illustrée y renvoie. Le cadre affiché peut être plus large
  // ou plus haut que « view » (l'image n'est jamais rognée) : les points sont pris dans une fenêtre élargie.
  const win = [x - w * .8, y - h * .8, x + w * 1.8, y + h * 1.8], level = detail === 'fine' ? 'mid' : 'coarse';
  geo.used.add(level);
  const dot = (list) => list.filter((p) => p[0] > win[0] && p[0] < win[2] && p[1] > win[1] && p[1] < win[3]).map((p) => 'M' + p[0].toFixed(d) + ' ' + p[1].toFixed(d) + 'h0').join('');
  const a11y = label ? `role="img" aria-label="${esc(label)}"` : 'aria-hidden="true" focusable="false"';
  return `<svg class="plate ${cls}" viewBox="${[x, y, w, h].map((v) => v.toFixed(0)).join(' ')}" preserveAspectRatio="xMidYMid ${cls.includes('plate-hero') ? 'slice' : 'meet'}" ${a11y}>` +
    `<use href="#fond-${level}" stroke-width="${(u * .18).toFixed(2)}"/>` +
    (hi.length ? `<path class="pl-hi" d="${hi.map((g) => pathOf(g[detail], d)).join('')}" stroke-width="${(u * .28).toFixed(2)}"/>` : '') +
    (dots.length ? `<path class="pl-dots" d="${dot(dots)}" stroke-width="${(u * (dots.length > 400 ? .42 : dots.length > 100 ? .6 : .9)).toFixed(2)}"/>` : '') +
    (strong.length ? `<path class="pl-dots pl-strong" d="${dot(strong)}" stroke-width="${(u * (dots.length > 400 ? .8 : dots.length > 100 ? 1.1 : 1.6)).toFixed(2)}"/>` : '') +
    (route && route.length > 1 ? `<path class="pl-route-bg" d="M${route.map((p) => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('L')}" stroke-width="${(u * 1.1).toFixed(2)}"/>` +
      `<path class="pl-route" d="M${route.map((p) => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('L')}" stroke-width="${(u * .5).toFixed(2)}"/>` +
      `<path class="pl-stops" d="${route.map((p) => 'M' + p[0].toFixed(1) + ' ' + p[1].toFixed(1) + 'h0').join('')}" stroke-width="${(u * 1.3).toFixed(2)}"/>` +
      `<circle class="pl-start" cx="${route[0][0].toFixed(1)}" cy="${route[0][1].toFixed(1)}" r="${(u * 1.2).toFixed(2)}" stroke-width="${(u * .45).toFixed(2)}"/>` : '') +
    // Étapes prévues (seulement si le propriétaire a choisi de les montrer) : tracé en pointillés, distinct de la route parcourue.
    (planned && planned.length > 1 ? `<path class="pl-planned" d="M${planned.map((p) => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('L')}" stroke-width="${(u * .45).toFixed(2)}" stroke-dasharray="${(u * 1.4).toFixed(2)} ${(u * 1.1).toFixed(2)}"/>` : '') +
    // Dernière étape publiée : un repère cerclé, jamais une position « en direct ».
    (last ? `<circle class="pl-last-halo" cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="${(u * 3).toFixed(2)}" stroke-width="${(u * .5).toFixed(2)}"/><circle class="pl-last" cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="${(u * 1.5).toFixed(2)}" stroke-width="${(u * .5).toFixed(2)}"/>` : '') +
    '</svg>';
}

/* ───────────── Données dérivées du catalogue ───────────── */
function derive(cat, mode) {
  const { P, hav, months } = evaluate(['js', 'geo.js'], ['P', 'hav', 'months']);
  const geo = geometry(cat.pays, P);
  const byId = new Map(cat.app.lieux.map((L) => [L.i, L]));
  const pt = (L) => P(L.x, L.y);
  const geoFor = (name) => geo.find((g) => g.name === GEO_NAMES[name]) || geo.find((g) => g.label && slug(g.label) === slug(name)) || null;
  const legKm = (a, b) => hav(a, b) * 1.25;      // même estimation que le Planner : vol d'oiseau majoré de 25 %

  const used = new Set();
  const unique = (base) => { let s = base || 'page', n = 2; while (used.has(s)) s = `${base}-${n++}`; used.add(s); return s; };

  const trips = cat.app.parcours.map((r, index) => {
    const places = r.l.map((id) => byId.get(id)).filter(Boolean);
    let km = 0; for (let k = 1; k < places.length; k++) km += legKm(places[k - 1], places[k]);
    const countries = [...new Set(places.map((L) => L.p))];
    return { index, slug: slug(r.n), title: r.n, summary: r.d, type: r.t, typeLabel: TRIP_TYPES[r.t] || 'Itinéraire', places, km: Math.round(km),
      countries, loop: places.length > 2 && places[0].i === places[places.length - 1].i, points: places.map(pt) };
  });
  const slugs = trips.map((t) => t.slug);
  if (new Set(slugs).size !== slugs.length) throw new Error('Deux parcours ont la même adresse : renommer l’un d’eux');

  const names = [...new Set(cat.app.lieux.map((L) => L.p))];
  const countries = names.map((name) => {
    const places = cat.app.lieux.filter((L) => L.p === name);
    const cats = {}; places.forEach((L) => { cats[L.c] = (cats[L.c] || 0) + 1; });
    const perMonth = new Array(12).fill(0), dated = places.filter((L) => !/vérifier/i.test(L.s || ''));
    dated.forEach((L) => months(L.s).forEach((m) => { perMonth[m - 1]++; }));
    const top = places.filter((L) => L.w === 1 && L.c !== 'boulot' && L.c !== 'pratique' && L.c !== 'base').slice(0, 9);
    return { name, slug: slug(name), places, count: places.length, cats, top, perMonth, dated: dated.length, meta: cat.app.meta[name] || null, geo: geoFor(name), points: places.map(pt),
      trips: trips.filter((t) => t.places.filter((L) => L.p === name).length >= 2) };
  }).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'fr'));
  countries.forEach((c) => used.add('destinations/' + c.slug));

  const jobs = cat.app.lieux.filter((L) => L.c === 'boulot');
  return { geo, byId, pt, P, hav, legKm, trips, countries, jobs, all: cat.app.lieux.map(pt), strong: cat.app.lieux.filter((L) => L.w === 1).map(pt), places: cat.app.lieux, meta: cat.app.meta, checklist: cat.app.checklist, unique, mode };
}

/* ───────────── Voyage : étapes publiées ───────────── */
// Les étapes d'un voyage sont ses récits publiés qui sont situés (lieu de l'Atlas ou lieu approximatif) et que le propriétaire n'a pas retirés
// de la carte (« onMap »: false). À défaut de récit situé, les lieux déclarés du voyage (« placeIds ») tiennent lieu d'étapes, sans date.
// Aucune position n'est inventée ni « actuelle » : la dernière étape est celle du dernier récit publié.
function journey(ctx, v) {
  const { d, content } = ctx;
  const articles = content.articles.filter((a) => a.voyage === v.slug).sort((a, b) => a.date.localeCompare(b.date) || a.slug.localeCompare(b.slug));
  const located = articles.filter((a) => a.onMap).map((a) => {
    const L = a.placeId != null ? d.byId.get(a.placeId) : null;
    if (L) return { name: L.n, country: L.p, date: a.date, article: a, placeId: L.i, at: { x: L.x, y: L.y }, approx: false };
    if (a.place) return { name: a.place.name, country: a.place.country, date: a.date, article: a, placeId: null, at: { x: a.place.lon, y: a.place.lat }, approx: true };
    return null;
  }).filter(Boolean);
  const fromArticles = located.length > 0;
  const stages = fromArticles ? located : v.placeIds.map((id) => d.byId.get(id)).filter(Boolean).map((L) => ({ name: L.n, country: L.p, date: null, article: null, placeId: L.i, at: { x: L.x, y: L.y }, approx: false }));
  stages.forEach((s) => { s.pt = d.P(s.at.x, s.at.y); });
  let estimate = 0; for (let k = 1; k < stages.length; k++) estimate += d.legKm(stages[k - 1].at, stages[k].at);
  const planned = v.showPlanned ? v.planned.map((id) => d.byId.get(id)).filter(Boolean) : [];
  const countries = [...new Set([...v.countries, ...stages.map((s) => s.country).filter(Boolean)])];
  const lastDate = articles.length ? articles[articles.length - 1].date : null;
  const end = v.dateEnd || lastDate;
  const days = v.dateStart && end && end >= v.dateStart ? Math.round((Date.parse(end) - Date.parse(v.dateStart)) / 864e5) + 1 : null;
  const updates = [v.updatedAt, ...articles.map((a) => a.updatedAt || a.date)].filter(Boolean).sort();
  return { voyage: v, articles, stages, fromArticles, last: fromArticles ? stages[stages.length - 1] : null, planned, plannedPts: planned.map(d.pt),
    // Distance : celle que le voyageur a publiée ; sinon une estimation entre étapes (vol d'oiseau + 25 %), toujours dite « estimée ».
    km: v.distanceKm != null ? { value: v.distanceKm, estimated: false } : stages.length > 1 ? { value: Math.round(estimate), estimated: true } : null,
    countries, days, ongoing: v.state === 'ongoing' && !v.dateEnd, updated: updates.length ? updates[updates.length - 1] : null };
}
const lastStage = (x, cls = '') => `<p class="last-stage ${cls}"><span>Dernière étape publiée</span><strong>${esc(x.name)}</strong><span class="last-meta">${x.country ? esc(x.country) + ' · ' : ''}<time datetime="${esc(x.date)}">${esc(dateLabel(x.date))}</time>${x.approx ? ' · position approximative' : ''}</span></p>`;
const STATE_LABEL = { ongoing: 'En cours', finished: 'Terminé', planned: 'À venir' };
function journeyPlate(ctx, j, { ratio = 4 / 3, detail = 'mid', label = null, cls = '' } = {}) {
  const pts = [...j.stages.map((s) => s.pt), ...j.plannedPts];
  const view = pts.length ? frame(boxOf(pts), ratio, pts.length > 1 ? .18 : 4) : frame(boxOf(ctx.d.all), ratio, .02);
  const hi = j.countries.map((n) => ctx.d.countries.find((c) => c.name === n)).filter((c) => c && c.geo).map((c) => c.geo);
  return plate(ctx.d.geo, { view, hi, route: j.stages.length > 1 ? j.stages.map((s) => s.pt) : null, planned: j.plannedPts.length > 1 ? [j.last ? j.last.pt : j.stages.length ? j.stages[j.stages.length - 1].pt : j.plannedPts[0], ...j.plannedPts] : null,
    last: j.last ? j.last.pt : null, dots: pts.length ? [] : ctx.d.all, detail, label, cls });
}
const mapLegend = (j) => `<ul class="map-legend">${j.stages.length > 1 ? '<li><span class="lg lg-route" aria-hidden="true"></span>Route parcourue, d’étape en étape</li>' : ''}${j.last ? '<li><span class="lg lg-last" aria-hidden="true"></span>Dernière étape publiée</li>' : ''}${j.plannedPts.length ? '<li><span class="lg lg-planned" aria-hidden="true"></span>Étapes prévues (indicatives)</li>' : ''}</ul>`;
function journeyLabel(j) {
  const v = j.voyage;
  if (!j.stages.length) return `Carte du voyage « ${v.title} » : aucune étape publiée pour l’instant.`;
  return `Carte du voyage « ${v.title} » : ${j.stages.length} étape${j.stages.length > 1 ? 's' : ''}${j.fromArticles ? ' publiée' + (j.stages.length > 1 ? 's' : '') : ''}, de ${j.stages[0].name} à ${j.stages[j.stages.length - 1].name}${j.last ? ` (dernière étape publiée : ${j.last.name}, le ${dateLabel(j.last.date)})` : ''}. La liste des étapes suit la carte.`;
}

/* ───────────── Gabarit commun ───────────── */
// Rubriques de l'en-tête ; le menu et le pied de page y ajoutent le carnet (journal de route) et la recherche.
const NAV = [['voyage-en-cours/index.html', 'Mon voyage'], ['voyages/index.html', 'Mes voyages'], ['destinations/index.html', 'Destinations'], ['road-trips/index.html', 'Road trips'], ['partage/index.html', 'Partage'], ['guides/index.html', 'Guides'], ['a-propos/index.html', 'À propos']];
const MENU = [...NAV.slice(0, 2), ['carnet/index.html', 'Carnet de route'], ...NAV.slice(2)];
const ICON = {
  arrow: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  menu: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
  close: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  search: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>'
};
// Politique de sécurité des pages du site : aucune requête vers un autre serveur. Seules les pages de « Partage » reçoivent,
// quand l'espace communautaire est configuré, une politique propre qui autorise ce seul serveur (voir partagePages).
export const CSP = "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'none'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
// La politique est un texte fixe (jamais une donnée du contenu) : écrite telle quelle, sans guillemet double possible.
const cspOf = (page) => { const v = page.csp || CSP; if (/["<>&]/.test(v)) throw new Error('politique de sécurité invalide'); return v; };
function shell(ctx, page) {
  // La page 404 est servie par l'hébergeur à n'importe quelle adresse : ses liens partent de la racine du site quand elle est connue.
  const root = page.path === '404.html' && ctx.content.site.siteUrl ? new URL(ctx.content.site.siteUrl + '/').pathname : null;
  const depth = page.path.split('/').length - 1, up = '../'.repeat(depth), to = (target) => (root != null ? root + target : up + target);
  const section = page.path.split('/')[0];
  const current = (href) => (href.split('/')[0] === section && depth > 0 ? ' aria-current="' + (page.path === href ? 'page' : 'true') + '"' : '');
  const site = ctx.content.site, title = page.home ? `${site.name} — ${site.descriptor}` : `${page.title} — ${site.name}`;
  const description = clip(page.description, 158);
  const url = site.siteUrl ? `${site.siteUrl}/${page.path.replace(/index\.html$/, '')}` : null;
  const crumbs = page.crumbs && page.crumbs.length ? `<nav class="crumbs wrap" aria-label="Fil d’Ariane"><ol>${[['index.html', 'Accueil'], ...page.crumbs].map(([href, label], i, list) =>
    i === list.length - 1 ? `<li aria-current="page">${esc(label)}</li>` : `<li><a href="${esc(to(href))}">${esc(label)}</a></li>`).join('')}</ol></nav>` : '';
  const ld = [...(page.jsonld || [])];
  if (page.crumbs && page.crumbs.length && site.siteUrl) ld.push({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [['index.html', 'Accueil'], ...page.crumbs].map(([href, label], i) =>
    ({ '@type': 'ListItem', position: i + 1, name: label, item: `${site.siteUrl}/${href.replace(/index\.html$/, '')}` })) });
  ctx.d.geo.used = new Set();
  const body = page.body(to);
  const pageNav = page.home ? NAV.slice(2) : NAV;
  const pageMenu = page.home ? pageNav : MENU;
  const nav = (cls, list = pageNav) => list.map(([href, label]) => `<a class="${cls}" href="${esc(to(href))}"${current(href)}>${label}</a>`).join('');
  return `<!doctype html>
<html lang="fr" dir="ltr" data-direction="${esc(ctx.direction)}" data-mode="${esc(ctx.mode)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta http-equiv="Content-Security-Policy" content="${cspOf(page)}">
<meta name="referrer" content="no-referrer">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
${ctx.mode !== 'public' || page.noindex ? '<meta name="robots" content="noindex">\n' : ''}${url && !page.noindex && ctx.mode === 'public' ? `<link rel="canonical" href="${esc(url)}">\n<meta property="og:url" content="${esc(url)}">\n` : ''}<meta property="og:type" content="${page.article ? 'article' : 'website'}">
<meta property="og:site_name" content="${esc(site.name)}">
<meta property="og:locale" content="fr_FR">
<meta property="og:title" content="${esc(page.home ? site.name : page.title)}">
<meta property="og:description" content="${esc(description)}">
<meta name="theme-color" content="${ctx.direction === 'a' ? '#1f3329' : '#f1ede5'}">
<link rel="stylesheet" href="${esc(to('assets/site.css'))}">
<script src="${esc(to('assets/site.js'))}" defer></script>${(page.scripts || []).map((src) => `\n<script src="${esc(to(src))}" defer></script>`).join('')}
${ld.map((o) => `<script type="application/ld+json">${jsonForHtml(o)}</script>`).join('\n')}
</head>
<body class="${page.home ? 'is-home' : 'is-inner'}${page.bodyClass ? ' ' + page.bodyClass : ''}"${page.data ? ` data-partage="${esc(page.data)}"` : ''}>
<a class="skip-link" href="#main">Aller au contenu</a>
${worldDefs(ctx.d.geo)}
<header class="site-head">
  <div class="wrap head-row">
    <a class="brand" href="${esc(to('index.html'))}"${page.home ? ' aria-current="page"' : ''}>Atlas <em>Van</em></a>
    <nav class="site-nav" aria-label="Rubriques">${nav('nav-link')}</nav>
    <a class="btn btn-cta" href="${esc(to('app/index.html'))}">Préparer mon voyage</a>
    <button class="menu-btn" type="button" aria-haspopup="dialog" aria-controls="menu" aria-label="Ouvrir le menu" data-menu-open>${ICON.menu}</button>
  </div>
</header>
<dialog class="menu-sheet" id="menu" aria-label="Menu du site">
  <div class="menu-top"><span class="brand">Atlas <em>Van</em></span><button class="menu-btn" type="button" aria-label="Fermer le menu" data-menu-close>${ICON.close}</button></div>
  <nav class="menu-nav" aria-label="Rubriques (menu)"><a class="menu-link" href="${esc(to('index.html'))}">Accueil</a>${nav('menu-link', pageMenu)}<a class="menu-link" href="${esc(to('recherche/index.html'))}">Rechercher</a></nav>
  <a class="btn btn-primary btn-block" href="${esc(to('app/index.html'))}">Préparer mon voyage ${ICON.arrow}</a>
</dialog>
<main id="main" tabindex="-1">
${crumbs}${body}
</main>
<footer class="site-foot">
  <div class="wrap foot-grid">
    <div class="foot-brand"><a class="brand" href="${esc(to('index.html'))}">Atlas <em>Van</em></a><p>${esc(site.descriptor)}. ${esc(plural(ctx.d.places.length, 'lieu', 'lieux'))}, ${esc(plural(ctx.d.trips.length, 'itinéraire', 'itinéraires'))} et un outil de préparation qui fonctionne sur votre appareil.</p></div>
    <nav class="foot-nav" aria-label="Plan du site"><h2 class="foot-title">Explorer</h2><ul>${pageMenu.map(([href, label]) => `<li><a href="${esc(to(href))}">${label}</a></li>`).join('')}<li><a href="${esc(to('recherche/index.html'))}">Rechercher</a></li></ul></nav>
    <nav class="foot-nav" aria-label="Outil et informations"><h2 class="foot-title">Atlas</h2><ul><li><a href="${esc(to('app/index.html'))}">Préparer mon voyage</a></li><li><a href="${esc(to('confidentialite/index.html'))}">Confidentialité</a></li><li><a href="${esc(to('mentions/index.html'))}">Mentions</a></li></ul>${
      site.social.length ? `<ul class="foot-social">${site.social.map((s) => `<li><a href="${esc(s.url)}" rel="noopener noreferrer">${esc(s.label)}</a></li>`).join('')}</ul>` : ''}</nav>
  </div>
  <div class="wrap foot-note"><p>Sans mesure d’audience, sans traceur, sans publicité. Le blog et le Planner se lisent et s’utilisent sans compte.${ctx.mode !== 'public' ? ' <strong>Version personnelle</strong> : elle peut contenir du contenu privé, ne pas la publier.' : ''}</p></div>
</footer>
</body>
</html>
`;
}

/* ───────────── Composants ───────────── */
const eyebrow = (t) => `<p class="eyebrow">${esc(t)}</p>`;
const badge = (t, cls = '') => `<span class="badge ${cls}">${esc(t)}</span>`;
const facts = (list) => `<dl class="facts">${list.filter(Boolean).map(([k, v, note]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}${note ? `<small>${esc(note)}</small>` : ''}</dd></div>`).join('')}</dl>`;
const more = (href, label) => `<a class="more" href="${esc(href)}">${esc(label)} ${ICON.arrow}</a>`;
// Texte rédigé (voyage, article, guide) : paragraphes, intertitres « ## », listes « - ». Tout est échappé.
function prose(text) {
  return String(text || '').split(/\n{2,}/).map((block) => {
    const b = block.trim(); if (!b) return '';
    if (b.startsWith('## ')) return `<h2>${esc(b.slice(3))}</h2>`;
    if (b.split('\n').every((l) => l.trim().startsWith('- '))) return `<ul>${b.split('\n').map((l) => `<li>${esc(l.trim().slice(2))}</li>`).join('')}</ul>`;
    return `<p>${esc(b).replace(/\n/g, '<br>')}</p>`;
  }).join('\n');
}
function figure(ctx, to, image, { cls = '', eager = false, sizes = '100vw' } = {}) {
  ctx.media.add(image.src);
  return `<img class="${cls}" src="${esc(to('media/' + image.src))}" width="${image.width}" height="${image.height}" alt="${esc(image.alt || '')}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async" sizes="${sizes}">`;
}
const visual = (ctx, to, item, fallback, opts) => (item && item.cover ? figure(ctx, to, item.cover, opts) : fallback);

function countryPlate(ctx, c, { ratio = 4 / 3, detail = 'mid', label = null, cls = '' } = {}) {
  const box = c.geo ? c.geo.box : boxOf(c.points);
  return plate(ctx.d.geo, { view: frame(box, ratio, .12), hi: c.geo ? [c.geo] : [], dots: c.points, strong: c.top.map(ctx.d.pt), detail, label, cls });
}
function tripPlate(ctx, t, { ratio = 4 / 3, detail = 'mid', label = null, cls = '' } = {}) {
  return plate(ctx.d.geo, { view: frame(boxOf(t.points), ratio, .14), route: t.points, detail, label, cls });
}
function countryCard(ctx, to, c, { large = false, h = 3 } = {}) {
  const told = ctx.content.voyages.some((v) => v.countries.includes(c.name));
  return `<article class="card card-plate${large ? ' card-large' : ''} reveal"><a class="card-link" href="${esc(to(`destinations/${c.slug}/index.html`))}">` +
    `<div class="card-media">${countryPlate(ctx, c, { ratio: large ? 16 / 10 : 4 / 3, detail: large ? 'mid' : 'coarse' })}</div>` +
    `<div class="card-body">${told ? badge('Raconté', 'badge-accent') : ''}<h${h} class="card-title">${esc(c.name)}</h${h}>` +
    `<p class="card-meta">${esc(plural(c.count, 'lieu', 'lieux'))}${c.trips.length ? ' · ' + esc(plural(c.trips.length, 'road trip', 'road trips')) : ''}</p></div></a></article>`;
}
function tripCard(ctx, to, t, { large = false } = {}) {
  return `<article class="card card-plate${large ? ' card-large' : ''} reveal"><a class="card-link" href="${esc(to(`road-trips/${t.slug}/index.html`))}">` +
    `<div class="card-media">${tripPlate(ctx, t, { ratio: large ? 16 / 10 : 4 / 3, detail: 'coarse' })}</div>` +
    `<div class="card-body">${badge(t.typeLabel)}<h3 class="card-title">${esc(t.title)}</h3><p class="card-text">${esc(t.summary)}</p>` +
    `<p class="card-meta">${esc(plural(t.places.length, 'étape', 'étapes'))} · ${esc(nb(t.km))} km · ${esc(plural(t.countries.length, 'pays', 'pays'))}</p></div></a></article>`;
}
const privacyBadge = (item) => (item.isPublic ? '' : badge(item.status === 'draft' ? 'Brouillon — privé' : 'Privé', 'badge-private')) + (item.demo ? badge('DÉMO', 'badge-demo') : '');
function storyCard(ctx, to, item, folder, meta, fallback, h = 3, large = false) {
  return `<article class="card card-story${large ? ' card-large' : ''} reveal"><a class="card-link" href="${esc(to(`${folder}/${item.slug}/index.html`))}">` +
    `<div class="card-media">${visual(ctx, to, item, fallback, { cls: 'card-img', sizes: '(min-width: 900px) 33vw, 100vw' })}</div>` +
    `<div class="card-body">${privacyBadge(item)}<p class="card-meta">${esc(meta)}</p><h${h} class="card-title">${esc(item.title)}</h${h}>${item.summary || item.excerpt ? `<p class="card-text">${esc(clip(item.summary || item.excerpt, 180))}</p>` : ''}</div></a></article>`;
}
// Bandeau d'appel vers le Planner : le même partout, une action à la fois.
const plannerBand = (to, { title, text, href = 'app/index.html', label = 'Préparer mon voyage' }) =>
  `<section class="band band-planner"><div class="wrap band-row"><div><h2 class="band-title">${esc(title)}</h2><p>${esc(text)}</p></div><a class="btn btn-light" href="${esc(to(href))}">${esc(label)} ${ICON.arrow}</a></div></section>`;
// Chiffres d'un voyage : seulement ce que les données publiées permettent d'affirmer ; une distance calculée est dite « estimée ».
function voyageFacts(j) {
  const v = j.voyage;
  return facts([v.dateStart ? ['Départ', dateLabel(v.dateStart)] : null, ['État', STATE_LABEL[v.state]], j.countries.length ? ['Pays', j.countries.join(', ')] : null,
    j.stages.length ? [j.fromArticles ? 'Étapes publiées' : 'Étapes', String(j.stages.length)] : null,
    j.km ? ['Distance', nb(j.km.value) + ' km', j.km.estimated ? 'estimée entre étapes (vol d’oiseau + 25 %)' : (j.ongoing ? 'publiée par le voyageur' : '')] : null,
    j.days ? [j.ongoing ? 'Jours de voyage' : 'Durée', `${j.days} jour${j.days > 1 ? 's' : ''}`, j.ongoing && !v.dateEnd ? 'jusqu’au dernier récit publié' : ''] : null,
    j.updated ? ['Mis à jour', dateLabel(j.updated)] : null]);
}
const emptyState = (title, text, extra = '') => `<div class="empty reveal"><h2 class="empty-title">${esc(title)}</h2><p>${esc(text)}</p>${extra}</div>`;
// Emplacement de contenu à fournir : visible dans la version personnelle seulement, jamais publié.
const todo = (ctx, title, text) => (ctx.mode === 'public' ? '' : `<aside class="todo" aria-label="Contenu à fournir"><p class="todo-tag">À compléter — non publié</p><h2 class="todo-title">${esc(title)}</h2><p>${esc(text)}</p></aside>`);

/* ───────────── Pages ───────────── */
function pages(ctx) {
  const { d, content } = ctx, out = [];
  const add = (p) => out.push(p);
  const N = d.places.length, C = d.countries.length, R = d.trips.length;
  // Trois itinéraires de nature différente en première page : un thème, une saison, un court séjour (à défaut, les premiers du catalogue).
  const featuredTrips = [...new Set([d.trips.find((t) => t.type === 'thème'), d.trips.find((t) => t.type === 'été') || d.trips.find((t) => ['printemps', 'automne', 'hiver'].includes(t.type)), d.trips.find((t) => t.type === 'court'), ...d.trips].filter(Boolean))].slice(0, 3);
  const tripOf = (slug_) => content.voyages.find((v) => v.slug === slug_);
  const voyageMeta = (v) => [v.countries.join(', '), v.dateStart ? dateLabel(v.dateStart) : '', v.distanceKm ? nb(v.distanceKm) + ' km' : ''].filter(Boolean).join(' · ');
  const voyageArt = (v) => { const pts = v.placeIds.map((id) => d.byId.get(id)).filter(Boolean).map(d.pt); return pts.length > 1 ? plate(d.geo, { view: frame(boxOf(pts), 4 / 3, .15), route: pts, detail: 'coarse' }) : plate(d.geo, { view: frame(boxOf(d.all), 4 / 3, .02), dots: d.all, detail: 'coarse' }); };
  const articleArt = (a) => { const L = !a.onMap ? null : a.placeId != null ? d.byId.get(a.placeId) : a.place ? { x: a.place.lon, y: a.place.lat } : null; return L ? plate(d.geo, { view: frame(boxOf([d.pt(L)]), 4 / 3, 6), strong: [d.pt(L)], detail: 'coarse' }) : plate(d.geo, { view: frame(boxOf(d.all), 4 / 3, .02), dots: d.all, detail: 'coarse' }); };

  /* Accueil : destinations, itinéraires et outils pour préparer son voyage. */
  const hero = content.site.hero;
  const cur = content.site.currentVoyage ? journey(ctx, content.voyages.find((v) => v.slug === content.site.currentVoyage)) : null;
  add({ path: 'index.html', home: true, title: content.site.name, description: `${hero.title}. ${hero.lead}`.length >= 70 ? `${hero.title}. ${hero.lead}` : `${hero.title}. ${hero.lead} Atlas de ${nb(N)} lieux en Europe et outil pour préparer un voyage en van.`,
    jsonld: content.site.siteUrl ? [{ '@context': 'https://schema.org', '@type': 'WebSite', name: content.site.name, url: content.site.siteUrl + '/', inLanguage: 'fr' }] : [],
    body: (to) => `
<section class="hero">
  <div class="hero-art">${plate(d.geo, { view: frame(boxOf(d.all), 4 / 3, .03), dots: d.all, strong: d.strong, detail: 'mid', cls: 'plate-hero', scale: .62 })}</div>
  <div class="wrap hero-text">
    ${eyebrow(hero.eyebrow || content.site.name)}
    <h1 class="hero-title">${esc(hero.title)}</h1>
    <p class="hero-lead">${esc(hero.lead)}</p>
    <div class="hero-actions"><a class="btn btn-primary" href="${esc(to('app/index.html'))}">${esc(hero.primary)}</a><a class="btn btn-ghost" href="${esc(to('destinations/index.html'))}">${esc(hero.secondary)}</a></div>
    <p class="hero-more"><a href="${esc(to('road-trips/index.html'))}">${esc(hero.tertiary)} ${ICON.arrow}</a></p>
  </div>
</section>
<section class="section">
  <div class="wrap">
    <header class="section-head"><div><h2 class="section-title">Explorer l’Atlas</h2><p class="section-lead">${esc(nb(N))} lieux dans ${C} pays d’Europe et ${R} itinéraires à adapter : de quoi repérer ses propres étapes.</p></div>${more(to('destinations/index.html'), `Les ${C} pays`)}</header>
    <div class="grid grid-feature">${d.countries.slice(0, 3).map((c, i) => countryCard(ctx, to, c, { large: i === 0 })).join('')}</div>
  </div>
</section>
<section class="band band-atlas">
  <div class="wrap atlas-row">
    <div class="atlas-figure reveal"><p class="atlas-number">${esc(nb(N))}</p><p class="atlas-unit">lieux dans l’Atlas</p></div>
    <div class="atlas-text reveal"><h2 class="band-title">Une carte pour repérer ses étapes</h2>
      <p>Villes, patrimoine, sites naturels, côtes et haltes pratiques : ${esc(Object.entries(d.places.reduce((a, L) => { a[L.c] = (a[L.c] || 0) + 1; return a; }, {})).filter(([k]) => CATEGORIES[k] && k !== 'base').sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, n]) => `${nb(n)} ${CATEGORIES[k][1]}`).join(', '))}, et le reste à découvrir en zoomant.</p>
      <a class="btn btn-light" href="${esc(to('app/index.html'))}">Explorer la carte ${ICON.arrow}</a></div>
  </div>
</section>
<section class="section">
  <div class="wrap">
    <header class="section-head"><div><h2 class="section-title">Road trips</h2><p class="section-lead">Des itinéraires prêts à adapter, étape par étape, à ouvrir ensuite dans le Planner.</p></div>${more(to('road-trips/index.html'), `Les ${R} itinéraires`)}</header>
    <div class="grid grid-feature">${featuredTrips.map((t, i) => tripCard(ctx, to, t, { large: i === 0 })).join('')}</div>
  </div>
</section>
<section class="section section-quiet section-tight">
  <div class="wrap split-even">
    <div><h2 class="section-title">Partage</h2><p class="section-lead">Circuits, spots, astuces et retours d’expérience proposés par d’autres voyageurs. Des idées pour préparer votre voyage, à lire sans compte.</p>${more(to('partage/index.html'), 'Voir les partages')}</div>
    <div><h2 class="section-title">Guides pratiques</h2><ul class="link-list link-list-compact">${ctx.guides.slice(0, 3).map((g) => `<li><a href="${esc(to(`guides/${g.slug}/index.html`))}"><span class="link-title">${esc(g.title)}</span>${ICON.arrow}</a></li>`).join('')}</ul>${more(to('guides/index.html'), 'Tous les guides')}</div>
  </div>
</section>
${plannerBand(to, { title: 'Un outil pour préparer votre voyage', text: 'Choisissez des étapes, estimez distances et budget, gardez vos notes. Le Planner fonctionne hors ligne, sur votre appareil, sans compte.', label: hero.primary })}
<section class="section section-tight"><div class="wrap narrow about-teaser"><h2 class="section-title">À propos</h2><p>${esc(content.site.name)} vous aide à préparer vos voyages en van en Europe : trouvez des lieux à découvrir, choisissez vos étapes et estimez votre budget.</p>${more(to('a-propos/index.html'), 'En savoir plus')}</div></section>` });

  /* Destinations */
  add({ path: 'destinations/index.html', title: 'Destinations', crumbs: [['destinations/index.html', 'Destinations']],
    description: `Les ${C} pays de l’Atlas : nombre de lieux, itinéraires qui les traversent, meilleure saison d’après les fiches.`,
    body: (to) => `<header class="page-head wrap">${eyebrow('Destinations')}<h1 class="page-title">Destinations</h1>
<p class="page-lead">${C} pays, ${esc(nb(N))} lieux repérés. Figurer dans l’Atlas ne veut pas dire que le pays a été parcouru : seuls ceux qu’un voyage publié traverse portent la mention « Raconté ».</p></header>
<section class="section section-tight"><div class="wrap"><div class="grid grid-4">${d.countries.map((c) => countryCard(ctx, to, c, { h: 2 })).join('')}</div></div></section>
${plannerBand(to, { title: 'Tout voir sur une seule carte', text: 'Le Planner affiche les lieux de tous les pays, avec filtres par catégorie, saison et importance.', label: 'Explorer la carte' })}` });
  for (const c of d.countries) {
    const catLine = Object.entries(c.cats).filter(([k]) => CATEGORIES[k]).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${nb(n)} ${CATEGORIES[k][n > 1 ? 1 : 0]}`).join(', ');
    const peak = Math.max(...c.perMonth), best = c.perMonth.map((n, i) => [n, i]).filter(([n]) => peak && n >= peak * .9).map(([, i]) => MONTHS_FULL[i]);
    const told = content.voyages.filter((v) => v.countries.includes(c.name)), stories = content.articles.filter((a) => a.placeId != null && d.byId.get(a.placeId) && d.byId.get(a.placeId).p === c.name);
    add({ path: `destinations/${c.slug}/index.html`, title: `${c.name} en van`, crumbs: [['destinations/index.html', 'Destinations'], [`destinations/${c.slug}/index.html`, c.name]],
      description: `${c.name} en van : ${plural(c.count, 'lieu repéré', 'lieux repérés')} dans l’Atlas (${catLine}).${c.trips.length ? ` ${c.trips.length} itinéraire${c.trips.length > 1 ? 's' : ''} y passe${c.trips.length > 1 ? 'nt' : ''}.` : ''}`,
      body: (to) => `<header class="detail-head"><div class="detail-art">${countryPlate(ctx, c, { ratio: 21 / 9, detail: 'fine', label: `Carte : ${c.name} et les ${nb(c.count)} lieux de l’Atlas`, cls: 'plate-wide' })}</div>
<div class="wrap detail-intro">${badge(told.length ? 'Raconté' : 'Dans l’Atlas', told.length ? 'badge-accent' : '')}<h1 class="page-title">${esc(c.name)}</h1>
<p class="page-lead">${esc(plural(c.count, 'lieu repéré', 'lieux repérés'))} : ${esc(catLine)}.</p>
${facts([['Lieux', nb(c.count)], c.trips.length ? ['Road trips', String(c.trips.length)] : null, best.length && c.dated >= 5 ? ['Saison la plus citée', best.slice(0, 3).join(', '), `d’après la saison indiquée sur ${nb(c.dated)} fiches`] : null, c.meta ? ['Gazole', c.meta.g.toFixed(2).replace('.', ',') + ' €/L', 'relevé de l’Atlas, non daté'] : null])}
<a class="btn btn-primary" href="${esc(to(`app/index.html#pays=${c.slug}`))}">Explorer ${esc(c.count > 1 ? `les ${nb(c.count)} lieux` : 'ce lieu')} dans Atlas ${ICON.arrow}</a></div></header>
${c.top.length ? `<section class="section"><div class="wrap"><h2 class="section-title">Incontournables de l’Atlas</h2><p class="section-lead stops-hint">Chaque nom ouvre le lieu dans le Planner.</p><ol class="stops">${c.top.map((L) => `<li class="reveal"><h3 class="stop-title"><a href="${esc(to(`app/index.html#lieu=${L.i}`))}">${esc(L.n)}</a></h3><p>${esc(L.d)}</p>${L.s && !/vérifier/i.test(L.s) ? `<p class="stop-meta">${esc(L.s)}${L.du ? ' · ' + esc(L.du) : ''}</p>` : ''}</li>`).join('')}</ol></div></section>` : ''}
${c.dated >= 5 ? `<section class="section section-quiet"><div class="wrap split"><div><h2 class="section-title">Quand partir</h2><p>Nombre de lieux « en saison » chaque mois, d’après la saison indiquée sur ${esc(nb(c.dated))} fiches de l’Atlas. C’est un repère, pas une prévision météo.</p></div>
<figure class="months" role="img" aria-label="Lieux en saison par mois : ${esc(c.perMonth.map((n, i) => `${MONTHS_FULL[i]} ${n}`).join(', '))}"><svg viewBox="0 0 240 90" aria-hidden="true" focusable="false">${c.perMonth.map((n, i) => { const h = peak ? Math.max(2, n / peak * 66) : 2; return `<rect class="${peak && n >= peak * .9 ? 'bar bar-hi' : 'bar'}" x="${i * 20 + 3}" y="${(70 - h).toFixed(1)}" width="14" height="${h.toFixed(1)}" rx="2"/><text class="bar-label" x="${i * 20 + 10}" y="84">${MONTHS_FULL[i].charAt(0).toUpperCase()}</text>`; }).join('')}</svg></figure></div></section>` : ''}
${c.trips.length ? `<section class="section"><div class="wrap"><h2 class="section-title">Road trips qui y passent</h2><div class="grid grid-3">${c.trips.slice(0, 6).map((t) => tripCard(ctx, to, t)).join('')}</div></div></section>` : ''}
${told.length || stories.length ? `<section class="section"><div class="wrap"><h2 class="section-title">Récits</h2><div class="grid grid-3">${[...told.map((v) => storyCard(ctx, to, v, 'voyages', voyageMeta(v), voyageArt(v))), ...stories.map((a) => storyCard(ctx, to, a, 'carnet', dateLabel(a.date), articleArt(a)))].join('')}</div></div></section>` : ''}
${c.meta ? `<section class="section section-quiet"><div class="wrap narrow"><h2 class="section-title">Sur la route</h2><p class="caveat">Notes de l’Atlas, non sourcées et non datées : à vérifier auprès des sources officielles avant de partir.</p>
<dl class="notes"><div><dt>Routes et péages</dt><dd>${esc(c.meta.v)}</dd></div><div><dt>Nuits en van</dt><dd>${esc(c.meta.b)}</dd></div><div><dt>Gazole</dt><dd>${esc(c.meta.g.toFixed(2).replace('.', ','))} € le litre</dd></div></dl>
${more(to('guides/regles-et-couts-par-pays/index.html'), 'Comparer tous les pays')}</div></section>` : ''}
${plannerBand(to, { title: `Préparer un voyage en ${c.name}`, text: `Le Planner s’ouvre sur la carte, filtrée sur ${c.name}.`, href: `app/index.html#pays=${c.slug}`, label: 'Ouvrir dans Atlas' })}` });
  }

  /* Road trips */
  const groups = [['Longs voyages', (t) => t.type === 'long'], ['Au fil des saisons', (t) => ['hiver', 'printemps', 'été', 'automne'].includes(t.type)], ['Par thème', (t) => t.type === 'thème'], ['Courts séjours', (t) => t.type === 'court']];
  add({ path: 'road-trips/index.html', title: 'Road trips', crumbs: [['road-trips/index.html', 'Road trips']], description: `${R} itinéraires en van à travers l’Europe : étapes, distance estimée, pays traversés. À adapter dans le Planner.`,
    body: (to) => `<header class="page-head wrap">${eyebrow('Road trips')}<h1 class="page-title">Road trips</h1>
<p class="page-lead">${R} itinéraires à adapter : des suites d’étapes tirées de l’Atlas. Les distances sont estimées (vol d’oiseau majoré de 25 %) ; ce sont des propositions, pas des voyages réalisés.</p></header>
${groups.map(([title, test]) => { const list = d.trips.filter(test); return list.length ? `<section class="section section-tight"><div class="wrap"><h2 class="section-title">${esc(title)}</h2><div class="grid grid-3">${list.map((t) => tripCard(ctx, to, t)).join('')}</div></div></section>` : ''; }).join('')}
${plannerBand(to, { title: 'Composer le vôtre', text: 'Partez d’un itinéraire ou d’une carte vide : ajoutez, retirez, réordonnez les étapes.' })}` });
  for (const t of d.trips) {
    add({ path: `road-trips/${t.slug}/index.html`, title: t.title, crumbs: [['road-trips/index.html', 'Road trips'], [`road-trips/${t.slug}/index.html`, t.title]],
      description: `${t.title} : ${t.summary}. ${t.places.length} étapes, environ ${nb(t.km)} km à travers ${t.countries.slice(0, 6).join(', ')}.`,
      body: (to) => `<header class="detail-head"><div class="detail-art">${tripPlate(ctx, t, { ratio: 21 / 9, detail: 'fine', label: `Carte de l’itinéraire « ${t.title} » : ${t.places.length} étapes`, cls: 'plate-wide' })}</div>
<div class="wrap detail-intro">${badge(t.typeLabel)}<h1 class="page-title">${esc(t.title)}</h1><p class="page-lead">${esc(t.summary)}.</p>
${facts([['Étapes', String(t.places.length)], ['Distance estimée', nb(t.km) + ' km', 'vol d’oiseau majoré de 25 %'], ['Pays', t.countries.join(', ')], t.loop ? ['Forme', 'Boucle : retour au point de départ'] : null])}
<a class="btn btn-primary" href="${esc(to(`app/index.html#parcours=${t.slug}`))}">Préparer ce parcours dans Atlas ${ICON.arrow}</a></div></header>
<section class="section"><div class="wrap narrow"><h2 class="section-title">Les étapes</h2><p class="section-lead stops-hint">Chaque nom ouvre l’étape dans le Planner.</p>
<ol class="stops stops-numbered">${t.places.map((L, i) => `<li class="reveal"><h3 class="stop-title"><a href="${esc(to(`app/index.html#lieu=${L.i}`))}">${esc(L.n)}</a></h3><p class="stop-meta">${esc(L.p)}${L.du ? ' · ' + esc(L.du) : ''}${i === t.places.length - 1 && t.loop ? ' · retour' : ''}</p><p>${esc(L.d)}</p></li>`).join('')}</ol></div></section>
<section class="section section-quiet"><div class="wrap narrow"><h2 class="section-title">À savoir</h2>
<p>Cet itinéraire est une proposition construite à partir de l’Atlas, pas un voyage réalisé. Sa durée n’est pas indiquée : elle dépend entièrement de votre rythme. Le Planner l’estime, avec le carburant et le budget, à partir de vos réglages (kilomètres par semaine, nuits par étape, consommation).</p>
<ul class="plain-list">${t.countries.filter((n) => d.countries.find((c) => c.name === n)).map((n) => `<li><a href="${esc(to(`destinations/${slug(n)}/index.html`))}">${esc(n)} : lieux et règles sur la route</a></li>`).join('')}</ul></div></section>
${plannerBand(to, { title: 'Faire de ce parcours le vôtre', text: 'Il s’ouvre dans le Planner ; si un trajet est déjà en cours, rien n’est remplacé sans votre accord.', href: `app/index.html#parcours=${t.slug}`, label: 'Préparer ce parcours' })}` });
  }

  /* Voyage en cours : une seule source, « currentVoyage » dans content/site.json, et les récits rattachés à ce voyage. */
  add({ path: 'voyage-en-cours/index.html', title: cur ? `${cur.voyage.title} — le voyage en cours` : 'Mon voyage', crumbs: [['voyage-en-cours/index.html', 'Mon voyage']], noindex: !cur, article: !!cur,
    description: cur ? (cur.voyage.summary && cur.voyage.summary.length >= 70 ? cur.voyage.summary : `Suivre « ${cur.voyage.title} » : ${[cur.countries.join(', '), cur.stages.length ? plural(cur.stages.length, 'étape', 'étapes') : '', cur.voyage.summary].filter(Boolean).join(' · ')}. Carte, étapes publiées, récits et photos.`) : 'Le voyage en cours sera suivi ici, étape par étape, dès qu’il sera publié.',
    body: (to) => cur ? `<header class="detail-head"><div class="detail-art">${visual(ctx, to, cur.voyage, journeyPlate(ctx, cur, { ratio: 21 / 9, detail: 'fine', label: journeyLabel(cur), cls: 'plate-wide' }), { cls: 'detail-img', eager: true })}</div>
<div class="wrap detail-intro">${badge(STATE_LABEL[cur.voyage.state], 'badge-accent')}${privacyBadge(cur.voyage)}<h1 class="page-title">${esc(cur.voyage.title)}</h1>${cur.voyage.summary ? `<p class="page-lead">${esc(cur.voyage.summary)}</p>` : ''}
${voyageFacts(cur)}</div></header>
${cur.voyage.cover ? `<section class="section section-tight"><div class="wrap"><figure class="voyage-map voyage-map-wide">${journeyPlate(ctx, cur, { ratio: 16 / 9, detail: 'fine', label: journeyLabel(cur), cls: 'plate-wide' })}<figcaption>${mapLegend(cur)}<p class="map-note">Position approximative, publiée avec les récits : jamais en direct.</p></figcaption></figure></div></section>` :
  `<div class="wrap"><div class="map-caption">${mapLegend(cur)}<p class="map-note">Position approximative, publiée avec les récits : jamais en direct.</p></div></div>`}
${cur.last ? `<section class="section section-tight"><div class="wrap narrow">${lastStage(cur.last, 'last-stage-large')}${more(to(`carnet/${cur.last.article.slug}/index.html`), 'Lire le récit de cette étape')}</div></section>` : ''}
${cur.voyage.text ? `<section class="section section-tight"><div class="wrap prose">${prose(cur.voyage.text)}</div></section>` : ''}
<section class="section section-quiet"><div class="wrap narrow"><h2 class="section-title">${cur.fromArticles ? 'Les étapes publiées' : 'Les étapes'}</h2>
${cur.stages.length ? `<ol class="stops stops-numbered timeline">${cur.stages.map((x) => `<li><h3 class="stop-title">${x.article ? `<a href="${esc(to(`carnet/${x.article.slug}/index.html`))}">${esc(x.name)}</a>` : x.placeId != null ? `<a href="${esc(to(`app/index.html#lieu=${x.placeId}`))}">${esc(x.name)}</a>` : esc(x.name)}</h3><p class="stop-meta">${[x.date ? `<time datetime="${esc(x.date)}">${esc(dateLabel(x.date))}</time>` : '', x.country ? esc(x.country) : '', x.approx ? 'position approximative' : ''].filter(Boolean).join(' · ')}</p>${x.article && x.article.excerpt ? `<p>${esc(clip(x.article.excerpt, 200))}</p>` : ''}</li>`).join('')}</ol>` :
  '<p>Aucune étape publiée pour l’instant. Elles apparaîtront ici avec les récits du voyage.</p>'}
${cur.planned.length ? `<h2 class="section-title section-title-next">Étapes prévues</h2><p class="caveat">Intentions de route, susceptibles de changer : ce ne sont pas des étapes parcourues.</p><ul class="plain-list">${cur.planned.map((L) => `<li>${esc(L.n)} <span class="stop-meta">${esc(L.p)}</span></li>`).join('')}</ul>` : ''}</div></section>
${cur.articles.length ? `<section class="section"><div class="wrap"><header class="section-head"><h2 class="section-title">Derniers récits du voyage</h2>${more(to('carnet/index.html'), 'Tout le carnet')}</header><div class="grid grid-3">${[...cur.articles].reverse().slice(0, 6).map((a) => storyCard(ctx, to, a, 'carnet', dateLabel(a.date), articleArt(a))).join('')}</div></div></section>` : ''}
${cur.voyage.gallery.length ? `<section class="section"><div class="wrap"><h2 class="section-title">En images</h2><div class="gallery">${cur.voyage.gallery.map((g) => `<figure>${figure(ctx, to, g, { sizes: '(min-width: 900px) 50vw, 100vw' })}${g.caption ? `<figcaption>${esc(g.caption)}</figcaption>` : ''}</figure>`).join('')}</div></div></section>` : ''}
${cur.countries.some((n) => d.countries.find((c) => c.name === n)) ? `<section class="section section-tight"><div class="wrap narrow"><h2 class="section-title">Ces pays dans l’Atlas</h2><ul class="plain-list">${cur.countries.filter((n) => d.countries.find((c) => c.name === n)).map((n) => `<li><a href="${esc(to(`destinations/${slug(n)}/index.html`))}">${esc(n)} : lieux, saisons et règles sur la route</a></li>`).join('')}</ul>
<p>${more(to(`voyages/${cur.voyage.slug}/index.html`), 'La page complète du voyage')}</p></div></section>` : ''}
${plannerBand(to, { title: 'Préparer votre voyage', text: 'Le Planner reprend les lieux de l’Atlas ; à vous d’en faire votre itinéraire. Il fonctionne hors ligne, sur votre appareil.', label: content.site.hero.tertiary })}` :
      `<header class="page-head wrap">${eyebrow('Mon voyage')}<h1 class="page-title">Le voyage en cours</h1><p class="page-lead">Le voyage en cours sera suivi ici, étape par étape : carte des étapes publiées, récits et photographies.</p></header>
<section class="section section-tight"><div class="wrap">${emptyState('Aucun voyage en cours n’est publié pour l’instant', 'Les étapes paraissent ici au fil des récits publiés, avec une position approximative et jamais en direct.', `<p>${more(to('voyages/index.html'), 'Voir mes voyages')}</p>`)}
${todo(ctx, 'Désigner le voyage en cours', 'Dans content/site.json, « currentVoyage » : le slug d’un voyage de content/voyages/. Ses étapes sont les articles qui lui sont rattachés (« voyage ») et situés (« placeId » ou « place »).')}</div></section>
${plannerBand(to, { title: 'Préparer votre voyage', text: 'Le Planner fonctionne hors ligne, sur votre appareil, sans compte.', label: content.site.hero.tertiary })}` });

  /* Voyages (récits du propriétaire) */
  add({ path: 'voyages/index.html', title: 'Mes voyages', crumbs: [['voyages/index.html', 'Mes voyages']], description: 'Les voyages en van racontés sur Atlas Van : itinéraire, étapes, photographies.',
    body: (to) => `<header class="page-head wrap">${eyebrow('Voyages')}<h1 class="page-title">Mes voyages</h1><p class="page-lead">Les voyages réellement parcourus et racontés : le voyage en cours et les précédents.</p></header>
<section class="section section-tight"><div class="wrap">${content.voyages.length ? `<div class="grid grid-feature">${content.voyages.map((v) => storyCard(ctx, to, v, 'voyages', voyageMeta(v), voyageArt(v), 2)).join('')}</div>` :
      emptyState('Aucun voyage n’est encore raconté ici', 'Cette rubrique accueillera les récits de voyages réalisés. En attendant, les road trips proposent des itinéraires à adapter.', `<p>${more(to('road-trips/index.html'), 'Voir les road trips')}</p>`)}
${todo(ctx, 'Vos voyages', 'Ajoutez un fichier par voyage dans content/voyages/ (titre, dates, pays, lieux de l’Atlas, photographies). Modèle et champs : content/README.md.')}</div></section>` });
  for (const v of content.voyages) {
    const stops = v.placeIds.map((id) => d.byId.get(id)).filter(Boolean), related = content.articles.filter((a) => a.voyage === v.slug);
    const days = v.dateStart && v.dateEnd ? Math.round((Date.parse(v.dateEnd) - Date.parse(v.dateStart)) / 864e5) + 1 : null;
    add({ path: `voyages/${v.slug}/index.html`, title: v.title, article: true, noindex: !v.isPublic, crumbs: [['voyages/index.html', 'Mes voyages'], [`voyages/${v.slug}/index.html`, v.title]], description: v.summary && v.summary.length >= 70 ? v.summary : [v.title, v.summary, v.countries.join(', '), v.text].filter(Boolean).join(' — '),
      body: (to) => `<header class="detail-head"><div class="detail-art">${visual(ctx, to, v, stops.length > 1 ? plate(d.geo, { view: frame(boxOf(stops.map(d.pt)), 21 / 9, .15), route: stops.map(d.pt), detail: 'fine', label: `Carte du voyage « ${v.title} »`, cls: 'plate-wide' }) : voyageArt(v), { cls: 'detail-img', eager: true })}</div>
<div class="wrap detail-intro">${v.slug === content.site.currentVoyage ? badge('Voyage en cours', 'badge-accent') : ''}${privacyBadge(v)}<h1 class="page-title">${esc(v.title)}</h1>${v.summary ? `<p class="page-lead">${esc(v.summary)}</p>` : ''}${v.slug === content.site.currentVoyage ? `<p>${more(to('voyage-en-cours/index.html'), 'Suivre ce voyage étape par étape')}</p>` : ''}
${facts([v.countries.length ? ['Pays', v.countries.join(', ')] : null, v.dateStart ? ['Départ', dateLabel(v.dateStart)] : null, days ? ['Durée', `${days} jours`] : null, v.distanceKm ? ['Distance', nb(v.distanceKm) + ' km'] : null, stops.length ? ['Étapes', String(stops.length)] : null])}</div></header>
${v.text ? `<section class="section"><div class="wrap prose">${prose(v.text)}</div></section>` : ''}
${stops.length ? `<section class="section section-quiet"><div class="wrap narrow"><h2 class="section-title">Les étapes</h2><ol class="stops stops-numbered">${stops.map((L) => `<li><h3 class="stop-title"><a href="${esc(to(`app/index.html#lieu=${L.i}`))}">${esc(L.n)}</a></h3><p class="stop-meta">${esc(L.p)}</p></li>`).join('')}</ol></div></section>` : ''}
${v.gallery.length ? `<section class="section"><div class="wrap"><h2 class="section-title">En images</h2><div class="gallery">${v.gallery.map((g) => `<figure>${figure(ctx, to, g, { sizes: '(min-width: 900px) 50vw, 100vw' })}${g.caption ? `<figcaption>${esc(g.caption)}</figcaption>` : ''}</figure>`).join('')}</div></div></section>` : ''}
${related.length ? `<section class="section"><div class="wrap"><h2 class="section-title">Récits de ce voyage</h2><div class="grid grid-3">${related.map((a) => storyCard(ctx, to, a, 'carnet', dateLabel(a.date), articleArt(a))).join('')}</div></div></section>` : ''}
${plannerBand(to, { title: 'Préparer un voyage dans ces pays', text: 'Le Planner reprend les lieux de l’Atlas ; à vous d’en faire votre itinéraire.' })}` });
  }

  /* Carnet (articles publiés) */
  add({ path: 'carnet/index.html', title: 'Carnet', crumbs: [['carnet/index.html', 'Carnet']], description: 'Le carnet de route d’Atlas Van : récits d’étapes, datés et situés sur la carte.',
    body: (to) => `<header class="page-head wrap">${eyebrow('Carnet')}<h1 class="page-title">Carnet de route</h1><p class="page-lead">Des récits d’étapes, datés et situés. Seuls les articles explicitement publiés paraissent ici ; le carnet personnel reste dans le Planner, sur l’appareil.</p></header>
<section class="section section-tight"><div class="wrap">${content.articles.length ? `<div class="grid grid-3">${content.articles.map((a) => storyCard(ctx, to, a, 'carnet', dateLabel(a.date) + (a.placeId != null && d.byId.get(a.placeId) ? ' · ' + d.byId.get(a.placeId).n : a.place ? ' · ' + a.place.name : ''), articleArt(a), 2)).join('')}</div>` :
      emptyState('Aucun récit publié pour l’instant', 'Le carnet personnel se tient dans le Planner, où il reste privé. Un article ne paraît ici qu’après avoir été exporté puis marqué comme public.', `<p>${more(to('app/index.html'), 'Ouvrir le carnet personnel')}</p>`)}
${todo(ctx, 'Publier un récit', 'Dans le Planner : Carnet › Blog à partager › « Fichier pour le site », puis node build/import-articles.mjs <fichier> : les articles arrivent dans content/articles/, privés et en brouillon. Passez « visibility » à "public" et « status » à "published" pour ceux que vous choisissez (détail : CONTENT_WORKFLOW.md).')}</div></section>` });
  content.articles.forEach((a, i) => {
    const L = a.placeId != null ? d.byId.get(a.placeId) : null, prev = content.articles[i + 1], next = content.articles[i - 1], v = a.voyage ? tripOf(a.voyage) : null;
    add({ path: `carnet/${a.slug}/index.html`, title: a.title, article: true, noindex: !a.isPublic, bodyClass: 'is-article', crumbs: [['carnet/index.html', 'Carnet'], [`carnet/${a.slug}/index.html`, a.title]], description: a.excerpt && a.excerpt.length >= 70 ? a.excerpt : [a.excerpt, a.text].filter(Boolean).join(' — '),
      jsonld: content.site.siteUrl && a.isPublic ? [{ '@context': 'https://schema.org', '@type': 'Article', headline: a.title, datePublished: a.date, ...(a.updatedAt ? { dateModified: a.updatedAt } : {}), inLanguage: 'fr' }] : [],
      body: (to) => `<article class="story"><header class="story-head wrap narrow">${privacyBadge(a)}<p class="story-meta"><time datetime="${esc(a.date)}">${esc(dateLabel(a.date))}</time>${L ? ` · ${esc(L.n)}, ${esc(L.p)}` : a.place ? ` · ${esc(a.place.name)}${a.place.country ? ', ' + esc(a.place.country) : ''}` : ''}</p><h1 class="page-title">${esc(a.title)}</h1>${a.excerpt ? `<p class="page-lead">${esc(a.excerpt)}</p>` : ''}</header>
${a.cover ? `<figure class="story-cover">${figure(ctx, to, a.cover, { eager: true })}${a.cover.caption ? `<figcaption class="wrap narrow">${esc(a.cover.caption)}</figcaption>` : ''}</figure>` : ''}
<div class="wrap prose">${prose(a.text)}</div>
${a.photos.length ? `<div class="wrap gallery">${a.photos.map((g) => `<figure>${figure(ctx, to, g, { sizes: '(min-width: 900px) 50vw, 100vw' })}${g.caption ? `<figcaption>${esc(g.caption)}</figcaption>` : ''}</figure>`).join('')}</div>` : ''}
<footer class="story-foot wrap narrow">${a.updatedAt ? `<p class="story-meta">Mis à jour le <time datetime="${esc(a.updatedAt)}">${esc(dateLabel(a.updatedAt))}</time></p>` : ''}
${L ? `<p><a class="btn btn-ghost" href="${esc(to(`app/index.html#lieu=${L.i}`))}">Voir cette étape sur la carte ${ICON.arrow}</a></p>` : ''}${v ? `<p>${more(to(`voyages/${v.slug}/index.html`), `Le voyage : ${v.title}`)}</p>` : ''}
<nav class="story-nav" aria-label="Autres récits">${prev ? `<a rel="prev" href="${esc(to(`carnet/${prev.slug}/index.html`))}"><span>Récit précédent</span>${esc(prev.title)}</a>` : '<span></span>'}${next ? `<a rel="next" href="${esc(to(`carnet/${next.slug}/index.html`))}"><span>Récit suivant</span>${esc(next.title)}</a>` : '<span></span>'}</nav>
<p>${more(to('carnet/index.html'), 'Retour au carnet')}</p></footer></article>` });
  });

  /* Partage (espace communautaire) */
  for (const p of partagePages(ctx, { esc, eyebrow, badge, more, emptyState, todo, plannerBand, ICON })) add(p);

  /* Guides */
  for (const g of ctx.guides) add({ path: `guides/${g.slug}/index.html`, title: g.title, crumbs: [['guides/index.html', 'Guides'], [`guides/${g.slug}/index.html`, g.title]], description: g.description || g.summary, noindex: g.private, body: g.body });
  add({ path: 'guides/index.html', title: 'Guides pratiques', crumbs: [['guides/index.html', 'Guides']], description: 'Guides pratiques pour voyager en van en Europe : règles et coûts par pays, préparation, travail saisonnier, calcul du budget.',
    body: (to) => `<header class="page-head wrap">${eyebrow('Guides')}<h1 class="page-title">Guides pratiques</h1><p class="page-lead">Des pages courtes, tirées de ce que contient l’Atlas. Chacune dit d’où viennent ses informations.</p></header>
<section class="section section-tight"><div class="wrap narrow"><ul class="link-list">${ctx.guides.map((g) => `<li class="reveal"><a href="${esc(to(`guides/${g.slug}/index.html`))}"><span class="link-title">${esc(g.title)}${g.private ? ' ' + badge('Privé', 'badge-private') : ''}</span><span class="link-text">${esc(g.summary)}</span>${ICON.arrow}</a></li>`).join('')}</ul></div></section>` });

  /* À propos, confidentialité, mentions */
  add({ path: 'a-propos/index.html', title: 'À propos', crumbs: [['a-propos/index.html', 'À propos']], description: 'Ce qu’est Atlas Van : un atlas de lieux en Europe et un outil de préparation de voyage en van qui fonctionne sur votre appareil.',
    body: (to) => `<header class="page-head wrap">${eyebrow('À propos')}<h1 class="page-title">À propos d’Atlas Van</h1>
<p class="page-lead">Un atlas de ${esc(nb(N))} lieux à travers ${C} pays, et un outil pour en faire un voyage.</p></header>
<section class="section section-tight"><div class="wrap prose">
<h2>Ce que c’est</h2>
<p>Atlas Van rassemble des lieux à voir en Europe — villes, patrimoine, nature, côtes, haltes pratiques, pistes de travail saisonnier — et ${R} itinéraires qui les relient. Le Planner permet d’en composer un trajet, d’en estimer la distance et le budget, et de tenir un carnet avec ses photos.</p>
<h2>Comment ça fonctionne</h2>
<p>Le Planner travaille sur votre appareil : pas de compte, pas de serveur qui garde vos trajets, pas de mesure d’audience. Il tient dans un fichier et fonctionne sans connexion ; seuls les liens vers des cartes ou des sites officiels sortent, quand vous les ouvrez. L’espace Partage, séparé du blog, est le seul endroit où un compte sert : pour publier.</p>
<h2>Ce que l’Atlas n’est pas</h2>
<p>Ni un guide officiel, ni une réservation. Les tarifs et les règles notés sur les fiches sont des repères relevés à un moment donné : à vérifier avant de faire un détour.</p>
${content.site.about.map((s) => `<h2>${esc(s.title)}${s.visibility !== 'public' ? ' ' + badge('Privé', 'badge-private') : ''}</h2>${prose(s.text)}`).join('')}
</div></section>
${content.site.about.length ? '' : `<section class="section section-tight"><div class="wrap narrow">${todo(ctx, 'Qui je suis, comment je voyage', 'Quelques paragraphes à la première personne : depuis quand, à quel rythme, seul en van. À écrire dans content/site.json, section « about » (une section par sujet, « visibility » : "public" pour la publier).')}${todo(ctx, 'Le van', 'Modèle, aménagement, autonomie — et une ou deux photographies.')}${todo(ctx, 'Ce que je cherche sur la route', 'Ce qui fait choisir une étape plutôt qu’une autre.')}${todo(ctx, 'Me contacter', 'Un moyen de contact, si vous le souhaitez (« legal.contact » ou « social »). Rien n’est inventé à votre place.')}</div></section>`}
${plannerBand(to, { title: 'Essayer le Planner', text: 'Aucune inscription : il s’ouvre et il fonctionne.' })}` });
  add({ path: 'confidentialite/index.html', title: 'Confidentialité', crumbs: [['confidentialite/index.html', 'Confidentialité']], description: 'Atlas Van ne collecte rien : pas de compte, pas de traceur, pas de mesure d’audience. Vos trajets et votre carnet restent sur votre appareil.',
    body: () => `<header class="page-head wrap">${eyebrow('Confidentialité')}<h1 class="page-title">Confidentialité</h1><p class="page-lead">Ce qui reste sur votre appareil, et ce qui en sort.</p></header>
<section class="section section-tight"><div class="wrap prose">
<h2>Ce site</h2><p>Les pages de ce site ne déposent aucun cookie, ne chargent aucun script d’un tiers, ne mesurent pas l’audience et n’intègrent aucun lecteur ni bouton de réseau social. Une politique de sécurité du contenu interdit à ces pages toute requête vers un autre serveur${content.site.community ? ', à l’exception des pages de l’espace Partage, qui ne peuvent joindre que son serveur' : ''}.</p>
<h2>Le Planner</h2><p>Trajets, notes, favoris, lieux personnels, carnet et photographies sont enregistrés dans le navigateur de votre appareil, et nulle part ailleurs. Ils ne sont pas chiffrés : quiconque a accès à votre navigateur peut les lire. Vous pouvez les sauvegarder dans un fichier, les restaurer et les effacer depuis la rubrique « Plus ».</p>
<h2>Votre position</h2><p>Elle n’est demandée que si vous l’activez. Elle reste en mémoire le temps de la page : elle n’est ni enregistrée, ni envoyée, ni ajoutée au carnet.</p>
<h2>Ce qui sort</h2><p>Quand vous ouvrez un lien vers Google Maps, Google ou Wikipédia depuis une fiche, ce service reçoit le nom ou les coordonnées du lieu concerné, comme pour n’importe quel lien. Rien d’autre ne quitte votre appareil.</p>
<h2>Ce qui est publié ici</h2><p>Seuls les contenus explicitement marqués comme publics paraissent sur ce site. Les brouillons et le carnet personnel n’y figurent jamais. La position du voyage en cours est celle de la dernière étape publiée, arrondie : jamais une position en direct.</p>
<h2>L’espace Partage</h2><p>${content.site.community ? 'Lire Partage ne demande rien. Publier, garder des favoris ou signaler demande un compte : adresse e-mail (jamais affichée), pseudo public, et ce que vous publiez. Votre Planner n’est jamais envoyé ; seules les étapes que vous choisissez de partager le sont, après aperçu et confirmation. Le détail, l’export et la suppression de vos données : page « Règles de Partage » et « Mon compte ».' : 'Pas encore ouvert. Quand il le sera, lire restera libre ; publier demandera un compte, dont les données seront décrites ici et dans les règles de Partage.'}</p>
</div></section>` });
  add({ path: 'mentions/index.html', title: 'Mentions', crumbs: [['mentions/index.html', 'Mentions']], description: 'Mentions du site Atlas Van : éditeur, hébergement, origine des données cartographiques et des fiches.', noindex: !content.site.legal,
    body: () => `<header class="page-head wrap">${eyebrow('Mentions')}<h1 class="page-title">Mentions</h1></header>
<section class="section section-tight"><div class="wrap prose">${content.site.legal ? `<h2>Éditeur</h2><p>${esc(content.site.legal.publisher)}</p>${content.site.legal.contact ? `<h2>Contact</h2><p>${esc(content.site.legal.contact)}</p>` : ''}${content.site.legal.host ? `<h2>Hébergement</h2><p>${esc(content.site.legal.host)}</p>` : ''}` :
      '<p>Les mentions de l’éditeur et de l’hébergeur ne sont pas encore renseignées. Elles doivent l’être avant toute mise en ligne.</p>'}
<h2>Données cartographiques et fiches</h2><p>Les contours des pays proviennent de données cartographiques libres ; une partie des fiches renvoie à sa source (lien « source » sur la fiche, dans le Planner). Les coordonnées servent au repérage : vérifiez l’accès et le stationnement sur place.</p>
</div>${content.site.legal ? '' : `<div class="wrap narrow">${todo(ctx, 'Éditeur et hébergeur', 'Nom ou raison sociale de l’éditeur, moyen de contact, hébergeur : à renseigner dans content/site.json, section « legal ».')}</div>`}</section>` });

  /* Recherche */
  const index = [
    ...d.countries.map((c) => ({ t: c.name, k: 'Destination', u: `destinations/${c.slug}/index.html`, s: `${nb(c.count)} lieux` })),
    ...d.trips.map((t) => ({ t: t.title, k: 'Road trip', u: `road-trips/${t.slug}/index.html`, s: t.summary })),
    ...ctx.guides.map((g) => ({ t: g.title, k: 'Guide', u: `guides/${g.slug}/index.html`, s: g.summary })),
    ...content.voyages.map((v) => ({ t: v.title, k: 'Voyage', u: `voyages/${v.slug}/index.html`, s: v.summary })),
    ...content.articles.map((a) => ({ t: a.title, k: 'Récit', u: `carnet/${a.slug}/index.html`, s: a.excerpt })),
    ...d.places.map((L) => ({ t: L.n, k: 'Lieu', u: `app/index.html#lieu=${L.i}`, s: L.p }))
  ];
  add({ path: 'recherche/index.html', title: 'Rechercher', crumbs: [['recherche/index.html', 'Rechercher']], description: 'Rechercher une destination, un road trip, un guide ou un lieu de l’Atlas.', noindex: true,
    body: () => `<header class="page-head wrap">${eyebrow('Recherche')}<h1 class="page-title">Rechercher</h1></header>
<section class="section section-tight"><div class="wrap narrow"><div class="search-box" role="search"><label for="site-q">Destination, road trip, guide ou lieu</label>
<div class="search-field">${ICON.search}<input id="site-q" type="search" inputmode="search" enterkeyhint="search" autocomplete="off" spellcheck="false" placeholder="Par exemple : Portugal, lac, Balkans"></div></div>
<p class="search-status" id="site-results-status" role="status" aria-live="polite">La recherche se fait sur votre appareil, sans rien envoyer.</p>
<ul class="link-list" id="site-results"></ul>
<noscript><p>La recherche a besoin de JavaScript. Les rubriques restent accessibles par le menu.</p></noscript>
<script type="application/json" id="site-index">${jsonForHtml(index)}</script></div></section>` });

  add({ path: '404.html', title: 'Page introuvable', description: 'Cette page n’existe pas ou a changé d’adresse.', noindex: true,
    body: (to) => `<header class="page-head wrap">${eyebrow('Erreur 404')}<h1 class="page-title">Cette page n’existe pas</h1><p class="page-lead">Elle a peut-être changé d’adresse.</p>
<p><a class="btn btn-primary" href="${esc(to('index.html'))}">Revenir à l’accueil</a> <a class="btn btn-ghost" href="${esc(to('recherche/index.html'))}">Rechercher</a></p></header>` });
  return out;
}

/* ───────────── Guides tirés de l'Atlas ───────────── */
function atlasGuides(ctx) {
  const { d } = ctx, guides = [];
  const metaNames = Object.keys(d.meta).sort((a, b) => a.localeCompare(b, 'fr'));
  guides.push({ slug: 'regles-et-couts-par-pays', title: 'Règles et coûts par pays', summary: `Prix du gazole, péages et vignettes, nuits en van : ${metaNames.length} pays côte à côte.`,
    body: (to) => `<header class="page-head wrap">${eyebrow('Guide')}<h1 class="page-title">Règles et coûts par pays</h1><p class="page-lead">Prix du gazole, péages et vignettes, règles pour dormir en van, dans ${metaNames.length} pays.</p></header>
<section class="section section-tight"><div class="wrap"><p class="caveat">Notes de l’Atlas, non sourcées et non datées. Les prix et les règles changent : à vérifier auprès des sources officielles de chaque pays avant de partir.</p>
<div class="table-scroll" tabindex="0" role="region" aria-label="Tableau : règles et coûts par pays"><table class="table"><caption class="sr-only">Règles et coûts par pays</caption><thead><tr><th scope="col">Pays</th><th scope="col" class="num">Gazole (€/L)</th><th scope="col">Routes et péages</th><th scope="col">Nuits en van</th></tr></thead>
<tbody>${metaNames.map((n) => { const m = d.meta[n], c = d.countries.find((x) => x.name === n); return `<tr><th scope="row">${c ? `<a href="${esc(to(`destinations/${c.slug}/index.html`))}">${esc(n)}</a>` : esc(n)}</th><td class="num">${esc(m.g.toFixed(2).replace('.', ','))}</td><td>${esc(m.v)}</td><td>${esc(m.b)}</td></tr>`; }).join('')}</tbody></table></div></div></section>
${plannerBand(to, { title: 'Le budget carburant, calculé', text: 'Le Planner applique le prix du gazole de chaque pays traversé à votre consommation.' })}` });
  guides.push({ slug: 'avant-de-partir', title: 'Avant de partir', summary: 'La liste de contrôle de l’Atlas : véhicule, assurance, santé, papiers, argent, autonomie.',
    body: (to) => `<header class="page-head wrap">${eyebrow('Guide')}<h1 class="page-title">Avant de partir</h1><p class="page-lead">Sept points à passer en revue avant un long voyage en van.</p></header>
<section class="section section-tight"><div class="wrap narrow"><p class="caveat">Liste personnelle, sans valeur de conseil professionnel : adaptez-la à votre véhicule, à votre situation et aux pays traversés.</p>
<ol class="checklist">${d.checklist.map(([title, text]) => `<li><h2 class="check-title">${esc(title)}</h2><ul>${String(text).split(' · ').map((x) => `<li>${esc(x)}</li>`).join('')}</ul></li>`).join('')}</ol></div></section>
${plannerBand(to, { title: 'La même liste, dans le Planner', text: 'Rubrique « Plus », avec les règles par pays.' })}` });
  if (d.jobs.length) {
    const byCountry = {}; d.jobs.forEach((L) => { (byCountry[L.p] = byCountry[L.p] || []).push(L); });
    guides.push({ slug: 'travail-saisonnier', title: 'Travailler en route', summary: `${d.jobs.length} pistes de travail saisonnier repérées dans l’Atlas, par pays et par saison.`,
      body: (to) => `<header class="page-head wrap">${eyebrow('Guide')}<h1 class="page-title">Travailler en route</h1><p class="page-lead">${d.jobs.length} pistes de travail saisonnier dans ${Object.keys(byCountry).length} pays : vendanges, récoltes, saisons touristiques.</p></header>
<section class="section section-tight"><div class="wrap narrow"><p class="caveat">Ce sont des repères, pas des offres d’emploi : périodes et conditions varient d’une année à l’autre.</p>
${Object.entries(byCountry).sort((a, b) => b[1].length - a[1].length).map(([n, list]) => `<h2 class="section-title">${esc(n)}</h2><ol class="stops">${list.map((L) => `<li><h3 class="stop-title"><a href="${esc(to(`app/index.html#lieu=${L.i}`))}">${esc(L.n)}</a></h3><p>${esc(L.d)}</p><p class="stop-meta">${esc(L.s || '')}${L.du ? ' · ' + esc(L.du) : ''}</p></li>`).join('')}</ol>`).join('')}</div></section>
${plannerBand(to, { title: 'Une année de saisons', text: 'L’itinéraire « boucle boulot » enchaîne ces pistes mois après mois.', href: d.trips.find((t) => /boulot/i.test(t.title)) ? `road-trips/${d.trips.find((t) => /boulot/i.test(t.title)).slug}/index.html` : 'road-trips/index.html', label: 'Voir l’itinéraire' })}` });
  }
  guides.push({ slug: 'comment-atlas-calcule', title: 'Comment Atlas estime un trajet', summary: 'Distance, durée, carburant, budget : les formules du Planner, et leurs limites.',
    body: (to) => `<header class="page-head wrap">${eyebrow('Guide')}<h1 class="page-title">Comment Atlas estime un trajet</h1><p class="page-lead">Les chiffres du Planner sont des estimations. Voici comment ils sont obtenus.</p></header>
<section class="section section-tight"><div class="wrap prose">
<h2>Distance</h2><p>Entre deux étapes, le Planner mesure la distance à vol d’oiseau et l’augmente de 25 % pour approcher la route. Il ne calcule pas d’itinéraire routier : pour cela, il ouvre le trajet dans Google Maps, par tronçons.</p>
<h2>Durée</h2><p>Le nombre de jours additionne le temps de route (250 km par semaine par défaut) et les haltes (2 nuits par étape par défaut). Les deux se règlent.</p>
<h2>Carburant</h2><p>La distance est multipliée par votre consommation (9 L aux 100 km par défaut) et par le prix du gazole du pays traversé, tel que relevé dans l’Atlas.</p>
<h2>Budget</h2><p>S’ajoutent les nuitées et la vie courante (par jour et par personne), les vignettes, les visites des étapes et vos propres montants. Les tarifs de visite sont des ordres de grandeur pour un adulte, hors réductions : ils changent chaque année.</p>
<h2>Ce que cela vaut</h2><p>Un ordre de grandeur pour comparer deux itinéraires, pas un devis.</p>
</div></section>
${plannerBand(to, { title: 'Régler ces paramètres', text: 'Dans le Planner, rubrique « Trajet » : consommation, rythme, nuits, budget par jour.' })}` });
  // Guides rédigés par le propriétaire (content/guides/).
  for (const g of ctx.content.guides) guides.push({ slug: g.slug, title: g.title, summary: g.summary || clip(g.text, 150), description: g.summary && g.summary.length >= 70 ? g.summary : [g.summary, g.text].filter(Boolean).join(' — '), private: !g.isPublic,
    body: () => `<header class="page-head wrap">${eyebrow('Guide')}${privacyBadge(g)}<h1 class="page-title">${esc(g.title)}</h1>${g.summary ? `<p class="page-lead">${esc(g.summary)}</p>` : ''}</header>
<section class="section section-tight"><div class="wrap prose">${prose(g.text)}${g.sources.length ? `<h2>Sources</h2><ul>${g.sources.map((s) => `<li><a href="${esc(s.url)}" rel="noopener noreferrer">${esc(s.label)}</a></li>`).join('')}</ul>` : ''}${g.updatedAt ? `<p class="story-meta">Mis à jour le <time datetime="${esc(g.updatedAt)}">${esc(dateLabel(g.updatedAt))}</time></p>` : ''}</div></section>` });
  const slugs = guides.map((g) => g.slug);
  if (new Set(slugs).size !== slugs.length) throw new Error('Un guide de content/guides/ reprend l’adresse d’un guide de l’Atlas : changer son « slug »');
  return guides;
}

/* ───────────── Construction ───────────── */
const DIRECTIONS = ['a', 'b', 'c'];
export const DEFAULT_DIRECTION = 'a';
const SECRET_PATTERNS = [/sb_secret_[A-Za-z0-9_-]{8,}/, /service_role/, /SUPABASE_SERVICE/i, /sk-[A-Za-z0-9]{20,}/, /ghp_[A-Za-z0-9]{30,}/, /AKIA[0-9A-Z]{16}/, /-----BEGIN [A-Z ]*PRIVATE KEY-----/, /xox[baprs]-[A-Za-z0-9-]{10,}/, /"app"\s*:\s*"atlas-van"/];

export function buildSite({ mode, outDir, check = false, direction = null, contentDir = null, siteUrl = null, demo = false }) {
  if (mode !== 'personal' && mode !== 'public') throw new Error(`mode inconnu : ${mode} (personal ou public)`);
  if (mode === 'public' && demo) throw new Error('Construction publique refusée : le contenu de démonstration (--demo) ne se publie pas');
  const dir = direction || DEFAULT_DIRECTION;
  if (!DIRECTIONS.includes(dir)) throw new Error(`direction inconnue : ${dir} (a, b ou c)`);
  const cat = catalogue(mode), d = derive(cat, mode);
  const all = loadContent(path.resolve(contentDir || path.join(ROOT, 'content')), { placeIds: new Set(cat.app.lieux.map((L) => L.i)), countries: new Set(d.countries.map((c) => c.name)) });
  const content = visibleContent(all, mode, { demo });
  if (siteUrl) { try { const u = new URL(siteUrl); if (!/^https?:$/.test(u.protocol)) throw 0; content.site.siteUrl = u.href.replace(/\/+$/, ''); } catch { throw new Error('--site-url doit être une adresse http(s)'); } }
  const ctx = { mode, direction: dir, d, content, media: new Set(), warnings: [] };
  ctx.guides = atlasGuides(ctx);
  const files = new Map();    // chemin → contenu (texte) ou Buffer
  const list = pages(ctx);
  const seen = new Set();
  for (const p of list) { if (seen.has(p.path)) throw new Error(`Deux pages ont la même adresse : ${p.path}`); seen.add(p.path); files.set(p.path, shell(ctx, p)); }

  const css = [read(SRC, 'css', 'tokens.css'), read(SRC, 'site', 'css', 'site.css'), read(SRC, 'site', 'css', `direction-${dir}.css`)].map((s) => s.trim()).join('\n') + '\n';
  files.set('assets/site.css', css);
  files.set('assets/site.js', read(SRC, 'site', 'js', 'site.js'));
  // Script de Partage : seulement si l'espace communautaire est configuré (les pages de Partage le chargent, aucune autre).
  if (content.site.community) files.set('assets/partage.js', read(SRC, 'site', 'js', 'partage.js'));
  files.set('app/index.html', buildPlanner({ mode, siteHome: '../index.html' }).html);
  for (const src of ctx.media) files.set('media/' + src, fs.readFileSync(path.join(all.contentDir, 'media', src)));
  const base = content.site.siteUrl;
  if (base && mode === 'public') {
    const indexable = list.filter((p) => !p.noindex && p.path !== '404.html');
    files.set('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${indexable.map((p) => `  <url><loc>${esc(`${base}/${p.path.replace(/index\.html$/, '')}`)}</loc></url>`).join('\n')}\n</urlset>\n`);
    files.set('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${base}/sitemap.xml\n`);
  }

  if (!content.site.siteUrl) ctx.warnings.push('adresse du site inconnue : ni lien canonique, ni sitemap, ni robots.txt (indiquer « siteUrl » dans content/site.json ou --site-url)');
  if (!content.site.legal) ctx.warnings.push('mentions de l’éditeur absentes (content/site.json, « legal ») : à renseigner avant une mise en ligne');
  if (!content.voyages.length) ctx.warnings.push('aucun voyage ' + (mode === 'public' ? 'public' : '') + ' : la rubrique Voyages affiche un état vide');
  if (!content.articles.length) ctx.warnings.push('aucun article ' + (mode === 'public' ? 'public' : '') + ' : la rubrique Carnet affiche un état vide');
  const located = [...all.voyages, ...all.articles, ...all.guides].flatMap((i) => [i.cover, ...(i.gallery || []), ...(i.photos || [])]).filter((m) => m && m.gps);
  if (located.length) ctx.warnings.push(`${located.length} photographie(s) portent une position GPS dans leurs métadonnées (${located.slice(0, 3).map((m) => m.src).join(', ')}) : la version publique les refusera`);
  if (![...all.voyages, ...all.articles, ...all.guides].some((i) => i.cover)) ctx.warnings.push('aucune photographie fournie : les visuels sont des cartes dessinées à partir de l’Atlas');

  // Aucune clé de service, quelle que soit la version : un jeton (JWT) présent dans un fichier ne peut être que la clé publique « anon ».
  for (const [name, body] of files) if (typeof body === 'string') for (const m of body.matchAll(/eyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g)) if (isServiceKey(m[0])) throw new Error(`${name} : clé de service détectée — construction refusée`);
  if (mode === 'public') {
    // Contrôle de confidentialité : catalogue (règles de build.mjs), contenu privé, démonstration, sauvegardes, secrets. Le moindre doute arrête tout.
    const texts = Object.fromEntries([...files].filter(([, v]) => typeof v === 'string'));
    privacyGate(texts, cat);
    const problems = [], secrets = privateStrings(all);
    for (const [name, body] of Object.entries(texts)) {
      for (const s of secrets) if (body.includes(s) || body.includes(esc(s))) problems.push(`${name} : texte d’un contenu privé (« ${s.slice(0, 30)}… »)`);
      for (const re of SECRET_PATTERNS) if (re.test(body)) problems.push(`${name} : motif interdit (${re.source.slice(0, 24)})`);
      if (/badge-private|badge-demo|class="todo"/.test(body) && name.endsWith('.html')) problems.push(`${name} : marqueur de contenu privé, de démonstration ou à compléter`);
    }
    const allowed = new Set([...content.voyages, ...content.articles, ...content.guides].flatMap((i) => [i.cover, ...(i.gallery || []), ...(i.photos || [])]).filter(Boolean).map((m) => 'media/' + m.src));
    for (const name of files.keys()) if (name.startsWith('media/') && !allowed.has(name)) problems.push(`${name} : image qui n’appartient à aucun contenu public`);
    for (const item of [...content.voyages, ...content.articles, ...content.guides]) if (!item.isPublic || item.demo) problems.push(`${item.kind} « ${item.slug} » : ni public ni publié`);
    // Une photographie publique ne doit pas révéler où elle a été prise à l'insu de son auteur.
    for (const item of [...content.voyages, ...content.articles, ...content.guides]) for (const m of [item.cover, ...(item.gallery || []), ...(item.photos || [])]) if (m && m.gps) problems.push(`media/${m.src} : la photographie porte une position GPS dans ses métadonnées (la retirer, ou réexporter l’image sans position)`);
    if (problems.length) throw new Error('Contrôle de confidentialité : construction publique refusée\n  - ' + [...new Set(problems)].slice(0, 20).join('\n  - '));
  }

  const bytes = [...files.values()].reduce((a, v) => a + Buffer.byteLength(v), 0);
  const result = { files: files.size, pages: list.length, bytes, places: cat.app.lieux.length, warnings: ctx.warnings, direction: dir };
  if (check) {
    const different = [...files].filter(([name, v]) => { const f = path.join(outDir, name); return !fs.existsSync(f) || Buffer.compare(fs.readFileSync(f), Buffer.from(v)) !== 0; }).map(([name]) => name);
    const extra = fs.existsSync(outDir) ? walk(outDir).filter((f) => f !== '.atlas-build' && !files.has(f)) : [];
    return { ...result, same: !different.length && !extra.length, different: [...different, ...extra.map((f) => f + ' (en trop)')] };
  }
  // Le dossier de sortie est remplacé en entier ; par prudence, seulement s'il est vide ou s'il a été produit par cette commande.
  if (fs.existsSync(outDir) && fs.readdirSync(outDir).length && !fs.existsSync(path.join(outDir, '.atlas-build'))) throw new Error(`${outDir} existe et n’a pas été produit par cette commande : choisir un autre dossier`);
  fs.rmSync(outDir, { recursive: true, force: true });
  for (const [name, body] of files) { const f = path.join(outDir, name); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, body); }
  fs.writeFileSync(path.join(outDir, '.atlas-build'), `mode=${mode}\ndirection=${dir}\n`);
  return result;
}
function walk(dir, base = '') {
  return fs.readdirSync(path.join(dir, base), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(dir, path.join(base, e.name)) : [path.join(base, e.name)]));
}
