# Atlas van

Deux choses, une même identité :

- **Atlas Planner** — carte de 3 400 lieux dans 34 pays d'Europe, préparation de trajets en van, budget, carnet de voyage avec
  photos. Il tient dans **un seul fichier `index.html`** : il s'ouvre par un double-clic, fonctionne sans connexion et
  n'envoie rien. Toutes les données restent dans le navigateur de l'appareil.
- **Le site éditorial** — accueil, destinations, road trips, voyages, carnet, guides, à propos : des pages statiques
  produites à partir du catalogue et de `content/`, avec le Planner derrière le bouton « Préparer mon voyage ».

## Utiliser

Ouvrir `index.html` dans un navigateur récent (Chrome, Edge, Firefox, Safari). Rien à installer.

## Modifier

`index.html` est **assemblé** à partir de `src/`. Ne pas le modifier à la main : modifier les sources, puis
reconstruire.

```bash
node build.mjs                    # assemble src/ → index.html : le Planner seul, tout le catalogue
node build.mjs --check            # vérifie que index.html correspond aux sources
node build.mjs --mode personal    # → dist/personal/ : site + Planner, tout votre contenu (pages non indexables)
node build.mjs --mode public      # → dist/public/ : site + Planner, sans rien de personnel
node build.mjs --mode public --check
```

Options du site : `--direction a|b|c` (direction visuelle, `a` par défaut), `--site-url https://…` (liens canoniques,
`sitemap.xml`, `robots.txt`), `--content <dossier>`, `--demo` (contenu de démonstration, version personnelle seulement).

Node 22 ou plus récent suffit. Le projet n'a aucune dépendance.

```text
index.html                 fichier livré (assemblé)
build.mjs                  entrée en ligne de commande
build/planner.mjs          assemblage du Planner + politique de sécurité (empreintes SHA-256) + contrôle de confidentialité
build/site.mjs             pages du site éditorial, cartes illustrées
build/content.mjs          lecture et validation de content/
build/import-articles.mjs  articles exportés du Planner → content/
content/                   votre contenu : voyages, récits, guides, photographies (mode d'emploi : content/README.md)
src/
  site/css/site.css        socle du site ; direction-a.css, -b.css, -c.css : trois directions visuelles
  site/js/site.js          menu, apparition au défilement, recherche
  index.template.html      structure de la page, icônes, dialogues
  css/tokens.css           jetons de design : couleurs, tailles, rayons, polices
  css/base.css             remise à zéro, texte, focus, accessibilité
  css/layout.css           en-tête, carte, panneau, navigation mobile
  css/components.css       boutons, pastilles, champs, dialogues, messages
  css/map.css              carte, lieux, tracés, commandes superposées
  css/panes.css            rubriques Explorer, Trajet, Idées, Plus
  css/journal.css          carnet de voyage
  js/util.js               DOM, échappement, messages, dialogues, fichiers
  js/data.js               lecture du catalogue livré en JSON dans la page
  js/geo.js                projection, distances, saisons, dates (fonctions pures)
  js/state.js              état du voyage : lecture contrôlée, enregistrement
  js/map.js                dessin de la carte, vue, zoom, gestes, sélection
  js/places.js             fiche d'un lieu, aperçu mobile, modification, lieux personnels
  js/route.js              trajet, calculs, exports, imports, parcours prêts
  js/explore.js            filtres, liste des lieux, recherche
  js/journal.js            carnet (IndexedDB), photos, blog à partager, sauvegardes
  js/location.js           localisation et « Près de moi »
  js/shell.js              rubriques, vue mobile, bouton « retour » du téléphone, discrétion, dialogues permanents
  js/boot.js               démarrage, en étapes courtes
  data/places.js           contours des pays, parcours prêts, fiches pays (source ; jamais livré tel quel)
  data/lieux/<pays>.json   les lieux, un fichier par pays, une fiche par ligne (réunis et triés par identifiant au build)
scripts/places/            pipeline du catalogue : références, enrichissement, contrôles, couverture, parcours (voir data-sources/README.md)
data-sources/              candidats, revue de chaque candidat, références GeoNames/UNESCO/Natural Earth, quotas, identifiants attribués
tests/                     tests navigateur (Playwright)
audit-refonte/             cycle 1 — refonte : audit, preuves, captures, rapports
audit-refonte-v2/          cycle 2 — performance mobile, carte, version publique : rapports, preuves, scripts de mesure
audit-refonte-v3/          cycle 3 — site éditorial : rapports, preuves, captures ; CONTENT_NEEDED.md liste le contenu à fournir
audit-places-v4/           cycle 4 — catalogue doublé pays par pays (lot v10) : méthode, sources, contrôles, couverture, performances, tests
dist/                      versions construites (non suivies par Git : elles se reconstruisent)
```

