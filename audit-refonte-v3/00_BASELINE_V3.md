# 00 — Baseline V3

Cycle 3 : un site éditorial devant le Planner. Point de départ : la version finale du cycle 2
(`audit-refonte-v2/12_FINAL_REPORT.md`, READY_LOCAL = YES, READY_PUBLIC = NO).

## Ce qui a été vérifié avant de toucher au code

| Vérification | Résultat |
|---|---|
| Version considérée comme finale | commit `ee7a1c7` (fin du cycle 2) |
| `build.mjs`, `src/`, `tests/` | présents ; `node build.mjs --check` : OK |
| Rapports de non-régression des cycles 1 et 2 | lus (`audit-refonte/11`, `audit-refonte-v2/11`) |
| Dépôt Git | `git rev-parse --show-toplevel` → `/Users/dreano/Downloads/van-main` |

## Référence figée

| Fichier | SHA-256 |
|---|---|
| `baseline/index.v2-final.html` (Planner personnel) | `a37fcf8b31f6aad9e954f6eee1bc062b4b1b74585849a9f4150d4ee1ec5a182d` |
| `baseline/index.v2-final.public.html` (Planner public) | `5c8f55da00ef5165242850ce67bbe93cc6f0f1ff69806d9bb92f0a6097904187` |

Copies en lecture seule ; empreintes dans `baseline/SHA256.txt`. Commit de référence : `dd9ece5`.
Retour immédiat : `git checkout dd9ece5 -- .`, ou rouvrir l'un des deux fichiers ci-dessus.

## Tests de départ

| Suite | Résultat | Preuve |
|---|---|---|
| `tests/e2e.mjs` | 77 / 77 | `evidence/e2e-baseline-v3.json` |
| `tests/ui.mjs` | 59 / 59 | `evidence/ui-baseline-v3.json` |
| `tests/migration.mjs` | 10 / 10 | `evidence/migration-baseline-v3.json` |
| `tests/smoke.mjs` | 6 / 6 | `evidence/smoke-baseline-v3.json` |
| `tests/v2.mjs` | 36 / 36 | `evidence/v2-baseline-v3.json` |

## Audits de départ

La baseline V3 **est** la version finale du cycle 2 : même code, même fichier. Ses audits ont été faits une heure avant
le début de ce cycle, avec les mêmes versions d'outils (Creative Engine 9.1.0, SENTINEL 7.0.0). Ils ne sont pas
rejoués ; ils sont repris tels quels :

| Outil | Résultat sur la baseline V3 | Preuve |
|---|---|---|
| Creative Engine — audit | qualité 70 (fichier unique), 77 (fichiers séparés) ; axe 0 violation ; CSP PASS | `audit-refonte-v2/evidence/creative-engine/` |
| Creative Engine — Lighthouse | mobile 92 / 100 / 100 / 91, TBT 62 ms ; ordinateur 100 / 100 / 100 / 91 | idem |
| SENTINEL | 0 secret, 0 vulnérabilité, 0 sortie réseau ; 9 HIGH + 1 MEDIUM de stockage local | `audit-refonte-v2/evidence/sentinel/` |
| semgrep | 54 points d'inventaire | `audit-refonte-v2/evidence/semgrep/` |

La version des deux outils est relevée de nouveau à la fin du cycle (`14`, `15`).

## Contenu réellement disponible au départ

| Contenu | Existe ? | Source |
|---|---|---|
| 1 600 lieux (1 595 publics) dans 34 pays, avec résumé, saison, durée, tarifs | oui | `src/data/places.js` |
| 25 itinéraires | oui | idem |
| Règles et coûts de 33 pays | oui — notes non sourcées, non datées | idem |
| Liste « avant de partir », formules de calcul | oui | code du Planner |
| Voyages réalisés, récits, photographies | **non** | — |
| Présentation des voyageurs, du van | **non** | — |
| Mentions de l'éditeur, adresse du site, réseaux | **non** | — |

Ce tableau fixe la règle du cycle : le site se construit avec ce qui existe, et laisse des emplacements signalés
pour le reste (`CONTENT_NEEDED.md`).
