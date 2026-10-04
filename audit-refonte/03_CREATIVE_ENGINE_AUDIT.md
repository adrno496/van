# 03 — Audit CREATIVE_ENGINE_V9 (avant et après)

Outil : `/Users/dreano/Downloads/CREATIVE_ENGINE_V9`. `node cli.mjs doctor` : Node 24.16, Playwright 1.63,
axe-core 4.13, Lighthouse 13.5 disponibles. Je n'ai modifié aucun fichier du moteur ; les sorties ont été écrites
dans un dossier temporaire, puis résumées dans `evidence/creative-engine/`.

**Le moteur a changé de version pendant la mission** : 9.0.0 au début, 9.1.0 à partir de 01:18 (modifié par un
autre travail en cours sur cette machine, pas par celui-ci). Le premier audit de la baseline avait tourné en 9.0.0.
Je l'ai **rejoué en 9.1.0** : tous les chiffres « avant / après » ci-dessous viennent de la même version du moteur.
Le résultat de la baseline est le même dans les deux versions (qualité 24, 27 constats) ; l'ancien passage est
conservé dans `audit-avant.moteur-9.0.0.summary.json`. La recherche créative donne aussi le même résultat dans
les deux versions (`creative-directions.json` et `creative-directions.engine-9.1.0.json`).

## Ce que le moteur sait faire, et ce qui s'applique ici

Creative Engine conçoit et certifie des **sites vitrines** à partir d'un cahier des charges. Atlas van est une
**application**. J'ai donc utilisé ce qui se transpose, et écarté le reste en le disant :

| Capacité du moteur | Utilisée | Comment |
|---|---|---|
| Audit d'un site existant (`audit`) : sécurité statique, HTML, liens, SEO, accessibilité statique | oui | sur la baseline, les 3 variantes, la version finale (fichier unique et fichiers séparés) |
| Laboratoire navigateur (Playwright) : 5 largeurs, zoom 200 %, texte 200 %, mouvement réduit, clavier, cibles tactiles, axe-core, CSP, console, requêtes tierces | oui | idem |
| Lighthouse (`lighthouse`, 3 passages) | oui | baseline et version finale |
| Comparaison (`compare`) | oui | baseline → version finale |
| Recherche créative (`creative-explorer`, `color-engine`, `typography-engine`, `art-direction`) | oui | 3 briefs → 3 directions, voir `05_VARIANTS_COMPARISON.md` |
| Calcul de contraste (`contrastRatio`) | oui | 29 couples de couleurs par variante |
| Génération de pages (`compile`), adaptateur Astro, SEO autofix, arène | non | produit des pages vitrines : `NON APPLICABLE` à une application existante |
| Questionnaire client, grand livre anti-convergence | non | `NON APPLICABLE` |

## Commandes exécutées

```bash
node cli.mjs doctor
node cli.mjs audit <dossier> --mode balanced          # ×6 : baseline, variantes A B C, finale ×2
node cli.mjs lighthouse <dossier> --runs 3            # ×2 : baseline, finale
node cli.mjs compare <audit avant.json> <audit après.json>
node audit-refonte/scripts/creative-directions.mjs    # recherche créative sur 3 briefs
node audit-refonte/scripts/contrast.mjs <jetons…>     # contrastRatio du moteur
```

## Résultats de l'audit

| Mesure du moteur | Baseline | Finale (fichier unique) | Finale (fichiers séparés) |
|---|---|---|---|
| Certification | FAIL | FAIL ¹ | FAIL ¹ |
| Score de qualité | 24 | **70** | **77** |
| Sécurité statique | PARTIAL | PARTIAL | PARTIAL |
| HTML | PARTIAL (identifiant dupliqué) | PASS | PASS |
| Liens | PASS | PASS | PASS |
| SEO statique | FAIL | FAIL ² | FAIL ² |
| Accessibilité statique | FAIL (score 0) | FAIL (score 28) ³ | PARTIAL (score 90) |
| Laboratoire navigateur | FAIL — 11 scénarios en échec sur 11 | PARTIAL — 6 PASS, 5 PARTIAL ⁴, 0 FAIL | idem |
| Débordement | FAIL (3 scénarios) | PASS (0) | PASS |
| Requêtes tierces | 103 (Google Fonts) | **0** | 0 |
| axe-core, violations | 18, dont 3 critiques ou sérieuses | **0** | 0 |
| Clavier | FAIL (10 commandes inaccessibles) | PASS (0) | PASS |
| Cibles sous 24 px | FAIL (1 scénario) | PASS (0) | PASS |
| Lien d'évitement | FAIL | PASS | PASS |
| Mouvement réduit | FAIL | PASS | PASS |
| Zoom 200 % et texte 200 % | FAIL | PASS | PASS |
| Politique de sécurité (CSP) | FAIL (40 violations de la politique recommandée) | PASS (0) | PASS |

