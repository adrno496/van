/* Outils communs : DOM, échappement, messages, dialogues, fichiers. */
// Repères de démarrage, lisibles dans les outils de performance du navigateur (coût négligeable).
function mark(name) { try { performance.mark('atlas:' + name); } catch (e) { /* API absente */ } }
mark('app-start');
var NS = 'http://www.w3.org/2000/svg';
function el(tag, attrs) { var e = document.createElementNS(NS, tag); for (var k in attrs) e.setAttribute(k, attrs[k]); return e; }
function $(s) { return document.querySelector(s); }
function $$(s) { return Array.from(document.querySelectorAll(s)); }

// Tout texte inséré dans du HTML passe par ici, qu'il vienne du catalogue, d'une saisie ou d'un fichier importé.
function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function ic(name) { return '<svg class="ic" aria-hidden="true"><use href="#i-' + name + '"/></svg>'; }
function fmt(n) { return Math.round(n).toLocaleString('fr-FR'); }
function idValue(v) { return String(v).charAt(0) === 'c' ? String(v) : Number(v); }
function safeURL(v) { try { var u = new URL(v); return /^https?:$/.test(u.protocol) ? u.href : ''; } catch (e) { return ''; } }
function isMobile() { return window.matchMedia('(max-width: 859px)').matches; }
function setPressed(button, on) { button.classList.toggle('on', !!on); button.setAttribute('aria-pressed', String(!!on)); }

/* ── Message bref en bas d'écran ── */
var toastTimer = 0;
function toast(message, options) {
  var t = $('#toast');
  t.textContent = message;
  t.classList.toggle('error', !!(options && options.error));
  t.classList.add('on');
  clearTimeout(toastTimer);
  // Un message long reste lisible plus longtemps.
  toastTimer = setTimeout(function () { t.classList.remove('on'); }, Math.min(7000, 1800 + String(message).length * 45));
}

/* ── Dialogues ──
   <dialog> natif : Échap ferme, le focus est retenu à l'intérieur puis rendu à l'élément d'origine. */
var dialogSeq = 0;
// Ouvre un dialogue et note l'instant : le « clic fantôme » qui suit un toucher ne doit pas le refermer aussitôt.
function showDialog(d) { d._openedAt = performance.now(); d.showModal(); }
function backdropClose(e) {
  var d = e.currentTarget;
  if (e.target !== d || performance.now() - (d._openedAt || 0) < 400) return;
  var r = d.getBoundingClientRect();
  if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) d.close();
}
function modalShell(title, content, options) {
  var d = document.createElement('dialog'), id = 'dialogTitle' + (++dialogSeq);
  if (options && options.className) d.className = options.className;
  d.setAttribute('aria-labelledby', id);
  d.innerHTML = '<button class="close-modal" type="button" aria-label="Fermer">' + ic('x') + '</button><h2 id="' + id + '">' + esc(title) + '</h2>' + content;
  document.body.appendChild(d);
  d.querySelector('.close-modal').onclick = function () { d.close(); };
  d.addEventListener('close', function () { d.remove(); });
  d.addEventListener('click', backdropClose);
  showDialog(d);
  return d;
}
// Demande de confirmation. Résout à true si la personne confirme.
function askConfirm(o) {
  return new Promise(function (resolve) {
    var confirmed = false;
    var d = modalShell(o.title, (o.text ? '<p>' + esc(o.text) + '</p>' : '') +
      '<div class="dialog-actions"><button class="btn" type="button" data-dialog-cancel>' + esc(o.cancel || 'Annuler') + '</button>' +
      '<button class="btn ' + (o.danger ? 'danger' : 'p') + '" type="button" data-dialog-ok>' + esc(o.ok || 'Confirmer') + '</button></div>');
    d.querySelector('[data-dialog-ok]').onclick = function () { confirmed = true; d.close(); };
    d.querySelector('[data-dialog-cancel]').onclick = function () { d.close(); };
    d.addEventListener('close', function () { resolve(confirmed); });
  });
}
// Petit formulaire. Résout au tableau des valeurs saisies, ou à null si la personne annule.
function askFields(o) {
  return new Promise(function (resolve) {
    var result = null;
    var d = modalShell(o.title, '<form novalidate>' + (o.text ? '<p>' + esc(o.text) + '</p>' : '') + o.fields.map(function (f, i) {
      return '<div class="fld"><label for="dialogField' + i + '">' + esc(f.label) + '</label><input class="input" id="dialogField' + i + '" data-dialog-input type="' + (f.type || 'text') + '"' +
        (f.inputmode ? ' inputmode="' + f.inputmode + '"' : '') + ' value="' + esc(f.value == null ? '' : f.value) + '"' + (f.placeholder ? ' placeholder="' + esc(f.placeholder) + '"' : '') +
        ' maxlength="' + (f.maxlength || 200) + '"' + (i === 0 ? ' autofocus' : '') + '></div>';
    }).join('') + '<p class="field-error" role="alert" hidden></p><div class="dialog-actions"><button class="btn" type="button" data-dialog-cancel>Annuler</button>' +
      '<button class="btn p" type="submit" data-dialog-ok>' + esc(o.ok || 'Valider') + '</button></div></form>');
    var error = d.querySelector('.field-error');
    d.querySelector('form').addEventListener('submit', function (e) {
      e.preventDefault();
      var values = Array.from(d.querySelectorAll('[data-dialog-input]')).map(function (input) { return input.value.trim(); });
      var problem = o.validate ? o.validate(values) : (values[0] ? '' : 'Ce champ est nécessaire.');
      if (problem) { error.textContent = problem; error.hidden = false; d.querySelector('[data-dialog-input]').focus(); return; }
      result = values; d.close();
    });
    d.querySelector('[data-dialog-cancel]').onclick = function () { d.close(); };
    d.addEventListener('close', function () { resolve(result); });
  });
}
// Les deux dialogues permanents de la page (filtres, paramètres) se ferment par leur bouton ou par un clic à côté.
function wireStaticDialog(d) {
  d.addEventListener('click', backdropClose);
  d.querySelectorAll('[data-close]').forEach(function (b) { b.onclick = function () { d.close(); }; });
}

/* ── Fichiers ── */
function dl(name, text, mime) {
  var blob = new Blob([text], { type: mime || 'application/json' }), url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
}
function readTextFile(file, maxBytes) {
  if (!file) return Promise.reject(new Error('Aucun fichier choisi.'));
  if (file.size > maxBytes) return Promise.reject(new Error('Le fichier dépasse la limite de ' + Math.round(maxBytes / 1048576) + ' Mo.'));
  return file.text();
}
