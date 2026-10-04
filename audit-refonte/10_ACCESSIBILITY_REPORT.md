# 10 — Accessibilité

Cible : bonnes pratiques compatibles WCAG 2.2 AA. **La conformité WCAG AA n'est pas déclarée** : elle demande
une revue manuelle avec technologies d'assistance, qui n'a pas eu lieu.

## Résultats automatisés

| Contrôle | Outil | Avant | Après | Statut |
|---|---|---|---|---|
| Violations axe-core (5 largeurs) | Creative Engine + axe 4.13 | 18, dont 3 critiques ou sérieuses | **0** | PASS |
| Score d'accessibilité Lighthouse | Lighthouse 13.5 | 98 mobile, 92 ordinateur | **100 / 100** | PASS |
| Champs sans nom | `tests/e2e.mjs` | 12 | 0 | PASS |
| Champs sans nom (moteur) | Creative Engine | — | 0 | PASS |
| Commandes inaccessibles au clavier | Creative Engine | 10 | 0 | PASS |
| Lien d'évitement | Creative Engine, `tests/ui.mjs` | absent | présent, visible au focus, mène au contenu | PASS |
| Titre de niveau 1, zone principale, langue, direction | `tests/ui.mjs` | aucun `h1`, aucun `main` | 1 / 1 / `fr` / `ltr` | PASS |
| Hiérarchie des titres | Creative Engine | sauts de niveau | aucun | PASS |
| Cibles sous 24 × 24 px (9 largeurs, 9 écrans) | `tests/ui.mjs` | jusqu'à 2 | 0 | PASS |
| Cibles sous 44 px sur écran tactile | `tests/ui.mjs` | 3 à 9 | 0 | PASS |
| Zoom du navigateur à 200 % | Creative Engine, `tests/ui.mjs` | FAIL | sans défilement horizontal | PASS |
| Texte agrandi à 200 % | Creative Engine | FAIL | PASS | PASS |
| Mouvement réduit | Creative Engine, `tests/ui.mjs` | FAIL | transitions neutralisées | PASS |
| Débordement horizontal | les deux | 3 scénarios | 0 | PASS |
| Texte ≥ 12 px, champs ≥ 16 px | `tests/ui.mjs` | 2 champs sous 16 px | conforme | PASS |
| Contraste des jetons (29 couples) | `contrastRatio` du moteur | non mesuré | 29 / 29, minimum 5,42 pour le texte | PASS |
| Contraste des textes posés sur la carte | axe-core | « à vérifier » | « à vérifier » (71 à 270 éléments) | **PARTIAL** ¹ |

¹ axe ne sait pas calculer le contraste d'un texte superposé à un dessin. Les noms de lieux sont en `#1b1913` avec
un liseré clair, sur des fonds `#f6f1e6` / `#e9e3d6` / `#dde7e6` : le calcul sur l'aplat le plus clair donne 15,6:1, mais
un nom peut recouvrir un marqueur coloré. Les noms de pays (`#857a68`, repères décoratifs) sont à
3,7:1 sur le fond le plus clair. Non vérifié à l'œil sur l'ensemble de la carte.

## Clavier (testé)

| Parcours | Résultat |
|---|---|
| Premier arrêt : lien d'évitement ; Entrée amène au contenu | PASS |
| Recherche : flèche bas, Entrée, Échap | PASS |
| Onglets : Tab, flèches, Début, Fin ; `aria-selected` à jour | PASS |
| Carte : flèches pour déplacer, `+` `−` `0` pour zoomer | PASS |
| Dialogues : focus à l'intérieur, page inerte derrière, Échap, retour du focus au bouton | PASS |
| Menu d'outils : ouverture, `aria-expanded`, Échap, retour du focus | PASS |
| Parcours prêts chargés au clavier | PASS |
| Bascules : `aria-pressed` sur les filtres, catégories synchronisées | PASS |
| Focus visible (anneau de 3 px, contraste 6,5:1) | PASS |
| Annuler : Ctrl+Z, Ctrl+Maj+Z | PASS |

## Ce qui a été fait

- Structure : `header`, `main`, `aside`, `nav`, un `h1`, titres sans saut ; langue et direction déclarées.
- Onglets `tablist` / `tab` / `tabpanel` ; recherche `combobox` + `listbox` ; dialogues natifs nommés.
- Chaque champ a un libellé relié ; les boutons à icône ont un nom ; les icônes sont masquées aux lecteurs d'écran.
- États annoncés : `aria-pressed`, `aria-selected`, `aria-expanded`, `aria-current` ; zones `role="status"` pour
  les compteurs et les messages ; `role="alert"` pour les erreurs de formulaire.
- Les 1 600 marqueurs ne sont plus exposés un par un : la carte est décrite, et la **liste Explorer** en est
  l'équivalent accessible (recherche, filtres, ouverture de fiche, ajout au trajet).
- Cibles : 44 px sur tout écran tactile ou étroit (`pointer: coarse`), 36 à 40 px à la souris.
- `prefers-reduced-motion`, `forced-colors`, zoom 200 %, texte 200 %.
- Rubriques floutées rendues inertes (non atteignables au clavier tant qu'elles sont masquées).

## Limites connues

| Limite | Statut |
|---|---|
| Lecteurs d'écran réels | NON TESTÉ |
| Les marqueurs se distinguent par la couleur seule ; la catégorie est écrite ailleurs (infobulle, aperçu, fiche, liste, pastilles) | PARTIAL |
| La carte se parcourt au clavier (déplacer, zoomer) mais on ne choisit pas un marqueur au clavier : il faut passer par la recherche ou la liste | PARTIAL, par conception |
| Glisser-déposer des étapes : souris seulement ; boutons équivalents pour le clavier et le toucher | PASS par l'alternative |
| Règle du moteur `A11Y_MOBILE_MENU_ESCAPE_MISSING` | faux négatif (voir `03`) |
| Contraste en plein soleil | NON TESTÉ |
