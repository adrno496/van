# 12 — Rapport final

Refonte d'Atlas van, 2026-10-04. Fichier livré : `index.html`, SHA-256
`3922084812a7ca31ce20db2b418a5510939adb7dacbb83cb4785428bf75532e7`. Fichier d'origine intact dans
`audit-refonte/baseline/` (SHA-256 `ace08e33…`).

## A. Résumé

**Amélioré**
- L'application est réorganisée en cinq rubriques (Explorer, Trajet, Idées, Carnet, Plus) ; il y a toujours une rubrique active.
- Sur téléphone : en-tête de 61 px au lieu de 119, carte sur 86 % de l'écran au lieu de 78 % (390 px), aperçu d'un lieu sans quitter la carte, 0 commande sous 44 px (3 à 9 avant).
- À 768 px, la recherche n'est plus écrasée à 26 px.
- Trois injections de script par fichier ou saisie sont fermées ; une politique de sécurité stricte est en place ; plus aucun appel à Google.
- L'application démarre même si ses données enregistrées sont abîmées, et prévient quand un enregistrement échoue.
- Démarrage environ deux fois plus rapide sur mobile simulé (1 581 → 698 ms) ; un changement de filtre 4 à 9 fois plus rapide.
- Accessibilité automatisée : 18 violations axe → 0 ; Lighthouse 98/92 → 100/100.
- Lighthouse performance : 81 → 100 sur ordinateur ; 74 → 80 sur mobile à conditions égales.

**Conservé** : toutes les fonctions, le catalogue (octet pour octet), les clés et formats de stockage, les formats
d'export et de sauvegarde, la livraison en un seul fichier ouvrable par double-clic.

**Refactorisé** : un fichier de 1,5 Mo devient 20 sources (`src/`) assemblées par `build.mjs`. Les 23
redéfinitions de fonctions empilées ont disparu ; les 9 dialogues natifs aussi.

**Direction visuelle retenue** : A, « Atlas éditorial » (titres serif, papier chaud, terre cuite), choisie sur
mesures face à « Outdoor moderne » et « Carnet contemporain » (`05`).

**Ce qui n'est pas atteint**
- Le code n'a pas diminué : JavaScript +19 %, CSS +44 %, fichier +4,3 %.
- Le déplacement de la carte n'est pas plus fluide (mesuré : identique).
- Sur mobile, le temps de blocage Lighthouse est moins bon qu'avant (78 → 382 ms), même si le démarrage total est plus court.
- La certification Creative Engine reste `FAIL` et le gate SENTINEL reste `FAIL`, pour des raisons expliquées en B et C.

## B. SENTINEL

