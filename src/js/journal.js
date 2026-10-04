/* Carnet de voyage : articles et photos dans IndexedDB, brouillons automatiques, blog à partager, sauvegarde complète.
   Base et format inchangés (« atlasvan.journal.v1 ») : les carnets existants restent lisibles. */
var JOURNAL_DB = 'atlasvan.journal.v1', journalReady = false, journalEditing = false, journalDB = null, journalError = '', journalSaveQueue = Promise.resolve(),
  journalTimer = null, journalDraft = null, photoBusy = false, journalSaving = 0;
var journalFilter = 'all', journalSearch = '', journalLimit = 12, journalCommittedPosts = new Map();
var J = { version: 1, title: 'Mon carnet de voyage', subtitle: 'Les étapes, les images et les souvenirs de la route.', author: '', posts: [] };

function uid() { return crypto.randomUUID ? crypto.randomUUID() : 'j' + Date.now().toString(36) + Math.random().toString(36).slice(2); }
function orderedPosts(includeDrafts) { return J.posts.filter(function (p) { return includeDrafts || p.status === 'ready'; }).slice().sort(function (a, b) { return a.date.localeCompare(b.date) || a.created - b.created; }); }
function postPlace(p) { return p.placeId != null && byId[p.placeId] ? byId[p.placeId] : p.location; }
function journalLocations(includeDrafts) { return orderedPosts(includeDrafts).map(postPlace).filter(function (p) { return p && Number.isFinite(p.x) && Number.isFinite(p.y); }); }
function locationCopy(p) { return p ? { n: p.n, p: p.p, x: p.x, y: p.y } : null; }
function setJournalStatus(msg, error) {
  var e = $('#journalStatus'); if (e) { e.textContent = msg; e.classList.toggle('error', !!error); }
  var d = $('#draftStatus'); if (d) { d.textContent = msg; d.classList.toggle('editor-error', !!error); }
}

/* ── Stockage : un enregistrement par article, pour ne réécrire que ce qui a changé ── */
function snapshotJournal() {
  return { version: 1, title: J.title, subtitle: J.subtitle, author: J.author, posts: J.posts.map(function (p) {
    return Object.assign({}, p, { location: p.location ? Object.assign({}, p.location) : null, photos: p.photos.map(function (ph) { return Object.assign({}, ph); }) });
  }) };
}
function samePost(a, b) {
  if (!a || !b) return false;
  if (['id', 'title', 'date', 'text', 'placeId', 'status', 'created', 'updated'].some(function (k) { return a[k] !== b[k]; })) return false;
  if (JSON.stringify(a.location) !== JSON.stringify(b.location) || a.photos.length !== b.photos.length) return false;
  return a.photos.every(function (p, i) { var q = b.photos[i]; return p.id === q.id && p.caption === q.caption && p.src === q.src; });
}
function dbWrite(value) {
  return new Promise(function (resolve, reject) {
    if (!journalDB) return reject(new Error('Le stockage du carnet est indisponible. Exportez vos données avant de fermer.'));
    var tx = journalDB.transaction('state', 'readwrite'), store = tx.objectStore('state'), next = new Map(value.posts.map(function (p) { return [p.id, p]; }));
    store.put({ recordType: 'meta', version: 1, title: value.title, subtitle: value.subtitle, author: value.author, postIds: value.posts.map(function (p) { return p.id; }) }, 'meta');
    value.posts.forEach(function (p) { if (!samePost(journalCommittedPosts.get(p.id), p)) store.put({ recordType: 'post', value: p }, 'post:' + p.id); });
    journalCommittedPosts.forEach(function (p, id) { if (!next.has(id)) store.delete('post:' + id); });
    store.delete('journal');
    tx.oncomplete = function () { journalCommittedPosts = next; resolve(); };
    tx.onerror = function () { reject(tx.error || new Error('Sauvegarde impossible')); };
    tx.onabort = function () { reject(tx.error || new Error('Sauvegarde interrompue')); };
  });
}
function persistJournal() {
  journalSaving++;
  var value = snapshotJournal();
  setJournalStatus('Enregistrement…');
  journalSaveQueue = journalSaveQueue.catch(function () {}).then(function () { return dbWrite(value); }).then(function () {
    journalError = ''; setJournalStatus('Enregistré sur cet appareil. Pensez à exporter une sauvegarde.');
  }).catch(function (e) {
    journalError = (e && e.name === 'QuotaExceededError') ? 'le stockage de ce navigateur est plein.' : (e && e.message) || 'le stockage est indisponible.';
    setJournalStatus('Non enregistré : ' + journalError, true); throw e;
  }).finally(function () { journalSaving--; });
  return journalSaveQueue;
}

