# 09 — Creative Engine : avant et après le cycle 2

Outil : `/Users/dreano/Downloads/CREATIVE_ENGINE_V9`. Aucun fichier du moteur n'a été modifié ; les audits ont porté
sur des copies, dans un dossier temporaire.

## Version du moteur

`cat VERSION` : **9.1.0** au début de la mission et à la fin. Le champ `run.engine` des audits vaut `9.1.0` avant
comme après (`evidence/creative-engine/*.summary.json`). **Le moteur n'a pas changé pendant ce cycle** : la
comparaison est faite à version égale, sans rejouer la baseline.

`node cli.mjs doctor` : Node 24.16, Playwright 1.63.0, axe-core 4.13.0, Lighthouse 13.5.0 disponibles ;
`html_validate` absent ; mode local, aucun réseau requis (`evidence/creative-engine/doctor.txt`).

## Commandes exécutées

```bash
cat VERSION
node cli.mjs doctor
node cli.mjs audit <copie> --mode balanced      # ×5 : avant (fichier unique, fichiers séparés), après (idem), version publique
node cli.mjs lighthouse <copie> --runs 3        # ×4 : avant (deux séries), après, version publique
node cli.mjs compare <audit avant.json> <audit après.json>   # ×2 : fichier unique, fichiers séparés
```