| | |
|---|---|
| Modules réellement utilisés | `sentinel.mjs` (`doctor`, `tools doctor`, `audit plan`, `audit local`), instantané et contrôle de lecture seule, gitleaks, syft, grype, vibe-qualify, code-graph, RECURSIVE (conteneur sans réseau), semgrep de la chaîne d'outils |
| Commandes | 4 audits locaux (avant/après × fichier unique/scripts séparés), 2 passes semgrep — détail dans `02` |
| Résultats | 0 secret, 0 dépendance vulnérable, cible jamais écrite, 0 requête vers un fournisseur |
| Problèmes corrigés signalés par SENTINEL | dialogues natifs 9 → 0, fonctions redéfinies 32 → 0, `window.open` 2 → 0 (semgrep) |
| Problèmes restants | 9 constats `SENSITIVE_DATA_PERSISTED` (10 avant) : les données sont enregistrées en clair dans le navigateur. C'est le fonctionnement voulu ; le gate reste `FAIL`. |
| Limite | SENTINEL n'analyse pas le JavaScript contenu dans une page et n'a pas de règle d'injection HTML côté navigateur. Les injections ont été trouvées par relecture et prouvées par tests. |
| Non lancé | audit web (fournisseurs incapables d'atteindre une adresse locale), scans actifs (sans objet) |

## C. Creative Engine

| | |
|---|---|
| Fonctions réellement utilisées | `audit` (statique + laboratoire navigateur + axe), `lighthouse`, `compare`, `doctor`, recherche créative, `contrastRatio` |
| Variantes étudiées | A Atlas éditorial, B Outdoor moderne, C Carnet contemporain — trois versions fonctionnelles, mesurées |
| Décision | A : meilleur contraste (5,42 contre 4,87 et 5,04), 54/54 contrôles de mise en page (C : 53), densité utile (C montre un tiers de contenu en moins), continuité avec l'existant |
| Score du moteur | 24 → 70 (77 en fichiers séparés), baseline rejouée avec la même version du moteur (9.1.0) |
| Laboratoire navigateur | 11 scénarios FAIL → 6 PASS, 5 PARTIAL, 0 FAIL |
| Certification | `FAIL` → `FAIL` : règles SEO de site public, sans objet ici |
| `compare` | `regression: true` : 13 constats résolus, 2 introduits (SEO) |
| Non utilisé | génération de pages, adaptateur Astro, SEO autofix, arène : conçus pour des sites vitrines |

## D. Fichiers

**Créés** : `build.mjs`, `README.md`, `src/` (20 fichiers), `tests/` (7 fichiers), `audit-refonte/` (13 rapports,
`baseline/`, `evidence/`, `screenshots/`, `variants/`, `scripts/` ; environ 90 Mo, surtout des captures).
**Modifié** : `index.html`. **Supprimé** : aucun.

## E. Tests

| Test | Commande | Résultat | Statut |
|---|---|---|---|
| Fonctionnel | `node tests/e2e.mjs` | 77 / 77 (baseline 69 / 77) | PASS |
| Interface | `node tests/ui.mjs` | 59 / 59 (baseline 19 / 42) | PASS |
| Données | `node tests/migration.mjs` | 10 / 10 | PASS |
| Navigateurs | `node tests/smoke.mjs` | 6 / 6 (Chromium, Firefox, WebKit × serveur, fichier) | PASS |
| Sources à jour | `node build.mjs --check` | conforme | PASS |
| Lighthouse | `node cli.mjs lighthouse … --runs 3` | mobile 80 / 100 / 100 / 91 (avant 74 / 98 / 100 / 100) ; ordinateur 100 / 100 / 100 / 91 (avant 81 / 92 / 100 / 100) | PASS ordinateur, PARTIAL mobile — réellement exécuté |
| Audit Creative Engine | `node cli.mjs audit … --mode balanced` | qualité 70, navigateur PARTIAL, certification FAIL | PARTIAL |
| Audit SENTINEL | `sentinel.mjs audit local …` | PARTIAL (7 phases sur 8, 1 sans objet) | PARTIAL |

## F. Régressions

Détectées : 3 par la suite fonctionnelle, 8 par l'audit Creative Engine, 3 par les contrôles d'interface.
Corrigées : toutes. Restantes : aucune fonctionnelle connue. Points de vigilance : `11`.

## G. Améliorations non mises en œuvre

| Proposition | Bénéfice | Coût | Difficulté | Risque | Priorité |
|---|---|---|---|---|---|
| Essai sur appareils réels (iPhone, Android, tablette) et lecteur d'écran | lève les principaux `NON TESTÉ` | 2 h | faible | nul | **P1** |
| Dépôt Git dans le dossier du projet (`git init` ici, pas dans le dossier personnel) | historique, retour arrière fin | 5 min | faible | nul | **P1** |
| Bouton « retour » du téléphone ramenant à la carte (navigation par ancre) | usage mobile naturel ; lève `LINK_NAV_BROKEN` | ½ j | moyenne | moyen | P2 |
| Contours des pays projetés à la construction | ~80 ms de démarrage en moins sur mobile lent | ½ j | moyenne | faible | P2 |
| Déplacement de la carte par transformation | fluidité | 1 j | élevée | moyen | P2 |
| Forme de marqueur par catégorie en zoom rapproché | couleur non seule | ½ j | moyenne | faible | P2 |
| Retirer ou généraliser les 5 bases personnelles du catalogue avant tout partage du fichier | confidentialité | 1 h | faible | faible | P2 |
| Mode sombre | confort de nuit | 1 j | moyenne | faible | P3 |
| Chiffrement du carnet par phrase secrète | protège si l'appareil est partagé | 2 j | élevée | élevé (perte en cas d'oubli) | P3 |
| PWA (si hébergement) | installation, cache | 1 j | moyenne | moyen | P3 |
| Tests unitaires des fonctions pures (`geo.js`, `state.js`) | filet plus rapide | ½ j | faible | nul | P3 |

## Auto-critique (§47)

