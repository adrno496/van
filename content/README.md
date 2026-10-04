# Contenu du site Atlas Van

Ce dossier contient ce que **vous** écrivez : voyages, récits, guides, photographies, présentation.
Le reste du site (destinations, road trips, guides de l'Atlas) est produit à partir du catalogue.

```text
content/
  site.json            nom, descripteur, adresse du site, « à propos », mentions, réseaux
  voyages/*.json       un fichier par voyage réellement parcouru
  articles/*.json      un fichier par récit du carnet
  guides/*.json        vos propres guides
  media/               photographies (jpg, png, webp)
```

## Public ou privé : c'est écrit dans chaque fichier

| Champ | Valeurs | Par défaut |
|---|---|---|
| `visibility` | `"private"` ou `"public"` | `"private"` |
| `status` | `"draft"` ou `"published"` | `"draft"` |

Un contenu ne paraît dans la version publique (`node build.mjs --mode public`) que s'il est **à la fois**
`"public"` et `"published"`. Tout le reste n'existe que dans la version personnelle, avec une étiquette « Privé »
ou « Brouillon ». La construction publique s'arrête si un texte privé se retrouve dans une page.

## Un voyage — `voyages/portugal-2026.json`

```json
{
  "slug": "portugal-2026",
  "title": "…",
  "summary": "…",
  "countries": ["Portugal"],
  "dateStart": "2026-03-02",
  "dateEnd": "2026-03-20",
  "distanceKm": 1850,
  "placeIds": [107, 119, 121],
  "cover": { "src": "portugal/cote.jpg", "alt": "…" },
  "gallery": [{ "src": "portugal/nazare.jpg", "alt": "…", "caption": "…" }],
  "text": "Premier paragraphe.\n\n## Un intertitre\n\nSuite du récit.",
  "visibility": "private",
  "status": "draft"
}
```

- `placeIds` : identifiants de lieux **de l'Atlas** (visibles dans le Planner et dans l'adresse « Voir sur la carte »).
  Un lieu n'est jamais recopié : la page pointe vers lui.
- `countries` : noms tels qu'ils figurent dans l'Atlas (« Portugal », « Mac. du Nord »…).
- Les chiffres (dates, distance) n'apparaissent que s'ils sont renseignés. Rien n'est calculé à votre place.

## Un récit — `articles/une-nuit-a-nazare.json`

```json
{
  "slug": "une-nuit-a-nazare",
  "title": "…",
  "date": "2026-03-09",
  "excerpt": "…",
  "placeId": 119,
  "voyage": "portugal-2026",
  "cover": { "src": "portugal/nazare.jpg", "alt": "…" },
  "photos": [],
  "text": "…",
  "visibility": "private",
  "status": "draft"
}
```

Depuis le Planner : **Carnet › Blog à partager › Fichier pour le site** (version personnelle du Planner seulement)
produit un fichier `atlas-van-articles.json` ; `node build/import-articles.mjs atlas-van-articles.json` le range ici,
toujours en `"private"` / `"draft"`. À vous de passer ceux que vous choisissez en public. Le détail (réimport,
photos, retouches) est dans `CONTENT_WORKFLOW.md`, à la racine du dépôt.

Champs propres aux récits :

| Champ | Rôle |
|---|---|
| `voyage` | slug du voyage auquel le récit appartient : il devient une **étape** de ce voyage s'il est situé |
| `placeId` | lieu de l'Atlas où se passe le récit |
| `place` | à défaut, lieu personnel `{ "name", "country", "lat", "lon" }` : la position est **arrondie au dixième de degré** (~10 km) à la lecture, jamais publiée exactement |
| `onMap` | `false` retire l'étape de la carte et de la liste des étapes (le récit reste publié) |
| `source` | écrit par l'import : identifiant de la note du carnet et empreinte du texte importé. Ne pas modifier |

## Le voyage en cours