/* ── Contrôle d'un carnet importé ou relu ── */
function validPhoto(p) { return p && typeof p.src === 'string' && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(p.src) && p.src.length < 8e6; }
function normalizeJournal(input) {
  if (!input || !Array.isArray(input.posts) || input.posts.length > 1000) throw new Error('Carnet invalide (maximum 1 000 articles).');
  var ids = new Set(), out = { version: 1, title: String(input.title || 'Mon carnet de voyage').slice(0, 120), subtitle: String(input.subtitle || '').slice(0, 500), author: String(input.author || '').slice(0, 100), posts: [] };
  input.posts.forEach(function (p) {
    if (!p || typeof p.id !== 'string' || ids.has(p.id) || p.id.length > 100 || typeof p.title !== 'string' || typeof p.text !== 'string' || !validDay(p.date)) throw new Error('Un article est invalide.');
    ids.add(p.id);
    var loc = null;
    if (p.location && Number.isFinite(p.location.x) && Number.isFinite(p.location.y) && Math.abs(p.location.x) <= 180 && Math.abs(p.location.y) < 85)
      loc = { n: String(p.location.n || 'Étape').slice(0, 200), p: String(p.location.p || '').slice(0, 100), x: p.location.x, y: p.location.y };
    var photos = Array.isArray(p.photos) ? p.photos : [];
    if (photos.length > 12 || photos.some(function (ph) { return !validPhoto(ph); })) throw new Error('Une photo est invalide.');
    out.posts.push({ id: p.id, title: p.title.slice(0, 160), text: p.text.slice(0, 100000), date: p.date, placeId: typeof p.placeId === 'number' || typeof p.placeId === 'string' ? p.placeId : null, location: loc,
      status: p.status === 'ready' ? 'ready' : 'draft', created: Number(p.created) || Date.now(), updated: Number(p.updated) || Date.now(),
      photos: photos.map(function (ph) { return { id: String(ph.id || uid()).slice(0, 100), src: ph.src, caption: String(ph.caption || '').slice(0, 300) }; }) });
  });
  return out;
}
async function initJournal() {
  try {
    journalDB = await new Promise(function (resolve, reject) {
      if (!window.indexedDB) return reject(new Error('Ce navigateur ne propose pas de stockage pour le carnet et ses photos.'));
      var request = indexedDB.open(JOURNAL_DB, 1);
      request.onupgradeneeded = function () { request.result.createObjectStore('state'); };
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error || new Error('Stockage du carnet indisponible (navigation privée ?).')); };
      request.onblocked = function () { reject(new Error('Fermez les autres onglets Atlas puis rechargez.')); };
    });
    var stored = await new Promise(function (resolve, reject) {
      var req = journalDB.transaction('state').objectStore('state').getAll();
      req.onsuccess = function () {
        var records = req.result, meta = records.find(function (v) { return v && v.recordType === 'meta'; });
        if (meta) {
          var posts = new Map(records.filter(function (v) { return v && v.recordType === 'post' && v.value; }).map(function (v) { return [v.value.id, v.value]; }));
          journalCommittedPosts = posts;
          resolve(Object.assign({}, meta, { posts: (Array.isArray(meta.postIds) ? meta.postIds : []).map(function (id) { return posts.get(id); }).filter(Boolean) }));
        } else resolve(records.find(function (v) { return v && Array.isArray(v.posts); }));   // ancien format : un seul enregistrement
      };
      req.onerror = function () { reject(req.error); };
    });
    if (stored) J = normalizeJournal(stored);
  } catch (e) { journalError = (e && e.message) || 'Stockage indisponible'; }
  journalReady = true; renderJournal(); paintJournalLine();
  mark('journal-ready');
}

