# 04 — Constats UI/UX et priorités

Sources : captures de la baseline (80), mesures `tests/ui.mjs`, audit Creative Engine, lecture complète du code.
Chaque constat indique ce qui a été fait. Priorités : P0 indispensable, P1 forte valeur, P2 amélioration, P3 optionnel.

## Architecture de l'information

| # | Constat sur la baseline | Preuve | Priorité | Traitement |
|---|---|---|---|---|
| A1 | Aucun onglet actif à l'ouverture : le panneau montre « Explorer », mais les onglets sont Trajet / Idées / Carnet. On ne sait pas où l'on est. | capture `desktop-1440x900__01-carte` | P1 | Cinq rubriques explicites : Explorer · Trajet · Idées · Carnet · Plus. Il y a toujours une rubrique active. |
| A2 | Guide pratique (fiches pays, checklist, conseils) et sauvegardes enfouis dans Paramètres › « Sauvegardes, options et aide ». | lecture du code | P1 | Rubrique **Plus** : Mes données, Réglages, Guide pratique, À propos. Les paramètres ne gardent que discrétion et localisation. |
| A3 | Actions rares en permanence dans l'en-tête : « Point perso », « Clic = ajouter », « Vue d'ensemble ». | capture | P1 | Regroupées dans le menu « ⋯ » de la carte ; « Ajouter mon lieu » aussi dans Explorer. |
| A4 | Dans « Mon trajet », la liste des étapes — le contenu principal — arrive après une quinzaine de boutons. | capture `…__04-trajet` | P1 | Ordre : chiffres clés, ajout d'étape, outils, **étapes**, puis trois sections repliées (budget, navigation, enregistrer/exporter). |
| A5 | Deux fonctions font la même chose : « Zoomer » et « Voir sur la carte » ; « Chercher des lieux » et la liste Explorer ; « Parcours prêts à partir » et l'onglet Idées. | code (`$('#zoomBtn').onclick=$('#locatePlace').onclick`) | P2 | Un seul bouton par action. Trois raccourcis redondants retirés (liste dans `06`). |
| A6 | Vocabulaire flottant : « parcours » et « trajet » pour la même chose (« Ajouter au parcours », « Mon trajet », « Voir mon parcours »). | captures | P2 | **Trajet** = ce que je compose. **Parcours** = un circuit nommé, proposé ou enregistré. |

## Carte

