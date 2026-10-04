# 08 — SENTINEL : avant et après le cycle 2

Outil : `/Users/dreano/Downloads/SENTINEL`, version `7.0.0-verified-recursive-private`, commande `audit local`.
Les audits de départ et les audits finaux ont été lancés le même jour, à une heure d'écart, avec le même
SENTINEL : ils sont comparables.

Règles respectées : cible en lecture seule (vérifiée par SENTINEL lui-même : empreinte identique avant et après
chaque passage) ; sorties redirigées hors du projet et hors de la capsule de SENTINEL (`--output-dir`,
`SENTINEL_EVIDENCE_DIR`) ; aucun fournisseur distant, aucune IA distante, aucun scan actif ; aucun fichier de
SENTINEL modifié ; aucune clé lue, copiée, affichée ou déplacée. Les preuves copiées dans `evidence/sentinel/` ont
été contrôlées (analyse des artefacts par SENTINEL : PASS ; recherche de motifs de secrets : aucun).

## Ce que SENTINEL voit, et ce qu'il ne voit pas

| Cible | Fichiers analysés sémantiquement | Conséquence |
|---|---:|---|
| `index.html` (fichier unique) | **0** | SENTINEL n'analyse pas le JavaScript contenu dans une page. **Zéro constat ne prouve rien ici.** |
| Vue à fichiers séparés (`build.mjs --split`) | **2** (`app.js`, `places.js`) | le même code, visible par l'analyse : ce sont ces résultats qui comptent |

## Résultats

| | Avant (baseline V2) | Après (personnelle) | Après (publique) |
|---|---|---|---|
| **Fichier unique** — statut | COMPLETE | COMPLETE | COMPLETE |
| Phases exécutées | 8 sur 8 prévues | 8 sur 8 | 8 sur 8 |
| Secrets (gitleaks) | 0 | 0 | 0 |
| Vulnérabilités (grype) | 0 | 0 | 0 |
| Composants (SBOM syft) | 0 — aucune dépendance | 0 | 0 |
| Fichiers sémantiques | 0 | 0 | 0 |
| Contrôle de déploiement | BLOCKED (rien à analyser) | BLOCKED | BLOCKED |
| **Fichiers séparés** — statut | COMPLETE ¹ | COMPLETE ¹ | COMPLETE ¹ |
| Fichiers sémantiques | 2 | 2 | 2 |
| Graphe de code | 197 nœuds, 1 553 liens, 0 erreur d'analyse | 210 nœuds, 1 598 liens, 0 erreur | 210, 1 598, 0 |
| `SENSITIVE_DATA_PERSISTED` (HIGH) | 9 | **9** | 9 |
| `MOBILE_BROWSER_STORAGE_REVIEW` (MEDIUM) | 1 | **1** | 1 |
| Sorties réseau détectées | 0 | 0 | 0 |
| Services tiers détectés | 0 | 0 | 0 |
| Requêtes distantes faites par l'audit | 0 | 0 | 0 |
| Code de la cible exécuté | non | non | non |
| Contrôle de déploiement | FAIL | **FAIL** | FAIL |
| Cible en lecture seule | PASS | PASS | PASS |
| Secrets dans les artefacts d'audit | PASS (21 fichiers) | PASS | PASS |

¹ Premier essai interrompu par manque de mémoire de Node (« heap out of memory ») ; relancé avec
`NODE_OPTIONS=--max-old-space-size=8192`, l'audit va au bout. Constaté sur les trois audits à fichiers séparés.
Seule la mémoire accordée à Node a été relevée ; aucun mécanisme de SENTINEL n'a été désactivé.

Le statut d'ensemble reste donc **PARTIAL** : audits complets, aucun secret, aucune vulnérabilité, aucune sortie
réseau — et un contrôle de déploiement en échec sur le stockage local.

## Les 10 constats : identiques avant et après