/* ── Accueil du carnet ── */
function renderJournal() {
  if (journalEditing) return;
  var root = $('#journalRoot');
  if (!journalReady) { root.innerHTML = '<div class="empty">Ouverture de votre carnet…</div>'; return; }
  var all = orderedPosts(true), locs = journalLocations(false), photos = all.reduce(function (n, p) { return n + p.photos.length; }, 0), countries = new Set(locs.map(function (p) { return p.p; })).size;
  root.innerHTML = '<header class="journal-intro"><div class="meta">Carnet de voyage</div><h2>' + esc(J.title) + '</h2><p>' + esc(J.subtitle) + '</p>' + (J.author ? '<p>Par ' + esc(J.author) + '</p>' : '') +
    '<div class="row"><button class="btn p" id="journalNew" type="button"' + (all.length ? '' : ' hidden') + '>' + ic('edit') + 'Écrire une étape</button></div></header>' +
    '<div class="journal-summary"' + (all.length ? '' : ' hidden') + '><span><strong>' + all.length + '</strong> article' + (all.length > 1 ? 's' : '') + '</span><span><strong>' + photos + '</strong> photo' + (photos > 1 ? 's' : '') + '</span><span><strong>' + countries + '</strong> pays raconté' + (countries > 1 ? 's' : '') + '</span></div>' +
    '<div class="storage-state' + (journalError ? ' error' : '') + '" id="journalStatus" role="status">' + esc(journalError ? 'Carnet non enregistré : ' + journalError : 'Carnet enregistré sur cet appareil. Rien n’est publié.') + '</div>' +
    '<div class="journal-filters"><label class="sr-only" for="journalSearch">Rechercher dans le carnet</label><input class="input" id="journalSearch" type="search" placeholder="Chercher dans vos articles…" value="' + esc(journalSearch) + '">' +
    '<div class="chips" role="group" aria-label="Articles affichés"><button class="chip" type="button" data-jfilter="all">Tous</button><button class="chip" type="button" data-jfilter="ready">À partager</button><button class="chip" type="button" data-jfilter="draft">Brouillons</button></div></div>' +
    '<p id="journalResultCount" class="count" role="status"></p><div id="journalPosts"></div><button class="btn block" id="journalMore" type="button">Afficher la suite</button>' +
    '<details class="group"><summary>Partager, relier à la carte, personnaliser</summary><div class="row"><button class="btn" id="journalExport" type="button">Exporter le blog à partager</button>' +
    '<button class="btn" id="journalMap" type="button">Voir le fil du voyage</button><button class="btn" id="journalToRoute" type="button">Créer le trajet du carnet</button><button class="btn" id="journalSettings" type="button">Titre et auteur</button></div></details>' +
    '<details class="group"><summary>Sauvegarder ou changer d’appareil</summary><p class="note">La sauvegarde contient les articles, les photos, vos lieux et vos trajets. Le blog à partager, lui, ne contient que les articles marqués « à partager ».</p>' +
    '<div class="row"><button class="btn" id="journalBackup" type="button">' + ic('download') + 'Tout sauvegarder (.json)</button><button class="btn" id="journalImport" type="button">' + ic('upload') + 'Restaurer une sauvegarde</button></div>' +
    '<input id="journalImportFile" type="file" accept="application/json,.json" aria-label="Fichier de sauvegarde à restaurer" hidden></details>';
  $('#journalNew').onclick = function () { openJournalEditor(); };
  $('#journalSettings').onclick = journalSettings; $('#journalExport').onclick = journalExportDialog; $('#journalBackup').onclick = backupEverything;
  $('#journalImport').onclick = function () { $('#journalImportFile').click(); };
  $('#journalImportFile').onchange = function (e) { var f = e.target.files[0]; e.target.value = ''; if (f) importBackupFile(f); };
  $('#journalMap').onclick = function () {
    var locs = journalLocations(false);
    if (!locs.length) return toast('Marquez « à partager » un article lié à un lieu pour le voir sur la carte.');
    setMobileView('map');
    requestAnimationFrame(function () { fitPts(locs.map(function (p) { var q = P(p.x, p.y); return { px: q[0], py: q[1] }; }), .2); });
  };
  $('#journalToRoute').onclick = function () {
    var ids = orderedPosts(false).map(function (p) { return p.placeId; }).filter(function (id) { return id != null && byId[id]; });
    if (!ids.length) return toast('Associez un lieu du catalogue à vos articles « à partager ».');
    snap(); route = ids; paint(); tab('p2'); toast('Trajet créé, dans l’ordre des dates du carnet');
  };
  $('#journalPosts').onclick = journalPostAction;
  $('#journalSearch').oninput = function () { journalSearch = this.value; journalLimit = 12; renderJournalList(); };
  $$('[data-jfilter]').forEach(function (b) { b.onclick = function () { journalFilter = b.dataset.jfilter; journalLimit = 12; renderJournalList(); }; });
  $('#journalMore').onclick = function () { journalLimit += 12; renderJournalList(); };
  renderJournalList();
  applyPrivacy();
}
function postCard(p) {
  var loc = postPlace(p), photos = p.photos || [];
  return '<article class="journal-post" data-post="' + esc(p.id) + '">' +
    (photos[0] ? '<button class="cover-btn" type="button" data-photo="0" aria-label="Agrandir la photo de ' + esc(p.title) + '"><img class="cover" loading="lazy" src="' + esc(photos[0].src) + '" alt="' + esc(photos[0].caption || p.title) + '"></button>' : '') +
    '<div class="journal-meta"><span>' + esc(dateLabel(p.date)) + '</span><span class="badge ' + (p.status === 'ready' ? 'g' : 'draft') + '">' + (p.status === 'ready' ? 'À partager' : 'Brouillon privé') + '</span>' + (photos.length > 1 ? '<span>' + photos.length + ' photos</span>' : '') + '</div>' +
    '<h3>' + esc(p.title || 'Article sans titre') + '</h3>' + (loc ? '<p class="post-date">' + ic('pin') + esc(loc.n) + (loc.p ? ' · ' + esc(loc.p) : '') + '</p>' : '') +
    '<p class="post-text">' + esc(p.text.length > 600 ? p.text.slice(0, 600) + '…' : p.text) + '</p>' +
    '<div class="row"><button class="btn" type="button" data-read-post>Lire</button><button class="btn" type="button" data-edit-post>Modifier</button>' + (loc ? '<button class="btn" type="button" data-map-post>Sur la carte</button>' : '') +
    '<button class="btn quiet" type="button" data-delete-post>Supprimer</button></div></article>';
}
function renderJournalList() {
  if (!$('#journalPosts')) return;
  var query = noac(journalSearch.trim()), all = orderedPosts(true).filter(function (p) {
    var loc = postPlace(p);
    return (journalFilter === 'all' || p.status === journalFilter) && (!query || noac(p.title + ' ' + p.text + ' ' + p.date + ' ' + (loc ? loc.n : '')).includes(query));
  });
  $$('[data-jfilter]').forEach(function (b) { setPressed(b, b.dataset.jfilter === journalFilter); });
  var none = !J.posts.length;
  $('#journalResultCount').textContent = none ? '' : all.length + ' article' + (all.length > 1 ? 's' : '');
  $('.journal-filters').hidden = none;
  $('#journalPosts').innerHTML = all.length ? all.slice(0, journalLimit).map(postCard).join('') :
    '<div class="journal-empty"><h3>' + (none ? 'Votre première histoire' : 'Aucun article trouvé') + '</h3><p>' + (none ? 'Choisissez une étape, racontez votre journée et ajoutez vos photos. Tout reste sur cet appareil.' : 'Essayez un autre mot ou le filtre « Tous ».') + '</p>' +
    (none ? '<button class="btn p" id="firstStory" type="button">Commencer mon carnet</button>' : '') + '</div>';
  $('#journalMore').hidden = all.length <= journalLimit;
  if ($('#firstStory')) $('#firstStory').onclick = function () { openJournalEditor(); };
}
function journalPostAction(e) {
  var card = e.target.closest('[data-post]'); if (!card) return;
  var p = J.posts.find(function (x) { return x.id === card.dataset.post; }); if (!p) return;
  if (e.target.closest('[data-edit-post]')) return openJournalEditor(p.id);
  if (e.target.closest('[data-delete-post]')) return deleteJournalPost(p);
  if (e.target.closest('[data-map-post]')) { var loc = postPlace(p), q = P(loc.x, loc.y); setMobileView('map'); requestAnimationFrame(function () { flyTo({ px: q[0], py: q[1] }, 65); }); return; }
  if (e.target.closest('[data-read-post]')) return readJournalPost(p);
  var photo = e.target.closest('[data-photo]'); if (photo) return showPhoto(p.photos[+photo.dataset.photo], p.title);
}
function showPhoto(p, title) {
  if (!p) return;
  modalShell(p.caption || title || 'Photo', '<div class="photo-view"><img src="' + esc(p.src) + '" alt="' + esc(p.caption || title) + '"></div>', { className: 'wide' });
}
function readJournalPost(p) {
  var loc = postPlace(p);
  var d = modalShell(p.title || 'Article sans titre', '<p class="post-date">' + esc(dateLabel(p.date)) + (loc ? ' · ' + esc(loc.n) : '') + '</p><p class="post-text">' + esc(p.text) + '</p><div class="journal-photo-grid">' + p.photos.map(function (ph, i) {
    return '<figure><button type="button" data-full-photo="' + i + '" aria-label="Agrandir la photo ' + (i + 1) + '"><img loading="lazy" src="' + esc(ph.src) + '" alt="' + esc(ph.caption || p.title) + '"></button>' + (ph.caption ? '<figcaption>' + esc(ph.caption) + '</figcaption>' : '') + '</figure>';
  }).join('') + '</div>', { className: 'wide' });
  d.addEventListener('click', function (e) { var b = e.target.closest('[data-full-photo]'); if (b) showPhoto(p.photos[+b.dataset.fullPhoto], p.title); });
}
function deleteJournalPost(p) {
  var d = modalShell('Supprimer cet article ?', '<p>« ' + esc(p.title || 'Article sans titre') + ' » et ses photos seront retirés du carnet. Vous pourrez annuler juste après.</p><div class="dialog-actions"><button class="btn" id="cancelDeletePost" type="button">Garder</button><button class="btn danger" id="confirmDeletePost" type="button">Supprimer</button></div>');
  d.querySelector('#cancelDeletePost').onclick = function () { d.close(); };
  d.querySelector('#confirmDeletePost').onclick = async function () {
    d.close();
    var old = JSON.parse(JSON.stringify(p));
    J.posts = J.posts.filter(function (v) { return v.id !== p.id; });
    try { await persistJournal(); } catch (e) { /* l'état est affiché dans le carnet */ }
    renderJournal(); paintJournalLine();
    $('#journalStatus').insertAdjacentHTML('beforeend', ' <button class="btn sm" id="restorePost" type="button">Annuler la suppression</button>');
    $('#restorePost').onclick = async function () { J.posts.push(old); try { await persistJournal(); } catch (e) { /* idem */ } renderJournal(); paintJournalLine(); };
  };
}
function journalSettings() {
  var d = modalShell('Titre et auteur du carnet', '<form novalidate><div class="fld"><label for="jTitle">Titre du carnet</label><input id="jTitle" maxlength="120" value="' + esc(J.title) + '"></div>' +
    '<div class="fld"><label for="jSubtitle">Une courte présentation</label><textarea id="jSubtitle" maxlength="500">' + esc(J.subtitle) + '</textarea></div>' +
    '<div class="fld"><label for="jAuthor">Votre nom ou pseudo (facultatif)</label><input id="jAuthor" maxlength="100" value="' + esc(J.author) + '"></div>' +
    '<div class="dialog-actions"><button class="btn p" id="jSettingsSave" type="submit">Enregistrer</button></div></form>');
  d.querySelector('form').onsubmit = async function (e) {
    e.preventDefault();
    J.title = d.querySelector('#jTitle').value.trim() || 'Mon carnet de voyage'; J.subtitle = d.querySelector('#jSubtitle').value.trim(); J.author = d.querySelector('#jAuthor').value.trim();
    try { await persistJournal(); d.close(); renderJournal(); } catch (err) { toast('Non enregistré : exportez votre carnet pour le préserver.', { error: true }); }
  };
}

