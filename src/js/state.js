/* État du voyage : lecture, contrôle et enregistrement dans ce navigateur.
   Clé et format inchangés (« atlasvan.v3 ») : les données déjà enregistrées restent lisibles. */
var KEY = 'atlasvan.v3', RECOVERY_KEY = 'atlasvan.v3.recovery';
var CATN = { ville: 'Ville', patrimoine: 'Patrimoine', nature: 'Nature', plage: 'Côte', base: 'Base gratuite', boulot: 'Boulot saisonnier', pratique: 'Pratique', perso: 'Lieu personnel' };
var WN = { 1: 'Incontournable', 2: 'Très bon', 3: 'Secondaire' };
var EDIT_KEYS = ['n', 'c', 'p', 'w', 'd', 's', 'du', 'v', 'e', 't', 'pe', 'y', 'x'];
var TEXT_KEYS = ['n', 'p', 'd', 's', 'du', 'v', 'e', 't'];
var TEXT_LIMITS = { n: 200, p: 100, d: 500, s: 100, du: 60, v: 6000, e: 3000, t: 1000 };
var CATALOG_IDS = new Set(DATA.lieux.map(function (p) { return p.i; }));

function emptyState() { return { edits: {}, notes: {}, custom: [], route: [], opts: {}, cSeq: 0, prAppend: false, saved: [] }; }
function isPlainObject(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
function validCoords(x, y) { return Number.isFinite(x) && Number.isFinite(y) && Math.abs(x) <= 180 && Math.abs(y) < 85; }

// Contrôle un état de voyage venu de l'extérieur : stockage du navigateur ou fichier importé.
//   strict = true  → la première anomalie lève une erreur : l'import est refusé en bloc.
//   strict = false → ce qui est illisible est écarté et compté, le reste est conservé (démarrage).
// Aucune valeur n'est reprise sans que son type soit vérifié : un fichier piégé ne peut rien injecter.
function readTravelState(raw, strict) {
  var out = emptyState(), dropped = 0;
  function bad(message) { if (strict) throw new Error(message); dropped++; }
  if (!isPlainObject(raw)) { bad('Les données de trajet sont invalides.'); return { state: out, dropped: dropped }; }
  var known = new Set(CATALOG_IDS);

  // Lieux personnels
  var custom = raw.custom == null ? [] : raw.custom;
  if (!Array.isArray(custom) || custom.length > 5000) { bad('Les lieux personnels sont invalides.'); custom = []; }
  custom.forEach(function (p) {
    if (!isPlainObject(p) || typeof p.i !== 'string' || !/^c[0-9]{1,9}$/.test(p.i) || known.has(p.i) || !validCoords(p.x, p.y)) return bad('Un lieu personnel est invalide.');
    if (strict && (typeof p.n !== 'string' || !CATN[p.c])) throw new Error('Un lieu personnel est invalide.');
    var c = { i: p.i, n: typeof p.n === 'string' && p.n.trim() ? p.n.slice(0, TEXT_LIMITS.n) : 'Lieu sans nom', y: p.y, x: p.x, p: 'Perso', c: CATN[p.c] ? p.c : 'perso',
      w: [1, 2, 3].indexOf(p.w) >= 0 ? p.w : 1, d: 'Lieu personnel', s: "toute l'année", v: '', du: '', e: '', t: '', pe: Number.isFinite(p.pe) && p.pe >= 0 ? p.pe : 0, perso: true };
    ['p', 'd', 's', 'v', 'du', 'e', 't'].forEach(function (k) {
      if (p[k] == null) return;
      if (typeof p[k] !== 'string') return bad('Un lieu personnel est invalide.');
      if (p[k] || k === 'd' || k === 'v' || k === 'du' || k === 'e' || k === 't') c[k] = p[k].slice(0, TEXT_LIMITS[k]);
    });
    if (p.pe != null && !(Number.isFinite(p.pe) && p.pe >= 0)) bad('Un lieu personnel est invalide.');
    known.add(c.i); out.custom.push(c);
  });

  // Fiches du catalogue modifiées
  var edits = raw.edits == null ? {} : raw.edits;
  if (!isPlainObject(edits)) { bad('Les fiches modifiées sont invalides.'); edits = {}; }
  Object.keys(edits).forEach(function (key) {
    var id = Number(key), e = edits[key], clean = {};
    if (!CATALOG_IDS.has(id) || String(id) !== key) return;            // fiche d'un lieu absent du catalogue : sans effet
    if (!isPlainObject(e)) return bad('Une fiche modifiée est invalide.');
    Object.keys(e).forEach(function (k) {
      var v = e[k];
      if (EDIT_KEYS.indexOf(k) < 0) return bad('Une fiche modifiée est invalide.');
      if (v == null) return;
      if (TEXT_KEYS.indexOf(k) >= 0) { if (typeof v !== 'string') return bad('Texte de fiche invalide.'); if (k !== 'n' || v.trim()) clean[k] = v.slice(0, TEXT_LIMITS[k]); }
      else if (k === 'c') { if (!CATN[v]) return bad('Catégorie invalide.'); clean.c = v; }
      else if (k === 'w') { if ([1, 2, 3].indexOf(v) < 0) return bad('Importance invalide.'); clean.w = v; }
      else if (k === 'pe') { if (!Number.isFinite(v) || v < 0) return bad('Tarif invalide.'); clean.pe = v; }
      else if (k === 'x') { if (!Number.isFinite(v) || Math.abs(v) > 180) return bad('Coordonnées modifiées invalides.'); clean.x = v; }
      else if (k === 'y') { if (!Number.isFinite(v) || Math.abs(v) >= 85) return bad('Coordonnées modifiées invalides.'); clean.y = v; }
    });
    if (Object.keys(clean).length) out.edits[key] = clean;
  });

  // Notes, statuts, budgets et dates de passage
  var notes = raw.notes == null ? {} : raw.notes;
  if (!isPlainObject(notes)) { bad('Les notes sont invalides.'); notes = {}; }
  Object.keys(notes).forEach(function (key) {
    var id = idValue(key), n = notes[key], clean = {};
    if (!known.has(id) || String(id) !== key) return;                  // note d'un lieu disparu : sans effet
    if (!isPlainObject(n)) return bad('Note invalide.');
    if (n.st != null) { if (['', 'fav', 'done'].indexOf(n.st) < 0) bad('Note invalide.'); else if (n.st) clean.st = n.st; }
    if (n.txt != null) { if (typeof n.txt !== 'string') bad('Note invalide.'); else if (n.txt) clean.txt = n.txt.slice(0, 20000); }
    if (n.bud != null) { if (!Number.isFinite(n.bud) || n.bud < 0) bad('Note invalide.'); else if (n.bud) clean.bud = n.bud; }
    if (n.date != null) { if (typeof n.date !== 'string') bad('Note invalide.'); else if (validDay(n.date)) clean.date = n.date; }
    if (Object.keys(clean).length) out.notes[key] = clean;
  });

  // Trajet en cours
  var route = raw.route == null ? [] : raw.route;
  if (!Array.isArray(route) || route.length > 5000) { bad('Les données de trajet sont invalides.'); route = []; }
  route.forEach(function (id) { if (known.has(id)) out.route.push(id); else bad('Une étape du trajet est inconnue.'); });

  // Parcours enregistrés
  var saved = raw.saved == null ? [] : raw.saved;
  if (!Array.isArray(saved) || saved.length > 1000) { bad('Un parcours enregistré est invalide.'); saved = []; }
  saved.forEach(function (r) {
    if (!isPlainObject(r) || typeof r.n !== 'string' || !Array.isArray(r.l) || r.l.length > 5000) return bad('Un parcours enregistré est invalide.');
    var steps = [];
    r.l.forEach(function (id) { if (known.has(id)) steps.push(id); else bad('Un parcours enregistré est invalide.'); });
    out.saved.push({ n: r.n.slice(0, 200), d: typeof r.d === 'string' ? r.d.slice(0, 500) : '', l: steps });
  });

  // Réglages du budget
  var o = isPlainObject(raw.opts) ? raw.opts : {};
  ['conso', 'ryt', 'nuits', 'vie', 'nuit', 'vis', 'pax'].forEach(function (k) {
    var v = o[k];
    if ((typeof v === 'string' || typeof v === 'number') && String(v).length <= 12 && Number.isFinite(Number(v))) out.opts[k] = String(v);
  });
  if (validDay(o.date)) out.opts.date = o.date;

  out.prAppend = raw.prAppend === true;
  out.cSeq = Math.min(1e9, Math.max.apply(null, [Number(raw.cSeq) || 0, 0].concat(out.custom.map(function (p) { return Number(p.i.slice(1)); }))));
  return { state: out, dropped: dropped };
}

/* ── Lecture au démarrage ── */
var ST = emptyState(), stateRepaired = false;
(function loadState() {
  var text = null, parsed = null;
  try { text = localStorage.getItem(KEY); } catch (e) { return; }      // stockage indisponible (navigation privée stricte)
  if (!text) return;
  try { parsed = JSON.parse(text); } catch (e) { parsed = null; }
  var result = readTravelState(parsed, false);
  ST = result.state;
  if (result.dropped) {
    // Rien n'est détruit en silence : l'original illisible est mis de côté et peut être téléchargé depuis « Plus ».
    stateRepaired = true;
    try { if (!localStorage.getItem(RECOVERY_KEY)) localStorage.setItem(RECOVERY_KEY, text); } catch (e) { /* stockage plein */ }
  }
})();

/* ── Enregistrement ── */
var saveTimer = null, booted = false, saveFailed = false;
function optionValues() {
  return { conso: $('#oConso').value, ryt: $('#oRythme').value, nuits: $('#oNuits').value, vie: $('#oJour').value, nuit: $('#oNuit').value, vis: $('#oVis').value, pax: $('#oPax').value, date: $('#oDate').value };
}
function customPlaces() {
  return PTS.filter(function (L) { return L.perso; }).map(function (L) {
    return { i: L.i, n: L.n, y: L.y, x: L.x, p: L.p, c: L.c, w: L.w, d: L.d, s: L.s, v: L.v || '', du: L.du || '', e: L.e || '', t: L.t || '', pe: L.pe || 0, perso: true };
  });
}
// Met ST à jour avec ce qui vit dans la page : trajet, lieux personnels, réglages.
function captureState() {
  for (var id in ST.notes) { var n = ST.notes[id]; if (!n || (!n.st && !n.txt && !n.bud && !n.date)) delete ST.notes[id]; }
  ST.route = route.slice(); ST.cSeq = cSeq; ST.custom = customPlaces(); ST.opts = optionValues();
  return ST;
}
function writeState() {
  try {
    localStorage.setItem(KEY, JSON.stringify(captureState()));
    saveFailed = false; updateBackupInfo(); return true;
  } catch (err) {
    // Prévenir une fois, clairement : sans cela des modifications seraient perdues sans que personne le sache.
    if (!saveFailed) toast('Enregistrement impossible : le stockage de ce navigateur est plein ou indisponible. Exportez une sauvegarde depuis « Plus ».', { error: true });
    saveFailed = true;
    if ($('#bkInfo')) $('#bkInfo').textContent = 'Enregistrement impossible dans ce navigateur : exportez une sauvegarde.';
    return false;
  }
}
function save() { clearTimeout(saveTimer); saveTimer = setTimeout(function () { if (booted) writeState(); }, 300); }
function bkSummary() {
  var edited = Object.keys(ST.edits).length, noted = 0, fav = 0, done = 0;
  for (var k in ST.notes) { var o = ST.notes[k]; if (o.txt) noted++; if (o.st === 'fav') fav++; if (o.st === 'done') done++; }
  return edited + ' fiche(s) modifiée(s) · ' + noted + ' note(s) · ' + fav + ' favori(s) · ' + done + ' lieu(x) fait(s) · ' + (ST.custom || []).length + ' lieu(x) personnel(s).';
}
function updateBackupInfo() { if ($('#bkInfo')) $('#bkInfo').textContent = bkSummary(); }
// Remplace l'état enregistré puis recharge la page : la carte est reconstruite sur des données saines.
function replaceTravelState(state) {
  clearTimeout(saveTimer); booted = false;
  localStorage.setItem(KEY, JSON.stringify(state));
  location.reload();
}

function nt(i) { return ST.notes[i] || (ST.notes[i] = {}); }
function hasNote(i) { var o = ST.notes[i]; return !!(o && (o.txt || o.bud)); }
function statOf(i) { var o = ST.notes[i]; return (o && o.st) || ''; }

/* ── Préférences d'affichage ── */
var PRIVACY_KEY = 'atlasvan.privacy', privacyPrefs = {};
try { var storedPrivacy = JSON.parse(localStorage.getItem(PRIVACY_KEY) || '{}'); if (isPlainObject(storedPrivacy)) ['p2', 'p3', 'pBlog'].forEach(function (id) { privacyPrefs[id] = storedPrivacy[id] === true; }); } catch (e) { /* préférences illisibles : valeurs par défaut */ }
function savePrivacy() { try { localStorage.setItem(PRIVACY_KEY, JSON.stringify(privacyPrefs)); } catch (e) { toast('Le réglage reste actif pour cette session.'); } }
