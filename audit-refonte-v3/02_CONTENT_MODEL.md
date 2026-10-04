# 02 — Modèle de contenu, public et privé

## Deux sources

| Source | Contient | Qui l'écrit |
|---|---|---|
| Catalogue (`src/data/places.js`) | lieux, itinéraires, notes par pays | inchangé depuis le cycle 1 |
| `content/` | voyages, articles, guides, présentation, photographies | le propriétaire |

Un lieu n'existe qu'une fois, dans le catalogue. Le contenu rédigé y **renvoie par identifiant**
(`placeId`, `placeIds`) : coordonnées et nom restent cohérents, et le Planner peut ouvrir le bon point.

## Types

| Type | Fichier | Champs propres |
|---|---|---|
| Voyage | `content/voyages/<slug>.json` | `summary`, `countries[]`, `dateStart`, `dateEnd`, `distanceKm`, `placeIds[]`, `gallery[]`, `text` |
| Article | `content/articles/<slug>.json` | `date`, `excerpt`, `placeId`, `voyage` (slug), `photos[]`, `text` |
| Guide | `content/guides/<slug>.json` | `summary`, `text`, `sources[]` (liens http ou https) |
| Site | `content/site.json` | `name`, `descriptor`, `siteUrl`, `about[]`, `legal`, `social[]` |
| Image | dans `cover`, `gallery`, `photos` | `src` (fichier de `content/media/`), `alt`, `caption` ; largeur et hauteur lues dans le fichier |
| Destination, Road trip, Lieu | dérivés du catalogue | aucun fichier à écrire |

Champs communs : `slug`, `title`, `cover`, `updatedAt`, `visibility`, `status`, `demo`.
Mode d'emploi et exemples : `content/README.md`.

## Public ou privé : écrit dans la donnée

| Champ | Valeurs | Défaut |
|---|---|---|
| `visibility` | `private`, `public` | **`private`** |
| `status` | `draft`, `published` | **`draft`** |

Un élément n'entre dans la version publique que s'il est `public` **et** `published`. Un brouillon est toujours
privé. Une section de « à propos » porte sa propre `visibility`.

| Élément | Version personnelle | Version publique |
|---|---|---|
| `public` + `published` | affiché | affiché |
| `private`, ou `draft` | affiché avec l'étiquette « Privé » ou « Brouillon — privé », page marquée `noindex` | **absent** : ni page, ni texte, ni image |
| `demo: true` | affiché seulement avec `--demo`, étiquette « DÉMO » | **refusé** : la construction s'arrête si `--demo` est demandé |
| Emplacement « à compléter » | affiché, encadré | absent |

Les lieux personnels du catalogue (les cinq « bases ») suivent la règle du cycle 2 : retirés de la version publique,
où ils sont alors inconnus — un contenu public qui en citerait un est refusé (« lieu inconnu »).

## Contrôles à la lecture (`build/content.mjs`)

Chaque fichier est relu champ par champ ; la première anomalie arrête la construction avec le nom du fichier.

| Contrôle | Refus |
|---|---|
| Clés | toute clé inconnue, dont `__proto__` |
| `slug` | autre chose que minuscules, chiffres et tirets ; plus de 80 caractères ; doublon |
| Textes | type, longueur, caractères de contrôle |
| Dates | format `AAAA-MM-JJ`, date impossible, fin avant début |
| Lieux et pays | identifiant ou nom absent du catalogue |
| Images | chemin avec `..`, absolu, ou adresse ; fichier absent ; fichier qui n'est pas une image |
| Liens | tout protocole autre que `http` et `https` |
| JSON | fichier illisible |

17 cas de refus sont testés (`tests/site.mjs`).

## Du carnet personnel au site

Le carnet du Planner n'est **pas** modifié : mêmes champs, même stockage, mêmes sauvegardes. Aucune migration.

```text
Planner › Carnet › Blog à partager › « Fichier pour le site »      → atlas-van-articles.json
node build/import-articles.mjs atlas-van-articles.json             → content/articles/*.json + content/media/carnet/*
(à la main)  visibility: "public", status: "published"             → l'article paraît dans la version publique
```

- Seuls les articles marqués « à partager » sont exportés.
- L'import écrit toujours `private` et `draft`, **même si le fichier prétend le contraire** (testé).
- L'import n'écrase pas un article existant sans `--force` ; il refuse une photo qui n'est pas un JPEG, PNG ou WebP.
- Un lieu personnel du Planner (identifiant `c…`) n'est pas repris : il n'existe pas dans le catalogue.

La publication reste un geste séparé, fait à la main, fichier par fichier. Rien n'est jamais publié « par défaut ».

## Ce qui n'a pas été construit

| Idée | Décision |
|---|---|
| Éditeur de contenu dans le navigateur | non : le carnet existant suffit pour écrire ; des fichiers JSON suffisent pour publier |
| Publication programmée | non : aucune fonction ne la justifie |
| Champ `published` dans le carnet du Planner | non : cela aurait modifié le modèle enregistré chez l'utilisateur pour un besoin qui se règle hors du Planner |
| Variantes d'images (srcset, WebP, AVIF) | NON APPLICABLE — aucune photographie fournie ; les dimensions sont réservées, le chargement est différé |
