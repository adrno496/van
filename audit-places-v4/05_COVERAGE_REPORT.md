# 05 — Couverture par pays, avant / après

Produit par `node scripts/places/report.mjs --batch v10` (code de sortie 0 seulement si chaque pays atteint 2 × son
nombre initial) et `node scripts/places/validate.mjs` (règle `quota`).

**Résultat : les 34 pays atteignent au moins le double de leur nombre initial — PASS pour chacun.** Total
1 600 → 3 400 lieux (+1 800), version publique 1 595 → 3 395.

Deux mesures simples de couverture territoriale, calculées hors ligne :

- **Régions** : régions administratives GeoNames (admin1) qui ont au moins un lieu, sur le total du pays (pour la
  Slovénie, la Macédoine du Nord et la Lettonie, l'admin1 GeoNames correspond aux communes : le total est donc très
  élevé et la mesure peu parlante).
- **Mailles** : cellules de 0,5° × 0,5° (environ 40 × 55 km) contenant au moins un lieu, sur les cellules du pays qui
  ont une localité de plus de 1 000 habitants (le territoire habité, vallées de montagne comprises).

| Pays | Avant | Après | Minimum | Ratio | Statut | Régions avant → après | Mailles avant → après |
|---|---:|---:|---:|---:|:---:|---|---|
| Italie | 363 | 745 | 726 | ×2.05 | PASS | 19 → 20 / 20 | 144 → 188 / 212 (68 % → 89 %) |
| France | 259 | 535 | 518 | ×2.07 | PASS | 13 → 13 / 13 | 157 → 246 / 311 (50 % → 79 %) |
| Espagne | 123 | 258 | 246 | ×2.1 | PASS | 16 → 16 / 19 | 86 → 155 / 278 (31 % → 56 %) |
| Portugal | 66 | 140 | 132 | ×2.12 | PASS | 17 → 18 / 20 | 30 → 47 / 63 (48 % → 75 %) |
| Grèce | 65 | 138 | 130 | ×2.12 | PASS | 13 → 14 / 14 | 48 → 78 / 126 (38 % → 62 %) |
| Allemagne | 59 | 126 | 118 | ×2.14 | PASS | 15 → 16 / 16 | 47 → 93 / 224 (21 % → 42 %) |
| Norvège | 45 | 96 | 90 | ×2.13 | PASS | 10 → 12 / 15 | 26 → 54 / 209 (12 % → 26 %) |
| Suède | 43 | 92 | 86 | ×2.14 | PASS | 17 → 21 / 21 | 21 → 50 / 186 (11 % → 27 %) |
| Suisse | 41 | 88 | 82 | ×2.15 | PASS | 14 → 23 / 26 | 21 → 27 / 32 (66 % → 84 %) |
| Royaume-Uni | 37 | 80 | 74 | ×2.16 | PASS | 3 → 4 / 4 | 30 → 58 / 180 (17 % → 32 %) |
| Roumanie | 34 | 73 | 68 | ×2.15 | PASS | 18 → 29 / 42 | 27 → 51 / 138 (20 % → 37 %) |
| Autriche | 31 | 67 | 62 | ×2.16 | PASS | 7 → 9 / 9 | 20 → 37 / 61 (33 % → 61 %) |
| Albanie | 31 | 66 | 62 | ×2.13 | PASS | 12 → 12 / 12 | 13 → 19 / 22 (59 % → 86 %) |
| Tchéquie | 31 | 67 | 62 | ×2.16 | PASS | 14 → 14 / 14 | 21 → 40 / 54 (39 % → 74 %) |
| Pologne | 31 | 67 | 62 | ×2.16 | PASS | 14 → 16 / 16 | 26 → 54 / 194 (13 % → 28 %) |
| Croatie | 29 | 63 | 58 | ×2.17 | PASS | 11 → 16 / 21 | 19 → 32 / 49 (39 % → 65 %) |
| Belgique | 28 | 60 | 56 | ×2.14 | PASS | 3 → 3 / 3 | 17 → 20 / 25 (68 % → 80 %) |
| Slovaquie | 27 | 58 | 54 | ×2.15 | PASS | 5 → 8 / 8 | 12 → 22 / 35 (34 % → 63 %) |
| Serbie | 25 | 54 | 50 | ×2.16 | PASS | 2 → 2 / 2 | 16 → 32 / 46 (35 % → 70 %) |
| Bulgarie | 25 | 54 | 50 | ×2.16 | PASS | 20 → 25 / 28 | 21 → 30 / 62 (34 % → 48 %) |
| Danemark | 22 | 48 | 44 | ×2.18 | PASS | 5 → 5 / 5 | 19 → 31 / 52 (37 % → 60 %) |
| Irlande | 22 | 48 | 44 | ×2.18 | PASS | 4 → 4 / 4 | 13 → 28 / 53 (25 % → 53 %) |
| Bosnie | 21 | 46 | 42 | ×2.19 | PASS | 2 → 2 / 3 | 16 → 23 / 34 (47 % → 68 %) |
| Slovénie | 20 | 44 | 40 | ×2.2 | PASS | 17 → 32 / 212 | 10 → 14 / 16 (63 % → 88 %) |
| Pays-Bas | 19 | 42 | 38 | ×2.21 | PASS | 9 → 12 / 12 | 13 → 23 / 36 (36 % → 64 %) |
| Hongrie | 19 | 42 | 38 | ×2.21 | PASS | 10 → 18 / 20 | 14 → 28 / 57 (25 % → 49 %) |
| Mac. du Nord | 17 | 38 | 34 | ×2.24 | PASS | 11 → 23 / 71 | 8 → 14 / 16 (50 % → 88 %) |
| Lettonie | 14 | 32 | 28 | ×2.29 | PASS | 13 → 29 / 43 | 11 → 22 / 50 (22 % → 44 %) |
| Finlande | 14 | 32 | 28 | ×2.29 | PASS | 10 → 15 / 18 | 9 → 20 / 177 (5 % → 11 %) |
| Lituanie | 13 | 30 | 26 | ×2.31 | PASS | 7 → 9 / 10 | 9 → 19 / 44 (20 % → 43 %) |
| Monténégro | 10 | 25 | 20 | ×2.5 | PASS | 9 → 17 / 25 | 7 → 8 / 10 (70 % → 80 %) |
| Estonie | 9 | 23 | 18 | ×2.56 | PASS | 5 → 13 / 15 | 8 → 19 / 36 (22 % → 53 %) |
| Luxembourg | 6 | 16 | 12 | ×2.67 | PASS | 4 → 10 / 12 | 2 → 4 / 7 (29 % → 57 %) |
| Andorre | 1 | 7 | 2 | ×7 | PASS | 1 → 6 / 7 | 1 → 3 / 4 (25 % → 75 %) |
| **Total** | **1600** | **3400** | **3200** | ×2.13 | PASS | 350 → 486 | 942 → 1589 / 3099 (30 % → 51 %) |

