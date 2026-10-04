# 06 — Journal de mise en œuvre (cycle 2)

Boucle suivie pour chaque lot : mesure avant → modification → mesure après → les quatre suites de tests →
conservation ou abandon. Un lot = un commit, annulable seul (`05_GIT_SETUP.md`).
Le design n'a pas été refait : mêmes écrans, mêmes jetons, mêmes textes. Aucune dépendance ajoutée.

## Lot 0 — Sécurisation (`4da7788`, `9fcbc89`)

- Copie en lecture seule de la version livrée au cycle 1, empreinte vérifiée ; suites rejouées (77, 59, 10, 6).
- Dépôt Git propre au projet.
- Repères de démarrage (`performance.mark`, coût négligeable) et profileur `tests/profile.mjs` : phases du
  démarrage, coût de chaque interaction (script, style, mise en page), taille de la page, tâches longues.

## Lot 1 — Marqueurs, noms, recherche (`5a3ae9a`) — O1, O2

- `src/js/map.js` : un chemin SVG par lieu, formes par catégorie (`SHAPES`), calque de halos pour les bases,
  calque de noms alimenté à la demande, `syncMarker()` (classe écrite seulement si elle change), `redrawMarker()`,
  `unregister()`, survol par lieu le plus proche.
- `src/js/explore.js`, `geo.js`, `route.js`, `journal.js` : clés de recherche en cache (`searchKeys`), ordre de la
  liste en cache (`placesInListOrder`), filtres sans lecture du DOM.
- `src/css/map.css`, `components.css` : styles des formes ; pastilles de légende aux mêmes formes.
- Tests : deux sélecteurs de `tests/e2e.mjs` élargis (`#map .poi text, #map text.lbl`) pour valoir sur l'ancienne
  et la nouvelle structure ; aucun test retiré, aucune attente assouplie.

Incident pendant ce lot : les suites écrivaient par défaut leurs rapports dans `audit-refonte/evidence/`. Une
exécution a écrasé deux preuves du cycle 1 ; elles ont été restaurées depuis Git avant tout commit, et le
dossier par défaut est devenu `test-results/` (ignoré par Git).

## Lot 2 — Données, pays, démarrage, version publique (`dea6921`) — O3, O4, O5