/* ── Éditeur d'article ── */
function openJournalEditor(postId, placeId) {
  if (!journalReady) return toast('Le carnet est en cours d’ouverture.');
  if (journalEditing) { toast('Terminez l’article ouvert avant d’en créer un autre.'); return tab('pBlog'); }
  var old = postId && J.posts.find(function (p) { return p.id === postId; });
  journalDraft = old ? JSON.parse(JSON.stringify(old)) : { id: uid(), title: '', date: dateToday(), text: '', placeId: byId[placeId] ? placeId : null, location: locationCopy(byId[placeId]), status: 'draft', photos: [], created: Date.now(), updated: Date.now() };
  journalEditing = true; tab('pBlog');
  $('#journalRoot').innerHTML = '<div class="journal-editor"><div class="meta">' + (old ? 'Modifier votre récit' : 'Une nouvelle étape') + '</div><h2>Racontez la route</h2><p class="note">Le brouillon s’enregistre tout seul sur cet appareil.</p>' +
    '<div class="field"><label for="postTitle">Titre de l’article</label><input id="postTitle" maxlength="160" placeholder="Un matin au bord du lac…" value="' + esc(journalDraft.title) + '"></div>' +
    '<div class="field"><label for="postDate">Date de l’étape</label><input id="postDate" type="date" value="' + esc(journalDraft.date) + '"></div>' +
    '<div class="field"><label for="postPlaceSearch">Lieu de cette étape</label><p id="postPlaceChosen"></p><input id="postPlaceSearch" type="search" placeholder="Nom du lieu ou du pays…" autocomplete="off"><div id="postPlaceResults"></div>' +
    '<div class="row"><button class="btn sm quiet" id="removePostPlace" type="button">Retirer le lieu</button></div></div>' +
    '<div class="field"><label for="postText">Votre récit</label><textarea id="postText" maxlength="100000" placeholder="Ce que vous avez découvert, aimé, appris…">' + esc(journalDraft.text) + '</textarea></div>' +
    '<div class="field"><label for="postPhotos">Vos photos (12 au plus par article)</label><p class="note">JPEG, PNG ou WebP. Les images sont allégées pour le carnet ; vos originaux ne sont pas modifiés.</p>' +
    '<input id="postPhotos" type="file" accept="image/jpeg,image/png,image/webp" multiple><p id="photoStatus" role="status"></p><div class="editor-photo-grid" id="editorPhotos"></div></div>' +
    '<div class="field checks"><input id="postReady" type="checkbox" ' + (journalDraft.status === 'ready' ? 'checked' : '') + '><label for="postReady">Inclure cet article dans le blog à partager<small>Le fichier exporté contiendra ce récit, ses photos et, si vous le choisissez, son lieu. Rien n’est mis en ligne.</small></label></div>' +
    '<p id="draftStatus" role="status">' + esc(journalError ? 'Non enregistré : ' + journalError : 'Brouillon ouvert') + '</p>' +
    '<div class="editor-actions"><button class="btn p" id="savePost" type="button">Enregistrer et fermer</button><button class="btn" id="closeEditor" type="button">Retour au carnet</button></div></div>';
  var chosen = function () { var loc = postPlace(journalDraft); $('#postPlaceChosen').textContent = loc ? loc.n + (loc.p ? ' · ' + loc.p : '') : 'Aucun lieu associé'; $('#removePostPlace').hidden = !loc; };
  chosen(); renderEditorPhotos();
  ['postTitle', 'postDate', 'postText', 'postReady'].forEach(function (id) { $('#' + id).addEventListener('input', scheduleDraft); });
  $('#postPlaceSearch').oninput = function () {
    var q = noac(this.value.trim());
    $('#postPlaceResults').innerHTML = q.length < 2 ? '' : PTS.filter(function (p) { return searchKeys(p).np.includes(q); }).slice(0, 12).map(function (p) {
      return '<button class="choose-place" type="button" data-jplace="' + esc(p.i) + '"><strong>' + esc(p.n) + '</strong><small>' + esc(p.p) + '</small></button>';
    }).join('') || '<p class="note">Aucun lieu trouvé.</p>';
  };
  $('#postPlaceResults').onclick = function (e) {
    var b = e.target.closest('[data-jplace]'); if (!b) return;
    journalDraft.placeId = idValue(b.dataset.jplace); journalDraft.location = locationCopy(byId[journalDraft.placeId]);
    $('#postPlaceResults').innerHTML = ''; $('#postPlaceSearch').value = ''; chosen(); scheduleDraft();
  };
  $('#removePostPlace').onclick = function () { journalDraft.placeId = null; journalDraft.location = null; chosen(); scheduleDraft(); };
  $('#postPhotos').onchange = addPostPhotos;
  $('#savePost').onclick = async function () {
    if (photoBusy) return toast('Attendez la fin de l’ajout des photos.');
    if (!$('#postTitle').value.trim()) { setJournalStatus('Ajoutez un titre avant de fermer.', true); $('#postTitle').focus(); return; }
    if (!$('#postDate').value) { setJournalStatus('Choisissez la date de cette étape.', true); $('#postDate').focus(); return; }
    await closeJournalEditor();
  };
  $('#closeEditor').onclick = async function () { if (photoBusy) return toast('Les photos sont encore en cours de traitement.'); await closeJournalEditor(); };
  $('#pBlog').scrollTop = 0;
  applyPrivacy();
}
function captureDraft() {
  if (!journalDraft || !$('#postTitle')) return;
  journalDraft.title = $('#postTitle').value.trim(); journalDraft.date = validDay($('#postDate').value) ? $('#postDate').value : dateToday(); journalDraft.text = $('#postText').value;
  journalDraft.status = $('#postReady').checked && journalDraft.title ? 'ready' : 'draft'; journalDraft.updated = Date.now(); journalDraft.location = locationCopy(postPlace(journalDraft));
}
function commitDraft() {
  var copy = JSON.parse(JSON.stringify(journalDraft)), idx = J.posts.findIndex(function (p) { return p.id === copy.id; });
  if (idx < 0) J.posts.push(copy); else J.posts[idx] = copy;
}
async function saveDraft() {
  if (!journalEditing) return;
  clearTimeout(journalTimer); journalTimer = null;
  captureDraft(); commitDraft();
  await persistJournal(); paintJournalLine();
}
function scheduleDraft() { setJournalStatus('Modifications en cours…'); clearTimeout(journalTimer); journalTimer = setTimeout(function () { saveDraft().catch(function () {}); }, 650); }
async function closeJournalEditor() {
  if (!journalEditing) return;
  try { await saveDraft(); journalEditing = false; journalDraft = null; renderJournal(); }
  catch (e) {
    setJournalStatus('Impossible d’enregistrer. Sauvegardez dans un fichier avant de fermer cet onglet.', true);
    if (!$('#emergencyBackup')) { $('#draftStatus').insertAdjacentHTML('afterend', '<button class="btn" id="emergencyBackup" type="button">Sauvegarder maintenant dans un fichier</button>'); $('#emergencyBackup').onclick = backupEverything; }
  }
}
function renderEditorPhotos() {
  if (!journalDraft || !$('#editorPhotos')) return;
  $('#editorPhotos').innerHTML = journalDraft.photos.map(function (p, i) {
    return '<figure><img src="' + esc(p.src) + '" alt="Photo ' + (i + 1) + ' du récit"><label for="caption' + i + '">Légende ' + (i + 1) + '</label><input id="caption' + i + '" data-caption="' + i + '" maxlength="300" value="' + esc(p.caption || '') + '" placeholder="Lieu, souvenir, détail…">' +
      '<button class="btn" type="button" data-photo-remove="' + i + '">Retirer</button>' + (i ? '<button class="btn" type="button" data-cover="' + i + '">Mettre en couverture</button>' : '<small>Photo de couverture</small>') + '</figure>';
  }).join('');
  $('#editorPhotos').oninput = function (e) { if (e.target.dataset.caption != null) { journalDraft.photos[+e.target.dataset.caption].caption = e.target.value; scheduleDraft(); } };
  $('#editorPhotos').onclick = function (e) {
    var b = e.target.closest('[data-photo-remove]');
    if (b) { journalDraft.photos.splice(+b.dataset.photoRemove, 1); renderEditorPhotos(); scheduleDraft(); return; }
    b = e.target.closest('[data-cover]');
    if (b) { journalDraft.photos.unshift(journalDraft.photos.splice(+b.dataset.cover, 1)[0]); renderEditorPhotos(); scheduleDraft(); }
  };
}
// Les photos sont réduites à 1 600 px et recompressées en JPEG : le carnet reste léger, les originaux intacts.
function compressPhoto(file) {
  return new Promise(function (resolve, reject) {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return reject(new Error(file.name + ' : utilisez JPEG, PNG ou WebP.'));
    if (file.size > 20 * 1024 * 1024) return reject(new Error(file.name + ' dépasse 20 Mo.'));
    var u = URL.createObjectURL(file), img = new Image();
    img.onload = function () {
      try {
        if (!img.width || !img.height) throw new Error(file.name + ' : image vide.');
        var factor = Math.min(1, 1600 / Math.max(img.width, img.height)), c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(img.width * factor)); c.height = Math.max(1, Math.round(img.height * factor));
        var ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0, c.width, c.height);
        var src = c.toDataURL('image/jpeg', .82);
        if (src.length > 8e6) throw new Error(file.name + ' : photo trop volumineuse, même réduite.');
        resolve({ id: uid(), src: src, caption: '' });
      } catch (e) { reject(e); } finally { URL.revokeObjectURL(u); }
    };
    img.onerror = function () { URL.revokeObjectURL(u); reject(new Error(file.name + ' : image illisible.')); };
    img.src = u;
  });
}
async function addPostPhotos(e) {
  if (photoBusy) return;
  var files = Array.from(e.target.files || []); e.target.value = '';
  if (journalDraft.photos.length + files.length > 12) { $('#photoStatus').textContent = 'Maximum 12 photos par article. Retirez-en avant d’en ajouter.'; return; }
  photoBusy = true; $('#savePost').disabled = true; $('#closeEditor').disabled = true;
  var failed = [];
  for (var i = 0; i < files.length; i++) {
    $('#photoStatus').textContent = 'Préparation de la photo ' + (i + 1) + ' sur ' + files.length + '…';
    try { journalDraft.photos.push(await compressPhoto(files[i])); renderEditorPhotos(); } catch (err) { failed.push(err.message); }
  }
  photoBusy = false; $('#savePost').disabled = false; $('#closeEditor').disabled = false;
  $('#photoStatus').textContent = failed.length ? failed.join(' ') : files.length + ' photo(s) ajoutée(s).';
  try { await saveDraft(); } catch (err) { /* l'état est affiché sous le formulaire */ }
}