| Pays | Catégories avant | Catégories après |
|---|---|---|
| Italie | ville 231, nature 46, patrimoine 65, plage 7, pratique 7, boulot 6, base 1 | ville 293, nature 133, patrimoine 256, plage 49, pratique 7, boulot 6, base 1 |
| France | ville 89, nature 48, patrimoine 88, plage 8, pratique 6, boulot 17, base 3 | ville 156, nature 115, patrimoine 215, plage 23, pratique 6, boulot 17, base 3 |
| Espagne | ville 14, nature 36, patrimoine 59, plage 5, pratique 2, boulot 7 | ville 39, nature 71, patrimoine 126, plage 13, pratique 2, boulot 7 |
| Portugal | ville 6, nature 15, patrimoine 34, plage 5, boulot 5, base 1 | ville 20, nature 24, patrimoine 71, plage 19, boulot 5, base 1 |
| Grèce | ville 6, nature 29, patrimoine 21, plage 7, boulot 2 | ville 16, nature 42, patrimoine 54, plage 24, boulot 2 |
| Allemagne | ville 9, nature 17, patrimoine 30, boulot 3 | ville 17, nature 34, patrimoine 64, plage 8, boulot 3 |
| Norvège | ville 4, nature 32, patrimoine 9 | ville 14, nature 54, patrimoine 25, plage 3 |
| Suède | ville 1, nature 27, patrimoine 15 | ville 19, nature 38, patrimoine 33, plage 2 |
| Suisse | ville 4, nature 18, patrimoine 10, pratique 3, boulot 6 | ville 14, nature 39, patrimoine 26, pratique 3, boulot 6 |
| Royaume-Uni | ville 5, nature 14, patrimoine 16, plage 1, pratique 1 | ville 12, nature 30, patrimoine 34, plage 3, pratique 1 |
| Roumanie | ville 3, nature 18, patrimoine 13 | ville 15, nature 27, patrimoine 30, plage 1 |
| Autriche | ville 4, nature 18, patrimoine 7, pratique 1, boulot 1 | ville 11, nature 29, patrimoine 25, pratique 1, boulot 1 |
| Albanie | ville 2, nature 19, patrimoine 9, plage 1 | ville 10, nature 26, patrimoine 23, plage 7 |
| Tchéquie | ville 4, nature 12, patrimoine 15 | ville 13, nature 20, patrimoine 34 |
| Pologne | ville 5, nature 11, patrimoine 15 | ville 10, nature 20, patrimoine 33, plage 4 |
| Croatie | ville 5, nature 14, patrimoine 8, plage 1, boulot 1 | ville 12, nature 21, patrimoine 23, plage 6, boulot 1 |
| Belgique | ville 3, nature 7, patrimoine 18 | ville 11, nature 15, patrimoine 33, plage 1 |
| Slovaquie | ville 1, nature 17, patrimoine 9 | ville 12, nature 23, patrimoine 23 |
| Serbie | ville 2, nature 13, patrimoine 10 | ville 9, nature 22, patrimoine 23 |
| Bulgarie | ville 2, nature 11, patrimoine 12 | ville 5, nature 21, patrimoine 27, plage 1 |
| Danemark | ville 1, nature 8, patrimoine 12, pratique 1 | ville 5, nature 13, patrimoine 25, plage 4, pratique 1 |
| Irlande | ville 1, nature 16, patrimoine 5 | ville 9, nature 24, patrimoine 13, plage 2 |
| Bosnie | ville 1, nature 12, patrimoine 8 | ville 8, nature 19, patrimoine 18, plage 1 |
| Slovénie | ville 2, nature 13, patrimoine 5 | ville 6, nature 24, patrimoine 14 |
| Pays-Bas | ville 5, nature 2, patrimoine 10, boulot 2 | ville 11, nature 7, patrimoine 22, boulot 2 |
| Hongrie | ville 3, nature 8, patrimoine 8 | ville 14, nature 12, patrimoine 16 |
| Mac. du Nord | ville 1, nature 13, patrimoine 3 | ville 6, nature 17, patrimoine 14, plage 1 |
| Lettonie | ville 1, nature 8, patrimoine 5 | ville 5, nature 11, patrimoine 14, plage 2 |
| Finlande | nature 5, patrimoine 9 | ville 4, nature 13, patrimoine 14, plage 1 |
| Lituanie | ville 1, nature 5, patrimoine 7 | ville 6, nature 7, patrimoine 16, plage 1 |
| Monténégro | nature 6, patrimoine 3, plage 1 | ville 2, nature 10, patrimoine 10, plage 3 |
| Estonie | ville 1, nature 4, patrimoine 4 | ville 4, nature 11, patrimoine 7, plage 1 |
| Luxembourg | ville 1, patrimoine 4, pratique 1 | ville 3, nature 1, patrimoine 11, pratique 1 |
| Andorre | pratique 1 | ville 1, nature 3, patrimoine 2, pratique 1 |
| **Total** | ville 418, nature 522, patrimoine 546, plage 36, pratique 23, boulot 50, base 5 | ville 792, nature 976, patrimoine 1374, plage 180, pratique 23, boulot 50, base 5 |

