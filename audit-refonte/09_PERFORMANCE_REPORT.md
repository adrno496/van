# 09 — Performance

Mesures de laboratoire sur cette machine (10 cœurs, partagée avec d'autres tâches : charge de 9 à 18 pendant les
mesures). Chaque comparaison a été faite **dans la même séance, l'une après l'autre**. Elles servent à comparer
deux versions, pas à certifier une valeur absolue. Mesures de terrain : `NON TESTÉ`.

## Poids

| | Avant | Après | Écart |
|---|---:|---:|---:|
| Fichier livré | 1 536 Ko | 1 602 Ko | **+66 Ko (+4,3 %)** |
| dont données du catalogue | 1 357 Ko | 1 358 Ko | inchangées (mêmes octets, plus une ligne de commentaire) |
| dont JavaScript | 136 Ko | 162 Ko | +26 Ko |
| dont CSS | 32,5 Ko | 46,7 Ko | +14 Ko |
| dont HTML et icônes | 9 Ko | 34 Ko | +25 Ko |
| Requêtes réseau au chargement | 1 feuille de style + 3 polices (Google) | **0** | |
| Nœuds du DOM | 7 482 | 7 765 | +283 |

Le fichier est plus lourd. Le gain vient d'ailleurs : plus de ressource bloquante distante, structure de page
présente dès le HTML, travail de dessin réduit.

## Lighthouse 13.5 (via Creative Engine, médiane de 3 passages)

Série mesurée à version de moteur égale, les deux versions l'une après l'autre (détail et première série dans `03`) :

| | Mobile avant | Mobile après | Ordinateur avant | Ordinateur après |
|---|---:|---:|---:|---:|
| Performance | 74 | **80** | 81 | **100** |
| Plus grand élément (LCP) | 3,6 s | 3,0 s | 1,29 s | 0,72 s |
| Décalage de mise en page (CLS) | 0 | 0 | 0,237 | 0,014 |
| Temps de blocage (TBT) | 78 ms | **382 ms** | 0 ms | 27 ms |
| Statut du moteur | PARTIAL | PARTIAL | PARTIAL | PASS |

Une première série, prise plus tôt, donnait 58 → 82 sur mobile : la baseline varie beaucoup d'une mesure à l'autre
parce qu'elle attend Google Fonts. **Le gain mobile réel se situe donc entre +6 et +24 points ; je retiens +6.**
Le temps de blocage sur mobile est moins bon qu'avant : voir « Démarrage » ci-dessous.

## Démarrage et interactions (`node tests/perf.mjs`, médiane de 5 démarrages)

| Mesure | Ordinateur avant | après | Mobile ×4 avant | après |
|---|---:|---:|---:|---:|
| Page interactive | 361 ms | **223 ms** | 1 581 ms | **698 ms** |
| Tâches longues au démarrage | 261 ms | 96 ms | 1 243 ms | 511 ms |
| CLS | 0,20 | 0,01 | 0 | 0 |
| `rescale()` (tailles et noms après un geste) | 10,7 ms | **2,3 ms** | 37,5 ms | **7,3 ms** |
| `applyFilters()` (un changement de filtre) | 27,1 ms | **6,0 ms** | 157,9 ms | **17,8 ms** |
| Liste des lieux | 2,5 ms | 2,6 ms | 17,6 ms | 9,1 ms |
| Une frappe dans la recherche | 4,2 ms | 4,6 ms | 19,3 ms | 16,2 ms |
| Afficher une fiche | 2,9 ms | 2,5 ms | 16,4 ms | 5,4 ms |
| Redessiner un trajet de 51 étapes | 18,2 ms | 8,7 ms | 57,2 ms | 35,4 ms |
| Déplacement de la carte, image médiane | 16,6 ms | 16,6 ms | 24,5 ms | 21,5 ms |

« Mobile ×4 » : écran 390 × 844, processeur ralenti quatre fois par le protocole DevTools.

### D'où viennent les gains

| Changement | Effet mesuré |
|---|---|
| Un filtre déclenchait 3 `rescale()` et 2 rendus de liste (fonctions empilées) ; une seule passe désormais | `applyFilters` ÷ 4 à ÷ 9 |
| Épaisseurs de trait fixées en CSS (`vector-effect`) au lieu de 1 600 + 47 attributs réécrits à chaque geste | `rescale` ÷ 4 à ÷ 5 |
| Noms : attributs écrits seulement pour les noms réellement affichés | idem |
| Marqueurs masqués ignorés | idem |
| Infobulle : 1 écouteur sur la carte au lieu de 6 400 fermetures | mémoire, démarrage |
| Structure de page dans le HTML au lieu d'être fabriquée puis déplacée par JavaScript | CLS 0,20 → 0,01 |
| Plus de feuille de style distante bloquante | FCP |

### Déplacement de la carte

Mesure dédiée (120 images, 3 répétitions, mobile ×4) : médianes 22 / 22 / 18 ms avant, 20 / 22 / 22 ms après.
**Pas de différence mesurable.** J'ai vérifié que `vector-effect` ne coûtait rien (variantes sans : mêmes valeurs).
Le déplacement n'a donc pas été amélioré.

### Démarrage : où part le temps (mobile ×4, ~350 ms de JavaScript)

| Phase | Durée |
|---|---:|
| Tracé des 47 pays (60 000 points projetés) | ~82 ms |
| Premier calcul de mise en page (1 600 marqueurs) | ~66 ms |
| Création des 1 600 marqueurs | ~55 ms |
| Filtres, liste, tailles | ~49 ms |
| Branchement des commandes | ~46 ms |
| Listes de référence et parcours | ~31 ms |
| Trajet | ~18 ms |

## Ce qui n'a pas été fait

| Piste | Gain attendu | Pourquoi non |
|---|---|---|
| Projeter les contours des pays à la construction | ~80 ms sur mobile ×4 | change le format des données embarquées ; à faire avec des tests de rendu |
| Créer les marqueurs par tranches | réduirait le temps de blocage | risque d'affichage partiel au démarrage |
| Déplacer la carte par transformation, recadrer à la fin du geste | fluidité du déplacement | changement profond du moteur de carte |
| Mise en cache hors connexion (PWA) | aucun pour un fichier local | voir ci-dessous |
| Réduction du code à la construction | ~40 Ko | rendrait le fichier livré illisible, pour 2,5 % |

## PWA / hors connexion — évaluation (§32)

**Non mise en œuvre — `NON APPLICABLE` dans l'usage actuel.** Le fichier fonctionne déjà entièrement hors connexion
(aucune ressource externe, vérifié). Un service worker ne s'installe pas sur une page ouverte en `file://` : il
n'apporterait quelque chose que si l'application était hébergée, et ajouterait alors un problème
d'invalidation de cache. Si un hébergement est décidé un jour, `node build.mjs --split` fournit la base ; un
manifeste et un service worker seraient alors un lot à part (P3).
