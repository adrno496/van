# 09 — Rapport final : catalogue Atlas van doublé pays par pays (lot v10)

**Résultat : 1 600 → 3 400 lieux. Chacun des 34 pays atteint au moins le double de son nombre initial (PASS pour les
34). Les 1 600 fiches d'origine sont intactes. Zéro régression fonctionnelle ; performances : gestes et recherche
aussi rapides ou plus qu'avant, démarrage plus long (voir « Performance »).**

## Inspecté

Ce qui a réellement été lu et contrôlé :

- `README.md`, `build.mjs`, `build/planner.mjs` (catalogue, mode public, contrôle de confidentialité, CSP),
  `build/site.mjs` (compteurs, pages pays, road trips, sitemap) ;
- `src/data/places.js` (structure complète : 47 contours, 1 600 lieux et leurs 23 champs, 25 parcours, 33 fiches
  pays) ;
- `src/js/map.js` (marqueurs, vue, noms, gestes), `explore.js` (filtres, liste, recherche, « Nouveautés »),
  `places.js` (fiche, liens), `route.js` (« Ajouter tout un pays », parcours), `location.js` (« Près de moi »),
  `state.js` (format des données utilisateur, identifiants des lieux personnels), `geo.js`, `boot.js`,
  `shell.js` (liens profonds), `src/css/map.css` ;
- les 10 suites de `tests/` et `tests/lib/harness.mjs` ; `audit-refonte-v2/scripts/ab-*.mjs` ;
- chacun des 2 447 candidats est passé par les contrôles automatiques ; les rejets, les signalements et un échantillon
  de fiches retenues ont été relus (descriptions, catégories, informations volatiles, doublons transfrontaliers).

Non disponible : SENTINEL (`/Users/dreano/Downloads/SENTINEL` absent de cet environnement — non utilisé),
Wikidata/Wikipédia/OSM (accès refusé par la politique réseau, voir `02_SOURCE_STRATEGY.md`).

## Modifié

161 fichiers par rapport au commit d'origine `367042f`, en 8 commits réversibles :

