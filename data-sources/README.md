# data-sources — d'où viennent les lieux, comment en ajouter

Ce dossier contient tout ce qui sert à **produire** le catalogue, jamais ce qui est livré : le Planner et le site ne lisent
que `src/data/lieux/<pays>.json` (et `src/data/places.js` pour les contours, parcours et fiches pays). Aucun appel réseau
n'a lieu à la construction ni dans le navigateur.

```text
data-sources/
  README.md                     ce fichier : méthode, sources, règles
  baseline-v10.json             catalogue d'avant le lot v10 : nombre de lieux par pays, empreinte de chaque fiche
  targets-v10.json              cible par pays du lot v10 (au moins 2 × le nombre initial)
  ledger-v10.json               identifiant attribué à chaque candidat retenu : une relance ne renumérote rien
  candidates/v10/*.json         candidats proposés, par zone (entrée du pipeline, versionnée)
  candidates/v10/_decisions.json   arbitrages manuels après revue : keep (garder malgré un signalement), drop (écarter)
  review/v10/<pays>.json        sortie du pipeline : chaque candidat, ses contrôles, son score, sa décision et pourquoi
  reference/                    données de référence, extraits européens compacts (voir plus bas)
scripts/places/
  lib.mjs                       outils communs (lecture du catalogue, noms, distances, contours, gazetier)
  fetch-reference.mjs           (re)télécharge les données de référence — seul script qui utilise le réseau
  enrich.mjs                    candidats → contrôles → doublons → score → sélection → fiches
  validate.mjs                  contrôles bloquants du catalogue (quotas, identifiants, coordonnées, provenance…)
  report.mjs                    couverture par pays avant / après (nombres, catégories, régions, mailles)
```

## Ajouter des lieux (nouveau lot)

1. **Candidats** : écrire un fichier JSON (tableau) dans `data-sources/candidates/<lot>/`. Format d'un candidat :
   `n` nom (français s'il existe un usage), `alt` autres noms, `p` pays (nom exact du catalogue), `c` catégorie
   (`ville`, `nature`, `patrimoine`, `plage`), `q` type court, `y`/`x` latitude/longitude du lieu lui-même,
   `pt` ce que représente le point, `near` localité de plus de 2 000 habitants la plus proche, `nearKm` distance
   annoncée, `d` description factuelle (1-2 phrases), `v` à voir (« · »), `s` saison, `du` durée, `w` importance,
   `unesco`, `conf` confiance dans les coordonnées, `sc` auto-évaluation (`tour`/25, `van`/15, `sing`/15, `val`/15, `acc`/5).
   Jamais d'horaires, de tarifs, de stationnement, de bivouac ou d'accès van inventés.
2. **Cibles** : `data-sources/targets-<lot>.json` (nombre total visé par pays) et `baseline-<lot>.json`
   (état de départ, voir le début de `validate.mjs`).
3. **Pipeline** : `node scripts/places/enrich.mjs --batch <lot> --explain` — rien n'est écrit avec `--dry`.
   Une relance retire d'abord les fiches du lot puis les remet : le résultat ne dépend que des entrées.
4. **Revue** : lire `review/<lot>/<pays>.json` ; les candidats signalés (« à contrôler : à 120 m de la fiche… »,
   « information volatile ») sont écartés tant qu'ils ne sont pas dans `_decisions.json` → `keep`.
5. **Contrôles** : `node scripts/places/validate.mjs --batch <lot>` puis `node tests/catalogue.mjs`.
6. **Construction** : `node build.mjs`, `node build.mjs --mode public`, `node build.mjs --mode personal`.

Retour en arrière d'un lot : `git revert` du commit du lot, ou retirer les fiches `"batch": "<lot>"` des fichiers
`src/data/lieux/*.json` (les fiches d'origine ne portent pas ce lot et ne sont jamais modifiées par le pipeline).

## Contrôles faits par le pipeline (enrich.mjs)

| Contrôle | Règle | Effet |
|---|---|---|
| Champs | nom, pays connu, catégorie touristique, coordonnées valides, description ≥ 40 caractères | rejet |
| (0, 0), inversion | point (0, 0) ; latitude/longitude inversées (le point inversé tombe dans le pays) | rejet |
| Pays | point dans le contour du pays annoncé (contours simplifiés de la carte, tolérance côte/frontière) ; dans un autre pays à plus de 2 km ; à plus de 12 km du pays sans localité du pays à moins de 15 km (mer) | rejet / signalement |
| Localité de référence | distance réelle entre le point et `near` (gazetier GeoNames) comparée à `nearKm` : tolérance max(12 km, 1,6 × annoncé + 8 km) ; au-delà de +25 km | signalement / rejet |
| Ville ou village | s'il figure dans GeoNames à moins de 6 km : coordonnées GeoNames, lien `source` GeoNames, QID Natural Earth si la ville y figure | correction |
| UNESCO | si le point de la liste UNESCO est à moins de 4 km : lien `source` UNESCO | lien |
| Doublons | même QID ; même nom (sans accents, articles, mots génériques multilingues : château/castle/castello/burg…) à moins de 30 km ; point à moins de 250 m d'une fiche existante (à contrôler) ; doublons entre candidats | rejet / revue |
| Textes | expressions interdites de la version publique ; informations volatiles (€, horaires, parking, bivouac…) ; descriptions génériques | rejet / revue |

## Score (sur 100) et sélection

`tour` 25 · `van` 15 · `sing` 15 · `val` 15 (auto-évaluation du curateur) · `geo` 10 (couverture : la maille de
0,5° du lieu a 0, 1, 2… lieux) · `rel` 10 (fiabilité : confiance annoncée, moins les écarts de contrôle) · `acc` 5 ·
`src` 5 (lien UNESCO ou GeoNames : 5, localité vérifiée : 3, contrôle partiel : 1).
Sélection pays par pays, jusqu'à la cible : à chaque pas, le meilleur score augmenté du bonus de couverture de sa
maille, avec une pénalité si une catégorie dépasse la moitié des ajouts. « Incontournable » (`w: 1`) est réservé à
~6 % des ajouts, les mieux notés. Les candidats non retenus restent dans la revue (« réserve ») pour un lot futur.

## Sources

| Source | Usage | Licence |
|---|---|---|
| GeoNames, localités ≥ 1 000 habitants (paquet npm `all-the-cities` 3.1.0) et noms de régions (`cities.json` 1.1.65) | contrôle des coordonnées, coordonnées des villes et villages, couverture régionale | CC BY 4.0 |
| Liste du patrimoine mondial (paquet npm `@worldwideview/wwv-plugin-unesco-sites` 1.0.0, instantané du 2026-08-23) | lien `source` vers whc.unesco.org | données UNESCO |
| Natural Earth, *populated places* 10 m | QID Wikidata des villes | domaine public |
| Connaissances des curateurs (lot v10) | identité des lieux, description, saison, durée | — |

Pendant le lot v10, `query.wikidata.org`, `wikipedia.org` et `openstreetmap.org` n'étaient pas joignables depuis
l'environnement de travail (politique réseau). Les nouvelles fiches n'ont donc pas de QID, sauf les villes
reconnues par Natural Earth ; leurs coordonnées sont des **coordonnées de repérage** contrôlées par la distance à une
localité GeoNames, pas une position certifiée. Une passe Wikidata (rattachement des QID, comparaison des
coordonnées) reste à faire quand l'accès sera possible ; `review/v10/*.json` garde pour chaque fiche la localité de
référence et l'écart mesuré.
