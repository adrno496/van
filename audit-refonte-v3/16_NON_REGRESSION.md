# 16 — Non-régression

Règle du cycle : le Planner ne perd rien. Les mêmes suites qu'aux cycles 1 et 2 ont été rejouées sur **trois**
Planners : le fichier autonome, celui du site personnel et celui du site public.

## Acquis des cycles précédents

| Acquis | Avant ce cycle | Après | Preuve |
|---|---|---|---|
| Fonctionnel | 77 / 77 | 77 / 77 × 3 Planners | `e2e-final`, `e2e-personal-site`, `e2e-public` |
| Interface | 59 / 59 | 59 / 59 × 2 | `ui-final`, `ui-public` |
| Migration des données | 10 / 10 | 10 / 10 depuis trois versions (origine, cycle 1, cycle 2) | `migration-*` |
| Navigateurs | 6 / 6 | 6 / 6 × 2 | `smoke-*` |
| Contrôles du cycle 2 (formes, retour mobile, sécurité étendue, endurance, Planner public) | 36 / 36 | 36 / 36 | `v2-final` |
| Chromium, Firefox, WebKit | oui | oui, site compris | `smoke`, `site` |
| Serveur et fichier local | oui | oui, site compris | idem |
| IndexedDB, `localStorage` | inchangés | inchangés : aucune clé ajoutée, aucun champ modifié | migration |
| Import, export, sauvegarde, restauration | oui | oui | `e2e` P2, P4 ; `v2` |
| Géolocalisation simulée | oui | oui | `e2e` P5 |
| Politique de sécurité stricte | oui | oui ; le site a la sienne, sans `unsafe-*` | `e2e`, `site` |
| axe automatisé : 0 violation | oui | voir `09` | Creative Engine |
| `src/` + construction sans dépendance | oui | oui : `build.mjs` + `build/` | — |
| Aucun framework | oui | oui | — |
| Application autonome | oui | `index.html` s'ouvre toujours seul, sans le site | `smoke` |
| Performance du Planner | TBT 62 ms, score mobile 92 | voir `10` | Lighthouse |

## Fonctions du Planner

Explorer, recherche, carte, filtres, favoris, notes, statuts, lieux personnels, itinéraire, étapes, réordonnancement,
annuler et rétablir, optimisation, boucle, budget, consommation, dates, nuits, exports, imports, parcours enregistrés,
idées de parcours, pays, proximité du trajet, Google Maps, carnet, photos, sauvegarde et restauration, paramètres,
discrétion, géolocalisation : **toutes présentes**, couvertes par les 77 tests fonctionnels et les 36 contrôles du
cycle 2, sur les trois Planners.

## Ce qui a changé dans le Planner

| Changement | Effet quand on n'utilise pas le site |
|---|---|
| Liens d'entrée (`#pays`, `#lieu`, `#parcours`, `#q`) | aucun : sans fragment dans l'adresse, rien ne se passe |
| Marque en lien | aucun : seulement dans `dist/…/app/` |
| Bouton « Fichier pour le site » dans « Blog à partager » | un bouton de plus dans un dialogue |
| Liste « avant de partir » lue dans le catalogue | texte affiché identique |

Comparaison visuelle : 20 écrans du Planner autonome, 0 % de pixels différents avec le cycle 2.

## Données

Aucun format modifié, aucune migration. Les champs de publication (`visibility`, `status`, `slug`…) vivent dans
`content/`, pas dans le carnet enregistré chez l'utilisateur. L'export pour le site lit le carnet sans l'écrire.

## Régressions rencontrées, corrigées avant les preuves finales

| Régression | Détectée par | Correction |
|---|---|---|
| Dans le site, la marque du Planner (devenue lien) faisait 25 px de haut sur écran tactile | `tests/ui.mjs` sur `dist/public/app` : 7 contrôles | cible de 44 px |
| Aucune autre | — | les suites du Planner autonome sont restées vertes à chaque lot |

## Compatibilité de la commande de construction

| Commande | Cycle 2 | Cycle 3 |
|---|---|---|
| `node build.mjs`, `--check`, `--tokens`, `--split` | — | inchangées |
| `node build.mjs --mode public` | écrivait `dist-public/index.html` (Planner seul) | écrit `dist/public/` (site + Planner dans `app/`) |
| Planner public seul, en un fichier | la commande ci-dessus | `node build.mjs --mode public --out <fichier>` |

C'est le seul changement de comportement d'une commande existante ; il est demandé par le cahier des charges de ce
cycle et documenté dans le README.

## Non couvert

Appareil réel, lecteurs d'écran, mode privé, très anciens navigateurs : comme aux cycles précédents (`NON TESTÉ`).
