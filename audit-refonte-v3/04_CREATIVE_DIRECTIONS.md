# 04 — Trois directions créatives, comparées sur mesures

## Méthode

1. **Recherche créative du moteur** (`scripts/creative-directions.mjs`, Creative Engine 9.1.0) : trois cahiers des
   charges, 100 candidats chacun, spécifications valides → `evidence/creative-directions.json`.
2. Les sorties du moteur sont des **graines** ; les trois feuilles de style (`src/site/css/direction-{a,b,c}.css`,
   21 à 25 lignes chacune) sont mon travail.
3. Les trois directions sont **trois versions construites du même site** (`node build.mjs --mode public --direction b`),
   pas des maquettes : mêmes pages, même contenu, même code.
4. Mesures identiques sur les trois : `scripts/variant-metrics.mjs`, audit et Lighthouse de Creative Engine.

## Ce que le moteur a proposé

| Brief | Famille | Fond / texte / accent | Titres | Densité | Première page | Mouvement |
|---|---|---|---|---|---|---|
| A — Atlas éditorial cinématique | EDITORIAL | `#f6f9f7` / `#131b19` / `#178244` (vert) | Georgia | équilibrée | « manifesto » | créatif |
| B — Carnet de route contemporain | COMMERCE (éditorial) | `#f9f8f6` / `#1b1b13` / `#8b6818` (ambre) | Georgia | aérée | grande | élégant |
| C — Outdoor minimal | EDITORIAL | `#f6f9f7` / `#131b19` / `#178244` (vert) | Georgia | aérée | expressive | élégant |

Pour les trois : navigation réduite, appel à l'action **persistant**. Distance entre directions, selon le moteur
(0 à 100) : A–B 76, A–C 15, B–C 69.

Ce que j'en ai retenu, et ce que j'ai écarté :

- retenu : serif pour les titres, appel à l'action permanent, navigation courte, première page très grande pour A ;
- retenu pour C : l'accent vert proposé par le moteur ;
- **écarté pour A et B** : l'accent vert et l'ambre. Le cahier des charges demande de « conserver l'esprit actuel » ;
  A et B gardent la terre cuite et le papier du Planner. Le moteur donne la même palette à A et à C : ce sont la
  première page et la typographie qui les séparent, pas la couleur.

## Les trois directions réalisées

| | A — cinématique | B — carnet de route | C — outdoor minimal |
|---|---|---|---|
| Première page | sombre : l'Europe de nuit, chaque lieu est un point de lumière | papier : la carte comme une page de carnet | aplat vert, titre en capitales |
| Titres | serif, très grands | serif, italique en première page | sans empattement, gras |
| Accent | terre cuite | terre cuite | vert forêt |
| Images | coins arrondis | filet et ombre décalée, étiquettes penchées | angles droits |
| Bandeaux | vert forêt | sable | noir-vert |
| Captures | `variants/A/` | `variants/B/` | `variants/C/` |

## Grille de comparaison

| Critère | Mesure | A | B | C | Source |
|---|---|---|---|---|---|
| **Lisibilité** | plus faible contraste de texte (seuil 4,5) | **6,02** | **6,02** | 5,94 | `variant-metrics.json` |
| **Contraste** | couples conformes | 26 / 26 | 26 / 26 | 26 / 26 | idem |
| **Densité** | mots au premier écran, ordinateur / téléphone | **43 / 32** | 44 / 50 | 64 / 53 | idem |
| | longueur de l'accueil en écrans, ordinateur / téléphone | 6,4 / 7,5 | 6,1 / 7,3 | **5,9 / 7,1** | idem |
| **Hiérarchie** | part du premier écran occupée par l'image | **63 %** | 54 % | 49 % | idem |
| | hauteur de la première page | **92 %** de l'écran | 80 % | 72 % | idem |
| | position de la première carte de contenu | 1 137 px | 1 006 px | **916 px** | idem |
| **Perception « premium »** | — | NON TESTÉ | NON TESTÉ | NON TESTÉ | jugement, pas une mesure |
| **Personnalité** | distance du moteur aux deux autres | 76 et 15 | **76 et 69** | 15 et 69 | `creative-directions.json` |
| **Performance** | Lighthouse mobile / ordinateur | 100 / 100 | 100 / 100 | 100 / 100 | `variants-creative-engine.json` |
| | LCP mobile | 1,11 s | 1,09 s | 1,08 s | idem |
| **Responsive** | débordement, 5 largeurs du moteur | 0 | 0 | 0 | idem |
| **Accessibilité** | cibles sous 44 px | 0 | 0 | 0 | `variant-metrics.json` |
| | violations axe (avant corrections communes) | 21 | 21 | 20 | `variants-creative-engine.json` |
| **Cohérence avec le Planner** | jetons de marque modifiés (police des titres, accent) | **0** | **0** | 4 | feuilles de style |
| **Différenciation** | ressemblance avec la référence d'ambiance | sombre comme elle, mais vert et cartographique | aucune | aucune | `evidence/reference-analysis.md` |
| **Maintenabilité** | lignes propres à la direction | 21 | 25 | 22 | feuilles de style |
| **Conversion vers le Planner** | accès au Planner au premier écran, ordinateur / téléphone | 2 / 1 | 2 / 1 | 2 / 1 | `variant-metrics.json` |
| Qualité Creative Engine | score d'audit | 64 | 65 | 64 | `variants-creative-engine.json` |

Les violations axe relevées à ce stade (textes en cours d'apparition) étaient communes aux trois directions et ont
été corrigées ensuite ; elles ne les départagent pas.

## Décision : direction A

Les mesures ne désignent pas un vainqueur sur la performance, l'accessibilité ou le contraste : les trois sont à
égalité. Le choix se fait sur ce qui les sépare :

1. **A est la plus immersive, mesurablement** : l'image occupe 63 % du premier écran, la première page 92 % de la
   hauteur, avec le moins de mots (43, et 32 sur téléphone). C'est le principe retenu de la référence — l'image
   d'abord, une phrase, deux actions — obtenu avec un visuel qui n'appartient qu'à Atlas Van.
2. **A garde l'identité du Planner intacte** (aucun jeton de marque modifié), comme B. C change la police des titres
   et l'accent : passer du site au Planner ferait changer de marque.
3. **B promet ce qui n'existe pas encore.** Étiquettes penchées et pages de carnet annoncent une voix personnelle,
   des notes, des photos ; les rubriques Voyages et Carnet sont vides aujourd'hui. B deviendra la meilleure candidate
   le jour où le carnet sera rempli.
4. **C est la plus sobre et la plus courte**, mais la moins singulière : aplat vert et capitales grasses sont le
   vocabulaire de beaucoup de marques d'extérieur.

Point de vigilance sur A : c'est la seule à partager un trait avec la référence (une première page sombre). Elle
s'en écarte par tout le reste — vert forêt et non bleu nuit, carte et non photographie, serif, pages claires.

Ce que les mesures ne tranchent pas : la perception réelle par des lecteurs (`NON TESTÉ`).

Changer de direction demande une option, pas une réécriture :

```bash
node build.mjs --mode public --direction b
```