À la construction, le catalogue est transformé : les fichiers de `src/data/lieux/` sont réunis en un seul tableau
`DATA.lieux` (trié par identifiant, format inchangé), les contours des pays sont projetés et écrits directement dans
la carte (SVG), le reste est livré en JSON. Le navigateur n'a ainsi ni JavaScript de données à compiler, ni
33 000 points à projeter au démarrage.

### Ajouter des lieux au catalogue

Méthode, format d'un candidat, contrôles et sources : `data-sources/README.md`. En bref :

```bash
node scripts/places/enrich.mjs --batch v10 --explain   # candidats → contrôles → doublons → score → fiches
node scripts/places/validate.mjs --batch v10           # quotas pays par pays, identifiants, coordonnées, provenance, public
node scripts/places/report.mjs --batch v10             # couverture avant / après
node scripts/places/parcours.mjs                       # idées de parcours définies dans data-sources/parcours-v10.json
```

Les scripts sont concaténés dans l'ordre listé dans `build.mjs` et partagent un même espace de noms
(scripts classiques, mode strict). Chaque fonction n'est définie qu'une fois.

### Changer le thème

Tout le visuel dépend de `src/css/tokens.css`. Deux autres jeux de jetons, étudiés pendant la refonte, sont
conservés dans `audit-refonte/variants/` :

```bash
node build.mjs --tokens audit-refonte/variants/tokens-B.css --out essai-B.html
```

### Version publique, sans rien de personnel

```bash
node build.mjs --mode public            # dist/public/ — 3 395 lieux, contenu public seulement
node build.mjs --mode public --out f.html   # le Planner public seul, en un fichier
```

Ce qui est retiré, et comment :

- **Catalogue** : les cinq « bases » (logements de proches, catégorie `base`) et leurs étapes dans les itinéraires.
- **Contenu** : tout ce qui n'est pas à la fois `"visibility": "public"` et `"status": "published"` — brouillons,
  notes privées, sections privées de « à propos », contenu de démonstration, et leurs images.
- **Emplacements « à compléter »** : visibles en version personnelle seulement.

La construction **échoue**, sans rien écrire, si un texte d'une fiche personnelle ou d'un contenu privé, une
expression familiale (« chez ma… », « grands-parents », « marraine », « port d'attache »), un chemin local, une clé
de service ou une sauvegarde se retrouve dans un fichier produit (règles : `PERSONAL` dans `build/planner.mjs`,
`privateStrings` dans `build/content.mjs`).

Ne publier que le contenu de `dist/public/`. Le dépôt, `index.html`, `dist/personal/`, `src/data/places.js` et les
dossiers d'audit contiennent le catalogue personnel.

À savoir : vos trajets, notes et carnet ne sont jamais dans les fichiers ; ils vivent dans le navigateur. Ouverte
**sur le même appareil et dans le même navigateur** que la version personnelle, la version publique lit les mêmes
données ; les étapes qui pointent vers une base y sont ignorées (l'état d'origine est mis de côté, voir « Mes
données »). Pour l'essayer, préférer une fenêtre privée ou un autre navigateur.

### Hébergement

`vercel.json` fait construire `dist/public` par l'hébergeur (`node build.mjs --mode public`) et ne sert que ce
dossier : le site éditorial à la racine, le Planner public dans `/app/`. Un `git push` sur `main` met donc en ligne.
Si le contrôle de confidentialité échoue, le déploiement échoue. L'adresse du site est dans `content/site.json`
(`siteUrl`).

### Publier un récit du carnet

```text
Planner › Carnet › Blog à partager › « Fichier pour le site »   → atlas-van-articles.json
node build/import-articles.mjs atlas-van-articles.json          → content/articles/, content/media/carnet/
```

Tout arrive privé et en brouillon. Pour publier un article : ouvrir son fichier, écrire le texte alternatif des
images, passer `visibility` à `"public"` et `status` à `"published"`, reconstruire.

### Liens vers le Planner

`app/index.html#pays=italie`, `#lieu=31`, `#parcours=balkans-en-six-semaines`, `#q=lac`. Chaque valeur est comparée
à ce que le Planner connaît ; une valeur inconnue est ignorée. Un parcours demandé alors qu'un trajet existe est
proposé, jamais imposé.

### Héberger sur un serveur web (facultatif)

```bash
node build.mjs --split site/                 # site/index.html + site/assets/{app.css,app.js,places.js}
node build.mjs --split site/ --mode public   # la même, sans les lieux personnels
```

Cette variante se met mieux en cache mais ne s'ouvre pas par double-clic.

## Données et formats (inchangés)

| Donnée | Emplacement | Clé |
|---|---|---|
| Trajet, notes, statuts, fiches modifiées, lieux personnels, parcours enregistrés, réglages | `localStorage` | `atlasvan.v3` |
| Carnet et photos | IndexedDB `atlasvan.journal.v1`, magasin `state` | `meta`, `post:<id>` |
| Rubriques floutées | `localStorage` | `atlasvan.privacy` |
| Réactivation de la localisation | `localStorage` | `atlasvan.location.enabled` |
| Données illisibles mises de côté au démarrage | `localStorage` | `atlasvan.v3.recovery` |

La position GPS n'est jamais enregistrée. Les sauvegardes sont des fichiers `.json` (version 5 : tout ;
version 3 : sans le carnet).

