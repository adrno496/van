# 04 — Accessibilité de la carte : formes et contrastes

## Le défaut

À la fin du cycle 1, les 1 600 lieux étaient des disques qui ne différaient que par la couleur. Pour une personne
qui distingue mal les couleurs (environ 8 % des hommes), « ville », « nature » et « patrimoine » se confondaient
sur la carte comme dans la légende. C'est le critère WCAG 1.4.1 (la couleur n'est pas le seul moyen de
transmettre une information).

## Ce qui a été fait

Une forme par catégorie, sur la carte **et** dans chaque pastille de l'interface (légende de la carte, filtres,
liste des lieux, fiche, étapes du trajet, résultats de recherche, « près de moi »).

| Catégorie | Forme | Lieux |
|---|---|---:|
| Ville | disque | 418 |
| Patrimoine | losange | 546 |
| Nature | triangle, pointe en haut | 522 |
| Côte | triangle, pointe en bas | 36 |
| Boulot saisonnier | carré | 50 |
| Pratique | croix | 23 |
| Base | étoile (avec son halo) | 5 |
| Lieu personnel | anneau | selon l'utilisateur |

- Les couleurs sont conservées : la forme s'ajoute à la couleur, elle ne la remplace pas.
- Les tailles suivent les mêmes règles qu'avant (importance du lieu, niveau de zoom, lieu choisi, étape du trajet).
- Les formes sont dessinées pour une surface voisine de celle du disque : aucune catégorie ne « pèse » plus qu'une autre.
- La carte reste hors de l'arbre d'accessibilité (`aria-hidden`) : son équivalent pour un lecteur d'écran est la liste
  de la rubrique Explorer, où chaque lieu porte sa catégorie **en toutes lettres** (« Patrimoine · Italie »).

Captures : `screenshots/final/desktop-1440x900__01-carte.png` (carte et légende),
`screenshots/final/mobile-390x844__01-carte.png`.

## Vérifications

| Contrôle | Résultat | Preuve |
|---|---|---|
| Un seul tracé par catégorie, huit tracés tous différents | PASS | `tests/v2.mjs` › marqueurs |
| Huit pastilles de légende différentes par la forme (style calculé par le navigateur) | PASS | idem |
| La forme et le halo suivent la catégorie quand une fiche est modifiée | PASS | idem |
| Contour constant de 1,2 px à l'écran, en vue d'ensemble comme en vue rapprochée | PASS | idem |
| Mode « couleurs forcées » (contraste élevé de Windows) : les pastilles gardent leur couleur (`forced-color-adjust: none`) et leur forme | PARTIAL — règle présente, rendu non vérifié sous Windows | `src/css/base.css` |
| Lisibilité des formes à petite taille (lieux secondaires en vue d'ensemble sur téléphone : environ 3 px de rayon) | PARTIAL — jugée sur captures ; à cette taille losange et disque se distinguent mal, la forme redevient nette dès qu'on zoome | captures mobiles |
| Perception réelle par une personne daltonienne | NON TESTÉ | demande un essai avec des utilisateurs ou un simulateur validé |

## Contrastes sur la carte

axe-core classe tous les textes posés sur la carte en « à vérifier à la main » (71 à 270 éléments selon la largeur
d'écran), parce qu'ils sont superposés à un dessin : il ne sait pas quel fond retenir. Cette vérification a été
faite par calcul : `scripts/map-contrast.mjs`, avec la fonction `contrastRatio` de Creative Engine, sur les quatre
fonds possibles (pays couvert, autre pays, mer, liseré clair) → `evidence/map-contrast.json`.

| Élément | Seuil | Plus faible contraste mesuré | Statut |
|---|---:|---:|---|
| Nom d'un lieu (texte `#1b1913`, entouré d'un liseré clair) | 4,5 | **13,74** (sur la mer) | PASS |
| Nom de pays (repère en capitales, décoratif) | 3 | 3,3 et plus | PASS |
| Marqueurs, 8 catégories × 4 fonds | 3 | **3,07** | PASS après correction |
| Tracé du trajet, fil du carnet, position | 3 | supérieur à 3 sur les 4 fonds | PASS |
| Contour d'un lieu choisi ou survolé | 3 | 16 environ | PASS |
| **Total** | | 51 couples sur 51 | PASS |

Correction : avant ce cycle, deux couleurs étaient sous le seuil sur les pays non couverts et sur la mer —
patrimoine `#b0811d` (2,74 et 2,77) et côte `#2e8fa8` (2,93 et 2,97). Elles ont été assombries du strict
nécessaire : `#a5791b` (−6 %) et `#2d8ba3` (−3 %). Les 29 couples de couleurs de l'interface restent conformes
(plus faible contraste de texte : 5,42, inchangé).

Limite du calcul : il compare des couleurs pleines. Il ne dit rien d'un nom qui chevauche un trait de côte ou un
autre nom ; le liseré clair autour de chaque nom est là pour cela, et l'algorithme de placement évite les
chevauchements entre noms.

## Audit automatisé

Résultats axe-core de l'audit Creative Engine final : voir `09_CREATIVE_ENGINE_FINAL.md` (violations, éléments
« à vérifier », clavier, cibles tactiles, zoom et texte à 200 %, mouvement réduit).

## Ce qui reste

| Point | Statut |
|---|---|
| Lecteurs d'écran (VoiceOver, TalkBack, NVDA) | NON TESTÉ |
| Essai avec des personnes daltoniennes | NON TESTÉ |
| Lisibilité en plein soleil | NON TESTÉ — appareil réel absent |
| Rendu en couleurs forcées sous Windows | NON TESTÉ |
| Navigation au clavier lieu par lieu **sur la carte** | non proposée (comme au cycle 1) : la liste Explorer en tient lieu |