/* ── Fil du voyage sur la carte : les étapes racontées, reliées dans l'ordre des dates ── */
function paintJournalLine() {
  if (!journalReady) return;
  var places = journalLocations(false), k = vb[2] / Math.max(W, 320);
  journalPath.setAttribute('d', places.length > 1 ? 'M' + places.map(function (p) { return P(p.x, p.y).join(','); }).join('L') : '');
  journalStops.forEach(function (c) { c.remove(); }); journalStops = [];
  places.forEach(function (p) { var q = P(p.x, p.y), c = el('circle', { 'class': 'journal-stop', cx: q[0], cy: q[1], r: 7 * k }); journalLayer.appendChild(c); journalStops.push(c); });
}

/* ── Sauvegarde complète et restauration ── */
function captureTravelState() { return JSON.parse(JSON.stringify(captureState())); }
async function backupEverything() {
  if (!journalReady) return toast('Attendez l’ouverture du carnet.');
  if (journalEditing) { try { await saveDraft(); } catch (e) { captureDraft(); commitDraft(); } }
  dl('atlas-van-sauvegarde-' + dateToday() + '.json', JSON.stringify({ app: 'atlas-van', version: 5, date: new Date().toISOString(), travel: captureTravelState(), journal: snapshotJournal() }), 'application/json');
  toast('Sauvegarde préparée : carnet, photos, lieux et trajets');
}
// Un seul chemin de restauration pour les deux formats : sauvegarde complète (version 5) et sauvegarde légère (version 3).
// Le fichier est contrôlé en entier avant que quoi que ce soit ne soit remplacé.
async function importBackupFile(file) {
  var payload, nextJournal = null, nextTravel = null;
  try {
    payload = JSON.parse(await readTextFile(file, 100 * 1048576));
    if (!isPlainObject(payload)) throw new Error('ce fichier n’est pas une sauvegarde Atlas.');
    var legacy = isPlainObject(payload.data) ? payload.data : (payload.edits || payload.notes || payload.custom || payload.route) && !payload.journal && !payload.posts ? payload : null;
    if (legacy) nextTravel = readTravelState(legacy, true).state;
    else { nextJournal = normalizeJournal(payload.journal || payload); if (payload.travel) nextTravel = readTravelState(payload.travel, true).state; }
  } catch (err) { toast('Restauration refusée : ' + (err instanceof SyntaxError ? 'ce fichier n’est pas une sauvegarde lisible.' : err.message), { error: true }); return; }
  var summary = (nextJournal ? nextJournal.posts.length + ' article(s) et ' + nextJournal.posts.reduce(function (n, p) { return n + p.photos.length; }, 0) + ' photo(s). ' : 'Sauvegarde légère : le carnet actuel est conservé. ') +
    (nextTravel ? nextTravel.route.length + ' étape(s), ' + nextTravel.custom.length + ' lieu(x) personnel(s), ' + nextTravel.saved.length + ' parcours enregistré(s) : vos trajets, notes et fiches actuels seront remplacés.' : 'Vos trajets actuels sont conservés.');
  var d = modalShell('Restaurer cette sauvegarde ?', '<p>' + esc(summary) + '</p><p class="note">Pour garder ce que vous avez aujourd’hui, enregistrez-en d’abord une copie.</p>' +
    '<p id="importStatus" class="field-error" role="alert" hidden></p><div class="dialog-actions"><button class="btn" id="preImportBackup" type="button">Sauvegarder l’actuel</button><button class="btn p" id="confirmJournalImport" type="button" data-dialog-ok>Restaurer</button></div>');
  d.querySelector('#preImportBackup').onclick = backupEverything;
  d.querySelector('#confirmJournalImport').onclick = async function () {
    var button = this, previous = J, oldTravel = null;
    button.disabled = true;
    try {
      await journalSaveQueue.catch(function () {});
      // À partir d'ici, plus aucun enregistrement automatique : un enregistrement en attente (il y en a un juste après
      // le démarrage) écrirait l'état actuel par-dessus l'état restauré pendant que le carnet s'écrit.
      if (nextTravel) { clearTimeout(saveTimer); booted = false; }
      try { oldTravel = localStorage.getItem(KEY); } catch (e) { /* stockage indisponible */ }
      if (nextJournal && !journalDB) throw new Error('le stockage du carnet est indisponible.');
      if (nextTravel) localStorage.setItem(KEY, JSON.stringify(nextTravel));
      if (nextJournal) {
        try { await dbWrite(nextJournal); }
        catch (err) { if (nextTravel) { if (oldTravel == null) localStorage.removeItem(KEY); else localStorage.setItem(KEY, oldTravel); } throw err; }   // tout ou rien
        J = nextJournal; journalEditing = false; journalDraft = null;
      }
      d.close();
      if (nextTravel) location.reload();
      else { renderJournal(); paintJournalLine(); toast('Carnet restauré'); }
    } catch (err) {
      J = previous; button.disabled = false;
      if (nextTravel) booted = true;   // restauration annulée : l'enregistrement automatique reprend
      var status = d.querySelector('#importStatus'); status.hidden = false; status.textContent = 'Restauration interrompue : ' + (err.message || 'stockage indisponible.');
    }
  };
}

