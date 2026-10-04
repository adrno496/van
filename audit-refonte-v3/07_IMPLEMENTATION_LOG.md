# 07 — Journal de mise en œuvre (cycle 3)

Ordre suivi : baseline → analyse → modèle de contenu → trois directions → mesures → choix → pages → passerelles →
confidentialité → tests → audits → corrections → rapports. Après chaque lot : `node build.mjs --check` et les suites.

## Lot 0 — Baseline (`dd9ece5`)

Copies en lecture seule de la version finale du cycle 2, empreintes, cinq suites rejouées (77, 59, 10, 6, 36).
Analyse de la référence d'ambiance : principes et mesures seulement (`evidence/reference-analysis.md`) ; les deux
captures prises pour l'observer ont été supprimées.

## Lot 1 — Socle du site (`f0fcf00`)

- `build.mjs` devient une entrée en ligne de commande ; l'assemblage du Planner est déplacé **tel quel** dans
  `build/planner.mjs` ; `node build.mjs` et `node build.mjs --check` se comportent comme avant.
- `build/site.mjs` : données dérivées du catalogue (pays, itinéraires, saisons, distances), gabarit commun, pages,
  cartes illustrées, guides de l'Atlas, recherche, sitemap.
- `build/content.mjs` : modèle de contenu et validation.
- `src/site/css/` : socle + trois directions ; `src/site/js/site.js`.
- `content/` : mode d'emploi, `site.json`.

Vérifié avant de choisir l'architecture : une politique `'self'` avec feuille de style, script et images partagés
fonctionne en fichier local dans Chromium, Firefox et WebKit, liens relatifs compris.

## Lot 2 — Passerelles et Planner

- `src/js/shell.js` : `applyDeepLink()` (pays, lieu, parcours, recherche), validée contre le catalogue.
- `src/js/geo.js` : `slugOf()`, même règle que la construction.
- `src/index.template.html`, `src/css/layout.css` : la marque du Planner devient un lien dans le site.
- `src/data/checklist.js` : la liste « avant de partir » sort de `route.js` pour être partagée avec le guide.
- `src/js/journal.js` : export « Fichier pour le site » ; `build/import-articles.mjs`.

## Lot 3 — Trois directions, une retenue

Voir `04_CREATIVE_DIRECTIONS.md`. Direction A.

## Lot 4 — Corrections tirées des audits et des tests

L'audit Creative Engine des trois directions, puis les suites, ont fait ressortir des défauts de mon propre
travail. Tous corrigés :

| Constat | Source | Correction |
|---|---|---|
| Contraste insuffisant sur des textes « en cours d'apparition » (16 violations sérieuses) | axe-core, via Creative Engine | l'apparition au défilement ne joue plus sur l'opacité : glissement seul |
| Niveau de titre sauté sur la liste des destinations (h1 → h3) | axe-core et règle SEO du moteur | les cartes prennent le niveau h2 quand aucune section ne les précède |
| Focus non visible sur le champ de recherche | parcours clavier du moteur | l'anneau de focus est porté par le champ lui-même |
| État du menu en retard d'un instant après Échap | test de menu du moteur (échec intermittent) | l'état est mis à jour dès l'événement d'annulation |
| « Voir sur la carte » répété à chaque étape (31 pages) | règle de répétition du moteur | le nom du lieu devient le lien ; une phrase l'explique une fois |
| Étiquette « Dans l'Atlas » répétée sur 34 cartes | idem | dite une fois en tête de page ; seule « Raconté » reste sur les cartes |
| Titres de page sans rapport avec le titre du document (3 pages) | règle SEO du moteur | « Destinations », « Road trips », « Confidentialité » en h1 |
| Lien d'évitement et cible non reconnus ; direction du texte absente | règles statiques du moteur | `href="#main"`, `id="main"`, `dir="ltr"` — comme dans le Planner |
| Fil d'Ariane : cible de 43 px à 320 px | `tests/site.mjs` | 44 px |
| Marque du Planner devenue lien : cible de 25 px sur écran tactile | `tests/ui.mjs` sur `dist/public/app` | 44 px |
| « 1 lieux » sur la page Andorre ; descriptions trop courtes | `tests/site.mjs` | accord du pluriel ; description complétée par le début du texte |
| Durée « indicative » trompeuse sur les itinéraires | relecture | retirée (`01`) |
| Cartes illustrées rognées dans les grandes vignettes | captures | l'image n'est plus rognée ; le fond de carte déborde le cadre |
| Accueil de 150 Ko, listes de 280 Ko | mesure | un fond de carte par page : 55 à 70 Ko |

Constats du moteur **non suivis**, et pourquoi : `15_CREATIVE_ENGINE_FINAL.md`.

## Erreurs de ma part pendant le cycle

| Erreur | Conséquence | Rattrapage |
|---|---|---|
| Import circulaire entre `build.mjs` et `build/site.mjs` | la construction ne se terminait pas | bibliothèque séparée de l'entrée en ligne de commande |
| Commit du site alors qu'un contrôle sur 34 échouait encore (description courte) | un commit intermédiaire non vert | corrigé au commit suivant ; les preuves finales portent sur le dernier commit |
| Quatre attentes de test fausses (nombre de pages, attribut lu après modification, longueur mesurée sur du texte échappé, navigation attendue trop tôt) | 4 faux échecs | tests corrigés ; aucun n'a été affaibli |
| Première série finale lancée avant que la suite UI ait été rejouée sur le Planner du site | 7 échecs découverts en cours de série | série arrêtée, défaut corrigé, série relancée en entier |

## Comportements modifiés volontairement dans le Planner

| Avant | Après |
|---|---|
| La marque est un titre | dans le site : un lien vers l'accueil (inchangé dans le fichier autonome) |
| L'adresse ne porte aucune instruction | `#pays`, `#lieu`, `#parcours`, `#q` ouvrent le Planner au bon endroit |
| « Blog à partager » : un bouton | deux : le blog, et le fichier pour le site |

Rien d'autre. Comparaison pixel à pixel de 20 écrans du Planner avec ceux du cycle 2 : 0 % de pixels différents.

## Fichiers

**Créés** : `build/{planner,site,content,import-articles}.mjs`, `src/site/css/{site,direction-a,direction-b,direction-c}.css`,
`src/site/js/site.js`, `src/data/checklist.js`, `content/{README.md,site.json}`, `tests/{site,site-shots}.mjs`,
`tests/fixtures/content/**`, `tests/fixtures/content-demo/**`, `audit-refonte-v3/**`.

**Modifiés** : `build.mjs`, `README.md`, `.gitignore`, `src/index.template.html`, `src/css/layout.css`,
`src/js/{geo,shell,boot,route,journal}.js`, `tests/v2.mjs` (emplacement du Planner public), `index.html` (assemblé).

**Supprimé** : aucun. `src/data/places.js` est inchangé à l'octet près.

**Dépendances ajoutées** : aucune.
