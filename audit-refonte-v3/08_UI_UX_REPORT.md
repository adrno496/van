# 08 — Interface et parcours

## Ce que l'accueil doit faire comprendre en quelques secondes

| Message | Où il se lit | Vérifié |
|---|---|---|
| C'est un univers de voyage en van | première page : la carte de l'Europe, « Atlas de l'Europe en van » | capture `screenshots/site/accueil-1440.png` |
| Il y a des destinations et des itinéraires | phrase de première page (« … lieux dans 34 pays, 25 itinéraires ») ; sections « Destinations » et « Road trips » | test « accueil » |
| Il y a un atlas de lieux | bandeau au grand chiffre, « lieux dans l'Atlas » | idem |
| On peut préparer son propre voyage | « Préparer mon voyage » : en-tête, première page, bandeau final | 2 accès au premier écran sur ordinateur, 1 sur téléphone |

Ce que l'accueil **ne dit pas**, parce que ce serait faux aujourd'hui : qu'il y a des récits. Les sections « Derniers
voyages » et « Carnet » n'apparaissent que si du contenu publié existe.

## Mesures de l'accueil (direction A)

| Mesure | Ordinateur 1440 × 900 | Téléphone 390 × 844 |
|---|---:|---:|
| Mots au premier écran | 43 | 32 |
| Part du premier écran occupée par l'image | 63 % | 61 % |
| Hauteur de la première page | 92 % de l'écran | 92 % |
| Actions au premier écran | 3 (dont 2 vers le Planner) | 2 (dont 1 vers le Planner) |
| Longueur de la page | 6,4 écrans | 7,5 écrans |
| Cibles sous 44 px | 0 | 0 |
| Débordement horizontal | 0 | 0 |

Source : `evidence/variant-metrics.json`. Pour mémoire, la référence d'ambiance : 61 mots par écran, 3,3 écrans,
image à 100 % du premier écran. L'accueil d'Atlas Van est plus long parce qu'il présente un catalogue ; sur
téléphone, chaque section se limite à trois vignettes.

## Parcours

| Parcours | Étapes | Testé |
|---|---|---|
| Découvrir un pays, puis l'explorer | Accueil → Destinations → Italie → « Explorer les 362 lieux dans Atlas » → carte filtrée | oui |
| Adopter un itinéraire | Accueil → Road trips → Balkans → « Préparer ce parcours » → trajet de 28 étapes | oui |
| Lire un récit, voir le lieu | Carnet → article → « Voir cette étape sur la carte » | oui (contenu de test) |
| Chercher | Rechercher → « portugal » → destination, voyage, lieux | oui |
| Aller droit à l'outil | « Préparer mon voyage », depuis n'importe quelle page | oui |
| Revenir du Planner | marque « Atlas van » → accueil | oui |

## Site éditorial, pas tableau de bord

| Risque | Ce qui a été fait |
|---|---|
| Grille de petites cartes identiques | une grande vignette et deux ou cinq moyennes par section ; des listes à filets pour les guides et les étapes |
| Catalogue d'outils | l'outil n'apparaît que comme destination d'un bouton ; aucune capture d'écran du Planner |
| Page d'accueil « produit » | pas de liste de fonctions, pas de chiffres vantards : un seul nombre, celui des lieux |
| Vocabulaire commercial | aucun « révolutionnaire », « ultime », « incroyable » ; les réserves sont écrites (« proposition », « estimée », « non sourcées ») |

## Téléphone

| Point | État |
|---|---|
| Une action principale à la fois | première page : un bouton plein, un bouton contour |
| Menu au pouce | plein écran, liens de 60 px de haut, Planner en bas |
| Images pleine largeur | oui |
| Textes | 17 px, interligne 1,65 ; récits 18 px, interligne 1,75 |
| Cibles | 44 px au minimum, 48 px au toucher — vérifié de 320 à 1024 px |
| Planner toujours accessible | menu et pied de page ; le bouton d'en-tête passe dans le menu sous 1020 px |
| Zones sûres (encoche) | marges `env(safe-area-inset-*)` sur l'en-tête, le menu, le pied de page |

`PARTIAL — émulation uniquement` : aucun essai sur un vrai téléphone (comme au cycle 2).

## États prévus

| État | Rendu |
|---|---|
| Rubrique sans contenu (Voyages, Carnet) | encadré : ce que la rubrique accueillera, lien vers ce qui existe |
| Article sans image, sans lieu, sans extrait | titre, date, texte ; aucun bloc vide |
| Destination sans incontournable ni itinéraire | les sections absentes ne sont pas affichées |
| Pays sans notes pratiques | section « Sur la route » absente |
| Recherche sans résultat | « Aucun résultat pour « … » » |
| Page inconnue | page 404 avec retour à l'accueil et recherche |
| Sans JavaScript | tout le contenu est lisible ; la navigation passe par le pied de page ; la recherche le dit |
| Contenu privé (version personnelle) | étiquette « Privé » ou « Brouillon — privé » |
| Contenu à fournir (version personnelle) | encadré « À compléter — non publié » |

## Captures

| Dossier | Contenu |
|---|---|
| `screenshots/site/` | 12 pages × 3 largeurs (1440, 820, 390) : accueil, listes, destination, road trip, guides, à propos, recherche, 404 |
| `screenshots/site-contenu-de-test/` | voyages, voyage, carnet, article × 3 largeurs, **avec le contenu de test** (images en dégradé, textes de test) |
| `screenshots/planner/`, `planner-personnel/` | 10 écrans du Planner × 2 largeurs |
| `variants/{A,B,C}/` | accueil, destination, liste des road trips pour chaque direction |

Comparaison avant / après pour le Planner : 20 écrans comparés pixel à pixel avec ceux du cycle 2 —
0 % de pixels différents (`evidence/planner-visual-diff.json`). Le site, lui, n'existait pas avant.

## Limites

| Point | Statut |
|---|---|
| Perception « premium », « vivant », « identifiable » | NON TESTÉ — aucun lecteur n'a vu le site |
| La photographie domine-t-elle ? | **non** : il n'y a pas de photographie. Les cartes dessinées tiennent la place ; c'est un atlas, pas encore un magazine |
| Essai par des utilisateurs, sur téléphone | NON TESTÉ |
