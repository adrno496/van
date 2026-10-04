# 02 — Rendu de la carte : analyse et décisions

## Comment la carte était construite (baseline V2)

Carte SVG maison (projection conique de Lambert, zoom par `viewBox`). Au démarrage, dans une seule tâche :

1. le navigateur compile un script de 1,3 Mo contenant le catalogue en littéral JavaScript ;
2. 33 073 points de contours de 47 pays sont projetés et transformés en chemins ;
3. pour chacun des 1 600 lieux, 4 éléments SVG sont créés : un groupe, un disque invisible de 22 px servant de zone
   de toucher, le disque visible, et un texte masqué pour le nom (5 éléments pour une base, avec son halo) ;
4. les commandes sont branchées, les listes remplies, la vue cadrée, les filtres appliqués, les noms placés.

Résultat mesuré : 6 405 éléments pour les marqueurs sur 9 603 dans la page, 1 681 textes dont 77 affichés.

## Où partait le temps (mobile, processeur ×4, médiane de 5 — `evidence/profile-baseline-v2.txt`)

| Poste | Durée | Constat |
|---|---:|---|
| Compilation JavaScript | 206 ms | dominée par le catalogue en littéral |
| Lecture des données | 77 ms | idem |
| Dessin des pays | 62 ms | projection + 47 chemins |
| Première vue et mise en page | 61 ms | première mise en page de 9 600 éléments |
| Création des marqueurs | 53 ms | 6 400 éléments |
| Filtre initial et noms | 45 ms | 1 600 lectures de classes dans le DOM, tri alphabétique à chaque fois |
| Branchement des commandes | 42 ms | |
| Listes | 30 ms | |
| Trajet | 18 ms | |

Tout cela dans **une tâche de 348 ms**, d'où un temps de blocage de 379 ms.

Interactions : chaque filtre relisait et réécrivait les classes de 1 600 groupes et retriait la liste avec
`localeCompare` ; chaque frappe de recherche renormalisait (accents, casse) jusqu'à cinq textes par lieu ; après
chaque déplacement, `rescale()` réécrivait 3 200 attributs dont aucun n'avait changé ; pendant un pincement,
le navigateur recalculait à chaque image 1 600 contours « non-scaling-stroke » et recomposait tous les textes.

## Optimisations évaluées

Mesures : `tests/profile.mjs` (médiane de 5) et, pour les décisions, comparaisons **en alternance**
(`scripts/ab-boot.mjs`, `scripts/ab-gestures.mjs`). Mobile = 390 × 844, processeur ralenti ×4.

### Retenues

| # | Optimisation | Effet mesuré | Preuve |
|---|---|---|---|
| O1 | **Clés de recherche en cache** (nom, pays, résumé, contenu sans accents, calculés une fois par lieu) et **ordre de la liste calculé une fois** | recherche (5 frappes) 103 → 60 ms ; part de script des filtres 107 → 22 ms | `profile-o1-o2.txt` |
| O2 | **Un seul élément SVG par lieu** (un chemin, placé et dimensionné par `transform`), **noms dans un calque à part créés à la demande**, classes et tailles écrites seulement quand elles changent, sélection limitée aux deux lieux concernés, survol calculé (lieu le plus proche) au lieu d'une zone invisible par lieu | page 9 603 → 4 894 éléments ; création des marqueurs 53 → 13 ms ; filtres 217 → 40 ms ; temps de blocage 379 → 215 ms | `profile-o1-o2.txt` |
| O3 | **Contours des pays projetés à la construction** et livrés en SVG dans la page | dessin des pays 62 → 0 ms au démarrage ; 518 Ko de coordonnées en moins à lire | `profile-o3-o4.txt` |
| O4 | **Catalogue livré en JSON** (`JSON.parse`) au lieu d'un littéral JavaScript | compilation 172 → 82 ms ; lecture des données 63 → 15 ms ; mémoire JavaScript 8,4 → 4,3 Mo ; fichier 1 601 923 → 1 505 829 octets | `profile-o3-o4.txt` |
| O5 | **Démarrage en quatre étapes courtes** (lieux ; état, vue et commandes ; listes ; carnet), une tâche du navigateur chacune | plus longue tâche 248 → 114 ms ; temps de blocage 226 → 104 ms (en alternance, médiane de 9) | `ab-boot-o5.json` |
| O6 | **Contours des marqueurs sans « non-scaling-stroke »** : l'épaisseur est écrite par la carte dans l'unité du marqueur, elle reste de 1,2 px à l'écran | pincement 38,6 → 31,1 ms par image | `ab-gestures-o6.json` |
| O7 | **Textes de la carte en `text-rendering: geometricPrecision`** : ils suivent le zoom sans être recomposés à chaque image | pincement 34,3 → 20,2 ms par image ; mise en page par image 15 → 4,6 ms | mesure d'essai, puis `ab-gestures-o7.json` |

