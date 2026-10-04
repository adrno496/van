# 02 — Audit SENTINEL (avant et après)

Outil : `/Users/dreano/Downloads/SENTINEL` (AXDIA_OS `7.0.0-verified-recursive-private`, moteur d'audit SENTINEL V8.2).
Tout ce qui figure ici a été réellement exécuté ; ce qui ne l'a pas été est marqué `NON TESTÉ` ou `NON APPLICABLE`
avec la raison.

## Précautions prises

- **Aucun fichier de SENTINEL n'a été modifié.** Les preuves ont été redirigées hors de son arbre
  (`SENTINEL_EVIDENCE_DIR=<dossier temporaire>`, `--output-dir <dossier temporaire>`).
- **Aucune clé n'a été lue, copiée ni affichée.** `sentinel doctor` n'affiche que des décomptes de
  fournisseurs, jamais une clé. Le registre d'usage des API de chaque audit est vide (`API_USAGE_LEDGER.jsonl` : 0 ligne) :
  **0 requête vers un fournisseur**.
- **Autre activité sur la machine.** Pendant la mission, un autre travail écrivait dans SENTINEL
  (`.recursive/internal-ops/`, registre d'usage global). Ces écritures ne viennent pas de cette mission, dont les
  sorties sont toutes dans le dossier temporaire indiqué par `--output-dir`.
- **La cible n'a jamais été écrite** : SENTINEL travaille sur un instantané et vérifie l'empreinte avant/après
  (`TARGET_READ_ONLY.json` : `PASS` sur les 4 audits).

## Capacités utilisées

| # | Capacité | Commande exécutée | Module | Cible | Résultat | Preuve | Statut |
|---|---|---|---|---|---|---|---|
| 1 | Diagnostic | `node sentinel/cli/sentinel.mjs doctor` | `cli/audit.mjs` (systemCommands) | SENTINEL lui-même | node, frontière d'espace de travail, coffre (mode 600), moteur d'audit : tous PASS | sortie console | PASS |
| 2 | Inventaire des outils | `… sentinel.mjs tools doctor` | `assurance/tool-qualification.mjs` | — | 13 outils installés (gitleaks 8.30.1, syft 1.52.0, grype 0.119.0, semgrep 1.179.0, trivy, nuclei, osv-scanner, zap, cosign, scorecard, playwright, axe-core, lighthouse) | `evidence/sentinel/tools-doctor.json` | PASS ¹ |
| 3 | Plan d'audit local | `… sentinel.mjs audit plan local <cible>` | `assurance/audit-session.mjs` | baseline | 10 phases prévues, « aucune écriture dans la cible, aucune écriture distante » | `evidence/sentinel/*/AUDIT_PLAN.json` | PASS |
| 4 | Plan d'audit web | `… sentinel.mjs audit plan web http://127.0.0.1:8765/` | idem | — | fournisseurs retenus : PageSpeed, CrUX, Wayback | sortie console | plan seulement ² |
| 5 | **Audit local** (×4) | `… sentinel.mjs audit local <cible> --output-dir <dossier>` | `cli/audit.mjs` | voir tableau suivant | 7 phases sur 8 exécutées, 1 sans objet | `evidence/sentinel/<audit>/AUDIT_RESULT.json` | PARTIAL ³ |
| 5a | — instantané et lecture seule | (phase) | `assurance/snapshot.mjs` | — | empreinte identique avant/après | `TARGET_READ_ONLY.json` | PASS |
| 5b | — secrets | `gitleaks detect --no-git --redact` | gitleaks | — | 0 secret | `gitleaks.json` | PASS |
| 5c | — nomenclature (SBOM) | `syft dir:<cible>` | syft | — | 0 composant (aucune dépendance) | `sbom.cdx.json` | PASS |
| 5d | — vulnérabilités connues | `grype dir:<cible>` | grype | — | 0 correspondance | `grype.summary.json` | PASS |
| 5e | — flux de données et stockage | `axdia_vibe_security.py --no-host --complete qualify` | moteur vibe-security | — | voir tableau suivant | `vibe-security.summary.json` | voir ci-dessous |
| 5f | — graphe de code | `… sentinel.mjs graph build --root <cible>` | `assurance/code-graph.mjs` (TypeScript 5.9.3) | — | voir tableau suivant | `code-graph.summary.json` | PASS |
| 5g | — veille dépendances (OSV, EPSS, KEV) | — | `intel/engine.mjs` | — | aucun lockfile | — | NON APPLICABLE |
| 5h | — analyse RECURSIVE | `docker run --rm --network none … recursive.py full-scan` | RECURSIVE (conteneur sans réseau) | — | exécutée ; statut repris du gate vibe | `AUDIT_RESULT.json` | PARTIAL |
| 5i | — secrets dans les artefacts d'audit | (phase) | `lib/secrets.mjs` | dossier d'audit | 18 fichiers, 0 secret | `ARTIFACT_SECRET_SCAN.json` | PASS |
| 6 | Analyse de motifs | `semgrep scan --config atlas-rules.yml --metrics=off --disable-version-check` | semgrep 1.179.0 de la chaîne d'outils SENTINEL, **règles locales écrites pour cette mission** | scripts avant / après | voir tableau | `evidence/semgrep/` | PASS |

¹ Les outils apparaissent « installés, non qualifiés » parce que les preuves de qualification restent dans la capsule
de SENTINEL, que je n'ai pas lue pour ne pas la modifier.
² **Audit web non lancé — `NON TESTÉ`.** La cible est un fichier local servi en boucle locale : les fournisseurs
retenus par la politique (PageSpeed, CrUX, Wayback) ne peuvent pas atteindre `127.0.0.1`. L'audit n'aurait produit
que des appels inutiles à des tiers.
³ `PARTIAL` est le statut renvoyé par SENTINEL lui-même : la phase « intel » est sans objet.

Non utilisées : scans actifs ZAP et nuclei (`NON APPLICABLE` : pas de service en production), configurateur d'API
(aucune API nécessaire), IA distante (non sollicitée).

## Limite importante de l'audit sur fichier unique

Sur `index.html` seul, SENTINEL indique lui-même `semantic_files_analyzed: 0` et un graphe de code vide : ses
analyseurs lisent les fichiers `.js`, pas le JavaScript enfoui dans une page. **« 0 constat » sur le fichier unique
n'est donc pas un certificat.** Pour obtenir une vraie analyse, j'ai audité une seconde vue où les scripts sont
dans des fichiers séparés (extraction octet pour octet pour la baseline ; `node build.mjs --split` pour la refonte).

## Résultats

| Audit | Statut | Secrets | Vulnérabilités | Fichiers analysés (flux) | Constats flux de données | Gate vibe | Graphe de code |
|---|---|---:|---:|---:|---|---|---|
| Avant — fichier unique | PARTIAL | 0 | 0 | 0 | aucun (non analysé) | BLOCKED | vide |
| Avant — scripts extraits | PARTIAL | 0 | 0 | 3 | 10 `HIGH SENSITIVE_DATA_PERSISTED`, 1 `MEDIUM MOBILE_BROWSER_STORAGE_REVIEW` | FAIL | 149 nœuds, 896 liens |
| Après — fichier unique | PARTIAL | 0 | 0 | 0 | aucun (non analysé) | BLOCKED | vide |
| Après — fichiers séparés | PARTIAL | 0 | 0 | 2 | 9 `HIGH SENSITIVE_DATA_PERSISTED`, 1 `MEDIUM MOBILE_BROWSER_STORAGE_REVIEW` | FAIL | 196 nœuds, 1 539 liens |

### Lecture des constats `SENSITIVE_DATA_PERSISTED`

Ce sont des « candidats statiques » : le moteur relève qu'une donnée créée dans la page finit dans
`localStorage` ou IndexedDB sans chiffrement. **C'est exact, et c'est le fonctionnement voulu** d'une application
dont toutes les données restent sur l'appareil. Ils ne sont donc pas « corrigés » :

- avant : 10 chemins, dont 3 partent de `prompt` (saisie dans un dialogue natif) ;
- après : 9 chemins, plus aucun ne part de `prompt` (les dialogues natifs ont disparu).

Ce qui a été fait autour : rien ne quitte l'appareil (politique `connect-src 'none'`), l'utilisateur est informé
de ce qui est stocké (rubrique Plus › « Ce qui reste sur cet appareil, ce qui en sort »), il peut tout effacer.
**Risque résiduel documenté** : quiconque a accès au profil du navigateur peut lire les notes et le carnet ; le
floutage n'est pas une protection. Le gate vibe reste `FAIL` pour cette raison.

### Analyse de motifs (semgrep, règles locales)

| Motif | Avant | Après |
|---|---:|---:|
| `innerHTML` avec valeur non littérale | 23 | 24 |
| `insertAdjacentHTML` | 34 | 9 |
| Dialogue bloquant natif (`prompt` / `confirm` / `alert`) | 9 | **0** |
| `window.open` | 2 | **0** |
| Fonction globale redéfinie après coup | 32 | **0** |
| `JSON.parse` d'une donnée externe | 11 | 8 |
| Écriture dans le stockage | 11 | 12 |

SENTINEL n'a pas de règle pour l'injection HTML côté navigateur (DOM XSS) : ses flux visent les secrets, le réseau,
le système de fichiers. Les injections trouvées et corrigées (voir `08_SECURITY_REPORT.md`) l'ont été par
**relecture du code, tests d'attaque exécutés dans le navigateur et revue AST**, pas par un moteur SENTINEL.

## Comparaison avant / après (§48)

| Axe | Avant | Après | Source |
|---|---|---|---|
| Secrets | 0 | 0 | gitleaks |
| Dépendances vulnérables | 0 (aucune dépendance) | 0 (aucune dépendance) | syft, grype |
| Stockage non chiffré de données utilisateur | 10 HIGH + 1 MEDIUM | 9 HIGH + 1 MEDIUM (par conception) | vibe-qualify |
| Dette : fonctions redéfinies | 32 motifs | 0 | semgrep |
| Dette : dialogues natifs | 9 | 0 | semgrep |
| Architecture | 3 fichiers de scripts extraits, 149 nœuds | 11 modules, 196 fonctions, 1 539 appels résolus | code-graph |
| Requêtes distantes de l'audit | 0 | 0 | registre d'usage |
| Nouvelle vulnérabilité introduite | — | aucune relevée par SENTINEL | — |
