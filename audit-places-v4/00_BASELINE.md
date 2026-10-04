# 00 — Baseline (avant le lot v10)

Relevé fait le 2026-10-04, avant toute modification, sur le dépôt tel que cloné.

## Dépôt et environnement

| Élément | Constat |
|---|---|
| Git | branche `claude/eloquent-babbage-9a71w1`, arbre propre, HEAD `367042f` (« deploy: serve the public editorial site on Vercel ») |
| Copie de référence | copie intégrale du dépôt hors Git (dossier de travail de la session) pour les mesures A/B |
| SENTINEL | `/Users/dreano/Downloads/SENTINEL` **absent** (environnement cloud Linux) : non utilisé, aucune de ses capacités n'est revendiquée |
| Playwright | le chemin attendu par `tests/lib/harness.mjs` (`/Users/dreano/Downloads/CREATIVE_ENGINE_V9`) est absent : Playwright 1.56.1 installé hors du dépôt, avec le Chromium 141 préinstallé de l'environnement (`PLAYWRIGHT_FROM=…`). **Firefox et WebKit ne sont pas installés** : les étapes qui les demandent sont NON TESTÉ (avant comme après) |
| Réseau | `query.wikidata.org`, `wikipedia.org`, `openstreetmap.org`, `geonames.org`, `whc.unesco.org` refusés par la politique réseau ; `registry.npmjs.org` et `raw.githubusercontent.com` accessibles (voir `02_SOURCE_STRATEGY.md`) |
| Node | v22.22.0 ; le projet n'a aucune dépendance |

## Catalogue

| Mesure | Valeur |
|---|---|
| Fichier | `src/data/places.js`, 1,3 Mo, un seul littéral `DATA = { pays, lieux, parcours, meta }` |
| Lieux | **1 600** (version publique : 1 595, les 5 bases personnelles retirées) |
| Pays | 34 (+ 47 contours dessinés sur la carte) |
| Catégories | patrimoine 546, nature 522, ville 418, plage 36, boulot 50, pratique 23, base 5 |
| Importance | `w` 1 : 110, 2 : 1 183, 3 : 307 |
| Lots | sans lot 670, v5 330, v7 500, v9 100 ; 930 fiches avec `qid`/`source` Wikidata |
| Identifiants | 0 à 1 599, contigus, triés |
| Parcours | 25 ; fiches pays : 33 |

Nombre de lieux par pays : voir `01_COUNTRY_TARGETS.md` (calculé automatiquement, enregistré dans
`data-sources/baseline-v10.json` avec une empreinte de chaque fiche).

Régions administratives sans aucun lieu (GeoNames admin1, extrait) : Molise (Italie) ; Bragança (Portugal) ;
Basse-Saxe (Allemagne) ; Groningue, Drenthe, Flevoland (Pays-Bas) ; Vorarlberg, Burgenland (Autriche) ;
Irlande du Nord (Royaume-Uni) ; Macédoine-Occidentale (Grèce) ; Łódź, Opole (Pologne) ; Nitra, Trenčín, Trnava
(Slovaquie) ; 10 comitats de Hongrie ; 10 comitats de Croatie ; 22 départements de Roumanie ; Varna, Dobrich,
Gabrovo, Sliven… (Bulgarie) ; Finnmark, Troms, Telemark, Agder… (Norvège) ; Västerbotten, Värmland,
Södermanland, Östergötland (Suède) ; 12 cantons suisses ; 6 paroisses d'Andorre ; 8 cantons du Luxembourg ; la
plupart des comtés d'Estonie et de Lettonie. Couverture territoriale (mailles de 0,5° habitées occupées) : **30 %**.

Anomalies présentes dans le catalogue d'origine (signalées par `validate.mjs`, non modifiées) : voir
`04_GEO_VALIDATION.md` (15 points hors du pays annoncé : Chaussée des Géants rangée en Irlande, biens UNESCO
transnationaux pointés dans un autre pays, sites du Kosovo rangés en Serbie, îles au large).

## Construction

| Mesure | Valeur |
|---|---|
| `index.html` | 1 474,9 Ko (CSS 47,3 Ko, JS 171,3 Ko, données 819,8 Ko) |
| Planner public | 1 471,5 Ko (données 816,5 Ko) |
| `dist/public` / `dist/personal` | 79 fichiers, 74 pages, 5 193 474 o / 77 fichiers, 5 202 410 o |
| Temps (moyenne de 5) | `node build.mjs` 299 ms · `--mode public` 855 ms · `--mode personal` 758 ms |

## Tests (référence, exécutés sur la copie d'origine)

| Commande | Résultat |
|---|---|
| `node tests/e2e.mjs` | 76/77 PASS — 1 FAIL : « P6-mobile › aucun débordement horizontal » (bouton `#loop`) |
| `node tests/e2e.mjs --dir dist/public/app --catalogue public` | 76/77 PASS — même FAIL |
| `node tests/ui.mjs` | 58/59 PASS — 1 FAIL : « mobile-320x568 : aucun libellé de bouton tronqué » |
| `node tests/smoke.mjs` | Chromium serveur PASS, Chromium fichier PASS ; Firefox, WebKit NON TESTÉ (absents) |
| `node tests/site.mjs` | 30/34 PASS — 4 FAIL : images de test `/media/test/*.png` en échec (×2), focus visible, Firefox absent |
| `node tests/v2.mjs --public dist/public/app` | 36/36 PASS |
| `node tests/migration.mjs --old audit-refonte-v3/baseline/index.v2-final.html --new index.html` | 10/10 PASS |
| `node tests/perf.mjs --runs 3`, `node tests/profile.mjs --runs 3` | mesures (voir `06_PERFORMANCE_REPORT.md`) |

Ces échecs existaient avant toute modification ; ils servent de point de comparaison dans `08_NON_REGRESSION.md`.