/* ── Blog à partager : un fichier HTML autonome, sans script ── */
var PUBLIC_EDITION = document.documentElement.getAttribute('data-edition') === 'public';
function journalExportDialog() {
  var posts = orderedPosts(false);
  if (!posts.length) return toast('Marquez au moins un article « à partager » pour créer le blog.');
  var d = modalShell('Préparer le blog à partager', '<p>' + posts.length + ' article(s) et ' + posts.reduce(function (n, p) { return n + p.photos.length; }, 0) + ' photo(s) seront inclus. Les brouillons privés et les notes de trajet en sont exclus.</p>' +
    '<label class="check-row"><input type="checkbox" id="shareLocations" checked><span>Afficher la carte et les lieux de ces articles</span></label>' +
    '<p class="note">Vous obtenez un fichier HTML lisible sans compte ni connexion, à envoyer aux personnes de votre choix. Aucun lien public n’est créé.</p>' +
    // Version publique (visiteurs) : le fichier reste le leur ; rien ne laisse croire qu'il peut paraître sur le blog d'Atlas Van.
    (PUBLIC_EDITION ? '<div class="dialog-actions"><button class="btn p" id="exportJournalConfirm" type="button">Créer le fichier du blog</button></div>' +
      '<p class="note">Ce fichier vous appartient : il n’est publié nulle part, ni sur ce site ni ailleurs.</p>' :
      '<div class="dialog-actions"><button class="btn" id="exportForSite" type="button">Fichier pour le site</button><button class="btn p" id="exportJournalConfirm" type="button">Créer le fichier du blog</button></div>' +
      '<p class="note">« Fichier pour le site » prépare ces articles pour le site Atlas Van. Ils y restent privés tant que vous ne les marquez pas vous-même comme publics.</p>'));
  d.querySelector('#exportJournalConfirm').onclick = function () {
    dl('mon-carnet-de-voyage.html', buildJournalHTML(posts, d.querySelector('#shareLocations').checked), 'text/html');
    d.close(); toast('Votre blog à partager est prêt');
  };
  if (!PUBLIC_EDITION) d.querySelector('#exportForSite').onclick = function () {
    dl('atlas-van-articles.json', JSON.stringify(articlesForSite(posts)), 'application/json');
    d.close(); toast('Fichier prêt : à importer avec « node build/import-articles.mjs »');
  };
}
// Articles « à partager » au format attendu par le site (content/articles/). Privé et brouillon par défaut :
// rien n'est publié tant que le propriétaire ne change pas lui-même ces deux champs, fichier par fichier.
// Version 2 : identifiant stable de la note (pour reconnaître une note déjà importée) et lieu personnel arrondi au dixième
// de degré (une dizaine de kilomètres) dès l'export : la position exacte d'une nuit ne quitte pas l'appareil.
function articlesForSite(posts) {
  var round = function (v) { return Math.round(v * 10) / 10; };
  return { type: 'atlas-van-articles', version: 2, exported: new Date().toISOString(), articles: posts.map(function (p) {
    var catalogued = typeof p.placeId === 'number' && byId[p.placeId] && !byId[p.placeId].perso, own = !catalogued ? postPlace(p) : null;
    return { id: String(p.id || '').slice(0, 64), slug: slugOf(p.title) || 'article', title: p.title, date: p.date, excerpt: p.text.replace(/\s+/g, ' ').trim().slice(0, 240),
      placeId: catalogued ? p.placeId : null,
      place: own && Number.isFinite(own.x) && Number.isFinite(own.y) ? { name: String(own.n || 'Étape').slice(0, 120), country: String(own.p || '').slice(0, 60), lat: round(own.y), lon: round(own.x) } : null,
      text: p.text, photos: p.photos.map(function (ph) { return { src: ph.src, caption: ph.caption || '' }; }), visibility: 'private', status: 'draft' };
  }) };
}
function exportJourneySVG(posts) {
  var locs = posts.map(postPlace).filter(Boolean), numbers = posts.map(function (p, i) { return postPlace(p) ? i + 1 : null; }).filter(Boolean);
  if (!locs.length) return '';
  var qs = locs.map(function (p) { return P(p.x, p.y); }), xs = qs.map(function (q) { return q[0]; }), ys = qs.map(function (q) { return q[1]; });
  var minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs), minY = Math.min.apply(null, ys), maxY = Math.max.apply(null, ys);
  var w = Math.max(40, maxX - minX) * 1.3, h = Math.max(30, maxY - minY) * 1.4, x = (minX + maxX) / 2 - w / 2, y = (minY + maxY) / 2 - h / 2, k = Math.max(w / 900, h / 480);
  // Les contours des pays sont ceux de la carte, déjà projetés.
  var countries = $$('#mapCountries path').map(function (c) {
    return '<path d="' + esc(c.getAttribute('d')) + '" fill="#e0e7d4" stroke="#a9b99e" stroke-width="' + k * .7 + '"/>';
  }).join('');
  return '<svg role="img" aria-label="Les étapes du carnet reliées dans l’ordre chronologique" viewBox="' + [x, y, w, h].join(' ') + '" style="width:100%;height:clamp(250px,45vw,480px);background:#dcebed;border-radius:20px">' + countries +
    '<path d="M' + qs.map(function (q) { return q.join(','); }).join('L') + '" fill="none" stroke="#b34725" stroke-width="' + k * 3 + '" stroke-linecap="round"/>' +
    qs.map(function (q, i) { return '<circle cx="' + q[0] + '" cy="' + q[1] + '" r="' + k * 10 + '" fill="#b34725" stroke="#fff" stroke-width="' + k * 2 + '"/><text x="' + q[0] + '" y="' + (q[1] + k * 4) + '" text-anchor="middle" font-size="' + k * 12 + '" fill="#fff" font-family="system-ui">' + numbers[i] + '</text>'; }).join('') + '</svg>';
}
function buildJournalHTML(posts, includeLocations) {
  var photos = posts.reduce(function (n, p) { return n + p.photos.length; }, 0), map = includeLocations ? exportJourneySVG(posts) : '';
  // Le fichier exporté porte sa propre politique : images incluses seulement, aucun script, aucune requête.
  return '<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src data:; style-src \'unsafe-inline\'"><meta name="referrer" content="no-referrer"><title>' + esc(J.title) + '</title>' +
    '<style>*{box-sizing:border-box}body{margin:0;background:#faf8f2;color:#18302e;font:18px/1.75 system-ui,sans-serif}main{max-width:960px;margin:auto;padding:32px 20px}header{padding:32px 0}h1{font:600 clamp(36px,7vw,70px)/1.1 Georgia,serif;letter-spacing:-.04em;margin:12px 0}h2{font:600 34px/1.2 Georgia,serif}p{overflow-wrap:anywhere}.meta{font-size:14px;color:#52655e}.intro{max-width:680px;font-size:22px}.story{margin:36px 0;padding:28px;background:#fff;border:1px solid #d8dfd7;border-radius:20px;scroll-margin-top:20px}.text{white-space:pre-wrap}.photos{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.photos figure{margin:0}.photos figure:first-child{grid-column:1/-1}.photos img{width:100%;height:auto;border-radius:12px;display:block}.photos figcaption{font-size:15px;color:#52655e;padding-top:6px}nav{display:flex;gap:10px;flex-wrap:wrap;margin:20px 0}a{color:#275e70}nav a{padding:9px 14px;min-height:44px;background:#e9eee6;border-radius:10px;text-decoration:none;font-size:15px}footer{padding:30px 0;color:#52655e;font-size:14px}@media(max-width:560px){main{padding:18px 14px}.story{padding:20px 16px}.photos{grid-template-columns:1fr}h2{font-size:29px}header{padding:14px 0}}@media print{nav{display:none}.story{break-inside:avoid;border:0}.photos img{max-height:450px;object-fit:contain}}</style></head><body><main>' +
    '<header><p class="meta">Carnet de voyage' + (J.author ? ' · ' + esc(J.author) : '') + '</p><h1>' + esc(J.title) + '</h1><p class="intro">' + esc(J.subtitle) + '</p><p class="meta">' + posts.length + ' étapes racontées · ' + photos + ' photos</p></header>' + map +
    (map ? '<p class="meta">Les traits relient les lieux racontés ; ils ne représentent pas un itinéraire routier.</p>' : '') +
    '<nav aria-label="Les articles du carnet">' + posts.map(function (p, i) { return '<a href="#article-' + i + '">' + (i + 1) + '. ' + esc(p.title) + '</a>'; }).join('') + '</nav>' +
    posts.map(function (p, i) {
      var loc = postPlace(p);
      return '<article class="story" id="article-' + i + '"><p class="meta">' + esc(dateLabel(p.date)) + (includeLocations && loc ? ' · ' + esc(loc.n) + ' — ' + esc(loc.p) : '') + '</p><h2>' + esc(p.title) + '</h2><p class="text">' + esc(p.text) + '</p><div class="photos">' +
        p.photos.map(function (ph) { return '<figure><img loading="lazy" src="' + esc(ph.src) + '" alt="' + esc(ph.caption || p.title) + '"><figcaption>' + esc(ph.caption) + '</figcaption></figure>'; }).join('') + '</div>' +
        (includeLocations && loc ? '<p><a href="' + esc(gMapsAt(loc)) + '" target="_blank" rel="noopener noreferrer">Voir ce lieu sur une carte ↗</a></p>' : '') + '</article>';
    }).join('') + '<footer>Créé avec Atlas van · Un carnet à lire à votre rythme.</footer></main></body></html>';
}

function wireJournal() {
  // Quitter la page avec un article ouvert : le texte en cours est repris, et le navigateur prévient si tout n'est pas enregistré.
  window.addEventListener('beforeunload', function (e) {
    if (!journalEditing) return;
    captureDraft(); commitDraft();
    if (journalTimer || journalError || photoBusy || journalSaving) { e.preventDefault(); e.returnValue = ''; }
  });
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden' && journalEditing) saveDraft().catch(function () {}); });
}
