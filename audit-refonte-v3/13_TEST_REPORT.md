# 13 — Tests

Vrais navigateurs (Playwright 1.63 : Chromium 153, Firefox 155, WebKit 26.6). Un test ne passe que si l'effet attendu
est observé.

## Résultats finaux

| Suite | Cible | Résultat | Preuve |
|---|---|---|---|
| `node build.mjs --check` | `index.html` | OK | sortie de la commande |
| `node build.mjs --mode public --check`, `--mode personal --check` | `dist/public/`, `dist/personal/` | OK (77 fichiers chacun) | idem |
| `tests/e2e.mjs` — fonctionnel | Planner autonome (`index.html`) | **77 / 77** | `evidence/e2e-final.json` |
| | Planner du site personnel (`dist/personal/app`) | **77 / 77** | `e2e-personal-site.json` |
| | Planner du site public (`dist/public/app`, `--catalogue public`) | **77 / 77** | `e2e-public.json` |
| `tests/ui.mjs` — mise en page, clavier, tactile | Planner autonome | **59 / 59** | `ui-final.json` |
| | Planner du site public | **59 / 59** | `ui-public.json` |
| `tests/migration.mjs` — depuis la version d'origine | | **10 / 10** | `migration-final.json` |
| — depuis la version du cycle 1 | | **10 / 10** | `migration-v1-final.json` |
| — depuis la version du cycle 2 | | **10 / 10** | `migration-v2-final.json` |
| `tests/smoke.mjs` — 3 moteurs × serveur et fichier local | Planner autonome | **6 / 6** | `smoke-final.json` |
| | Planner du site public | **6 / 6** | `smoke-public.json` |
| `tests/v2.mjs` — contrôles du cycle 2 | | **36 / 36** | `v2-final.json` |
| `tests/site.mjs` — **nouveau** : le site éditorial | | **34 / 34** | `site-final.json` |

Aucun test existant n'a été retiré ni affaibli. Seule modification d'une suite antérieure : `tests/v2.mjs` cherche le
Planner public à son nouvel emplacement (`dist/public/app`).

## Suite du site (`tests/site.mjs`)

Le site est construit par le test lui-même, dans un dossier temporaire, à partir du catalogue et d'un **contenu de
test** (`tests/fixtures/content`) : un voyage et trois articles publics (dont un aux textes hostiles et un sans image
ni lieu), un voyage privé, une note privée, un brouillon, un guide, des sections « à propos » publique et privée,
des images en dégradé. `content/` n'est pas touché. Quatre constructions : publique, personnelle, sans aucun contenu,
avec adresse de site.

Les vingt points demandés par le cahier des charges :

| N° | Point | Contrôle | Statut |
|---:|---|---|---|
| 1 | Accueil | un seul h1, première page, deux actions, sections, chiffres tirés du catalogue, aucune erreur | PASS |
| 2 | Navigation grand écran | six rubriques, rubrique courante signalée, retour par la marque | PASS |
| 3 | Navigation téléphone | menu plein écran, focus retenu, Échap, focus rendu, cibles de 44 px, lien qui navigue | PASS |
| 4 | Voyages | seul le voyage public listé ; faits fournis seulement ; étapes par identifiant ; galerie | PASS |
| 5 | Destinations | 34 pays ; « Raconté » réservé au pays d'un voyage publié ; saison, itinéraires, notes signalées | PASS |
| 6 | Road trips | 25 itinéraires ; étapes ordonnées ; distance estimée ; aucune durée inventée | PASS |
| 7 | Carnet | articles publics seulement ; date, lieu, largeur de lecture, navigation entre récits | PASS |
| 8 | Guides | quatre guides de l'Atlas + guide rédigé ; tableau de 33 pays ; source en `noopener noreferrer` | PASS |
| 9 | À propos | contenu factuel ; section publique seulement ; mentions : absence dite clairement | PASS |
| 10 | Accès au Planner | Planner complet (1 595 lieux, 5 rubriques) ; retour au site par la marque | PASS |
| 11 | Liens d'entrée | pays filtré, parcours chargé, lieu choisi — depuis les pages réelles | PASS |
| 12 | Contenu privé non publié | 10 chaînes privées absentes de tous les fichiers publics ; présentes et étiquetées en version personnelle | PASS |
| 13 | Assainissement de la version publique | aucune donnée personnelle du catalogue, ni chemin local, ni marqueur privé | PASS |
| 14 | 404 | message, retour à l'accueil, `noindex` | PASS |
| 15 | Clavier | lien d'évitement, ordre de tabulation, focus visible, commandes nommées, repères sur 16 pages | PASS |
| 16 | Responsive | 10 largeurs (320 à 1920 px) × 8 pages : aucun débordement ; cibles de 44 px sous 1024 px | PASS |
| 17 | Politique de sécurité | présente et stricte sur chaque page ; aucun style ni script en ligne ; 0 violation | PASS |
| 18 | XSS | contenu hostile, adresse hostile, 17 fichiers de contenu refusés, options de construction hostiles | PASS |
| 19 | Images | dimensions, texte alternatif, chargement différé, aucune image cassée, aucun décalage de mise en page | PASS |
| 20 | Absence de traceur | 0 requête tierce, 0 cookie, 0 ressource externe, sur toutes les pages | PASS |