| Question | Réponse |
|---|---|
| L'interface est-elle réellement plus simple ? | Oui sur téléphone (en-tête ÷ 2, une rubrique = un sujet, aperçu). Sur grand écran, le premier écran compte **plus** de commandes (33 contre 27) : les 6 catégories servent de légende. |
| Changement d'apparence seulement ? | Non : ordre du contenu, aperçu mobile, états, dialogues, messages d'erreur, sécurité des données. |
| Complexité ajoutée ? | Une étape de construction. Elle est petite (83 lignes), mais elle existe. |
| Le mobile est-il vraiment meilleur ? | Mesuré en émulation, oui. **Non essayé sur un vrai téléphone.** |
| Une fonction est-elle devenue plus difficile à trouver ? | Les catégories sur mobile (dans « Filtres ») et la fiche complète depuis la carte (un toucher de plus). « Point perso » et « ajout rapide » sont derrière « ⋯ ». |
| Les données existantes restent-elles lisibles ? | Oui, testé dans les deux sens. |
| Imports, exports, IndexedDB, localStorage, dialogues, erreurs, console, clavier testés ? | Oui. |
| Comparaison à la baseline ? | Oui, même suite, mêmes mesures. |
| SENTINEL et Creative Engine réellement exécutés ? | Oui, avant et après. |

## Matrice finale

| Domaine | Statut | Testé réellement ? | Preuve | Reste à faire |
|---|---|---:|---|---|
| Fonctionnel | PASS | Oui | `e2e-refonte.json` 77 / 77 ; `smoke.json` 6 / 6 | essai sur appareil réel |
| UI/UX | PASS | Oui | 90 captures ; `ui-refonte.json` ; `04`, `05` | compréhension par un utilisateur : NON TESTÉ |
| Responsive | PASS | Oui | 9 largeurs × 9 écrans, 0 débordement ; Creative Engine : PASS | encoches, clavier virtuel : NON TESTÉ |
| Accessibilité | PARTIAL | Oui (automatisé et clavier) | axe 0 violation ; Lighthouse 100 ; `10` | lecteur d'écran, contraste sur la carte, couleur seule |
| Performance | PARTIAL | Oui | `perf-*.json` ; Lighthouse 80 mobile, 100 ordinateur | temps de blocage mobile 382 ms (78 avant) ; terrain : NON TESTÉ |
| Sécurité | PASS | Oui | 6 tests d'attaque ; CSP sans violation sur 3 moteurs ; `08` | pas de test d'intrusion externe |
| Données | PASS | Oui | `migration.json` 10 / 10, retour arrière compris | navigation privée : NON TESTÉ |
| Import/export | PASS | Oui | 4 formats exportés, 3 importés, fichiers invalides et piégés | fichier de 100 Mo : NON TESTÉ |
| IndexedDB | PASS | Oui | articles et photos relus après rechargement, sur 3 moteurs, en `file://` | quota réel : NON TESTÉ |
| Géolocalisation | PARTIAL | Oui (position simulée) | 7 tests : autorisée, refusée, indisponible, délai, arrêt | GPS réel : NON TESTÉ |
| SENTINEL final | PARTIAL | Oui | `evidence/sentinel/SUMMARY.json` | gate `FAIL` : stockage en clair, par conception |
| Creative Engine final | PARTIAL | Oui | `evidence/creative-engine/` | certification `FAIL` : règles SEO sans objet ; `compare` : `regression: true` |

```text
READY — pour l'usage prévu : outil personnel, ouvert en fichier local ou hébergé pour soi.
```

Raisons factuelles :
- les éléments bloquants ont été contrôlés par des tests exécutés : fonctions (77 / 77), données existantes
  (10 / 10, dans les deux sens), import/export, IndexedDB, trois moteurs de navigateur, ouverture en fichier local ;
- les défauts graves de la baseline (injections, blocage au démarrage, perte silencieuse) sont fermés et testés ;
- le retour arrière est immédiat et sans perte : `audit-refonte/baseline/index.baseline.html`.

Réserves, à lever avant de supprimer la baseline :
1. un essai sur votre téléphone (carte au doigt, clavier, GPS réel) — rien de cela n'a été fait sur un appareil ;
2. un essai avec un lecteur d'écran si l'accessibilité compte pour vous ;
3. ne pas héberger le fichier publiquement tel quel : le catalogue contient vos bases personnelles.

`NOT READY` s'il s'agissait de publier l'application pour d'autres : il faudrait d'abord les trois points ci-dessus
et une revue d'accessibilité manuelle.