- `build.mjs` : le catalogue source (`src/data/places.js`, inchangé à l'octet près) est évalué à la construction ;
  les contours des pays sont projetés et écrits dans la carte ; lieux, parcours et fiches pays sont livrés en JSON
  (`<script type="application/json">`, `<` écrit `<`) ; le nombre de lieux annoncé suit le catalogue livré.
- `src/js/data.js` (nouveau) : lecture du catalogue, puis suppression du bloc source.
- `src/js/boot.js` : quatre étapes, une tâche chacune (`MessageChannel`). Les commandes ne sont branchées qu'une
  fois l'état restauré ; `journalReady` ne passe à vrai qu'à la dernière étape.
- `src/js/journal.js` : la carte du blog exporté reprend les contours déjà présents dans la page.
- `build.mjs --mode public` : voir `10_PUBLIC_READINESS.md`.

Régression évitée : `tests/e2e.mjs` vérifie l'attribut `opacity` de chaque nom de pays. Une première version le
portait sur le calque ; je suis revenu à un attribut par nom (écrit seulement quand la valeur change) plutôt que
de modifier le test.

## Lot 3 — Zoom fluide (`4e1679b`) — O6, O7

- `src/js/map.js` : `paintStroke()` écrit l'épaisseur du contour dans l'unité du marqueur.
- `src/css/map.css` : plus de `vector-effect` sur les marqueurs ; `text-rendering: geometricPrecision` sur les
  textes de la carte. Rendu comparé sur captures à 1440 px (densité 1) : pas de différence visible.
- Essai écarté : même traitement pour les contours de pays (aucun gain mesuré).

## Lot 4 — Bouton « retour » mobile, tests V2 (`eb25a74`)

- `src/js/shell.js` : `wireBackButton()`. Sur petit écran, s'éloigner de la carte ajoute **une** entrée
  d'historique ; « retour » referme, dans l'ordre : la fenêtre ouverte, l'aperçu d'un lieu, l'éditeur du carnet
  (le brouillon est enregistré), la rubrique affichée. L'adresse de la page ne change pas ; sur grand écran,
  l'historique n'est pas touché.
- Pourquoi : sans cela, « retour » depuis une fiche ou une fenêtre **quittait l'application**. Évalué puis retenu
  parce que le comportement est celui qu'attend un utilisateur de téléphone ; vérifié en émulation uniquement.
- `tests/v2.mjs` : 36 contrôles (voir `07_TEST_REPORT.md`).

## Lot 5 — Contraste des marqueurs, README (`09d9f78`)

- `src/css/tokens.css` : `--cat-patrimoine` `#b0811d` → `#a5791b`, `--cat-plage` `#2e8fa8` → `#2d8ba3`
  (6 % et 3 % plus sombres) pour atteindre 3:1 sur tous les fonds de la carte (`04_ACCESSIBILITY_MARKERS.md`).

## Lot 6 — Défaut de restauration (`ff1a481`)

Trouvé en rejouant le test de migration avec la version du cycle 1 comme « ancienne version » : après la
restauration d'une sauvegarde complète, le carnet revenait mais **pas le trajet**.

Cause : la restauration écrivait le trajet, attendait la fin de l'écriture du carnet (asynchrone), puis rechargeait
la page. Un enregistrement automatique programmé juste avant — il y en a toujours un 300 ms après le démarrage —
pouvait se déclencher entre les deux et réécrire l'état courant par-dessus l'état restauré.

- Défaut **antérieur à ce cycle** : reproduit sur le fichier livré au cycle 1 (`tests/v2.mjs --dir <V1>` : FAIL).
- Correction (`src/js/journal.js`) : l'enregistrement automatique est suspendu avant toute écriture, et repris si
  la restauration est annulée.
- Test de non-régression ajouté : restauration pendant un enregistrement en attente, écriture du carnet ralentie.
- Les trois autres chemins qui rechargent la page (réinitialisation, sauvegarde légère, « rétablir l'original »)
  ont été relus : ils sont synchrones et ne sont pas concernés.

## Comportements modifiés volontairement

| Avant | Après | Pourquoi |
|---|---|---|
| Marqueurs : disques de couleur | une forme par catégorie, mêmes couleurs | la couleur ne doit pas être le seul repère |
| Pastilles de légende rondes | mêmes formes que sur la carte | la légende doit correspondre à la carte |
| Survol : dernier marqueur dessiné sous le pointeur | lieu le plus proche, dans le rayon du clic | le survol annonce ce que le clic fera |
| Noms des lieux dessinés avec leur marqueur | noms au-dessus de tous les marqueurs | un nom n'est plus recouvert par un marqueur voisin |
| Modifier la catégorie d'un lieu en « base » n'ajoutait pas de halo | le halo suit la catégorie | cohérence |
| Mobile : « retour » quitte l'application | « retour » referme le premier plan | usage attendu sur téléphone |
| Démarrage en un bloc | carte d'abord, listes ensuite (quelques dizaines de millisecondes) | réactivité |
| Restauration complète parfois écrasée | restauration atomique | perte de données |
| Deux couleurs de catégorie | 3 à 6 % plus sombres | contraste 3:1 sur la carte |

## Ce qui n'a pas été fait, et pourquoi

| Demande ou piste | Décision |
|---|---|
| Chiffrement des données locales | non : recommandation P3, pas un moyen de faire passer un contrôle SENTINEL |
| Assouplir `connect-src 'none'` pour le score SEO de Lighthouse | non |
| Ajouter des liens ou un `robots.txt` pour les règles SEO de Creative Engine | non : application locale |
| Reformater le code pour satisfaire une expression régulière d'audit | non |
| Canvas, WebGL, framework, Web Worker | non (voir `02`) |

## Fichiers

**Créés** : `src/js/data.js`, `tests/profile.mjs`, `tests/v2.mjs`, `audit-refonte-v2/**`.
**Modifiés** : `build.mjs`, `README.md`, `.gitignore`, `src/index.template.html`, `src/css/{tokens,components,map}.css`,
`src/js/{util,geo,map,places,route,explore,journal,shell,boot}.js`, `tests/{e2e,ui,smoke,migration,perf,screenshots,profile}.mjs`
(sélecteurs, dossier de sortie par défaut, option `--places`), `index.html` (assemblé).
**Supprimé** : aucun. `src/data/places.js` est inchangé à l'octet près.
