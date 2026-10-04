# Rapport de tests — transformation en blog personnel + Partage

Environnement : Linux, Node 22.22.0, Playwright 1.56.1 avec Chromium 141 (`PLAYWRIGHT_FROM`), PGlite 0.5.8
(PostgreSQL 18.3 en WebAssembly, `PGLITE_FROM`). Firefox et WebKit ne sont pas installés : NON TESTÉ.
« Avant » = copie exacte du commit `8763598` (`git archive`), construite et testée avant toute modification.
« Après » = commit final de ce lot. Rapports JSON : `audit-transformation/evidence/avant/` et `…/apres/`.

Statuts : PASS, PARTIAL (passe sauf échecs préexistants identiques avant/après), FAIL, NON TESTÉ, NON APPLICABLE.

## Construction

| Commande | Résultat après | Statut |
|---|---|---|
| `node build.mjs` | Planner autonome, 3 400 lieux | PASS |
| `node build.mjs --check` | « OK — index.html correspond aux sources » | PASS |
| `node build.mjs --mode personal` (+ `--check`) | 95 fichiers, 92 pages ; « correspond aux sources » | PASS |
| `node build.mjs --mode public` (+ `--check`) | 97 fichiers, 92 pages, 3 395 lieux, « contrôle de confidentialité réussi » ; « correspond aux sources » | PASS |
| Recherche de secrets et de données personnelles dans `dist/public` (`service_role`, `sb_secret_`, clé privée, `encrypted_password`, noms des bases privées) | aucun fichier | PASS |
| Construction refusée : clé de service (JWT `service_role`, `sb_secret_…`), adresse non https, clé inconnue dans `community`, voyage en cours inconnu | `site.mjs` « réglages refusés » | PASS |

Sortie complète : `audit-transformation/evidence/apres/builds.log`.

## Suites existantes : avant / après

| Commande | Avant | Après | Statut |
|---|---|---|---|
| `node tests/e2e.mjs` | 76/77 (FAIL : `#loop` déborde sur mobile) | 76/77 (même échec) | PARTIAL — préexistant |
| `node tests/e2e.mjs --dir dist/public/app --catalogue public` | 76/77 (même) | 76/77 (même) | PARTIAL — préexistant |
| `node tests/ui.mjs` | 58/59 (« Trajet51 » tronqué à 320 px) | 58/59 (même) | PARTIAL — préexistant |
| `node tests/v2.mjs --public dist/public/app` | 36/36 | 36/36 | PASS |
| `node tests/catalogue.mjs` | 13/13 | 13/13 | PASS |
| `node tests/migration.mjs --old audit-refonte-v3/baseline/index.v2-final.html --new index.html` | 10/10 | 10/10 | PASS |
| `node tests/smoke.mjs` (+ `--file dist/public/app/index.html`) | Chromium serveur et fichier PASS | idem | PASS (Chromium) ; Firefox, WebKit NON TESTÉ |
| `node tests/site.mjs` | 30/34 | **38/39** | PARTIAL — seul échec : « fichier local » demande Firefox et WebKit (absents) |

### `tests/site.mjs` : ce qui a changé et pourquoi

Avant : 4 échecs — 15 (focus visible), 16 (mise en page : image de test annulée), 17 (politique : image de test
annulée), « fichier local » (Firefox absent).
- **15** : le contour de focus mesure bien 3 px, mais le test le lisait dans la même image que la frappe ; il attend
  maintenant 150 ms avant de lire. Aucun seuil changé.
- **16, 17** : une image en cours de chargement quand le test change de page est annulée (`net::ERR_ABORTED`) ; ce
  n'est pas une erreur du site. Le test ignore désormais ce seul cas ; toute autre requête en échec reste une erreur.
- Changements **voulus** de l'accueil et de la navigation, reportés dans les tests 1, 2, 15 et « fichier local » :
  titre « Suivez mon voyage en van solo », actions « Suivre mon voyage » / « Voir mes voyages » / « Préparer votre
  voyage », ordre des sections, sept rubriques (dont « Partage »). Le contrôle des nombres du catalogue est conservé
  (déplacé dans la section « Explorer l'Atlas »).
- Test 3 (menu téléphone) : il comptait sur un nombre fixe de liens ; il vérifie maintenant, sur 30 tabulations, que le
  focus ne quitte jamais le menu pour la page (Chromium le rend au navigateur après le dernier lien, puis au menu).
- Import (« export du Planner pour le site ») : le second import n'est plus refusé mais **idempotent** (exigence de la
  consigne) : le test vérifie qu'aucun fichier n'est réécrit ni dupliqué ; le nom des photos inclut une empreinte.
- Ajouts : groupe « blog » (5 essais) et pages `voyage-en-cours/`, `partage/` dans les pages clés.
Aucun test n'a été supprimé ni désactivé.

## Nouvelles suites

