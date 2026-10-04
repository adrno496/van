# 01 — Performance : mesures avant et après

## Méthode, et ce qu'elle vaut

| Outil | Ce qu'il mesure | Limite |
|---|---|---|
| Lighthouse 13.5 via Creative Engine 9.1.0 (`lighthouse --runs 3`, médiane) | score, TBT, LCP, CLS en laboratoire ; mobile = réseau et processeur lents simulés | laboratoire, serveur local ; ni données de terrain, ni INP |
| `scripts/ab-boot.mjs` | démarrage en Chromium mobile émulé (390 × 844, processeur ×4), versions **mesurées en alternance** | émulation, pas un téléphone |
| `scripts/ab-gestures.mjs` | durée de chaque image pendant un déplacement et un pincement, en alternance | idem |
| `tests/profile.mjs` | phases du démarrage (repères `performance.mark`), coût de chaque interaction, taille de la page | le traçage ralentit la page : valeurs absolues majorées |
| `tests/perf.mjs` | coût unitaire des fonctions (un filtre, une frappe, un recalcul) | idem |

**Charge de la machine.** D'autres travaux tournaient en même temps : charge moyenne entre 4,7 et 20 sur
10 cœurs. Les valeurs absolues en souffrent ; c'est pourquoi chaque conclusion repose sur une comparaison en
alternance ou sur deux séries mesurées l'une derrière l'autre. La charge est notée à côté de chaque mesure.
Aucun chiffre de ce rapport n'est extrapolé.

## Objectifs et résultats

| Objectif du cahier des charges | Avant | Après | Statut |
|---|---:|---:|---|
| TBT mobile < 250 ms (idéal < 200 ms) | 426 ms (série appariée : 467 / 426 / 332) | **62 ms** (69 / 40 / 62) | **PASS** |
| Lighthouse mobile ≥ 85 | 79 (77 / 79 / 82) | **92** (91 / 92 / 92) | **PASS** |
| Ordinateur : performance 95–100, accessibilité 100, bonnes pratiques 100 | 100 / 100 / 100 | 100 / 100 / 100 | PASS |
| LCP mobile | 3,04 s | 2,77 s | PARTIAL — seuil « bon » : 2,5 s |
| CLS | 0 (mobile), 0,014 (ordinateur) | 0 et 0,014 | PASS |
| Zoom plus fluide | 38,5 ms par image (pincement) | 18,9 ms | PASS |
| Moins de DOM, de mémoire, de recalculs | 9 603 éléments, 6,7 Mo | 4 893 éléments, 4,3 à 5,6 Mo | PASS |

Le statut Lighthouse mobile du moteur reste **PARTIAL** : le LCP (2,77 s) dépasse le seuil de 2,5 s. Avec le réseau
lent simulé, ce délai est celui du téléchargement d'un fichier unique de 1,47 Mo ; il n'a presque plus de part
d'exécution (premier affichage 2,74 s, LCP 2,77 s). Le réduire demanderait de sortir le catalogue du fichier,
donc de renoncer au fichier unique qui s'ouvre par double-clic. Non fait ; valeur stable obtenue : 2,77 s.

## Lighthouse (laboratoire, médiane de 3)

| Profil | Mesure | Avant — série 1 (début) | Avant — série 2 (fin) | **Après** | Version publique |
|---|---|---:|---:|---:|---:|
| Mobile | Performance | 81 | 79 | **92** | 92 |
| | Accessibilité | 100 | 100 | 100 | 100 |
| | Bonnes pratiques | 100 | 100 | 100 | 100 |
| | SEO | 91 | 91 | 91 ¹ | 91 ¹ |
| | **TBT** | 352 ms | 426 ms | **62 ms** | 14 ms ² |
| | LCP | 3,00 s | 3,04 s | 2,77 s | 2,72 s |
| | Premier affichage | 2,86 s | 2,89 s | 2,74 s | 2,69 s |
| | Interactif (TTI) | 3,39 s | 3,45 s | 2,92 s | 2,76 s |
| | CLS | 0 | 0 | 0 | 0 |
| | Statut du moteur | PARTIAL | PARTIAL | PARTIAL | PARTIAL |
| Ordinateur | Performance | 100 | 100 | 100 | 100 |
| | TBT | 10 ms | 14 ms | 0 ms | 0 ms |
| | LCP | 0,64 s | 0,66 s | 0,65 s | 0,64 s |
| | CLS | 0,014 | 0,014 | 0,014 | 0,014 |
| | Statut du moteur | PASS | PASS | PASS | PASS |

