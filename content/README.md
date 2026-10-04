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

Depuis le Planner : **Carnet › Blog à partager › Fichier pour le site** produit ces fichiers à partir des articles
marqués « à partager », toujours en `"private"` / `"draft"`. À vous de passer ceux que vous choisissez en public.

## Photographies

- Fichiers dans `content/media/`, désignés par un chemin relatif (`"portugal/cote.jpg"`).
- `alt` : décrivez ce que montre l'image si elle apporte une information ; laissez vide (`""`) si elle est décorative.
  N'écrivez pas une description que vous ne pouvez pas vérifier.
- Largeur conseillée : 2 000 px pour une couverture, 1 400 px pour une galerie. La page réserve la place de chaque
  image (largeur et hauteur lues dans le fichier) : pas de saut à l'affichage.
- Seules vos propres photographies, ou des images dont la licence le permet.
- **Position GPS** : beaucoup d'appareils l'inscrivent dans le fichier. Une photographie publique qui la porte fait
  échouer la construction publique — réexportez l'image sans position. Les autres métadonnées (appareil, date) ne
  sont pas retirées : à vous de voir.

## `site.json`

```json
{
  "name": "Atlas Van",
  "descriptor": "Atlas de l’Europe en van",
  "siteUrl": "https://exemple.fr",
  "about": [{ "title": "Notre façon de voyager", "text": "…", "visibility": "public" }],
  "legal": { "publisher": "…", "contact": "…", "host": "…" },
  "social": [{ "label": "Instagram", "url": "https://…" }]
}
```

`siteUrl` déclenche les liens canoniques, `sitemap.xml` et `robots.txt` (version publique seulement).

## Règles de saisie

`slug` : minuscules, chiffres, tirets. Dates : `AAAA-MM-JJ`. Liens : `http` ou `https` uniquement.
Une clé inconnue, un lieu inexistant, une image absente ou un chemin sortant de `content/media/` arrêtent la
construction avec un message qui nomme le fichier.