Résultat cumulé sur les gestes (en alternance, médiane de 5) : pincement **38,5 → 18,9 ms par image**, images au-delà
de 33 ms **51 sur 60 → 0** (`evidence/ab-gestures-o7.json`, charge 7). Rejoué à la fin sur une machine plus chargée
(`ab-gestures-final.json`, charge 14) : 45,4 → 22,7 ms, 59 sur 60 → 1. Voir `01_PERFORMANCE_ANALYSIS.md`.

### Évaluées et écartées

| Piste | Mesure ou raison | Décision |
|---|---|---|
| Retirer « non-scaling-stroke » des contours de pays | aucun gain mesuré (pincement 28,0 → 29,0 ms, mise en page 12,3 → 11,8 ms) : le coût restant venait des textes, pas des pays | écartée, code non modifié |
| Déplacement par transformation CSS pendant le geste | le déplacement tient déjà la cadence de l'écran : 16,8 à 18 ms par image avant comme après, 0 à 1 image sur 90 au-delà de 33 ms | inutile |
| Masquer les marqueurs hors de la vue (culling) | même constat : en vue rapprochée, 16,8 ms par image ; le navigateur ne peint déjà que la zone visible ; basculer 1 600 éléments pendant un déplacement ajouterait du travail | écartée |
| Niveaux de détail (cacher les lieux secondaires en vue d'ensemble) | changerait ce que l'on voit sur la carte (les 1 600 lieux sont une fonction) pour un gain que les mesures ne réclament plus | écartée ; décision de produit, pas de performance |
| Création des marqueurs par `innerHTML` | 13 ms en mobile ×4 avec `createElementNS` ; `innerHTML` ajouterait une écriture HTML à auditer | écartée |
| `requestIdleCallback` | absent de Safari ; `MessageChannel` donne le même découpage partout, et n'est pas ralenti dans un onglet en arrière-plan | remplacée par O5 |
| Web Worker | la politique de sécurité (`script-src` par empreintes) interdit un worker créé depuis un `blob:` ; depuis un fichier séparé, il ne se charge pas en `file://` ; et il ne reste que 15 ms de lecture JSON à déplacer | non applicable sans affaiblir la politique ou perdre `file://` |
| Canvas ou WebGL | les objectifs sont atteints en SVG ; un canevas ferait perdre le texte net à tout zoom et obligerait à refaire sélection, survol et contrastes | non retenue (comme le prévoyait le cahier des charges) |
| Délégation d'événements | déjà en place : tous les gestes sont écoutés sur la carte, aucun écouteur par marqueur (183 écouteurs au total, stable) | rien à faire |
| Anti-rebond de la recherche | 12 ms par frappe en mobile ×4 après O1 : un délai ajouterait de la latence sans rien économiser | écartée |

## État final de la carte

| Mesure | Baseline V2 | Final |
|---|---:|---:|
| Éléments par lieu | 4 (5 pour une base) | 1 (+ 1 halo par base) |
| Éléments SVG de la carte | 6 647 | 1 938 |
| Éléments dans la page | 9 603 | 4 893 |
| Textes de noms dans le DOM | 1 600 (dont 77 affichés) | 77 créés au départ ; 164 après 5 tours de zooms et filtres, stable |
| Écouteurs d'événements | 189 | 183 à 189 |
| Mémoire JavaScript après démarrage | 6,7 Mo | 4,3 Mo |
| Projection des pays au démarrage | 33 073 points | 0 (faite à la construction) |

Les valeurs finales de démarrage et d'interaction sont dans `01_PERFORMANCE_ANALYSIS.md`.

## Ce qui n'a pas changé

Projection, algorithme de placement des noms (priorité, collisions, seuils de zoom), rayon de sélection au
toucher (26 px), gestes, raccourcis clavier, tracé du trajet et du fil du carnet, formats de données. Le survol
désigne désormais le lieu le plus proche du pointeur dans ce même rayon — le même que celui qu'un clic choisit —
au lieu du dernier marqueur dessiné sous le pointeur.