La série 2 de « avant » et la mesure « après » ont été prises l'une derrière l'autre, avec le même moteur (9.1.0) :
c'est la comparaison qui fait foi. Preuve : `evidence/creative-engine/lighthouse.json`.

¹ Inchangé depuis le cycle 1 : Lighthouse veut télécharger `robots.txt` depuis la page, ce que `connect-src 'none'`
interdit. La politique n'a pas été assouplie.
² Même code que la version personnelle ; l'écart (62 contre 14 ms) est du bruit de mesure entre deux séries, pas un
gain de la version publique. Passages individuels : 69 / 40 / 62 et 14 / 46 / 10.

## Démarrage, en alternance (mobile émulé, processeur ×4)

`evidence/ab-boot-o5.json` — 9 passages, charge 7,6, médianes :

| Version | Temps de blocage après le 1er affichage | Plus longue tâche | Démarrage complet |
|---|---:|---:|---:|
| Livrée au cycle 1 | 422 ms | 367 ms | 844 ms |
| Baseline V2 instrumentée | 383 ms | 355 ms | 839 ms |
| + marqueurs et recherche (O1, O2) | 375 ms | 338 ms | 836 ms |
| + JSON et pays pré-dessinés (O3, O4) | 226 ms | 248 ms | 548 ms |
| + démarrage par étapes (O5) | **104 ms** | **114 ms** | 654 ms |

`evidence/ab-boot-final.json` — 11 passages, charge 12,6, médiane (minimum) :

| Version | Temps de blocage | Plus longue tâche | Démarrage complet | Éléments (mobile) |
|---|---:|---:|---:|---:|
| Livrée au cycle 1 | 503 ms (439) | 441 ms (355) | 976 ms (962) | 7 765 |
| **Finale** | **162 ms (74)** | **138 ms (124)** | **790 ms (679)** | 3 029 |

Lecture :

- le temps de blocage est divisé par 3 à 4 quelle que soit la charge ;
- le découpage en étapes (O5) rallonge le démarrage complet d'une centaine de millisecondes par rapport à O4
  (654 contre 548 ms) : le navigateur affiche la page entre les étapes. C'est le prix d'une page qui répond plus
  tôt ; le démarrage reste plus court qu'au départ (−19 à −22 %) ;
- sur ordinateur, sans ralentissement : démarrage 223 → 189 ms, plus aucune tâche longue (`profile-paired-*.txt`).

## Phases du démarrage (profil apparié, charge 6 à 7, mobile ×4)

`evidence/profile-paired-baseline.txt` et `profile-paired-final.txt`, mesurés l'un derrière l'autre.

| Phase | Avant | Après | Remarque |
|---|---:|---:|---|
| Lecture des données | 91 ms | 16 ms | `JSON.parse` |
| Compilation JavaScript | 235 ms | 91 ms | le catalogue n'est plus du code |
| Dessin des pays | 73 ms | 0 | fait à la construction |
| Création des marqueurs | 61 ms | 41 ms | 1 élément au lieu de 4 ; inclut désormais le calcul des saisons |
| Analyse du HTML (scripts compris) | 582 ms | 203 ms | |
| Plus longue tâche | 403 ms | 129 ms | |
| Temps de blocage après le 1er affichage | 459 ms | 149 ms | |
| Démarrage complet | 923 ms | 803 ms | |

Les phases « commandes », « listes », « première vue » et « filtre initial » ne sont pas comparables ligne à ligne :
le démarrage a été réordonné (les listes passent après la carte), et chaque étape est désormais suivie d'un
affichage.

