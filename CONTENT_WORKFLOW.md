# Flux de contenu — du carnet au blog

Le blog appartient au propriétaire du site et vit dans `content/` (fichiers JSON et photos, versionnés dans Git).
Aucun compte en ligne, aucune page du site et aucun visiteur ne peut l'écrire : il change seulement quand le propriétaire
modifie ces fichiers, reconstruit et redéploie.

```text
 Planner (personnel)          ordinateur du propriétaire                 site public
 ┌──────────────────┐  export  ┌───────────────────────────┐  build   ┌──────────────────────────┐
 │ Carnet           │────────▶ │ atlas-van-articles.json   │          │ dist/public/             │
 │  notes, photos   │          │  └─ import-articles.mjs ─▶ content/ │─────────▶│  seulement public + publié│
 └──────────────────┘          │      articles/*.json (brouillons) │          └──────────────────────────┘
                               │      media/carnet/*.jpg (nettoyées)│
                               └───────────────────────────┘
```

## 1. Écrire sur la route

Dans le **Planner personnel** (`node build.mjs --mode personal`, ou `index.html` ouvert depuis le disque) : rubrique
**Carnet**. Les notes et photos restent dans le navigateur (IndexedDB `atlasvan.journal.v1`). Une note cochée
« Inclure cet article dans le blog à partager » devient exportable. Les photos du carnet sont déjà réduites et
réenregistrées par le Planner (leurs métadonnées disparaissent à cette étape).

## 2. Exporter

Carnet › Blog à partager › **Fichier pour le site** → `atlas-van-articles.json` (format version 2).

- chaque article porte l'identifiant stable de sa note (`id`) ;
- un lieu de l'Atlas est repris par son identifiant ; un lieu personnel par son nom et une position **arrondie au
  dixième de degré** (environ 10 km) dès l'export : la position exacte d'une nuit ne quitte pas l'appareil ;
- le fichier ne publie rien : tout y est marqué `"private"` / `"draft"`.

Ce bouton n'existe que dans le Planner **personnel**. Le Planner public (celui des visiteurs) n'offre qu'un export pour
soi, « Créer le fichier du blog », qui n'est publié nulle part.

## 3. Importer

```sh
node build/import-articles.mjs ~/Téléchargements/atlas-van-articles.json --dry-run   # voir ce qui changerait
node build/import-articles.mjs ~/Téléchargements/atlas-van-articles.json
```

| Situation | Ce que fait l'import |
|---|---|
| Note jamais importée | crée `content/articles/<date>-<slug>.json`, **privé et en brouillon**, rattaché au voyage en cours si sa date tombe dans ses dates (ou au voyage donné par `--voyage <slug>`) |
| Note déjà importée, inchangée | rien (« déjà à jour ») — l'import est idempotent |
| Note modifiée dans le carnet, fichier jamais retouché | met à jour le brouillon ; garde `visibility`, `status`, `voyage`, `onMap`, `updatedAt` |
| Fichier retouché à la main depuis l'import | **ignoré** et signalé ; `--force` remplace les champs venus du carnet (les vôtres restent) |
| Article déjà publié | **ignoré** et signalé ; `--update-published` le met à jour et il reste publié (choix explicite) |
| Deux notes du même jour et du même titre | deux fichiers distincts (`…-2`), jamais d'écrasement |

Photos : type **réel** vérifié dans les premiers octets (JPEG, PNG, WebP ; SVG, GIF, HTML refusés, type annoncé faux
refusé), 8 Mo et 12 photos au plus par article, métadonnées retirées (EXIF dont GPS, XMP, IPTC, commentaires, textes
PNG), contrôle final « aucune position GPS », nom de fichier sûr et déterminé par le contenu
(`carnet/<slug>-<n>-<empreinte>.jpg`). Chaque photo sans texte alternatif est signalée.
Textes : caractères de contrôle retirés ; un texte qui contient du code (« <script ») est signalé — il sera de toute façon
affiché comme du texte. Chemins : tout reste sous `content/` (essai avec `../` dans `tests/import.mjs`).
Écriture : rien n'est écrit tant que tout le fichier n'est pas contrôlé ; chaque fichier est écrit à côté puis renommé.

## 4. Relire et publier

Dans chaque fichier importé : écrire le texte alternatif (`alt`) des photos, relire, puis passer
`"visibility": "public"` **et** `"status": "published"`. Rien d'autre ne publie.
Vérifier dans la version personnelle : `node build.mjs --mode personal` (étiquettes « Brouillon — privé »).

## 5. Le voyage en cours

`content/site.json` : `"currentVoyage": "<slug>"`. Les étapes affichées sur l'accueil et sur `/voyage-en-cours/` sont
les **récits publiés** de ce voyage qui sont situés (`placeId` ou `place`), dans l'ordre des dates. La « dernière étape
publiée » est celle du dernier récit publié : publier plus tard, c'est décaler ce que le site montre.
- masquer une étape : `"onMap": false` sur le récit (il reste publié, sans position) ;
- montrer des étapes prévues : `"planned": [ids]` **et** `"showPlanned": true` sur le voyage (pointillés, « indicatives ») ;
- distance : celle de `distanceKm`, sinon une estimation dite « estimée » ;
- aucune position « actuelle », aucune mise à jour automatique : le site ne sait que ce que vous publiez.

## 6. Construire et déployer

```sh
node build.mjs --mode public            # dist/public/ : seulement public + publié, contrôle de confidentialité
node build.mjs --mode public --check    # vérifie que dist/public/ correspond aux sources
```

`dist/personal/` (version personnelle, avec brouillons et lieux privés) ne se déploie **jamais** : `vercel.json` publie
`dist/public` seulement, et chaque page personnelle porte `noindex` et la mention « Version personnelle ».

## Démonstration

Le contenu de démonstration (`--demo`) n'est accepté que dans la version personnelle ; la construction publique le refuse.
Le dépôt ne contient aucun faux voyage présenté comme réel : sans contenu, le site public montre des états vides.