Modules non utilisés, parce qu'ils ne s'appliquent pas à ce cycle : génération de pages (`compile`), recherche
créative et arène (le design n'est pas refait), SEO autofix, adaptateur Astro. `contrastRatio` a servi au calcul des
contrastes de la carte (`04_ACCESSIBILITY_MARKERS.md`).

## Audit (`audit --mode balanced`)

| Mesure du moteur | Avant | Après — fichier unique | Après — fichiers séparés | Version publique |
|---|---|---|---|---|
| Certification | FAIL | FAIL ¹ | FAIL ¹ | FAIL ¹ |
| Score de qualité | 70 | **70** | **77** (77 avant) | 70 |
| Sécurité statique | PARTIAL | PARTIAL | PARTIAL | PARTIAL |
| HTML | PASS | PASS | PASS | PASS |
| Liens | PASS | PASS | PASS | PASS |
| SEO statique | FAIL (92) | FAIL (92) ² | FAIL (92) ² | FAIL (92) ² |
| Accessibilité statique | FAIL (28) ³ | FAIL (28) ³ | PARTIAL (90) | FAIL (28) ³ |
| Laboratoire navigateur | PARTIAL | PARTIAL ⁴ | PARTIAL ⁴ | PARTIAL ⁴ |
| Scénarios navigateur | 6 PASS, 5 PARTIAL, 0 FAIL | 6 PASS, 5 PARTIAL, 0 FAIL | idem | idem |
| Erreurs de console, erreurs de page | 0, 0 | 0, 0 | 0, 0 | 0, 0 |
| Requêtes en échec, requêtes tierces | 0, 0 | 0, 0 | 0, 0 | 0, 0 |
| axe-core : violations | 0 | **0** | 0 | 0 |
| axe-core : « à vérifier à la main » (contraste) | 71 à 270 éléments | 70 à 269 | 70 à 269 | 71 à 269 |
| Débordement horizontal (5 largeurs) | 0 | 0 | 0 | 0 |
| Clavier | PASS | PASS | PASS | PASS |
| Cibles sous 24 px | 0 scénario | 0 | 0 | 0 |
| Lien d'évitement, mouvement réduit | PASS, PASS | PASS, PASS | PASS, PASS | PASS, PASS |
| Zoom 200 %, texte 200 % | PASS, PASS | PASS, PASS | PASS, PASS | PASS, PASS |
| Politique de sécurité (violations) | PASS (0) | PASS (0) | PASS (0) | PASS (0) |

¹ La certification du moteur reste FAIL, avec les mêmes trois blocages qu'au départ :
`ACCESSIBILITY_MANUAL_REVIEW` (les contrastes « à vérifier à la main »), `PERFORMANCE_LAB_LIGHTHOUSE` (statut mobile
PARTIAL) et `PROJECT_SPEC_FACTUAL_CONTEXT` (le moteur attend le cahier des charges d'un site vitrine). Ce cycle ne
visait pas cette certification et n'a rien modifié pour l'obtenir.

² Constats SEO inchangés : `LINK_NAV_BROKEN` (la navigation mobile contient des boutons, pas des liens),
`SEO_ROBOTS_TXT_MISSING`, `SEO_ORIGIN_UNKNOWN`, `CONTENT_INTENT_UNCLEAR`. Règles d'un site public indexé :
`NON APPLICABLE` à une application locale. Aucun lien artificiel, aucun `robots.txt` n'a été ajouté pour le score.

³ Faux négatifs connus depuis le cycle 1 : sur un fichier unique, le moteur ne lit pas la feuille de style contenue
dans la page (il cherche des fichiers `.css`) et déclare absentes des règles qui existent (focus visible, mouvement
réduit, taille des cibles, couleurs forcées). La vue à fichiers séparés le montre : score 90, un seul constat
restant (`A11Y_MOBILE_MENU_ESCAPE_MISSING`, lui-même un faux négatif d'expression régulière).

⁴ Les 5 scénarios PARTIAL le sont pour une seule raison : axe-core ne sait pas juger le contraste d'un texte posé
sur un dessin. La vérification a été faite par calcul (51 couples sur 51 conformes, texte ≥ 13,7:1) :
`04_ACCESSIBILITY_MARKERS.md`.

## Comparaison officielle du moteur (`compare`)

```text
fichier unique      : quality_before 70 → quality_after 70 (delta 0) · résolus : aucun · introduits : aucun · regression : false
fichiers séparés    : quality_before 77 → quality_after 77 (delta 0) · résolus : aucun · introduits : aucun · regression : false
```

**Lecture honnête : l'audit du moteur ne voit aucune différence entre avant et après.** Ses règles portent sur la
structure, l'accessibilité et la sécurité statiques, pas sur le temps d'exécution. Le travail de ce cycle n'apparaît
que dans la partie Lighthouse — et c'est normal. L'absence de régression, elle, est un résultat : 0 constat
introduit par un changement de 437 lignes ajoutées et 182 retirées dans les sources (15 fichiers).

## Lighthouse (`lighthouse --runs 3`, médiane)

| Profil | Mesure | Avant (série appariée) | Après | Version publique |
|---|---|---:|---:|---:|
| Mobile | Performance | 79 | **92** | 92 |
| | Accessibilité / Bonnes pratiques / SEO | 100 / 100 / 91 | 100 / 100 / 91 | 100 / 100 / 91 |
| | TBT | 426 ms | **62 ms** | 14 ms |
| | LCP | 3,04 s | 2,77 s | 2,72 s |
| | CLS | 0 | 0 | 0 |
| | Statut du moteur | PARTIAL | PARTIAL (LCP > 2,5 s) | PARTIAL |
| Ordinateur | Performance | 100 | 100 | 100 |
| | Accessibilité / Bonnes pratiques / SEO | 100 / 100 / 91 | 100 / 100 / 91 | 100 / 100 / 91 |
| | TBT | 14 ms | 0 ms | 0 ms |
| | LCP | 0,66 s | 0,65 s | 0,64 s |
| | Statut du moteur | PASS | PASS | PASS |

Passages individuels, mobile : performance 77 / 79 / 82 → 91 / 92 / 92 ; TBT 467 / 426 / 332 → 69 / 40 / 62 ms.
Détail, première série et lecture : `01_PERFORMANCE_ANALYSIS.md`.

Limites déclarées par le moteur : mesure de laboratoire sur un serveur local ; les Core Web Vitals de terrain et
l'INP sont `NON TESTÉ` ; les scores varient avec la charge de la machine.

## Ce qui n'a pas été modifié pour un score

| Tentation | Décision |
|---|---|
| Assouplir `connect-src 'none'` pour gagner 9 points de SEO Lighthouse | non |
| Remplacer les boutons de la navigation mobile par des liens pour `LINK_NAV_BROKEN` | non : ce sont des commandes, pas des pages |
| Ajouter `robots.txt`, une origine, un texte d'intention | non : application locale |
| Écrire `e.key==='Escape'` sans espaces pour satisfaire une expression régulière | non |
| Sortir le catalogue du fichier pour passer le LCP sous 2,5 s | non : le fichier unique est une fonction |

## Preuves

`evidence/creative-engine/` : `audit-{avant,apres}-fichier-unique.summary.json`,
`audit-{avant,apres}-fichiers-separes.summary.json`, `audit-public-fichier-unique.summary.json`,
`compare-avant-apres.json`, `compare-avant-apres-fichiers-separes.json`, `lighthouse.json`, `doctor.txt`.
