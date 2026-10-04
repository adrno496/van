# 01 — Quotas et cibles par pays

Les quotas sont **calculés automatiquement** à partir du catalogue réel (`src/data/lieux/*.json` au commit 367042f),
enregistrés dans `data-sources/baseline-v10.json` (nombre par pays + empreinte de chaque fiche), puis contrôlés par
`scripts/places/validate.mjs` (règle `quota` : *après ≥ 2 × avant*, pays par pays — pas sur le total).

La **cible** (`data-sources/targets-v10.json`) ajoute une petite marge au minimum, pour qu'un lieu retiré plus tard
après vérification ne fasse pas retomber un pays sous son quota : environ +4 à +7 % pour les grands pays, davantage
pour les pays très sous-représentés (Andorre, Luxembourg, Estonie, Monténégro), où le minimum « 2 × » reste très bas
au regard de ce qu'il y a à voir. Les curateurs ont proposé environ 1,3 × le nombre de lieux à ajouter, pour que la
sélection puisse écarter les candidats faibles, douteux ou en double.

| Pays | Avant | Minimum (2 ×) | Cible | À ajouter | Marge sur le minimum |
|---|---:|---:|---:|---:|---:|
| Italie | 363 | 726 | 745 | +382 | 19 |
| France | 259 | 518 | 535 | +276 | 17 |
| Espagne | 123 | 246 | 258 | +135 | 12 |
| Portugal | 66 | 132 | 140 | +74 | 8 |
| Grèce | 65 | 130 | 138 | +73 | 8 |
| Allemagne | 59 | 118 | 126 | +67 | 8 |
| Norvège | 45 | 90 | 96 | +51 | 6 |
| Suède | 43 | 86 | 92 | +49 | 6 |
| Suisse | 41 | 82 | 88 | +47 | 6 |
| Royaume-Uni | 37 | 74 | 80 | +43 | 6 |
| Roumanie | 34 | 68 | 73 | +39 | 5 |
| Autriche | 31 | 62 | 67 | +36 | 5 |
| Albanie | 31 | 62 | 66 | +35 | 4 |
| Tchéquie | 31 | 62 | 67 | +36 | 5 |
| Pologne | 31 | 62 | 67 | +36 | 5 |
| Croatie | 29 | 58 | 63 | +34 | 5 |
| Belgique | 28 | 56 | 60 | +32 | 4 |
| Slovaquie | 27 | 54 | 58 | +31 | 4 |
| Serbie | 25 | 50 | 54 | +29 | 4 |
| Bulgarie | 25 | 50 | 54 | +29 | 4 |
| Danemark | 22 | 44 | 48 | +26 | 4 |
| Irlande | 22 | 44 | 48 | +26 | 4 |
| Bosnie | 21 | 42 | 46 | +25 | 4 |
| Slovénie | 20 | 40 | 44 | +24 | 4 |
| Pays-Bas | 19 | 38 | 42 | +23 | 4 |
| Hongrie | 19 | 38 | 42 | +23 | 4 |
| Mac. du Nord | 17 | 34 | 38 | +21 | 4 |
| Lettonie | 14 | 28 | 32 | +18 | 4 |
| Finlande | 14 | 28 | 32 | +18 | 4 |
| Lituanie | 13 | 26 | 30 | +17 | 4 |
| Monténégro | 10 | 20 | 25 | +15 | 5 |
| Estonie | 9 | 18 | 23 | +14 | 5 |
| Luxembourg | 6 | 12 | 16 | +10 | 4 |
| Andorre | 1 | 2 | 7 | +6 | 5 |
| **Total** | **1600** | **3200** | **3400** | **+1800** | 200 |

Le compte « avant » inclut les fiches pratiques existantes (bases, boulots saisonniers, logistique) ; les ajouts,
eux, sont tous touristiques (`ville`, `nature`, `patrimoine`, `plage`). Les cinq bases personnelles (France 3,
Italie 1, Portugal 1) restent comptées dans le quota de leur pays mais sont retirées de la
version publique, comme avant.
