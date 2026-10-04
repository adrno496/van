# 00 — Baseline avant toute modification

Date de la baseline : 2026-10-04. Statuts utilisés : `PASS`, `PARTIAL`, `FAIL`, `NON TESTÉ`, `NON APPLICABLE`.

## 1. Point de restauration

| Élément | Valeur |
|---|---|
| Fichier d'origine | `index.html`, 1 535 959 octets, daté du 2026-09-09 |
| Empreinte SHA-256 | `ace08e33c9e2db47fac72d84d4c554b52b2e0de784ab18aeb939285a790041ac` |
| Copie de référence | `audit-refonte/baseline/index.baseline.html` (lecture seule), empreinte identique dans `baseline/SHA256.txt` |
| Retour arrière | recopier ce fichier à la racine sous le nom `index.html` ; les formats de données n'ont pas changé (preuve : `tests/migration.mjs`, test « retour à l'ancienne version ») |

**Git : commit de baseline non réalisé, volontairement.** La racine du dépôt détecté est `/Users/dreano` (le dossier
personnel entier), sans aucun commit. La commande `git add -A` proposée au §40 du cahier des charges y aurait ajouté
`.ssh`, `.zsh_history`, `.claude.json`, etc. La sauvegarde a donc été faite par copie de fichier avec empreinte.

## 2. Baseline fonctionnelle

Commande : `node tests/e2e.mjs --dir <copie de la baseline> --out audit-refonte/evidence/e2e-baseline.json`
Résultat : **69 tests PASS sur 77, 8 FAIL** (Chromium 153, écran 1440 × 900 et mobile 390 × 844).

| Groupe de tests | PASS | FAIL | Ce qui échoue sur la baseline |
|---|---:|---:|---|
| P1 Explorer — chargement, recherche, zoom, déplacement, sélection, fiche, filtres, liste, favoris, notes, noms, lieu personnel, modification, ajout rapide | 16 | 0 | — |
| P2 Trajet — ajout, réorganisation, calculs, options, annuler/rétablir, optimiser, exports, imports, parcours prêts et enregistrés, Google Maps, ajout groupé, proximité | 15 | 0 | — |
| P3 Carnet — état vide, création, photo, brouillon, publication locale, recherche, IndexedDB, export du blog, fil du voyage, suppression/annulation, personnalisation, refus de photo | 12 | 0 | — |
| P4 Sauvegarde — sauvegarde complète et restauration, sauvegarde v3, refus d'un fichier invalide, réinitialisation | 5 | 2 | **Stockage corrompu** : l'application ne démarre plus (`(ST.custom \|\| []).forEach is not a function`). **Quota atteint** : aucun message, la modification est perdue en silence. |
| P5 Géolocalisation — autorisée, refusée, indisponible, délai dépassé, arrêt, navigateur sans GPS, lieux proches | 7 | 0 | — |
| P6 Mobile 390 × 844 — navigation, toucher, pincement, filtres, paramètres, carnet, débordement | 9 | 0 | — |
| Accessibilité au clavier — dialogues, onglets, focus, champs nommés | 4 | 1 | **12 champs sans nom accessible** (`paysSel`, `nTxt`, `nBud`, `nDate`, les 8 réglages du budget). |
| Sécurité — fichiers piégés, saisie piégée, requêtes tierces, politique de sécurité | 1 | 5 | **Import de parcours piégé** : 2 scripts exécutés. **Sauvegarde piégée** : 7. **Saisie piégée dans une fiche** : 3. **Requête tierce** : `fonts.googleapis.com`. **Politique de sécurité du contenu** : absente. |
| **Total** | **69** | **8** | |

Chaque groupe comprend un test « console sans erreur pendant tout le groupe ».

Les 8 échecs sont des défauts réels de la baseline, reproduits par un test. Ils servent de cibles à la refonte.

## 3. Baseline visuelle

Commande : `node tests/screenshots.mjs audit-refonte/screenshots/baseline --dir <copie de la baseline>`
80 captures : 10 écrans × 8 largeurs (1440 × 900, 1280 × 800, 1024 × 768, 768 × 1024, 430 × 932, 390 × 844,
360 × 800, 320 × 568). Aucune erreur de console. Dossier : `audit-refonte/screenshots/baseline/`.

Écrans : carte, fiche d'un lieu, idées de parcours, trajet, carte avec trajet, carnet vide, éditeur du carnet,
paramètres, filtres, recherche.

## 4. Baseline de mise en page (mesurée)

Commande : `node tests/ui.mjs --dir <copie de la baseline> --out audit-refonte/evidence/ui-baseline.json`
(19 contrôles PASS sur 42 ; les 23 échecs sont des commandes trop petites, des champs sous 16 px et le champ de recherche écrasé)

| Largeur | Hauteur d'en-tête | Part de l'écran occupée par la carte | Commandes visibles (écran carte) | Commandes < 44 px (tous écrans) |
|---|---:|---:|---:|---:|
| 320 × 568 | 119 px | 67 % | 14 | 3 |
| 390 × 844 | 119 px | 78 % | 14 | 7 |
| 768 × 1024 | 79 px | 44 % | 28 | 9 |
| 1024 × 768 | 69 px | 56 % | 25 | 7 |
| 1440 × 900 | 77 px | 62 % | 27 | 8 |

Autres constats mesurés : 12 à 14 tailles de texte différentes selon l'écran ; champ de recherche réduit à
**26 px de large** à 768 px ; champs `#routeQuery` et `#insertAt` de 22 à 24 px de haut ; 2 champs en dessous de
16 px (zoom automatique sur iOS).

## 5. Baseline de performance (laboratoire, cette machine)

Lighthouse 13.5 via CREATIVE_ENGINE_V9 (`node cli.mjs lighthouse <dossier> --runs 3`), médiane de 3 passages.
Deux mesures de la baseline, à 1 h 40 d'intervalle : elle varie beaucoup, car son affichage attend Google Fonts.

| Profil | Performance | Accessibilité | Bonnes pratiques | SEO | LCP | CLS |
|---|---:|---:|---:|---:|---:|---:|
| Mobile, 1re mesure | 58 | 98 | 100 | 100 | 5,7 s | 0,162 |
| Mobile, 2e mesure | 74 | 98 | 100 | 100 | 3,6 s | 0 |
| Ordinateur, 1re mesure | 79 | 92 | 100 | 100 | 1,43 s | 0,237 |
| Ordinateur, 2e mesure | 81 | 92 | 100 | 100 | 1,29 s | 0,237 |

Mesures internes (`node tests/perf.mjs`, médiane de 5 démarrages ; machine partagée, charge 18 pendant la mesure) :

| Mesure | Ordinateur | Mobile (processeur ×4) |
|---|---:|---:|
| Page interactive | 361 ms | 1 581 ms |
| Tâches longues au démarrage | 261 ms | 1 243 ms |
| Décalage de mise en page (CLS) | 0,20 | 0 |
| `rescale()` | 10,7 ms | 37,5 ms |
| `applyFilters()` | 27,1 ms | 157,9 ms |
| Afficher une fiche | 2,9 ms | 16,4 ms |
| Redessiner un trajet de 51 étapes | 18,2 ms | 57,2 ms |

Ce sont des mesures de laboratoire sur une machine partagée : elles valent pour comparer avant et après,
pas comme valeurs absolues. Données de terrain : `NON TESTÉ`.

## 6. Baseline SENTINEL et Creative Engine

Voir `02_SENTINEL_AUDIT.md` et `03_CREATIVE_ENGINE_AUDIT.md`.
