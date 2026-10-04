# 07 — Tests

Tous les tests pilotent de vrais navigateurs (Playwright 1.63 : Chromium 153, Firefox 155, WebKit 26.6). Un test ne
passe que si l'effet attendu est observé dans la page ou dans les données.

## Résultats finaux

| Suite | Version personnelle | Version publique | Preuve |
|---|---|---|---|
| `node build.mjs --check` | OK | OK (`--mode public --check`) | sortie de la commande |
| `tests/e2e.mjs` — fonctionnel | **77 / 77** | **77 / 77** (`--catalogue public`) | `evidence/e2e-final.json`, `e2e-public.json` |
| `tests/ui.mjs` — mise en page, clavier, tactile | **59 / 59** | **59 / 59** | `ui-final.json`, `ui-public.json` |
| `tests/migration.mjs` — depuis la version d'origine | **10 / 10** | — | `migration-final.json` |
| `tests/migration.mjs` — depuis la version du cycle 1 | **10 / 10** | — | `migration-v1final-final.json` |
| `tests/smoke.mjs` — 3 moteurs × serveur et fichier local | **6 / 6** | **6 / 6** (`--places 1595`) | `smoke-final.json`, `smoke-public.json` |
| `tests/v2.mjs` — nouveaux contrôles du cycle 2 | **36 / 36** | (7 des 36 portent sur la version publique) | `v2-final.json` |

Baseline V2, pour comparaison : 77 / 77, 59 / 59, 10 / 10, 6 / 6 (`evidence/*-baseline-v2.json`).

Détail de `tests/e2e.mjs` : explorer 16, itinéraire 15, carnet 12, sauvegarde 7, géolocalisation 7, mobile 9,
clavier et accessibilité 5, sécurité 6. Détail de `tests/ui.mjs` : mise en page à 8 largeurs 42, clavier 7,
parcours 4, accessibilité 2, mobile 4.

## Suite V2 (`tests/v2.mjs`) — 36 contrôles

| Groupe | Contrôles | Ce qui est vérifié |
|---|---:|---|
| Marqueurs | 6 | un élément par lieu, noms dans un calque à part ; une forme par catégorie sur la carte et dans la légende ; contour de 1,2 px à deux niveaux de zoom, sans `non-scaling-stroke` ; survol = lieu le plus proche, identique au clic ; forme et halo suivent une modification de catégorie ; console propre |
| Bouton « retour » mobile | 6 | aperçu, fenêtre, rubrique, éditeur du carnet (brouillon enregistré) ; aucune entrée d'historique en trop après 5 allers-retours ; rien sur grand écran ; console propre |
| Sécurité étendue | 12 | voir ci-dessous |
| Endurance et mémoire | 5 | 320 actions répétées sans accumulation ; trajet de 200 étapes et 300 favoris ; restauration pendant un enregistrement en attente ; carnet de 60 articles et 120 photos ; console propre |
| Version publique | 7 | 1 595 lieux, aucune base ; aucun texte personnel dans le fichier, la page et les données ; rubrique masquée ; 25 parcours valides ; données d'une version personnelle déjà présentes ; CSP et absence de requête ; console propre |

## Rejeu ciblé de la sécurité

