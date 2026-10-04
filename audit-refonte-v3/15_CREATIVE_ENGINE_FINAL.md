# 15 — Creative Engine : fin du cycle 3

Outil : `/Users/dreano/Downloads/CREATIVE_ENGINE_V9`. Aucun fichier du moteur modifié ; audits sur des copies.

## Version

`cat VERSION` : **9.1.0** au début et à la fin du cycle ; champ `run.engine` des audits : `9.1.0`. Le moteur n'a pas
changé : la baseline (audits finaux du cycle 2) n'a pas eu à être rejouée.
`doctor` : Node 24.16, Playwright 1.63, axe-core 4.13, Lighthouse 13.5 (`evidence/creative-engine/doctor.txt`).

## Ce qui a été utilisé

| Fonction du moteur | Usage |
|---|---|
| `doctor` | état de l'outillage |
| Recherche créative (`creative-explorer`, palettes, typographie, direction artistique) | trois briefs → trois directions (`04`) |
| `contrastRatio` | 26 couples par direction, sur les couleurs rendues |
| `audit --mode balanced` (statique + laboratoire navigateur : 5 largeurs, zoom et texte 200 %, mouvement réduit, clavier, menu, axe-core, CSP, console) | ×3 directions, puis site final et Planner final |
| `lighthouse --runs 3` | ×3 directions, puis accueil final |
| `runLighthouse` (même fonction, par page) | 9 pages × 2 profils (`10`) |
| `compare` | Planner avant / après ; Planner avant / site après |
| Génération de pages (`compile`), adaptateur Astro, SEO autofix, arène | **non utilisés** : le site est produit par le projet lui-même, à partir de ses données ; faire générer des pages par le moteur aurait créé un second système |

Cette fois la cible est un site de lecture : les règles du moteur s'appliquent bien mieux qu'aux cycles 1 et 2, et
elles ont trouvé de vrais défauts.

## Audit final du site public (`dist/public/`, 77 fichiers)

| Mesure | Avant corrections (direction A) | **Final** |
|---|---|---|
| Score de qualité | 64 | **79** |
| Certification | FAIL | FAIL ¹ |
| HTML, liens | PASS, PASS | PASS, PASS |
| Sécurité statique | PARTIAL | PARTIAL ² |
| Accessibilité statique | FAIL (0) | PARTIAL (90) ³ |
| SEO statique | FAIL (64,7) | FAIL (66,7) ⁴ |
| Laboratoire navigateur | FAIL — 25 scénarios en échec | **PARTIAL — 80 PASS, 41 PARTIAL, 0 FAIL** |
| axe-core, violations | 21, dont 16 sérieuses | **0** |
| Clavier | FAIL | PASS |
| Menu mobile | FAIL | PASS |
| Débordement, cibles, lien d'évitement, mouvement réduit, zoom | PASS | PASS |
| Console, requêtes, tiers | 0 / 0 / 0 | 0 / 0 / 0 |
| Politique de sécurité | PASS (0 violation) | PASS (0) |

¹ Blocages de certification : `ACCESSIBILITY_MANUAL_REVIEW` (contrastes « à vérifier à la main » sur les cartes),
`PERFORMANCE_LAB_LIGHTHOUSE` (le Planner, PARTIAL sur mobile), `PROJECT_SPEC_FACTUAL_CONTEXT` (le moteur attend le
cahier des charges d'un projet qu'il a lui-même conçu). Non recherchée.

² `INLINE_SCRIPT` et `INLINE_EVENT_HANDLER` : un constat chacun pour tout le site, comme sur le Planner seul avant
ce cycle. Le Planner est un fichier unique dont les scripts sont autorisés par empreintes ; les pages du site n'ont
aucun script exécutable ni gestionnaire en ligne (vérifié fichier par fichier par `tests/site.mjs`).

³ Un seul constat restant, `A11Y_MOBILE_MENU_ESCAPE_MISSING` : faux négatif d'expression régulière déjà décrit au
cycle 1 (le menu est une fenêtre native, qui gère Échap ; le test navigateur du même moteur le confirme : PASS).

⁴ Voir « Constats non suivis ».

## Constats du moteur suivis d'une correction