| Commande | Résultat | Statut |
|---|---|---|
| `node tests/import.mjs` | 6/6 | PASS |
| `PGLITE_FROM=… node tests/community.mjs` | 17/17 | PASS |
| `PLAYWRIGHT_FROM=… PGLITE_FROM=… node tests/partage.mjs` | 19/19 | PASS |

### Correspondance avec la liste de la consigne

**Blog propriétaire**

| Essai demandé | Où | Statut |
|---|---|---|
| Accueil | `site.mjs` 1 (titre, actions, ordre des sections, chiffres), « voyage en cours sur l'accueil » | PASS |
| Voyage en cours | `site.mjs` « page voyage en cours » | PASS |
| Carte (étapes publiées, dernière étape, prévu distinct, alternative textuelle) | `site.mjs` « voyage en cours sur l'accueil » | PASS |
| Dernière étape | idem + `import.mjs` (l'article publié devient la dernière étape) | PASS |
| Articles, voyage passé, liens internes | `site.mjs` 4, 7, 11, « page voyage en cours » | PASS |
| Import du carnet, réimport sans doublon, brouillon non publié, publication explicite | `import.mjs` 2, 3 ; `site.mjs` « export du Planner » | PASS |
| Confidentialité de la position | `site.mjs` « confidentialité du voyage » | PASS |

**Planner**

| Essai demandé | Où | Statut |
|---|---|---|
| Ancien trajet, migration | `migration.mjs` 10/10 | PASS |
| Création de trajet, lieux personnels, favoris, sauvegarde, restauration | `e2e.mjs` P1–P4 | PASS |
| Mode fichier local | `smoke.mjs` (Chromium fichier) | PASS (Chromium) |
| Planner public sans publication vers le blog | `site.mjs` « Planner public » | PASS |

**Partage**

| Essai demandé | Où | Statut |
|---|---|---|
| Lecture sans compte, recherche, filtres | `partage.mjs` « lecture sans compte » | PASS |
| Inscription / connexion | « compte : inscription… », « compte : export… » | PASS (serveur imité) |
| Création circuit, spot, astuce, technique, retour d'expérience | « formulaire : circuit, spot, retour », « compte : … proposition », « photos » (technique) | PASS |
| Édition de sa contribution ; refus d'éditer celle d'un autre | « formulaire » (UI + envoi forcé), « sans droits » (HTTP), `community.mjs` 2 | PASS |
| Publication (modération) | « compte : … modération, publication » | PASS |
| Signalement | « favoris, utile, signalement » | PASS |
| Circuit → Planner, spot → mes lieux | « circuit → Planner », « spot → Ajouter à mes lieux » | PASS |
| Planner → Partage | « Planner → Partage » | PASS |
| Pagination | « pagination » | PASS |
| Mobile | « accessibilité et mobile » (320, 390, 1 280 px), formulaire rempli à 390 px | PASS |
| Erreur réseau | « serveur injoignable » | PASS |

Sécurité : les 17 essais demandés, un par un, dans `SECURITY_REPORT.md`.

## Performances (accueil, mobile 390 px, processeur ×4, 7 passages alternés)

| | Avant | Après |
|---|---:|---:|
| Premier affichage (médiane) | 260 ms | 276 ms |
| Chargement complet (médiane) | 329 ms | 354 ms |
| Éléments du DOM | 294 | 267 |
| `index.html` (public, sans voyage publié) | 109 067 o | 98 769 o |
| `assets/site.css` | 26 729 o | 37 490 o (styles de Partage et du voyage en cours ; une seule feuille, mise en cache) |
| `app/index.html` (Planner) | 2 572 185 o | 2 585 881 o (+13,7 Ko : module Partage ↔ Planner) |

L'accueil ne charge aucune donnée de Partage et ne contacte aucun serveur (vérifié dans `partage.mjs`, « serveur
injoignable » : 0 requête vers Partage depuis l'accueil). Écart de premier affichage : +16 ms, dans le bruit de mesure
et dû à la feuille de style plus lourde. Planner : non remesuré en détail (`perf.mjs`, `profile.mjs` NON TESTÉ dans ce
lot) ; seul ajout : 13,7 Ko de JavaScript exécutés au démarrage pour déclarer des fonctions.

## Non testé

- Firefox, WebKit (non installés).
- Un vrai projet Supabase (Auth, PostgREST, Storage, limites d'Auth, e-mails de confirmation) : non joignable ici.
  Commandes à exécuter : `SECURITY_REPORT.md`, « Ce qui reste à faire contre le vrai Supabase ».
- Lecteurs d'écran réels (NVDA, VoiceOver) : seuls les noms accessibles, les repères et le clavier sont vérifiés.
- `tests/perf.mjs`, `tests/profile.mjs`, `tests/screenshots.mjs`, `tests/site-shots.mjs` : non relancés ; captures
  manuelles de l'accueil, de `voyage-en-cours/` et des pages de Partage à 390 et 1 280 px examinées.
- Déploiement Vercel réel (en-têtes HTTP en production).
