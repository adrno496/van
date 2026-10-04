# 00 — Baseline V2

Cycle 2 : performance mobile, carte, appareil réel, version publique. Point de départ : la version livrée à la
fin du cycle 1 (`audit-refonte/12_FINAL_REPORT.md`, verdict READY pour un usage personnel et local).

## Ce qui a été lu avant de toucher au code

`audit-refonte/03_CREATIVE_ENGINE_AUDIT.md`, `09_PERFORMANCE_REPORT.md`, `10_ACCESSIBILITY_REPORT.md`,
`11_NON_REGRESSION.md`, `12_FINAL_REPORT.md`, ainsi que `08_SECURITY_REPORT.md` et `06_IMPLEMENTATION_LOG.md`.
Les points laissés ouverts par le cycle 1 et repris ici :

| Point ouvert au cycle 1 | Traité dans |
|---|---|
| Temps de blocage mobile en hausse (78 → 382 ms) | `01`, `02` |
| 9 600 nœuds dans la page, dont 6 400 pour les marqueurs | `02` |
| Catégories distinguées par la couleur seule | `04` |
| Pas de dépôt Git propre au projet | `05` |
| 5 lieux personnels dans le fichier | `10` |
| Appareil réel, GPS réel, lecteurs d'écran : non testés | `03` |

## Référence figée

| Élément | Valeur |
|---|---|
| Fichier | `audit-refonte-v2/baseline/index.v1-final.html` (lecture seule) |
| SHA-256 | `3922084812a7ca31ce20db2b418a5510939adb7dacbb83cb4785428bf75532e7` |
| Taille | 1 601 923 octets |
| Commit | `4da7788` — « baseline before V2 hardening » |
| Référence d'origine (avant cycle 1) | `audit-refonte/baseline/index.baseline.html`, SHA-256 `ace08e33…`, inchangée |

## Tests rejoués sur la baseline

```bash
node build.mjs --check      # OK
node tests/e2e.mjs          # 77 / 77
node tests/ui.mjs           # 59 / 59
node tests/migration.mjs    # 10 / 10
node tests/smoke.mjs        # 6 / 6 (Chromium, Firefox, WebKit × serveur, fichier local)
```

Preuves : `evidence/{e2e,ui,migration,smoke}-baseline-v2.json`. Aucun écart avec les résultats annoncés à la fin
du cycle 1.

## Mesures de départ

Machine : Apple M4, 10 cœurs, macOS 15.7. **La machine était chargée pendant toute la mission** (charge
moyenne de 4,7 à 7,6, due à d'autres travaux) : les valeurs absolues sont plus élevées qu'elles ne le seraient au
repos. Les comparaisons avant / après ont donc été faites **en alternance** (une mesure d'une version, une de
l'autre, et ainsi de suite), ce qui répartit la charge de façon égale. Voir `01`.

Profil détaillé (`tests/profile.mjs`, médiane de 5 démarrages, `evidence/profile-baseline-v2.txt`) :

| Phase | Ordinateur | Mobile (processeur ×4) |
|---|---:|---:|
| Premier affichage (FCP) | 116 ms | 156 ms |
| Lecture des données (script de 1,3 Mo) | 23 ms | 77 ms |
| Compilation JavaScript | 55 ms | 206 ms |
| Dessin des pays | 19 ms | 62 ms |
| Création des marqueurs | 14 ms | 53 ms |
| Branchement des commandes | 12 ms | 42 ms |
| Listes (parcours, fiches pays) | 8 ms | 30 ms |
| Première vue et mise en page | 16 ms | 61 ms |
| Filtre initial et noms | 16 ms | 45 ms |
| Trajet | 7 ms | 18 ms |
| Démarrage complet (carnet prêt) | 265 ms | 825 ms |
| Plus longue tâche | 102 ms | 348 ms |
| **Temps de blocage après le premier affichage** | 26 ms | **379 ms** |

| Interaction (temps de fil principal) | Ordinateur | Mobile ×4 |
|---|---:|---:|
| Première interaction | 30 ms | 98 ms |
| Zoom (4 pas) | 39 ms | 104 ms |
| Déplacement (30 images) | 256 ms | 557 ms |
| Filtres (4 bascules) | 93 ms | 217 ms |
| Recherche (5 frappes) | 39 ms | 103 ms |
| Ouverture d'une fiche | 32 ms | 141 ms |
| Chargement d'un parcours de 51 étapes | 77 ms | 269 ms |

Page : 9 603 éléments, dont 6 647 dans la carte (6 405 pour les 1 600 marqueurs : 4 éléments par lieu),
189 écouteurs d'événements, 6,7 Mo de mémoire JavaScript.

## Audits de départ (même jour, mêmes versions d'outils que les audits finaux)

| Outil | Résultat sur la baseline V2 | Preuve |
|---|---|---|
| Creative Engine 9.1.0 — `audit --mode balanced`, fichier unique | qualité 70, certification FAIL (règles SEO d'un site public), navigateur : 0 violation axe, 0 erreur console, 0 requête tierce, CSP PASS | `evidence/creative-engine/` |
| Creative Engine — fichiers séparés | qualité 77 | idem |
| Creative Engine — `lighthouse --runs 3`, mobile | performance 81, accessibilité 100, bonnes pratiques 100, SEO 91, **TBT 352 ms**, LCP 3,0 s, CLS 0 | idem |
| Creative Engine — Lighthouse, ordinateur | performance 100, accessibilité 100, TBT 10 ms, LCP 0,64 s | idem |
| SENTINEL 7.0.0 — `audit local`, fichier unique | COMPLETE ; gitleaks 0, grype 0 ; 0 fichier analysé sémantiquement (JavaScript enfoui dans la page) → aucune conclusion à en tirer | `evidence/sentinel/` |
| SENTINEL — fichiers séparés | COMPLETE ; 2 fichiers analysés ; 9 `SENSITIVE_DATA_PERSISTED` + 1 `MOBILE_BROWSER_STORAGE_REVIEW` ; 0 sortie réseau, 0 tiers | idem |
| semgrep (règles locales) | voir `08_SENTINEL_FINAL.md` | `evidence/semgrep/` |

L'audit SENTINEL des fichiers séparés a d'abord échoué par manque de mémoire de Node (catalogue de 1,3 Mo en
JavaScript) ; relancé avec `NODE_OPTIONS=--max-old-space-size=8192`, il est allé au bout. Aucun mécanisme de
SENTINEL n'a été contourné : seule la mémoire accordée à Node a été relevée.

## Retour en arrière

- `git revert <commit>` annule un lot précis ; `git checkout 4da7788 -- .` ramène tout le projet à la baseline V2.
- Sans Git : `audit-refonte-v2/baseline/index.v1-final.html` est le fichier livré au cycle 1, utilisable tel quel.
- Les formats de données n'ont pas changé pendant ce cycle : revenir en arrière ne fait rien perdre.
