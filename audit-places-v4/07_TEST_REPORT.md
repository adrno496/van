# 07 — Rapport de tests

Environnement : Linux, Node 22.22.0, Playwright 1.56.1 avec le Chromium 141 préinstallé
(`PLAYWRIGHT_FROM=<dossier contenant node_modules/playwright>`). Firefox et WebKit ne sont pas installés dans cet
environnement. Chaque commande a été exécutée sur la copie d'origine (« avant ») puis sur la version finale
(« après », commit `4fdc162` et suivants pour la documentation) ; les rapports JSON sont dans `evidence/avant/` et
`evidence/apres/`.

Statuts : PASS, PARTIAL (passe sauf échecs préexistants identiques avant/après), FAIL, NON TESTÉ, NON APPLICABLE.

## Construction et données

| Commande | Résultat après | Statut |
|---|---|---|
| `node build.mjs` puis `node build.mjs --check` | 3 400 lieux ; « OK — index.html correspond aux sources » | PASS |
| `node build.mjs --mode public` (+ `--check`) | 3 395 lieux, 89 fichiers, 84 pages, « contrôle de confidentialité réussi » | PASS |
| `node build.mjs --mode personal` (+ `--check`) | 3 400 lieux, 87 fichiers | PASS |
| Lot 0 (architecture) : les trois constructions comparées octet pour octet à celles d'avant la séparation par pays | identiques | PASS |
| `node scripts/places/validate.mjs` | quotas 34/34, 1 600/1 600 fiches d'origine inchangées, identifiants, QID, coordonnées, pays, catégories, format, provenance, public : « PASS — catalogue valide » ; 15 signalements non bloquants (fiches d'origine) | PASS |
| `node scripts/places/report.mjs` | 34/34 pays ≥ 2 × ; code de sortie 0 | PASS |
| `node scripts/places/enrich.mjs` puis `parcours.mjs` relancés sur la version finale | aucun fichier modifié (`git status` vide) : résultat reproductible, identifiants stables (`ledger-v10.json`) | PASS |
| `node scripts/places/parcours.mjs --dry` | 10 parcours résolus, plus longue étape 191 km | PASS |
| `node scripts/places/fetch-reference.mjs` | exécuté (npm + raw.githubusercontent.com) ; nécessite le réseau | PASS |

## Navigateur

| Commande | Avant | Après | Statut |
|---|---|---|---|
| `node tests/e2e.mjs` | 76/77 (FAIL : débordement de `#loop` sur mobile) | 76/77 (même FAIL, même élément) | PARTIAL — préexistant |
| `node tests/e2e.mjs --dir dist/public/app --catalogue public` | 76/77 (même FAIL) | 76/77 (même FAIL) | PARTIAL — préexistant |
| `node tests/ui.mjs` | 58/59 (FAIL : « Trajet51 » tronqué à 320 px) | 58/59 (même FAIL, même libellé) | PARTIAL — préexistant |
| `node tests/v2.mjs --public dist/public/app` | 36/36 | 36/36 | PASS |
| `node tests/site.mjs` (3 exécutions de chaque côté) | 30/34, 31/34, 30/34 | 30/34, 31/34, 30/34 | PARTIAL — mêmes échecs préexistants : image de test `/media/test/cover.png` annulée (instable), focus visible, Firefox absent. Une exécution supplémentaire lancée pendant une autre mesure lourde a donné 29/34 (une image de test de plus annulée) : écartée car machine chargée |
| `node tests/migration.mjs --old audit-refonte-v3/baseline/index.v2-final.html --new index.html` | 10/10 | 10/10 | PASS |
| `node tests/smoke.mjs` | Chromium serveur PASS, fichier PASS | Chromium serveur PASS, fichier PASS | PASS (Chromium) |
| `node tests/smoke.mjs --file dist/public/app/index.html` | — | Chromium serveur PASS, fichier PASS | PASS (Chromium) |
| Firefox, WebKit (smoke, site « fichier local ») | NON TESTÉ | NON TESTÉ | NON TESTÉ — moteurs absents |
| `node tests/catalogue.mjs` (nouveau) | — | 13/13 | PASS |
| `node tests/perf.mjs --runs 5`, `node tests/profile.mjs --runs 5` | mesures | mesures | voir `06_PERFORMANCE_REPORT.md` |
| `audit-refonte-v2/scripts/ab-boot.mjs`, `ab-gestures.mjs` (A/B alterné) | — | mesures | voir `06_PERFORMANCE_REPORT.md` |
| `node tests/screenshots.mjs`, `node tests/site-shots.mjs` | NON TESTÉ | NON TESTÉ | NON TESTÉ — captures de référence non régénérées ; comparaison visuelle ponctuelle faite à la place (carte autour de Paris et vue d'ensemble, avant/après : marqueurs identiques) |

## Ce que vérifie `tests/catalogue.mjs` (13 contrôles)

1. `validate.mjs` (quotas pays par pays, identifiants, QID, coordonnées valides, pays connu, catégorie valide, nom,
   provenance des nouvelles fiches, point dans le pays annoncé, format `DATA.lieux`, aucune fiche personnelle ni
   expression interdite dans le catalogue public) ;
2. construction personnelle et publique avec ≥ 3 200 lieux, version publique sans base et avec toutes les nouvelles
   fiches ;
3. site : nombre de lieux de l'accueil et des pages pays (Italie, France, Espagne, Andorre) tiré du catalogue, aucune
   mention « 1 600 / 1 595 lieux », lien vers le Planner filtré ;
4. démarrage : tous les lieux chargés et dessinés, aucune erreur ;
5. recherche : 30 nouveaux lieux répartis dans tous les pays trouvés par leur nom ; fiche ouverte depuis les
   résultats, mention « coordonnées de repérage », lien Google Maps ;
6. filtre pays (Italie, France, Espagne, Andorre, Luxembourg) : carte et liste réduites au pays ;
7. « Ajouter tout un pays » (incontournables d'Italie, de France, d'Espagne) ;
8. liens profonds `#pays=`, `#lieu=` (nouveau lieu), `#q=` ;
9. lisibilité : au plus 220 noms affichés et aucun nom superposé en vue d'ensemble, sur l'Italie, la France,
   l'Espagne et en vue rapprochée ;
10. Explorer : « Voir 24 lieux de plus », « Nouveautés » = lot v10 ;
11. « Près de moi » : un nouveau lieu voisin est proposé ;
12. mobile : carte dense de l'Italie, filtre, zoom, sélection d'un nouveau lieu ;
13. version publique : nouvelles fiches présentes, aucune base.

## Tests modifiés (et pourquoi)

Les tests existants figeaient des nombres du catalogue d'origine ; ils lisent désormais ces nombres dans le fichier
testé (ou dans les sources pour `site.mjs`, qui construit son propre site), ce qui garde leur intention et les rend
valables avant comme après : nombre de lieux (1 600 / 1 595), de villes (418), de lieux nature (522), de lieux
secondaires (307), de nouveautés (lot v9 : 100 → lot le plus récent), de parcours (25), de parcours d'hiver (3),
de lieux d'Italie (362). Les trois tests v2 qui lisaient la géométrie interne des marqueurs (attribut `d` identique
pour une catégorie, épaisseur de contour multipliée par l'échelle) comparent désormais la forme ramenée à l'origine et
au rayon 1, et l'épaisseur effective à l'écran — avec un contrôle ajouté : chaque marqueur trace exactement la forme
de sa catégorie. Aucun test n'a été désactivé ni assoupli sur ce qu'il vérifie.