| Constat | Nombre | Correction |
|---|---:|---|
| axe `color-contrast` (textes en cours d'apparition) | 16 sérieux | apparition sans fondu |
| axe `heading-order` ; `SEO_HEADING_HIERARCHY` | 1 page | niveau de titre des cartes |
| Clavier : focus non visible | 1 page | champ de recherche |
| Menu mobile : état après Échap | 4 pages (intermittent) | mise à jour dès l'annulation |
| `A11Y_SKIP_LINK_MISSING`, `A11Y_MAIN_TARGET_MISSING`, `A11Y_TEXT_DIRECTION_MISSING` | 74 pages chacun | `#main`, `id="main"`, `dir="ltr"` (convention déjà suivie par le Planner) |
| `CONTENT_KEYWORD_STUFFING` « sur la carte » | 31 pages | le nom du lieu devient le lien |
| `SEO_H1_TITLE_INCOHERENT` | 3 pages | h1 alignés sur les titres |

## Constats non suivis, et pourquoi

| Constat | Nombre | Raison |
|---|---:|---|
| `LINK_BROKEN_ANCHOR` | 738 | **faux positif** : les liens vers le Planner portent leur cible dans le fragment (`app/index.html#lieu=31`). Le moteur y voit une ancre sans élément correspondant. Passer à `?lieu=31` ferait retélécharger 1,5 Mo à chaque lien ; les 738 liens sont testés |
| `LINK_BROKEN_INTERNAL` | 26 | faux positif : le moteur traite `404.html` comme la route `/404/` et résout ses liens relatifs un niveau trop bas |
| `CONTENT_KEYWORD_STUFFING` | 33 | 10 fois « lieux et règles » (liens vers les pays traversés, sur les itinéraires) : répétition réelle, mineure, **non corrigée**. Le reste est la densité d'un nom de pays sur sa propre page ou d'« UNESCO » dans une liste de sites classés |
| `CONTENT_THIN` | 4 | `404`, recherche, Voyages (vide tant qu'aucun voyage n'est publié), Finlande (14 lieux, aucun incontournable) : pages courtes parce que le contenu l'est |
| `SEO_ROBOTS_NOINDEX_UNEXPECTED` | 3 | voulu : recherche, 404, mentions non renseignées |
| `CONTENT_INTENT_UNCLEAR`, `LINK_ORPHAN_PAGE`, `SEO_META_DESCRIPTION_LENGTH_HEURISTIC` | 4, 1, 1 | pages de service (404, recherche, mentions) et Planner |
| `LINK_DUPLICATE_DESTINATION` | 1 | voulu : le bouton vers le Planner est permanent |
| `SEO_ROBOTS_TXT_MISSING`, `SEO_ORIGIN_UNKNOWN` | 1, 1 | adresse du site inconnue ; produits dès qu'elle est fournie (testé) |
| `LINK_NAV_BROKEN` | 1 | le Planner : navigation en boutons |

Conséquence chiffrée : l'axe « graphe de liens » du score SEO du moteur est à 0 (767 constats, dont 764 faux
positifs), ce qui tient le score SEO statique à 66,7. Je n'ai pas changé la forme des liens pour le remonter.

## Comparaisons officielles (`compare`)

```text
Planner public, cycle 2 → cycle 3 : qualité 70 → 70 · résolus : aucun · introduits : aucun · regression : false
Planner (cycle 2) → site complet  : qualité 70 → 79 (+9) · résolus : 4 · introduits : 8 familles · regression : true
```

Lecture honnête de la seconde ligne : elle compare **un fichier** (le Planner) à **un site de 74 pages**. Les quatre
constats « résolus » sont les faux négatifs du fichier unique ; les huit « introduits » sont des règles de liens et
de contenu qui ne pouvaient pas se déclencher sur une page seule. Le moteur conclut `regression: true` parce que des
familles de constats sont nouvelles ; je le rapporte tel quel. La première ligne est la comparaison à périmètre
égal : aucune régression sur le Planner.

## Lighthouse (commande du moteur, accueil, médiane de 3)

| Profil | Performance | Accessibilité | Bonnes pratiques | SEO | LCP | TBT | CLS | Statut |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| Mobile | 100 | 100 | 100 | 91 | 1,11 s | 0 ms | 0 | PASS |
| Ordinateur | 100 | 100 | 100 | 91 | 0,30 s | 0 ms | 0 | PASS |

Neuf pages mesurées avec la même fonction : `10_PERFORMANCE_REPORT.md`.

## Scores : rien n'a été fait pour eux

| Tentation | Décision |
|---|---|
| Remplacer `#lieu=31` par `?lieu=31` pour effacer 738 constats | non |
| Assouplir `connect-src 'none'` pour le contrôle `robots-txt` de Lighthouse | non |
| Étoffer artificiellement les pages « minces » | non |
| Retirer `noindex` de la recherche, de la 404, des mentions vides | non |
| Générer des pages avec le moteur pour satisfaire `PROJECT_SPEC_FACTUAL_CONTEXT` | non |

## Preuves

`evidence/creative-engine/` : `audit-apres-site-public.summary.json`, `audit-apres-planner-public.summary.json`,
`audit-avant-planner-public.summary.json`, `compare-planner.json`, `compare-site.json`, `lighthouse-accueil.json`,
`doctor.txt`. `evidence/variants-creative-engine.json`, `evidence/creative-directions.json`,
`evidence/variant-metrics.json`, `evidence/lighthouse-site.json`, `evidence/lighthouse-contenu-de-test.json`.