| Attaque | Résultat observé | Statut |
|---|---|---|
| Parcours `.json` piégé (HTML dans 11 champs) | 0 script exécuté | PASS (`e2e`) |
| Sauvegarde v3 piégée, types invalides puis types valides | 0 script exécuté ; le texte reste du texte | PASS (`e2e`) |
| Saisie piégée dans une fiche, relue après rechargement | 0 script exécuté | PASS (`e2e`) |
| **Carnet piégé** : titre, texte, légende de photo, lieu, auteur, identifiant de lieu | restauré comme du texte, 0 script, 0 gestionnaire | PASS |
| **Blog exporté** depuis ce carnet, ouvert pour de bon dans un navigateur | 0 script, 0 attribut `on…`, 0 lien `javascript:` ; politique de sécurité propre au fichier | PASS |
| **Photo hostile** : SVG avec `onload`, adresse distante, `javascript:`, `data:text/html`, attribut injecté après une image valide | sauvegarde refusée en bloc, carnet intact (5 cas) | PASS |
| **Lien `javascript:`** dans la source d'une fiche ; 9 protocoles essayés (`data:`, `vbscript:`, `file:`, `blob:`, relatif au protocole, `ftp:`…) | aucun lien produit ; seuls `http` et `https` passent | PASS |
| **Pollution de prototype** (`__proto__`, `constructor.prototype`) dans une sauvegarde et dans un parcours | `({}).polluted` indéfini, aucune clé étrangère dans l'état | PASS |
| **JSON mal formé** : vide, tronqué, tableau, `null`, nombre, mauvais types, 20 000 niveaux d'imbrication, binaire — par les deux entrées de fichier | 16 refus, données identiques avant et après | PASS |
| **Chaînes d'un million de caractères** dans 7 champs d'un parcours | tronquées aux limites (200, 500, 100, 6 000, 3 000), catégorie inconnue ramenée à « perso », aucun débordement | PASS |
| **Import volumineux** | 2 001 étapes : refus ; 2 000 étapes : chargé en 1,5 s | PASS |
| **Politique de sécurité à l'épreuve** : `onerror` injecté, lien `javascript:` cliqué, balise `<script>` ajoutée | rien ne s'exécute ; le navigateur signale les violations | PASS |
| **Aucune requête** pendant l'usage (fiche, parcours, rubriques, paramètres, recherche) | 0 requête, 0 ressource tierce dans la page | PASS |
| Fichier de 100 Mo | NON TESTÉ — limite codée, non éprouvée avec un vrai fichier | |
| Test d'intrusion par un tiers | NON TESTÉ | |

Politique de sécurité livrée, inchangée dans sa structure : `default-src 'none'; script-src 'sha256-…' 'sha256-…';
style-src 'sha256-…'; img-src data: blob:; connect-src 'none'; font-src 'none'; object-src 'none'; base-uri 'none';
form-action 'none'`. Le catalogue en JSON n'est pas un script exécuté : il n'a pas d'empreinte et n'en a pas besoin
(0 violation dans les trois moteurs, par serveur et en fichier local).

## Console

| Objectif | Résultat |
|---|---|
| 0 erreur de console, 0 erreur de page | atteint : chaque groupe de `e2e` (8) et de `v2` (5) se termine par ce contrôle |
| 0 requête en échec, 0 requête tierce | atteint (audit Creative Engine : 0 / 0 / 0 sur 11 scénarios) |
| 0 violation de la politique de sécurité | atteint en usage normal ; les seules violations enregistrées sont celles provoquées exprès par le test d'attaque, dans une page à part |

## Défaut trouvé par les tests pendant ce cycle

Restauration d'une sauvegarde complète écrasée par un enregistrement automatique en attente : le carnet revenait,
pas le trajet. Présent depuis le cycle 1, révélé en rejouant la migration depuis la version du cycle 1, corrigé,
couvert par un test (détail dans `06`, lot 6). Avant correction : FAIL sur la version du cycle 1 et sur le
commit `09d9f78` ; après : PASS.

## Évolution des tests existants

Aucun test n'a été retiré ni affaibli. Modifications :

| Fichier | Modification | Raison |
|---|---|---|
| `tests/e2e.mjs` | deux sélecteurs acceptent l'ancienne et la nouvelle structure des noms (`#map .poi text, #map text.lbl`) | les noms ont changé de calque |
| `tests/e2e.mjs` | option `--catalogue public` : 1 595 lieux, premier identifiant 3, premier parcours de 45 étapes, fiche modifiée « Nantes » | appliquer les 77 tests à la version publique ; sans l'option, valeurs inchangées |
| `tests/ui.mjs` | « un lien par étape » compare au nombre d'étapes réel au lieu de 51 | idem |
| `tests/smoke.mjs` | option `--places` | idem |
| tous | rapports par défaut dans `test-results/` | ne plus écraser les preuves |

## Captures

`screenshots/final/` : 10 écrans × 9 formats (ordinateur 1440 et 1280, tablettes 1024, 1024 tactile et 768,
téléphones 430, 390, 360 et 320) = 90 captures. `screenshots/public/` : 10 écrans × 2 formats = 20 captures.
Elles servent de référence visuelle ; elles n'ont pas été comparées pixel à pixel à celles du cycle 1 (la carte a
changé de dessin volontairement).

## Non testé

Appareil réel, GPS réel, lecteurs d'écran, mode privé sur mobile, fichier de 100 Mo, échec de stockage en cours de
restauration (seul l'annulation est codée), anciennes versions de navigateurs. Voir `03` et `12`.