## Interactions

Profil apparié, temps de fil principal, mobile ×4 :

| Interaction | Avant | Après |
|---|---:|---:|
| Filtres (4 bascules) | 230 ms | 87 ms |
| Recherche (5 frappes) | 117 ms | 65 ms |
| Chargement d'un parcours de 51 étapes | 282 ms | 207 ms |
| Zoom (4 pas) | 114 ms | 131 ms — équivalent, dans le bruit |
| Ouverture d'une fiche | 171 ms | 170 ms — inchangé |
| Première interaction | 109 ms | 115 ms — inchangé |
| Déplacement (30 images) | 603 ms | 663 ms — inchangé, voir ci-dessous |

Coût unitaire (`tests/perf.mjs`, ordinateur ; les deux séries n'ont pas été prises sous la même charge — 6 et 13 —,
ce qui joue contre la version finale) : un filtre 5,9 → 1,8 ms ; une frappe de recherche 4,1 → 0,8 ms ; un recalcul
des tailles et des noms 2,3 → 0,9 ms ; la liste des lieux 2,5 → 0,4 ms.

Gestes, en alternance (`evidence/ab-gestures-o7.json`, charge 7, médiane de 5 ; entre parenthèses la série finale
`ab-gestures-final.json`, charge 14) :

| Geste | Mesure | Avant | Après |
|---|---|---:|---:|
| Pincement (60 images) | durée médiane d'une image | 38,5 ms (45,4) | **18,9 ms (22,7)** |
| | images au-delà de 33 ms | 51 sur 60 (59) | **0 (1)** |
| | mise en page par image | 19,9 ms (23,3) | 4,2 ms (5,0) |
| Déplacement, vue d'ensemble (90 images) | durée médiane d'une image | 16,9 ms (22,6) | 18,2 ms (21,9) |
| | images au-delà de 33 ms | 0 (1) | 0 (3) |
| Déplacement, vue rapprochée | durée médiane d'une image | 16,8 ms (18,6) | 16,8 ms (20,9) |

Le déplacement tenait déjà la cadence de l'écran ; il n'a pas changé, ni en mieux ni en moins bien (les écarts sont
dans le bruit). Le pincement, lui, passe d'environ 26 à environ 53 images par seconde en processeur ×4.

## Taille de la page et mémoire

| Mesure | Avant | Après |
|---|---:|---:|
| Fichier `index.html` | 1 601 923 octets | 1 505 829 octets (−6 %) |
| Éléments dans la page (ordinateur) | 9 603 | 4 893 |
| Éléments de la carte | 6 647 | 1 938 |
| Mémoire JavaScript après démarrage (profil) | 6,7 Mo | 4,3 à 5,6 Mo |
| Écouteurs d'événements | 189 | 183 à 191 |

Endurance (`tests/v2.mjs`, `evidence/v2-final.json`) : après un tour de chauffe puis quatre tours de 20 zooms et
déplacements, 20 filtres, 20 fiches et rubriques, 20 recherches — soit 320 actions — : éléments 3 348 → 3 348,
écouteurs 183 → 183, mémoire 4,17 → 4,20 Mo, réserve de noms 164 → 164. Rien ne s'accumule.
Trajet de 200 étapes : dessiné en 38 ms. 300 favoris : filtre en 34 ms. Carnet de 60 articles et 120 photos :
restauré, liste paginée, relu après rechargement.

## Ce qui n'a pas été mesuré

| Mesure | Statut |
|---|---|
| Téléphone réel (processeur, processeur graphique, mémoire) | NON TESTÉ — appareil réel absent |
| INP et Core Web Vitals de terrain | NON TESTÉ — demandent de vrais utilisateurs |
| Autonomie, échauffement | NON TESTÉ |
| Firefox et WebKit : mêmes mesures | NON TESTÉ — seul le bon fonctionnement y est vérifié (`tests/smoke.mjs`) |
| Machine au repos | NON TESTÉ — la machine est restée chargée pendant toute la mission |
