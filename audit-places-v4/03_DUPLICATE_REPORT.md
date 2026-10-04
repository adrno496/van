# 03 — Contrôle anti-doublons

## Règles (scripts/places/lib.mjs, enrich.mjs, validate.mjs)

| Détection | Règle | Effet |
|---|---|---|
| Même identifiant `i` | toute la base | `validate.mjs` échoue (et `build/planner.mjs` refuse de construire) |
| Même QID | toute la base | rejet du candidat ; `validate.mjs` échoue |
| Même nom, toutes formes | noyau du nom identique — sans accents, sans articles (de, la, di, of, von…), sans mots génériques multilingues (château/castle/castello/castillo/burg/hrad/zamek…, lac/lago/see/jezero…, parc/national…, cascade/waterfall/slap…, grotte/cave/jaskinia…), pluriels compris — à moins de 30 km | rejet |
| Nom contenu dans l'autre | « Albufera de Valence » / « Valence » : seulement à moins de 5 km (au-delà ce sont deux lieux) | rejet |
| Autres noms (`alt`) | nom local, nom sans article… : seulement à moins de 5 km (« Passo Lanciano » ne doit pas faire du Blockhaus un doublon de Lanciano) | rejet |
| Proximité | point à moins de 250 m d'une fiche touristique existante | « à contrôler » : écarté sauf arbitrage (`_decisions.json` → `keep`) |
| Fiches pratiques | une ville qui n'existe au catalogue que comme « Olives — Jaén », « Logistique — Zurich » peut entrer comme ville | autorisé |
| Entre candidats | mêmes règles ; le mieux noté reste | rejet |
| Entre pays | même nom à moins de 20 km dans deux pays (contrôle de revue) | aucun cas |

Le nom n'est jamais le seul critère : deux lieux homonymes éloignés (Belmonte en Espagne et au Portugal, Mělník et
Melnik, Guarda au Portugal et en Suisse, deux « Grotte de l'Ours » en Pologne et en Roumanie, Nora en Sardaigne et en
Suède) sont des lieux distincts et restent.

## Résultats du lot v10

2 447 candidats → 1 800 retenus, 632 en réserve (cible du pays atteinte par de meilleurs candidats), **15 rejetés**.

| Pays | Candidat | Motif |
|---|---|---|
| Allemagne | Parc de Muskau | doublon de la fiche 850 « Parc de Muskau » (0,2 km) |
| Grèce | Lacs Prespa | doublon de la fiche 725 « Parc national de Prespa » (15 km) |
| Pologne | Parc national des Pieniny | doublon de la fiche 764 (3,7 km) |
| Monténégro | Serpentine de Kotor | même lieu que la fiche 703 « Parc national du Lovćen » (route du Lovćen, 2,8 km) |
| Slovénie | Idrija | à 234 m de la fiche 988 « Patrimoine du mercure » (même ville) — à contrôler, non retenu |
| Espagne | Covadonga | doublon d'un autre candidat : « Lacs de Covadonga » |
| France | Col du Galibier | proposé deux fois (zones Est et Sud) |
| Luxembourg | Lac de la Haute-Sûre | doublon d'un autre candidat : « Esch-sur-Sûre » |
| Roumanie | Monastère de Neamț | même nom qu'un autre candidat retenu (« Citadelle de Neamț ») à moins de 30 km |
| Suède | Gamla Uppsala | nom contenu dans « Uppsala » à moins de 5 km |
| Espagne | Dunes de Corrubedo | coordonnées incohérentes (voir `04_GEO_VALIDATION.md`) |
| Italie | Nuraghe Arrubiu | coordonnées incohérentes |
| Lituanie | Neuvième Fort | coordonnées incohérentes |
| Suède | Hemavan | aucune localité de contrôle à moins de 90 km |
| Suède | Kukkolaforsen | point à 2 km en Finlande |

Arbitrages manuels (`data-sources/candidates/v10/_decisions.json`, chacun motivé) :

| Candidat | Règle déclenchée | Décision |
|---|---|---|
| Côme (ville) | même noyau que « Lac de Côme » (fiche 139) à 27 km | gardé : la ville au bout du lac est une étape distincte du lac |
| Col du Stelvio | même noyau que « Parc national du Stelvio » à 8 km | gardé : col routier, expérience de route à part entière |
| Monastère de Cozia | même noyau que « Parc national Cozia » à 11 km | gardé : monument majeur, distinct du parc |

Les curateurs avaient en outre écarté d'eux-mêmes, avant le pipeline, les lieux couverts par une fiche existante
(par exemple Pravčická brána et la Suisse bohémienne, Tihany et le lac Balaton, Phaistos et les centres palatiaux
minoens, Pogradec et le lac d'Ohrid, Odeceixe et la Costa Vicentina) : leurs comptes rendus sont résumés dans
`09_FINAL_REPORT.md`.

## Paires de points à moins de 250 m dans le catalogue final

| Fiches | Distance | Nature |
|---|---|---|
| 328 Saint-Émilion / 457 Vendanges — Bordeaux | 0 m | antérieure au lot (fiche boulot) |
| 407 Luxembourg-ville / 504 Luxembourg — gazole | 0 m | antérieure au lot (fiche pratique) |
| 459 Vendanges — Val de Loire / 2453 Saumur | 185 m | ville nouvelle au même point qu'une fiche boulot : lieux de nature différente |
| 493 Olives — Jaén / 1721 Jaén | 90 m | idem |
| 495 Saison été — Baléares / 1671 Palma | 71 m | idem |

Nouvelles fiches à moins d'1 km d'une fiche touristique existante : 2, toutes deux des sites distincts — musée
archéologique de Tarente (MArTA) et château aragonais (859 m) ; château de Turaida et grotte de Gutmanis (877 m).

## Contrôles bloquants de `validate.mjs` sur le catalogue final

Identifiants uniques (3 400, dont 1 800 nouveaux entre 1 600 et 3 552 — non contigus : un identifiant attribué à un candidat, retenu ou non, est gardé dans `data-sources/ledger-v10.json` et jamais réattribué ; aucun identifiant d’origine réutilisé) ; QID
uniques (1 078 fiches avec QID, aucun doublon) ; aucune nouvelle fiche portant le même nom qu'une fiche touristique
dans les limites ci-dessus (hors arbitrages) ; aucune paire < 250 m de même nom. **PASS.**
