# Contenu à fournir

Le site est construit avec ce qui existe. Tout ce qui suit **manque réellement** et n'a pas été inventé.
Dans la version personnelle, chaque emplacement vide est signalé par un encadré « À compléter — non publié » ;
dans la version publique, il n'apparaît pas.

Où écrire : `content/` — mode d'emploi dans `content/README.md`.

## Indispensable avant une mise en ligne

| Contenu | Où | Pourquoi |
|---|---|---|
| **Mentions** : éditeur (nom ou raison sociale), moyen de contact, hébergeur | `content/site.json` › `legal` | obligation légale ; la page Mentions dit aujourd'hui qu'elles ne sont pas renseignées |
| **Adresse du site** | `content/site.json` › `siteUrl` | sans elle : ni lien canonique, ni `sitemap.xml`, ni `robots.txt` |
| **Décision sur trois intitulés d'itinéraires** : « Année 1 — l'arc latin », « Année 2 — sud, Balkans, est », « Deux semaines depuis la Vendée » | `src/data/places.js` | ils décrivent un projet personnel et une région de départ ; ils paraissent sur des pages publiques |
| **Vérification des notes par pays** (prix du gazole, péages, règles de nuit) | `src/data/places.js` › `meta` | publiées avec la mention « non sourcées, non datées » ; une date et une source par pays les rendraient fiables |

## Ce qui ferait du site un magazine

| Contenu | Où | Remarque |
|---|---|---|
| **Photographies** : une grande image pour l'accueil, une par pays parcouru, une par voyage | `content/media/` | les vôtres uniquement ; 2 000 px de large pour une couverture. Aujourd'hui, toutes les images sont des cartes dessinées |
| **Voyages réalisés** : titre, dates, pays, étapes (identifiants de lieux), distance, récit | `content/voyages/` | la rubrique Voyages est vide ; rien ne dit qu'un pays a été parcouru |
| **Récits du carnet** | `content/articles/` | depuis le Planner : Carnet › Blog à partager › « Fichier pour le site », puis `node build/import-articles.mjs` |
| **Texte alternatif des images** | dans chaque fichier, champ `alt` | à écrire par vous : je ne décris pas une image que je n'ai pas vue |

## Présentation

| Contenu | Où |
|---|---|
| Qui voyage, depuis quand, à quel rythme (« Notre façon de voyager ») | `content/site.json` › `about` |
| Le van : modèle, aménagement, autonomie, une ou deux photos | idem |
| Ce que vous cherchez sur la route | idem |
| Un descripteur ou une signature, si « Atlas de l'Europe en van » ne convient pas | `content/site.json` › `descriptor` |
| Réseaux sociaux, s'il y en a | `content/site.json` › `social` |

## Guides

Quatre guides existent, tirés de l'Atlas. Pour aller plus loin : bivouac, équipement, budget réel d'un mois,
voyager hors saison — à écrire à partir de votre expérience, avec des sources quand il s'agit de règles
(`content/guides/`, champ `sources`).

## Ce que je n'ai pas fait à votre place

- aucune photographie prise sur Internet ;
- aucun voyage, aucune date, aucun kilométrage inventé ;
- aucune biographie, aucun nom, aucune adresse ;
- aucun avis, aucune note, aucun prix présenté comme vérifié.