Contrôles supplémentaires : recherche locale ; parcours demandé alors qu'un trajet existe (proposé, jamais imposé,
annulable) ; 10 liens d'entrée hostiles ; version personnelle (1 600 lieux, pages `noindex`) ; contrôle de
confidentialité (7 refus provoqués, dont une photographie portant une position GPS) ; contenu de démonstration ;
export du Planner et import (privé par défaut) ; référencement (titres et descriptions uniques, un h1, hiérarchie,
canonique et sitemap avec adresse, données structurées) ; site sans aucun contenu rédigé ; texte à 200 %, mouvement
réduit, couleurs forcées ; sans JavaScript ; fichier local dans trois moteurs (accueil, image, destination → Planner
filtré).

## Robustesse

| Cas | Résultat |
|---|---|
| Aucun contenu rédigé | 74 pages, rubriques vides honnêtes, aucune section vide sur l'accueil — PASS |
| Article sans image, sans lieu, sans extrait | page propre — PASS |
| Image manquante ou illisible | construction refusée, fichier nommé — PASS |
| Destination sans incontournable, sans itinéraire, sans notes | sections absentes — vérifié sur captures |
| Adresse inconnue | page 404 — PASS |
| Lien d'entrée invalide | ignoré — PASS |
| Stockage corrompu, quota atteint | inchangé (tests du Planner) — PASS |
| Sans JavaScript | lisible, navigable — PASS |
| Hors connexion | le site ne fait aucune requête ; en fichier local : PASS dans 3 moteurs |
| IndexedDB indisponible, mode privé | NON TESTÉ |

## Console

0 erreur de console, 0 erreur de page, 0 requête en échec, 0 violation de la politique de sécurité : contrôlé dans
chaque test du site (les pages sont ouvertes avec un collecteur d'erreurs) et, pour le Planner, à la fin de chaque
groupe.

## Comparaison visuelle

| Comparaison | Résultat |
|---|---|
| Planner : 20 écrans (10 × ordinateur et téléphone), cycle 2 contre cycle 3, pixel à pixel | **0 % de pixels différents** sur les 20 (`evidence/planner-visual-diff.json`) |
| Site | pas d'« avant » : captures de référence dans `screenshots/site/` (36) et `site-contenu-de-test/` (12) |
| Trois directions | `variants/{A,B,C}/` (6 captures chacune) |

## Défauts trouvés par les tests pendant ce cycle

Cible tactile de la marque du Planner (7 contrôles de `tests/ui.mjs`), cible du fil d'Ariane, « 1 lieux »,
descriptions trop courtes : tous corrigés (`07`).

## Non testé

Appareil réel, GPS réel, lecteurs d'écran, mode privé, IndexedDB indisponible, serveur de production (en-têtes,
compression, page 404 servie par l'hébergeur), comportement réel d'un moteur de recherche.
