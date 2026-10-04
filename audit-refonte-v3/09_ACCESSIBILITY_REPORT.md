# 09 — Accessibilité

Cible pratique : WCAG 2.2 AA, pour ce qui se teste. Ce rapport porte sur le site ; le Planner a été traité aux
cycles 1 et 2 (`audit-refonte/10`, `audit-refonte-v2/04`) et n'a pas changé d'interface.

## Audit automatisé final (Creative Engine 9.1.0 : Playwright, axe-core 4.13)

11 pages (accueil, dix rubriques dont le Planner) × 11 scénarios = 121 scénarios navigateur.

| Contrôle | Résultat |
|---|---|
| Scénarios | **80 PASS, 41 PARTIAL, 0 FAIL** |
| axe-core : violations | **0** (21 avant corrections, dont 16 sérieuses) |
| axe-core : « à vérifier à la main » | 50 scénarios : `aria-valid-attr-value` (30) et `color-contrast` (20) — voir ci-dessous |
| Clavier (ordre, focus visible, focus non masqué, aucun piège) | PASS |
| Menu mobile (état annoncé, ouverture, Échap, retour du focus, fermeture après un lien) | PASS |
| Lien d'évitement | PASS |
| Débordement à 320, 390, 820, 1440 et 1920 px | 0 |
| Cibles sous 24 px | 0 scénario |
| Zoom 200 %, texte 200 % | PASS |
| Mouvement réduit | PASS |
| Console, requêtes, politique de sécurité | 0 erreur, 0 échec, 0 violation |

Les 41 scénarios PARTIAL le sont pour deux raisons, toutes deux « à vérifier », aucune n'étant une violation :

- **`aria-valid-attr-value`** (petits écrans) : le bouton de menu porte `aria-controls="menu"`, et le menu est une
  fenêtre native fermée, donc absente de l'arbre d'accessibilité : axe ne peut pas vérifier la cible. L'attribut est
  juste, et c'est celui que le test de menu du moteur utilise.
- **`color-contrast`** : textes posés sur une carte dessinée (première page) ou sur la carte du Planner. Vérifiés
  par calcul, ci-dessous.

Lighthouse, accessibilité : **100** sur les 9 pages mesurées, mobile et ordinateur (`10`).

## Contrastes (calcul sur les couleurs réellement rendues)

`scripts/variant-metrics.mjs` lit les couleurs dans le navigateur et applique `contrastRatio` de Creative Engine.

| Couple | Rapport | Seuil |
|---|---:|---:|
| Plus faible contraste de texte du site (direction A) | **6,02** | 4,5 |
| 26 couples contrôlés (texte courant, chapeaux, navigation, boutons, étiquettes, bandeaux, pied de page, mises en garde, fil d'Ariane, première page) | 26 conformes | — |

Première page : le texte est posé sur un aplat (`#1a2c23`) ; un voile efface la carte sous le texte. Le calcul prend
l'aplat pour fond, ce qui est exact dans la zone du texte.

## Ce qui a été vérifié par les tests du projet (`tests/site.mjs`)

| Point | Contrôle | Statut |
|---|---|---|
| Clavier | premier arrêt : lien d'évitement ; puis les deux actions de la première page ; focus visible à chaque arrêt | PASS |
| Repères | un `header`, un `main`, un `footer` par page ; chaque `nav` nommée | PASS (16 pages) |
| Commandes nommées | aucun lien, bouton ou champ sans nom | PASS (16 pages) |
| Titres | un seul h1 ; aucun saut de niveau | PASS (toutes les pages) |
| Menu | plein écran, focus retenu, Échap, focus rendu au bouton, `aria-expanded` à jour | PASS |
| Images | `alt` présent sur chaque image ; cartes illustrées décoratives (`aria-hidden`) ou décrites (`role="img"` + libellé) | PASS |
| Graphique des saisons | décrit en texte (`aria-label` : un nombre par mois) | présent |
| Tableau | légende, en-têtes de colonne et de ligne, défilement accessible au clavier | PASS |
| Cibles | 44 px au minimum sous 1024 px, de 320 à 820 px | PASS |
| Zoom | 200 % sans défilement horizontal (3 pages) | PASS |
| Texte agrandi, mouvement réduit, couleurs forcées | rien n'est masqué, aucune animation | PASS |
| Sans JavaScript | contenu lisible, navigation par le pied de page | PASS |
| Langue et direction | `lang="fr"`, `dir="ltr"` | PASS |

## Texte alternatif

| Image | Règle |
|---|---|
| Carte illustrée dans une vignette | décorative : le titre de la carte dit déjà de quoi il s'agit |
| Grande carte d'une page de détail | décrite : « Carte : Italie et les 362 lieux de l'Atlas » |
| Photographie du propriétaire | texte fourni par lui dans le fichier de contenu ; vide si l'image est décorative |

Je n'ai écrit aucune description d'image réelle : il n'y a pas d'image réelle, et l'import depuis le Planner laisse
le champ `alt` vide, à remplir.

## Défauts trouvés et corrigés pendant ce cycle

Contraste pendant l'apparition (16 violations sérieuses), niveau de titre sauté, focus du champ de recherche, état du
menu après Échap, cibles de 25 et 43 px : détail dans `07`.

## Ce qui reste

| Point | Statut |
|---|---|
| Lecteurs d'écran (VoiceOver, TalkBack, NVDA) | NON TESTÉ |
| Appareil réel, plein jour | NON TESTÉ |
| Rendu en couleurs forcées sous Windows | NON TESTÉ — règle présente, émulation seulement |
| Lisibilité des cartes illustrées pour une personne malvoyante | elles sont décoratives ou doublées d'un texte ; non évaluée avec des utilisateurs |
| WCAG 2.2 AA dans son ensemble | **PARTIAL** : l'automatisé et le clavier sont propres ; la conformité complète demande un audit humain |
