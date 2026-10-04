# 14 — SENTINEL : fin du cycle 3

Outil : `/Users/dreano/Downloads/SENTINEL`, version `7.0.0-verified-recursive-private` — la même qu'au début du cycle
(baseline : audits finaux du cycle 2, faits une heure plus tôt). Commande : `audit local`.

Règles respectées : cible en lecture seule (vérifiée par SENTINEL à chaque passage) ; sorties hors du projet et hors
de la capsule de SENTINEL ; aucun fournisseur distant, aucune IA distante, aucun scan actif ; aucun fichier de
SENTINEL modifié ; aucune clé lue, copiée, affichée ni déplacée. Mémoire de Node portée à 8 Go, comme au cycle 2
(les audits à fichiers séparés échouent sinon par manque de mémoire) : aucun mécanisme n'est contourné.

## Quatre passages

| | Site public | Site personnel | Planner public, fichiers séparés | Planner personnel, fichiers séparés |
|---|---|---|---|---|
| Cible | `dist/public/` (77 fichiers) | `dist/personal/` (77 fichiers) | `build.mjs --split --mode public` | `build.mjs --split` |
| Statut | COMPLETE | COMPLETE | COMPLETE | COMPLETE |
| Secrets (gitleaks) | 0 | 0 | 0 | 0 |
| Vulnérabilités (grype) | 0 | 0 | 0 | 0 |
| Composants (SBOM) | 0 | 0 | 0 | 0 |
| Fichiers analysés sémantiquement | 1 (`assets/site.js`) | 1 | 2 (`app.js`, `places.js`) | 2 |
| Graphe de code | 6 nœuds, 0 erreur | idem | 214 nœuds, 1 630 liens, 0 erreur | idem |
| Constats | **0** | **0** | 9 `SENSITIVE_DATA_PERSISTED` + 1 `MOBILE_BROWSER_STORAGE_REVIEW` | idem |
| Sorties réseau, services tiers | 0, 0 | 0, 0 | 0, 0 | 0, 0 |
| Contrôle de déploiement | BLOCKED | BLOCKED | FAIL | FAIL |
| Cible en lecture seule | PASS | PASS | PASS | PASS |
| Secrets dans les artefacts d'audit | PASS | PASS | PASS | PASS |

## Lecture

**Site éditorial.** Le script du site (`assets/site.js`, 65 lignes) est analysé : aucun constat — il n'écrit rien dans
le stockage, n'envoie rien. Les 76 autres fichiers sont du HTML et une feuille de style. Le contrôle de déploiement
est « BLOCKED », non « FAIL » : SENTINEL ne certifie pas une cible sans preuve d'exécution ni reçu de construction ;
ce n'est pas un défaut relevé. Le Planner contenu dans `app/index.html` n'est **pas** analysé dans ces deux
passages (JavaScript dans une page) : zéro constat ne dit donc rien de lui.

**Planner.** C'est la vue à fichiers séparés qui compte. Résultat **identique à celui du cycle 2** : les mêmes dix
constats de stockage local (copie de secours au démarrage, restauration, ouverture du carnet), aucun nouveau. Le
code ajouté pendant ce cycle — liens d'entrée, export pour le site — n'a créé aucun constat. Le graphe passe de
210 à 214 nœuds.

Ces dix constats décrivent le fonctionnement voulu : les données de voyage sont enregistrées en clair dans le
navigateur. Ils ne sont **pas masqués** ; aucun chiffrement n'a été ajouté pour les faire disparaître.

Statut d'ensemble : **PARTIAL** — quatre audits complets, 0 secret, 0 vulnérabilité, 0 sortie réseau, 0 constat sur
le site ; contrôle de déploiement en échec sur le stockage local du Planner.

## Ce que SENTINEL ne couvre pas ici

| Angle | Couvert par |
|---|---|
| Les scripts de construction (`build/*.mjs`) : lecture de fichiers, chemins, écriture de `dist/` | **non soumis à SENTINEL** ; couverts par 17 cas de refus et le test du dossier de sortie (`tests/site.mjs`) |
| Injection HTML dans les pages produites | tests d'attaque dans le navigateur (`11`, `13`) |
| JavaScript du Planner dans `app/index.html` | vue à fichiers séparés ci-dessus |
| Confidentialité du contenu (public / privé) | contrôle à la construction et tests (`11`) — SENTINEL ne connaît pas ce modèle |
| Exécution réelle | phase « runtime » indisponible (pas de conteneur) |

## semgrep et revue des insertions HTML

| Mesure | Fin du cycle 2 | Fin du cycle 3 |
|---|---:|---:|
| semgrep : points d'inventaire (Planner + site) | 54 | 55 |
| — écritures `innerHTML` | 24 | 24 |
| — `insertAdjacentHTML` | 9 | 9 |
| — écritures dans le stockage | 12 | 12 |
| — `JSON.parse` | 9 | 10 |
| Revue des insertions HTML du Planner : valeurs insérées | 388 | 388 |
| — échappées par `esc()` | 183 | 185 |
| — à relire à la main | 57 | 56 |
| — **nouvelles** valeurs à relire | — | **0** |
| Insertions HTML dans le script du site | — | **0** |

Le `JSON.parse` de plus est celui de l'index de recherche du site, produit par la construction et lu dans la page.
La valeur « à relire » en moins est la liste « avant de partir », désormais échappée. Le script du site ne contient
aucune écriture HTML : les résultats de recherche sont créés nœud par nœud.

## Preuves

`evidence/sentinel/SUMMARY.json` et, par passage : `AUDIT_RESULT.json`, `AUDIT_PLAN.json`, `TARGET_READ_ONLY.json`,
`ARTIFACT_SECRET_SCAN.json`, `gitleaks.json`, `static-triage.json`. `evidence/semgrep/apres.json`,
`evidence/html-sinks.json`, `evidence/html-sinks-site.json`. Baseline : `audit-refonte-v2/evidence/`.