## Répartition des 1 800 ajouts

Toutes les nouvelles fiches sont touristiques (aucune `base`, `boulot` ni `pratique` ajoutée). « Incontournable »
(`w: 1`) est limité à ~6 % des ajouts de chaque pays, les mieux notés.

| Pays | Ajouts | nature | patrimoine | ville | côte (plage) | incontournables | avec lien source |
|---|---:|---:|---:|---:|---:|---:|---:|
| Italie | 382 | 87 | 191 | 62 | 42 | 13 | 175 |
| France | 276 | 67 | 127 | 67 | 15 | 9 | 106 |
| Espagne | 135 | 35 | 67 | 25 | 8 | 8 | 64 |
| Portugal | 74 | 9 | 37 | 14 | 14 | 2 | 32 |
| Grèce | 73 | 13 | 33 | 10 | 17 | 0 | 21 |
| Allemagne | 67 | 17 | 34 | 8 | 8 | 2 | 32 |
| Norvège | 51 | 22 | 16 | 10 | 3 | 3 | 15 |
| Suède | 49 | 11 | 18 | 18 | 2 | 2 | 23 |
| Suisse | 47 | 21 | 16 | 10 | 0 | 3 | 12 |
| Royaume-Uni | 43 | 16 | 18 | 7 | 2 | 1 | 8 |
| Roumanie | 39 | 9 | 17 | 12 | 1 | 2 | 16 |
| Autriche | 36 | 11 | 18 | 7 | 0 | 2 | 9 |
| Tchéquie | 36 | 8 | 19 | 9 | 0 | 2 | 14 |
| Pologne | 36 | 9 | 18 | 5 | 4 | 2 | 10 |
| Albanie | 35 | 7 | 14 | 8 | 6 | 1 | 11 |
| Croatie | 34 | 7 | 15 | 7 | 5 | 1 | 18 |
| Belgique | 32 | 8 | 15 | 8 | 1 | 2 | 15 |
| Slovaquie | 31 | 6 | 14 | 11 | 0 | 2 | 12 |
| Serbie | 29 | 9 | 13 | 7 | 0 | 0 | 8 |
| Bulgarie | 29 | 10 | 15 | 3 | 1 | 1 | 6 |
| Danemark | 26 | 5 | 13 | 4 | 4 | 2 | 8 |
| Irlande | 26 | 8 | 8 | 8 | 2 | 0 | 7 |
| Bosnie | 25 | 7 | 10 | 7 | 1 | 0 | 7 |
| Slovénie | 24 | 11 | 9 | 4 | 0 | 1 | 7 |
| Pays-Bas | 23 | 5 | 12 | 6 | 0 | 1 | 12 |
| Hongrie | 23 | 4 | 8 | 11 | 0 | 1 | 13 |
| Mac. du Nord | 21 | 4 | 11 | 5 | 1 | 1 | 7 |
| Lettonie | 18 | 3 | 9 | 4 | 2 | 1 | 7 |
| Finlande | 18 | 8 | 5 | 4 | 1 | 1 | 8 |
| Lituanie | 17 | 2 | 9 | 5 | 1 | 0 | 7 |
| Monténégro | 15 | 4 | 7 | 2 | 2 | 1 | 7 |
| Estonie | 14 | 7 | 3 | 3 | 1 | 1 | 3 |
| Luxembourg | 10 | 1 | 7 | 2 | 0 | 0 | 5 |
| Andorre | 6 | 3 | 2 | 1 | 0 | 0 | 3 |
| **Total** | **1800** | 454 | 828 | 374 | 144 | 68 | 708 |