¹ **La certification reste FAIL.** Le moteur la refuse dès qu'un contrôle statique est FAIL : ici le SEO.
² Constats SEO restants : `LINK_NAV_BROKEN` (la barre de navigation mobile contient des boutons, pas de liens
explorables), `SEO_ROBOTS_TXT_MISSING`, `SEO_ORIGIN_UNKNOWN`, `CONTENT_INTENT_UNCLEAR`. Ce sont des règles de
référencement d'un site public : `NON APPLICABLE` à une application locale. Je n'ai pas modifié le code pour les
faire taire.
³ Sur le fichier unique, les règles statiques d'accessibilité ne voient pas la feuille de style (elle est dans la
page, le moteur lit les fichiers `.css`) : 4 « règles absentes » sont des faux négatifs. La vue à fichiers séparés
le montre : il n'en reste qu'une, `A11Y_MOBILE_MENU_ESCAPE_MISSING`, elle aussi un faux négatif — le motif cherché
est `e.key==='Escape'` sans espaces, le code écrit `e.key === 'Escape'` (recherche, menu d'outils, aperçu ; les
dialogues natifs gèrent Échap eux-mêmes). Je n'ai pas reformaté le code pour satisfaire l'expression régulière.
⁴ Les 5 scénarios PARTIAL le sont pour une seule raison : axe-core classe le contraste des textes posés sur la
carte en « à vérifier à la main » (71 à 270 éléments selon la largeur), parce qu'ils sont superposés à un fond
dessiné. Voir `10_ACCESSIBILITY_REPORT.md`.

## Comparaison officielle du moteur (`compare`)

```text
quality_before 24 → quality_after 70 (delta +46)
résolus (13)   : DUPLICATE_ID, SEO_H1_COUNT, SEO_HEADING_HIERARCHY, A11Y_SKIP_LINK_MISSING,
                 A11Y_MAIN_TARGET_MISSING, A11Y_TEXT_DIRECTION_MISSING, A11Y_DISCLOSURE_STATE_MISSING,
                 6 scénarios navigateur
introduits (2) : LINK_NAV_BROKEN, CONTENT_INTENT_UNCLEAR
regression     : true
```

**Le moteur conclut `regression: true`** parce que deux constats n'existaient pas avant. Les deux sont des règles
SEO : la navigation mobile est maintenant dans le HTML (avant, elle était fabriquée par JavaScript, donc invisible
pour l'analyse statique) et ne contient pas de liens. Aucun des deux ne décrit un défaut d'usage. Je le rapporte
tel quel plutôt que de le masquer.

## Lighthouse 13.5 (laboratoire, médiane de 3 passages)

Deux séries. La série 2, où les deux versions sont mesurées l'une après l'autre avec le même moteur, fait foi.
La série 1 montre à quel point la baseline varie d'une mesure à l'autre (elle dépend de Google Fonts).

| Profil | Mesure | Baseline, série 1 | Baseline, série 2 | Finale, série 1 | Finale, série 2 |
|---|---|---:|---:|---:|---:|
| Mobile | Performance | 58 | 74 | 82 | **80** |
| | Accessibilité | 98 | 98 | 100 | **100** |
| | Bonnes pratiques | 100 | 100 | 100 | 100 |
| | SEO | 100 | 100 | 91 | 91 ⁵ |
| | Plus grand élément (LCP) | 5,7 s | 3,6 s | 3,0 s | 3,0 s |
| | Décalage (CLS) | 0,162 | 0 | 0 | 0 |
| | Temps de blocage (TBT) | 0 ms | 78 ms | 344 ms | 382 ms ⁶ |
| | Statut du moteur | FAIL | PARTIAL | PARTIAL | PARTIAL |
| Ordinateur | Performance | 79 | 81 | 100 | **100** |
| | Accessibilité | 92 | 92 | 100 | **100** |
| | SEO | 100 | 100 | 91 | 91 ⁵ |
| | LCP | 1,43 s | 1,29 s | 0,69 s | 0,72 s |
| | CLS | 0,237 | 0,237 | 0,014 | 0,014 |
| | Statut du moteur | PARTIAL | PARTIAL | PASS | PASS |

**Lecture honnête : sur mobile, le gain de score est de +6 points à version et conditions égales** (74 → 80), et
non de +24 comme le suggérait la première série. Sur ordinateur, le gain est net et stable (81 → 100).

⁵ **Le score SEO baisse de 100 à 91.** Un seul contrôle échoue : `robots-txt`. Lighthouse télécharge ce fichier
depuis la page, et la politique `connect-src 'none'` bloque ce téléchargement. C'est un effet de la politique de
sécurité, pas un défaut de référencement ; je ne l'ai pas assouplie pour un score.
⁶ **Le temps de blocage augmente sur mobile** (78 → 382 ms). La page s'affiche plus tôt ; le travail de démarrage
(dessin des pays et des 1 600 marqueurs) se fait désormais après le premier affichage au lieu d'avant. Le démarrage
total est plus court (voir `09`), mais cet indicateur-là est moins bon. Le statut du moteur pour le mobile reste `PARTIAL`.

Limites déclarées par le moteur : mesure de laboratoire sur un serveur local ; les Core Web Vitals de terrain et
l'INP sont `NON TESTÉ`.

## Recherche créative

Voir `05_VARIANTS_COMPARISON.md` et `evidence/creative-directions.json`.

## Preuves

`evidence/creative-engine/` : `audit-avant.summary.json`, `audit-apres-fichier-unique.summary.json`,
`audit-apres-fichiers-separes.summary.json`, `variant-{A,B,C}-audit.summary.json`, `compare-avant-apres.json`,
`lighthouse.json`.
