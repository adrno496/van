# 06 — Performances avant / après (1 600 → 3 400 lieux)

Mesures locales (Chromium 141 headless, machine de travail à 4 cœurs, charge 1 à 1,6). Elles servent à comparer deux
versions, pas à certifier. « Avant » = copie exacte du dépôt au commit 367042f ; « après » = version finale.
Mobile = 390 × 844, processeur ralenti ×4. Les comparaisons A/B alternent les versions (A, B, A, B…) pour que la
charge de la machine pèse autant sur chacune.

## Taille et construction

| Mesure | Avant | Après |
|---|---:|---:|
| `index.html` (Planner autonome) | 1 474,9 Ko | 2 515,2 Ko |
| dont données (JSON) | 819,8 Ko | 1 852,7 Ko |
| dont JavaScript | 171,3 Ko | 178,3 Ko |
| Planner public | 1 471,5 Ko | 2 512 Ko |
| `dist/public` | 5 193 474 o, 74 pages | 7 073 581 o, 84 pages (+10 road trips) |
| `node build.mjs` (moyenne de 5) | 299 ms | 345 ms |
| `node build.mjs --mode public` | 855 ms | 1 002 ms |
| `node build.mjs --mode personal` | 758 ms | 852 ms |

## Démarrage — `ab-boot.mjs`, 9 passages alternés

| | FCP | Prêt (carnet ouvert) | Tâches longues | Blocage après FCP | Nœuds DOM |
|---|---:|---:|---:|---:|---:|
| Mobile ×4 — avant | 264 ms | 1 423 ms | 7 (911 ms) | 578 ms | 3 029 |
| Mobile ×4 — après | 336 ms | 1 978 ms | 6 (1 273 ms) | 953 ms | 4 904 |
| Mobile ×1 — avant | 96 ms | 286 ms | 0 | 0 ms | 3 029 |
| Mobile ×1 — après | 76 ms | 419 ms | 2 (130 ms) | 21 ms | 4 904 |

Phases (`tests/profile.mjs`, médianes, ms, ordinateur / mobile ×4) :

| Phase | Avant | Après | Commentaire |
|---|---:|---:|---|
| Lecture HTML | 84 / 407 | 120 / 587 | proportionnelle au poids de la page |
| Lecture des données (JSON) | 10 / 32 | 14 / 61 | idem |
| Création des marqueurs | 18 / 93 | 20 / 103 | ×2,1 marqueurs, coût quasi constant (optimisé) |
| Listes (trajet, parcours, Explorer) | 20 / 81 | 43 / 173 | tri alphabétique de 3 400 noms (21 → 60 ms mobile) |
| Premier filtrage et noms | 30 / 117 | 66 / 311 | écriture du tracé des 3 400 marqueurs |
| Démarrage total | 197 / 779 | 299 / 1 290 | |
| Prêt | 326 / 1 398 | 500 / 2 129 | |

**Le démarrage reste plus long qu'avant** (+40 à +50 % sur mobile ralenti, +130 à +170 ms sans ralentissement) : la
page pèse 1 Mo de plus et contient deux fois plus de lieux. Sans les optimisations ci-dessous, la mesure intermédiaire
était de 2 527 ms (« prêt », mobile ×4) — voir l'historique plus bas.

## Gestes — `ab-gestures.mjs`, 5 passages alternés

Durée d'une image (ms, médiane / 9e décile, nombre d'images > 33 ms) :

| Geste | Mobile ×4 avant | Mobile ×4 après | Ordinateur avant | Ordinateur après |
|---|---|---|---|---|
| Déplacement, vue d'ensemble | 58 / 75 (88) | **46 / 60 (82)** | 16,7 / 21,7 (1) | **16,7 / 17,0 (0)** |
| Déplacement, vue rapprochée | 56 / 71 (88) | **41 / 52 (83)** | 16,7 / 18,2 (0) | **16,7 / 17,2 (0)** |
| Pincement (zoom continu) | 63 / 80 (60) | **48 / 64 (59)** | 18,1 / 26,3 (0) | **16,8 / 26,7 (1)** |