## Tester

Les tests pilotent un vrai navigateur. Playwright n'est pas installé dans ce projet : il est pris dans
`CREATIVE_ENGINE_V9` (chemin modifiable avec `PLAYWRIGHT_FROM=<dossier contenant node_modules/playwright>`).

```bash
node tests/e2e.mjs         # 77 tests : explorer, trajet, carnet, sauvegardes, localisation, mobile, sécurité
node tests/ui.mjs          # mise en page à 8 largeurs, clavier, parcours tactiles
node tests/migration.mjs   # les données de l'ancienne version sont relues à l'identique
node tests/smoke.mjs       # Chromium, Firefox, WebKit ; par serveur et en fichier local
node tests/v2.mjs          # 36 contrôles : formes des marqueurs, bouton « retour », sécurité étendue, endurance, Planner public
node tests/site.mjs        # 34 contrôles : pages du site, passerelles vers le Planner, public / privé, sécurité, images, accessibilité
node tests/catalogue.mjs   # catalogue enrichi : quotas, données, construction, recherche, filtres pays, pays entier, liens, lisibilité
node tests/perf.mjs        # temps de démarrage et d'interaction
node tests/profile.mjs     # démarrage phase par phase, coût de chaque interaction, taille de la page
node tests/screenshots.mjs <dossier>
```

Ajouter `--dir <dossier>` pour tester une autre version (par exemple la référence d'avant refonte). Les rapports
vont dans `test-results/` (non suivi) sauf si `--out` est donné. Version publique :

```bash
node tests/smoke.mjs --file dist/public/app/index.html
node tests/ui.mjs --dir dist/public/app
node tests/e2e.mjs --dir dist/public/app --catalogue public
node tests/site-shots.mjs <dossier> --dir dist/public      # captures du site
```

`tests/site.mjs` construit lui-même le site dans un dossier temporaire, avec un contenu de test
(`tests/fixtures/content`) ; `content/` n'est pas touché.

Mesures comparées, en alternance pour neutraliser la charge de la machine :

```bash
node audit-refonte-v2/scripts/ab-boot.mjs --variants avant=<dossier>,apres=.
node audit-refonte-v2/scripts/ab-gestures.mjs --variants avant=<dossier>,apres=.
```

## Historique et retour en arrière

Le projet a son propre dépôt Git (`git log` dans ce dossier) : chaque lot d'optimisation est un commit, annulable
par `git revert <commit>`. `audit-refonte-v2/baseline/index.v1-final.html` est la version livrée à la fin du
cycle 1.

## Revenir à la version d'avant refonte

`audit-refonte/baseline/index.baseline.html` est la copie exacte du fichier d'origine (empreinte dans
`SHA256.txt`). Les formats de données n'ayant pas changé, on peut la rouvrir sans rien perdre.