`"currentVoyage": "slug-du-voyage"` dans `site.json` désigne le voyage suivi sur l'accueil et sur la page
`/voyage-en-cours/`. Ses étapes sont ses récits **publiés** et situés, dans l'ordre des dates ; la « dernière étape
publiée » est celle du dernier récit publié — jamais une position en direct. Sans récit situé, les `placeIds` du
voyage servent d'étapes. Si le voyage désigné n'est pas public et publié, la version publique affiche un état vide.

Champs du voyage utiles ici :

| Champ | Rôle |
|---|---|
| `state` | `"ongoing"` (en cours), `"finished"` (terminé), `"planned"` (à venir). Par défaut : terminé s'il a une `dateEnd`, en cours sinon |
| `distanceKm` | distance que vous publiez. Sans elle, la page affiche une distance **estimée** entre étapes (vol d'oiseau + 25 %), dite comme telle |
| `planned` | identifiants de lieux prévus. **Jamais affichés** sans `"showPlanned": true` ; ils sont alors tracés en pointillés, distincts de la route parcourue |

Pour masquer une étape : `"onMap": false` sur le récit. Pour décaler la publication (ne pas révéler où vous êtes
aujourd'hui) : publiez le récit plus tard — rien n'est publié automatiquement.

## Photographies

- Fichiers dans `content/media/`, désignés par un chemin relatif (`"portugal/cote.jpg"`).
- `alt` : décrivez ce que montre l'image si elle apporte une information ; laissez vide (`""`) si elle est décorative.
  N'écrivez pas une description que vous ne pouvez pas vérifier.
- Largeur conseillée : 2 000 px pour une couverture, 1 400 px pour une galerie. La page réserve la place de chaque
  image (largeur et hauteur lues dans le fichier) : pas de saut à l'affichage.
- Seules vos propres photographies, ou des images dont la licence le permet.
- **Position GPS** : beaucoup d'appareils l'inscrivent dans le fichier. Une photographie publique qui la porte fait
  échouer la construction publique — réexportez l'image sans position. Les photos importées depuis le carnet
  (`build/import-articles.mjs`) sont, elles, nettoyées à l'import : EXIF (dont GPS), XMP, IPTC et commentaires
  retirés. Pour les photos ajoutées à la main, les autres métadonnées (appareil, date) ne sont pas retirées.

## `site.json`

```json
{
  "name": "Atlas Van",
  "descriptor": "Atlas de l’Europe en van",
  "siteUrl": "https://exemple.fr",
  "about": [{ "title": "Notre façon de voyager", "text": "…", "visibility": "public" }],
  "legal": { "publisher": "…", "contact": "…", "host": "…" },
  "social": [{ "label": "Instagram", "url": "https://…" }],
  "hero": { "eyebrow": "Vos voyages en van en Europe", "title": "Préparez votre prochain voyage en van", "lead": "…", "primary": "Préparer mon voyage", "secondary": "Explorer les destinations", "tertiary": "Découvrir les itinéraires" },
  "currentVoyage": "portugal-2026",
  "community": { "url": "https://<projet>.supabase.co", "anonKey": "<clé publique anon>" }
}
```

- `hero` : textes de la première page (tous facultatifs ; valeurs par défaut ci-dessus).
- `community` : serveur de l'espace « Partage » (voir `backend/README.md`). **Seulement la clé publique `anon`** :
  la construction s'arrête si on y met une clé de service (`service_role`, `sb_secret_…`) ou une autre clé.
  Sans `community`, la rubrique Partage affiche « pas encore ouvert » et aucune page ne contacte de serveur.

`siteUrl` déclenche les liens canoniques, `sitemap.xml` et `robots.txt` (version publique seulement).

## Règles de saisie

`slug` : minuscules, chiffres, tirets. Dates : `AAAA-MM-JJ`. Liens : `http` ou `https` uniquement.
Une clé inconnue, un lieu inexistant, une image absente ou un chemin sortant de `content/media/` arrêtent la
construction avec un message qui nomme le fichier.