**Avec deux fois plus de lieux, les gestes sont aussi fluides ou plus fluides qu'avant.**

## Interactions (`tests/profile.mjs`, tâche totale en ms, ordinateur / mobile ×4)

| Interaction | Avant | Après |
|---|---:|---:|
| Première interaction | 46 / 323 | 98 / 385 |
| Zoom (bouton) | 66 / 357 | 181 / 618 |
| Déplacement (30 images) | 467 / 1 796 | 485 / 1 373 |
| Filtre de catégorie (×4) | 42 / 154 | 83 / 246 |
| Recherche (5 frappes) | 32 / 104 | **19 / 76** |
| Fiche d'un lieu | 31 / 184 | 39 / 220 |
| Parcours de 51 étapes | 99 / 479 | 126 / 491 |
| Mémoire JS après démarrage (mobile) | 4,3 Mo | 13,1 Mo (index de recherche préparé) |

`tests/catalogue.mjs` (ordinateur) : recherche d'un nom 2,1 ms médiane ; filtre pays Italie/France/Espagne
10–12 ms ; « Ajouter tout un pays » (incontournables d'Italie, 34 étapes) 23 ms.

## Ce qui a été optimisé (sans retirer aucune fonction)

| Changement | Effet mesuré |
|---|---|
| Marqueurs tracés en coordonnées de carte, sans `transform` par élément (`src/js/map.js`) | déplacement mobile ×4 : 3 531 → ~1 300 ms (30 images) ; étape Layerize 1 605 → 257 ms |
| Chemins courts : point de départ absolu + suite relative mise en cache par forme et taille | premier filtrage mobile 411 → 285 ms ; zoom 721 → 563 ms |
| Contour commun porté par le calque des marqueurs ; contour propre seulement pour le lieu choisi, survolé ou favori | une écriture au lieu de 3 400 à chaque zoom |
| Calques remplis hors de la page au démarrage ; tracé écrit une seule fois | création des marqueurs 222 → 103 ms (mobile ×4) |
| Saisons mémorisées par texte (`months`) | 40 → 10 ms |
| Marqueurs à plus d'1,5 écran de la vue mis à l'écart (masqués, taille non recalculée), recalcul immédiat si la vue sort de cette zone | zooms en vue rapprochée ne redessinent plus toute l'Europe |
| Liseré clair des marqueurs ordinaires retiré pendant un glissement, un pincement ou un zoom à la molette (rendu à la fin du geste) | déplacement sur ordinateur 33 → 17 ms par image ; pincement 24,8 → 16,8 ms |
| Index de recherche préparé par paquets pendant les temps morts après le démarrage | recherche 104 → 76 ms (mobile ×4) |
| Largeur réelle des noms (canevas), police lue dans la feuille de style sans `getComputedStyle` | moins de noms superposés ; aucun recalcul de style forcé |

Écartés après mesure : couche composée (`will-change`) pour le calque des marqueurs (×6 plus lent) ; rendu sans
anticrénelage pendant le geste (gain marginal) ; Web Worker (le coût n'est pas du calcul JavaScript mais du
dessin) ; regroupement des marqueurs en quelques tracés (aurait supprimé l'élément par lieu sur lequel reposent
classes d'état, sélection et tests).

## Limites et pistes

- Démarrage : le poids de la page (2,5 Mo) et le tri de la liste Explorer sont proportionnels au catalogue. Pistes,
  par ordre d'intérêt : ordre de la liste pré-calculé à la construction (avec repli sur le tri si une fiche est
  modifiée) ; création différée des marqueurs hors de la vue initiale ; champs répétitifs des nouvelles fiches
  (`e`, `coordinateNote`) factorisés à la construction et restitués au chargement (~230 Ko).
- Zoom en vue d'ensemble : 3 178 des 3 400 lieux sont à l'écran ; leur tracé doit être réécrit à chaque changement
  d'échelle.