| Fichier | Nature du changement |
|---|---|
| `src/data/places.js` | ne contient plus les lieux (contours, parcours, fiches pays) ; 10 parcours ajoutés à la suite des 25 |
| `src/data/lieux/<pays>.json` (34 fichiers) | les lieux, une fiche par ligne : 1 600 d'origine inchangées + 1 800 nouvelles (`"batch": "v10"`) |
| `build/planner.mjs` | `loadPlaces()` réunit les fichiers par pays et trie par identifiant (contrôle des doublons d'identifiant) |
| `src/js/map.js` | marqueurs en coordonnées de carte, chemins courts mis en cache, contour commun sur le calque, création hors page, mise à l'écart des marqueurs lointains, allègement pendant les gestes, largeur réelle des noms |
| `src/js/explore.js` | « Nouveautés » = lot le plus récent (v10) au lieu de v9 figé |
| `src/js/places.js` | mention « coordonnées de repérage » affichée aussi sans lien source |
| `src/js/geo.js` | saisons mémorisées par texte |
| `src/js/boot.js` | index de recherche préparé pendant les temps morts |
| `src/css/map.css` | liseré des marqueurs ordinaires retiré pendant un geste |
| `index.html` | reconstruit (`node build.mjs`) |
| `scripts/places/` (6 fichiers) | pipeline : `lib`, `fetch-reference`, `enrich`, `validate`, `report`, `parcours` |
| `data-sources/` | `README.md` (méthode), `baseline-v10.json`, `targets-v10.json`, `ledger-v10.json`, `parcours-v10.json`, `reference/` (3 fichiers), `candidates/v10/` (21 fichiers + `_decisions.json`), `review/v10/` (34 fichiers) |
| `tests/catalogue.mjs` | nouvelle suite (13 contrôles) |
| `tests/e2e.mjs`, `v2.mjs`, `site.mjs`, `smoke.mjs`, `lib/harness.mjs` | nombres lus dans le catalogue testé au lieu de valeurs figées ; géométrie des marqueurs comparée forme à forme (`07`) |
| `README.md` | architecture, ajout de lieux, nouveaux tests, chiffres |
| `audit-places-v4/` | rapports 00 à 09, preuves JSON avant/après (`evidence/`) |

## Données ajoutées

- Avant : **1 600** lieux (public 1 595). Après : **3 400** (public 3 395). Ajoutés : **1 800**.
- Catégories, avant → après : patrimoine 546 → 1 374 · nature 522 → 976 · ville 418 → 792 · plage (côte) 36 → 180 ·
  boulot 50 → 50 · pratique 23 → 23 · base 5 → 5. Aucune fiche `base`, `boulot` ou `pratique` ajoutée.
- Importance des ajouts : 68 incontournables (`w: 1`, ≤ 6 % par pays), 1 212 « très bon », 520 « secondaire ».
- Chaque nouvelle fiche : nom, coordonnées de repérage, pays, catégorie, type (`q`), description factuelle de 92 à
  203 caractères, 2 à 4 choses à voir, saison, durée conseillée, « Horaires, accès et tarifs à vérifier avant la
  visite. », `batch`, `coordinateNote` ; `source` (708 fiches : GeoNames ou UNESCO) et `qid` (148) quand ils sont
  vérifiables.
- 10 nouveaux itinéraires : Norvège des fjords, volcans d'Italie, volcans d'Auvergne et du Velay (une semaine),
  grands lacs alpins, Balkans nature, Portugal de l'intérieur, Espagne sauvage, châteaux de Bohême-Moravie-Slovaquie,
  Italie loin des grandes villes, France méconnue (deux semaines) — plus longue étape 191 km à vol d'oiseau.

| Pays | Avant | Après | Minimum | Ajoutés | Statut |
|---|---:|---:|---:|---:|:---:|
| Italie | 363 | 745 | 726 | +382 | PASS |
| France | 259 | 535 | 518 | +276 | PASS |
| Espagne | 123 | 258 | 246 | +135 | PASS |
| Portugal | 66 | 140 | 132 | +74 | PASS |
| Grèce | 65 | 138 | 130 | +73 | PASS |
| Allemagne | 59 | 126 | 118 | +67 | PASS |
| Norvège | 45 | 96 | 90 | +51 | PASS |
| Suède | 43 | 92 | 86 | +49 | PASS |
| Suisse | 41 | 88 | 82 | +47 | PASS |
| Royaume-Uni | 37 | 80 | 74 | +43 | PASS |
| Roumanie | 34 | 73 | 68 | +39 | PASS |
| Autriche | 31 | 67 | 62 | +36 | PASS |
| Albanie | 31 | 66 | 62 | +35 | PASS |
| Tchéquie | 31 | 67 | 62 | +36 | PASS |
| Pologne | 31 | 67 | 62 | +36 | PASS |
| Croatie | 29 | 63 | 58 | +34 | PASS |
| Belgique | 28 | 60 | 56 | +32 | PASS |
| Slovaquie | 27 | 58 | 54 | +31 | PASS |
| Serbie | 25 | 54 | 50 | +29 | PASS |
| Bulgarie | 25 | 54 | 50 | +29 | PASS |
| Danemark | 22 | 48 | 44 | +26 | PASS |
| Irlande | 22 | 48 | 44 | +26 | PASS |
| Bosnie | 21 | 46 | 42 | +25 | PASS |
| Slovénie | 20 | 44 | 40 | +24 | PASS |
| Pays-Bas | 19 | 42 | 38 | +23 | PASS |
| Hongrie | 19 | 42 | 38 | +23 | PASS |
| Mac. du Nord | 17 | 38 | 34 | +21 | PASS |
| Lettonie | 14 | 32 | 28 | +18 | PASS |
| Finlande | 14 | 32 | 28 | +18 | PASS |
| Lituanie | 13 | 30 | 26 | +17 | PASS |
| Monténégro | 10 | 25 | 20 | +15 | PASS |
| Estonie | 9 | 23 | 18 | +14 | PASS |
| Luxembourg | 6 | 16 | 12 | +10 | PASS |
| Andorre | 1 | 7 | 2 | +6 | PASS |
| **Total** | **1 600** | **3 400** | **3 200** | **+1 800** | **PASS** |

Couverture territoriale (mailles habitées de 0,5° occupées) : 30 % → 51 %. Détail par pays, régions et catégories :
`05_COVERAGE_REPORT.md`.

## Sources

Réellement utilisées : GeoNames (npm `all-the-cities` 3.1.0, `cities.json` 1.1.65 — CC BY 4.0) pour le contrôle des
coordonnées, les coordonnées des villes et villages et la couverture ; liste du patrimoine mondial (npm
`@worldwideview/wwv-plugin-unesco-sites` 1.0.0, instantané du 2026-08-23) ; Natural Earth *populated places* (QID des
villes) ; contours des pays de la carte. Identité, description, saison et durée des lieux : curation par 21 agents
rédacteurs sur leurs connaissances, selon un cahier strict (aucune information volatile, aucun lieu douteux), puis
contrôles automatiques. **Pas de Wikidata, de Wikipédia ni d'OSM** : inaccessibles pendant le travail.

## Testé

| Commande | Résultat | Statut |
|---|---|---|
| `node build.mjs` / `--mode public` / `--mode personal` (+ `--check`) | 3 400 / 3 395 / 3 400 lieux ; confidentialité réussie ; sources = fichiers | PASS |
| `node scripts/places/validate.mjs` | PASS — 34/34 quotas, 1 600/1 600 fiches d'origine intactes | PASS |
| `node scripts/places/report.mjs` | 34/34 PASS | PASS |
| `node tests/catalogue.mjs` | 13/13 | PASS |
| `node tests/v2.mjs --public dist/public/app` | 36/36 | PASS |
| `node tests/migration.mjs --old … --new index.html` | 10/10 | PASS |
| `node tests/smoke.mjs` (personnel et public) | Chromium serveur et fichier PASS | PASS (Chromium) |
| `node tests/e2e.mjs` (personnel et public) | 76/77 — seul échec : débordement de `#loop` à 320 px, identique avant | PARTIAL (préexistant) |
| `node tests/ui.mjs` | 58/59 — seul échec : « Trajet51 » tronqué à 320 px, identique avant | PARTIAL (préexistant) |
| `node tests/site.mjs` | 30-31/34 — mêmes échecs qu'avant (image de test instable, focus visible, Firefox absent) | PARTIAL (préexistant) |
| `node tests/perf.mjs`, `profile.mjs`, `ab-boot.mjs`, `ab-gestures.mjs` | mesures avant/après | voir Performance |

## Non testé

- Firefox et WebKit (non installés dans l'environnement) : smoke et « fichier local » du site NON TESTÉ.
- Appareils mobiles réels : seulement l'émulation Chromium (390 × 844, processeur ralenti ×4).
- Captures de référence (`tests/screenshots.mjs`, `site-shots.mjs`) non régénérées ; comparaison visuelle ponctuelle
  faite (carte de Paris et vue d'ensemble, avant/après).
- Déploiement Vercel et `git push` : le push a été refusé (403, l'application GitHub de Claude n'a pas accès au
  dépôt) — les commits sont locaux sur `claude/eloquent-babbage-9a71w1`.
- Vérification Wikidata/OSM des coordonnées : impossible sans accès réseau.

## Incertitudes

- **Coordonnées** : coordonnées de repérage contrôlées par la distance à une localité (écart médian 0,3 km), pas des
  positions certifiées ; un décalage de quelques kilomètres dans la bonne direction n'est pas détecté. 29 fiches
  contrôlées seulement par la localité la plus proche (liste dans `04_GEO_VALIDATION.md`). Les fiches en confiance
  « moyenne » (≤ 5 km) sont repérables dans `data-sources/candidates/v10/` (champ `conf`).
- **Accès, saison, ferries** : saisons indicatives (cols fermés l'hiver, saison balnéaire), aucune affirmation sur les
  horaires, tarifs, stationnement, bivouac ou accès van. Quelques îles supposent un ferry embarquant les véhicules
  (Groix, Texel, Terschelling, Ischia, îles grecques, Gotland, Mull, Lewis, Orcades) : à vérifier avant de partir.
- **Statut UNESCO** : annoncé par les curateurs, rattaché à la liste seulement quand le point UNESCO est à moins de
  4 km (29 liens) ; 122 autres fiches marquées UNESCO par le curateur n'ont pas de lien (biens en série).
- **Fiches d'origine** : 15 anomalies antérieures (Chaussée des Géants rangée en Irlande, biens transnationaux pointés
  dans un autre pays…) signalées avec une correction proposée, non modifiées.

## Performance

Gestes (A/B alterné) : déplacement et pincement **plus fluides qu'avant** sur mobile ralenti ×4 (image médiane
58 → 46 ms, 63 → 48 ms), identiques ou meilleurs sur ordinateur (16,7 ms ; pincement 18,1 → 16,8 ms). Recherche
104 → 76 ms. Démarrage plus long : prêt 1 423 → 1 978 ms (mobile ×4), 286 → 419 ms (sans ralentissement) ; zoom
ponctuel 357 → 618 ms et filtres 154 → 246 ms (mobile ×4). Page 1 475 → 2 515 Ko. Détail : `06_PERFORMANCE_REPORT.md`.

## Zéro régression

| Volet | Statut | Justification |
|---|---|---|
| Fonctionnel | **PASS** | aucun test qui passait avant n'échoue ; mêmes échecs préexistants, au même endroit |
| Données utilisateurs | **PASS** | identifiants inchangés, formats inchangés, migration 10/10 |
| Confidentialité, hors ligne | **PASS** | contrôle de confidentialité réussi, `connect-src 'none'`, aucune API au fonctionnement |
| Performance | **PARTIAL** | gestes et recherche ≥ avant ; démarrage, zoom ponctuel et filtres plus lents en proportion du catalogue |

## Critères d'acceptation

- [x] chaque pays existant atteint au moins 2 × son nombre initial (34/34)
- [x] le catalogue contient au moins ~3 200 lieux (3 400)
- [x] les nouveaux lieux sont pertinents (cahier de curation, score, 632 candidats laissés en réserve, relecture)
- [x] les doublons sont contrôlés (`03`)
- [x] les coordonnées sont validées — au sens de `04` (contrôle par localité de référence et par pays, pas de
  vérification Wikidata possible)
- [x] les sources sont tracées (`source`/`qid` quand vérifiables, revue complète par fiche dans `data-sources/review`)
- [x] les catégories restent cohérentes (aucune catégorie nouvelle ; ajouts touristiques uniquement)
- [x] aucune donnée personnelle n'entre dans le build public
- [x] la carte reste utilisable (lisibilité contrôlée, gestes plus fluides)
- [x] la recherche reste rapide (plus rapide qu'avant)
- [x] les filtres fonctionnent
- [x] les itinéraires fonctionnent (25 d'origine + 10)
- [x] les builds public et personnel passent
- [x] les tests pertinents passent ou les échecs sont documentés (tous préexistants)
- [x] aucune fausse validation n'est annoncée
- [x] la documentation est mise à jour (`README.md`, `data-sources/README.md`, `audit-places-v4/`)
- [x] le rapport final est produit

Point ouvert : démarrage plus long qu'avant (PARTIAL en performance), et vérification Wikidata des coordonnées à
faire quand `query.wikidata.org` sera autorisé.
