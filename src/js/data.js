/* Catalogue : lieux, idées de parcours, fiches pays.
   Il est livré en JSON dans la page et lu une fois ici ; les contours des pays, eux, sont déjà dessinés dans la carte. */
mark('data-start');
var DATA = (function () {
  if (typeof ATLAS_DATA !== 'undefined') return ATLAS_DATA;   // variante à fichiers séparés : le catalogue arrive par son propre fichier
  var node = document.getElementById('atlasData'), data = JSON.parse(node.textContent);
  node.remove();   // le texte source n'a plus d'utilité : sa mémoire est rendue
  return data;
})();
mark('data-parsed');