| # | Constat | Preuve | Priorité | Traitement |
|---|---|---|---|---|
| C1 | Carte saturée en vue d'ensemble : 1 600 marqueurs de 7 à 10 px, noms qui se recouvrent. | captures | P1 | Marqueurs réduits en vue d'ensemble (jusqu'à moitié), noms par ordre d'importance : seuls les incontournables en vue large, les autres en zoomant. |
| C2 | Les couleurs des catégories ne sont expliquées nulle part sur la carte. | capture | P1 | Pastilles de catégorie sur la carte (grand écran) : légende et filtre en un geste. Sur petit écran, elles sont dans « Filtres ». |
| C3 | « Tous les noms » ne change rien (la limite de priorité est déjà atteinte par défaut). | code (`lim=allLabels?7:4`, priorité maximale 4) | P2 | Le réglage affiche désormais réellement tous les noms. |
| C4 | Sur mobile, toucher un lieu fait disparaître la carte au profit de la fiche. | parcours manuel | P1 | **Aperçu** en bas de carte : nom, résumé, « Ajouter au trajet », « Voir la fiche ». La carte reste visible. |
| C5 | Les numéros d'étape sortent de leur pastille dès qu'on zoome (décalage vertical fixe). | capture zoomée | P2 | Centrage indépendant du zoom. |
| C6 | Contours et anneaux des marqueurs grossissent démesurément en zoom rapproché (épaisseur en unités de carte). | code CSS | P2 | Épaisseurs constantes à l'écran. |
| C7 | Aucun moyen de déplacer la carte au clavier. | test | P2 | Flèches quand la carte a le focus ; `+`, `−`, `0` conservés. |
| C8 | Aucun retour quand un mode de saisie est actif (poser un point, ajout rapide). | parcours | P2 | Bandeau sur la carte avec « Arrêter ». |

## Hiérarchie et composants

| # | Constat | Preuve | Priorité | Traitement |
|---|---|---|---|---|
| H1 | Deux boutons principaux concurrents sur la fiche (« Ajouter au parcours », « Raconter cette étape »), six boutons de même poids. | capture `…__02-fiche-lieu` | P1 | Une action principale ; deux secondaires ; trois discrètes. |
| H2 | Le bouton « Ajouter au parcours » ne change pas après l'ajout. | parcours | P1 | Le bouton devient « Retirer du trajet » et suit l'état réel (fiche et aperçu). |
| H3 | Champs natifs non stylés dans « Mon trajet » (22 à 24 px de haut). | `ui-baseline.json` | P1 | Un seul style de champ, 44 px. |
| H4 | 12 à 14 tailles de texte selon l'écran, 47 couleurs. | `ui-baseline.json`, `code-metrics.json` | P1 | 7 tailles, 64 jetons. |
| H5 | Dialogues `prompt` / `confirm` / `alert` du navigateur pour nommer un parcours, déplacer une étape, confirmer. | semgrep : 9 | P2 | Dialogues de l'application, avec libellés, validation et Échap. |
| H6 | Suppression d'un lieu personnel sans confirmation. | code | P1 | Confirmation. |
| H7 | « Chercher le long du parcours » ouvre jusqu'à 6 fenêtres d'un coup : les navigateurs bloquent les suivantes. | code (`window.open` en boucle) | P1 | Une liste de liens, un par étape, pour toutes les étapes. |
| H8 | Messages affichés 1,7 s quelle que soit leur longueur. | code | P2 | Durée proportionnelle au texte (1,8 à 7 s). |
| H9 | Symboles disparates (`⌖ ◇ ↝ ▤ ☰ ⚙ ☷ ◎ ⤢ ✎ ↕`). | captures | P2 | 32 icônes SVG au trait, un seul style, incluses dans le fichier. |

## Mobile et tablette

| # | Constat | Preuve | Priorité | Traitement |
|---|---|---|---|---|
| M1 | À 768 px, le champ de recherche fait **26 px de large**. | `ui-baseline.json` | P0 | Disposition mobile jusqu'à 859 px ; recherche pleine largeur. |
| M2 | En-tête de 119 px sur téléphone ; la carte occupe 67 % de l'écran à 320 px. | mesures | P1 | En-tête de 61 px ; carte à 78 % (320 px), 86 % (390 px), 88 % (768 px). |
| M3 | 3 à 9 commandes sous 44 px, dont des champs de 22 px. | mesures | P1 | 0 sous 44 px sur écran tactile, 0 sous 24 px partout. |
| M4 | « Point perso » et « Clic = ajouter » inaccessibles ou presque sur mobile. | CSS (`display:none`) | P1 | Menu « ⋯ » de la carte, toutes largeurs. |
| M5 | Champs sous 16 px : zoom automatique d'iOS à la saisie. | mesures | P2 | Tous les champs à 16 px. |

## États

| État | Baseline | Après |
|---|---|---|
| Trajet vide | « Parcours vide. » | explication + bouton vers les idées |
| Aucun lieu avec ces filtres | texte | texte + « Tout afficher » |
| Carnet vide | deux boutons principaux identiques | un seul appel à l'action |
| Enregistrement impossible | **silencieux** | message d'erreur visible |
| Données illisibles au démarrage | **application bloquée** | démarrage, données mises de côté et téléchargeables |
| Import invalide | `alert` | message précis, rien n'est modifié |
| Localisation refusée / indisponible / délai | messages distincts (conservés) | idem, affichés plus longtemps |
| Navigateur trop ancien | erreurs | message explicite |

## Non traité

| Constat | Raison |
|---|---|
| Marqueurs distingués par la seule couleur | une forme par catégorie est illisible à 3–5 px ; la catégorie est écrite dans l'infobulle, l'aperçu, la fiche et la liste. Reste une limite. |
| Mode sombre | non demandé ; doublerait la recette visuelle. Proposé en P3. |
| Bouton « retour » du téléphone | fermerait l'application au lieu de revenir à la carte. Proposé en P2. |