## Lecture

- **Équilibre territorial** : la part du territoire habité couverte passe de 30 % à 51 %. Les régions vides de la
  baseline sont désormais couvertes, sauf exceptions assumées : Brčko (Bosnie), Lubusz (Pologne), Rapla et Järva
  (Estonie), Canaries, Ceuta, Melilla, Açores et Madère (hors d'un road-trip en van, exclues volontairement).
- **Italie** : le catalogue d'origine comptait 231 villes sur 363 lieux ; les 382 ajouts sont surtout patrimoine,
  nature et côte, et couvrent le Molise (vide), la Basilicate, la Calabre, la Sardaigne intérieure, les Apennins.
- **France** : 276 ajouts répartis entre le nord-ouest (Loire, Bretagne, Normandie, Hauts-de-France), l'est (Vosges,
  Jura, Alpes, Auvergne) et le sud (Pyrénées, Causses, Provence, Corse — 3 lieux seulement avant).
- **Espagne** : 135 ajouts, nature et patrimoine en majorité, Castille-La Manche, Estrémadure, Aragon et Galice
  renforcées.
- **Pays nordiques et baltes** : couverture multipliée par 2 à 2,5 en mailles (Finnmark, Troms, Laponie suédoise,
  Kurzeme, Latgale, Saaremaa).
- **Micro-pays** : Andorre 1 → 7 (6 paroisses sur 7 ; la seule fiche d’origine était une fiche pratique), Luxembourg 6 → 16
  (10 cantons sur 12), Monténégro 10 → 25.