| Constat | Où | Ce que c'est |
|---|---|---|
| `SENSITIVE_DATA_PERSISTED` × 4 | démarrage — `localStorage.setItem('atlasvan.v3.recovery', …)` | la copie de secours d'un état illisible, mise de côté au lieu d'être détruite |
| `SENSITIVE_DATA_PERSISTED` × 4 | restauration d'une sauvegarde — `localStorage.setItem('atlasvan.v3', …)` | le trajet, les notes et les fiches restaurés |
| `SENSITIVE_DATA_PERSISTED` × 1 | ouverture du carnet — `indexedDB.open` | le carnet et ses photos |
| `MOBILE_BROWSER_STORAGE_REVIEW` × 1 | ensemble | rappel : données d'utilisateur dans le stockage de l'appareil |

Ce sont les mêmes qu'à la fin du cycle 1 (les numéros de ligne ont bougé avec le code). L'analyse ne relève pas
l'enregistrement courant (`writeState`), qui écrit pourtant les mêmes données au même endroit : sa couverture est
partielle, ce qui est une raison de plus de ne pas lire « 10 constats » comme un décompte exhaustif. Ils sont **exacts** : les
données de voyage sont enregistrées en clair dans le navigateur. C'est le fonctionnement voulu d'une application
locale sans compte ni serveur. SENTINEL les classe en « candidats statiques », confiance « heuristique ».

**Ils n'ont pas été masqués.** Je n'ai pas retiré le stockage local, ni ajouté un chiffrement pour faire passer le
contrôle. Le chiffrement par phrase secrète reste une recommandation P3 (`10_PUBLIC_READINESS.md`).

Aucun constat nouveau n'est apparu avec le code du cycle 2 (lecture du catalogue en JSON, bouton « retour »,
démarrage par étapes) : même nombre, mêmes règles, mêmes sites d'écriture.

## semgrep (chaîne d'outils de SENTINEL, règles locales)

`evidence/semgrep/` — inventaire, pas preuve d'exploitabilité.

| Règle | Avant | Après |
|---|---:|---:|
| Écritures `innerHTML` | 24 | 24 |
| `insertAdjacentHTML` | 9 | 9 |
| Écritures dans le stockage | 12 | 12 |
| `JSON.parse` sur une donnée externe | 8 | 9 |
| **Total** | 53 | 54 |

Le seul ajout est `JSON.parse` dans `src/js/data.js` : il lit le catalogue livré dans la page, produit par la
construction, pas une donnée venue de l'extérieur. Aucune écriture HTML n'a été ajoutée — les marqueurs sont créés
par `createElementNS`, justement pour cela.

## Revue des insertions HTML (`audit-refonte/scripts/html-sinks.mjs`)

97 expressions HTML, 388 valeurs insérées : 183 passent par `esc()` (182 au cycle 1), 67 par un constructeur qui
échappe, 20 numériques, 35 choix entre chaînes fixes, 57 « à relire » (58 au cycle 1). **Aucune nouvelle valeur à
relire** ; une de moins : les contours de pays du blog exporté passent maintenant par `esc()`. Les 57 restantes sont
celles relues une à une au cycle 1 (compteurs, tables constantes, HTML déjà construit avec `esc`).

## Ce que SENTINEL ne couvre pas

Injection HTML côté navigateur (aucune règle), comportement à l'exécution (aucun conteneur disponible : phase
« runtime » `NOT_AVAILABLE`), JavaScript enfoui dans une page. Ces angles sont couverts par les tests d'attaque
exécutés dans le navigateur (`07_TEST_REPORT.md`) et par la revue des insertions HTML ci-dessus — pas par SENTINEL.

## Preuves

`evidence/sentinel/SUMMARY.json` (résumé des six passages) et, par passage : `AUDIT_RESULT.json`, `AUDIT_PLAN.json`,
`TARGET_READ_ONLY.json`, `ARTIFACT_SECRET_SCAN.json`, `gitleaks.json`, `static-triage.json`.
