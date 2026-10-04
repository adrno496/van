# 06 — Intégration du Planner

## Règle

Le Planner est repris **tel quel**. Il n'a perdu aucune fonction, aucun écran, aucun format de données. Trois
ajouts, tous sans effet quand on l'ouvre seul :

| Ajout | Fichier | Effet |
|---|---|---|
| Liens d'entrée par l'adresse | `src/js/shell.js` (`applyDeepLink`) | le site peut ouvrir le Planner sur un pays, un lieu, un parcours, une recherche |
| Lien de la marque vers le site | `build/planner.mjs` (`brand`) | dans `dist/…/app/` seulement ; dans `index.html` autonome, la marque reste un simple titre |
| Export « Fichier pour le site » | `src/js/journal.js` (`articlesForSite`) | un bouton de plus dans « Blog à partager » |

Un déplacement : la liste « avant de partir » vit désormais dans `src/data/checklist.js`, lue par le Planner et par
le guide du site (une seule source ; le texte affiché est identique).

## Passerelles du site vers le Planner

| Depuis | Lien | Effet dans le Planner |
|---|---|---|
| Toute page | « Préparer mon voyage » (en-tête, menu, pied de page) | ouverture simple |
| Une destination | « Explorer les 362 lieux dans Atlas » → `#pays=italie` | carte filtrée sur le pays et cadrée dessus |
| Un road trip | « Préparer ce parcours dans Atlas » → `#parcours=<slug>` | parcours chargé — **ou proposé** si un trajet existe déjà |
| Une étape, un incontournable, un récit | nom du lieu → `#lieu=<id>` | lieu choisi, carte centrée |
| La recherche du site | résultat « Lieu » → `#lieu=<id>` | idem |
| — | `#q=<texte>` | recherche du Planner préremplie |

Toutes ces transitions sont testées, depuis les pages réelles et en fichier local (`tests/site.mjs`, groupe
« planner »).

## Proposition contrôlée

Un parcours demandé par un lien ne remplace jamais un trajet en cours sans accord : le Planner demande
« Charger ce parcours ? … remplacera votre trajet actuel (3 étapes). Vous pourrez annuler. » Refuser garde le trajet ;
accepter le remplace, et « annuler » le rétablit (testé).

## Validation des liens d'entrée

Rien de ce qui vient de l'adresse n'est écrit dans la page.

| Paramètre | Accepté si | Sinon |
|---|---|---|
| `lieu` | forme `chiffres` ou `c` + chiffres, **et** identifiant présent dans le catalogue (propriété propre) | ignoré |
| `pays` | égal à l'adresse d'un pays de la liste du Planner | ignoré |
| `parcours` | égal à l'adresse d'un parcours du catalogue | ignoré |
| `q` | texte, 80 caractères au plus, placé dans la valeur du champ | — |
| autre clé, encodage invalide, plus de 300 caractères | — | ignoré |

Une fois lu, le lien est retiré de l'adresse : recharger la page ne le rejoue pas.
Dix valeurs hostiles sont testées (`__proto__`, `constructor`, balises, remontée de dossier, encodage cassé,
5 000 caractères) : aucun effet, aucune erreur.

La même règle d'adresse (`slugOf` dans le Planner, `slug` à la construction) sert des deux côtés ; un test vérifie
que les liens produits par le site ouvrent bien la bonne cible.

## Cohérence visuelle

Mêmes jetons (`tokens.css`), même marque, même terre cuite, même serif. Le site est plus grand, plus aéré, plus
sombre en première page ; le Planner reste dense et utilitaire. La direction A ne modifie aucun jeton de marque.

Écart assumé : le Planner n'a pas l'en-tête du site (rubriques, menu). Sur un écran de téléphone, sa barre du haut
est déjà occupée par la recherche ; y ajouter six rubriques aurait coûté de la place à la carte. Le retour se fait
par la marque.

## Fonctions du Planner : toutes préservées

Explorer, recherche, carte, filtres, favoris, notes, statuts, lieux personnels, itinéraire, étapes, ordre,
annuler et rétablir, optimisation, boucle, budget, consommation, dates, nuits, exports, imports, parcours
enregistrés, idées de parcours, pays, proximité du trajet, Google Maps, carnet, photos, sauvegarde et restauration,
paramètres, discrétion, géolocalisation : couvertes par les 77 + 59 + 36 tests des cycles précédents, rejoués sur
`index.html`, sur `dist/personal/app/` et sur `dist/public/app/` (`13`, `16`).

## Performance du Planner

Inchangée par ce cycle : le travail du cycle 2 (TBT 62 ms, score mobile 92) est conservé. Mesure finale dans `10`.
