# 12 — Référencement et lisibilité par les moteurs de réponse

Périmètre : les pages publiques du site. Le Planner n'est pas optimisé pour le référencement — c'est un outil.

## Ce que porte chaque page publique

| Élément | État | Vérifié par |
|---|---|---|
| `<title>` unique, 75 caractères au plus | oui, 74 titres distincts | `tests/site.mjs` |
| Description unique, 40 à 160 caractères | oui ; quand un extrait est trop court, il est complété par le début du texte | idem |
| Un seul `h1`, sans saut de niveau | oui | idem, axe-core |
| `lang="fr"`, `dir="ltr"` | oui | idem |
| Open Graph : type, nom du site, langue, titre, description | oui | idem |
| Lien canonique, `og:url` | **seulement si l'adresse du site est connue** | idem |
| `sitemap.xml`, `robots.txt` | idem ; le sitemap ne contient que les pages indexables | idem |
| Fil d'Ariane | visible ; en données structurées si l'adresse est connue | idem |
| Liens internes | chaque destination renvoie à ses itinéraires et au guide par pays ; chaque itinéraire à ses pays | lecture |
| Adresses lisibles | `destinations/italie/`, `road-trips/balkans-en-six-semaines/` | — |

L'adresse du site est **inconnue aujourd'hui** : aucun lien canonique n'est produit. Elle se déclare dans
`content/site.json` (`siteUrl`) ou par `--site-url` ; le test le vérifie avec une adresse d'exemple.

## Indexation

| Pages | Règle |
|---|---|
| Version publique : accueil, destinations, road trips, guides, à propos, confidentialité, voyages, carnet | indexables |
| Recherche, 404 | `noindex` |
| Mentions | `noindex` tant que l'éditeur n'est pas renseigné |
| Version personnelle : **toutes** les pages | `noindex` — elle contient du contenu privé et n'est pas faite pour être hébergée |
| Planner | inchangé, sans directive |

## Données structurées

Uniquement ce qui est factuel, et uniquement quand l'adresse du site est connue :

| Type | Page | Champs |
|---|---|---|
| `WebSite` | accueil | nom, adresse, langue |
| `BreadcrumbList` | pages intérieures | le fil d'Ariane |
| `Article` | récit publié | titre, date de publication, date de mise à jour si fournie |

Volontairement absents : notes, avis, prix, auteur, coordonnées — rien de tout cela n'existe dans les données, et un
test vérifie qu'aucun n'apparaît. `TouristTrip` n'est pas utilisé pour les itinéraires : ce sont des propositions,
pas des offres.

## Contenu lisible par un moteur de réponse

| Principe | Mise en œuvre |
|---|---|
| Une page, un sujet, une réponse en tête | chaque page de destination commence par « N lieux repérés : … » ; chaque itinéraire par son résumé et ses chiffres |
| Faits en liste de définitions | étapes, distance, pays : `<dl>` |
| Tableau quand il s'agit de comparer | règles et coûts de 33 pays : un vrai tableau, en-têtes de ligne et de colonne |
| Étapes ordonnées | `<ol>` numérotée |
| Méthode à côté du chiffre | « vol d'oiseau majoré de 25 % », « d'après la saison indiquée sur 104 fiches » |
| Réserves dites | « notes non sourcées, non datées », « proposition, pas un voyage réalisé » |
| Dates | date de publication et de mise à jour sur les récits et les guides rédigés, quand elles sont fournies |
| Contexte géographique | pays de chaque lieu, pays traversés par chaque itinéraire |

Pas de foire aux questions : aucune vraie question d'utilisateur n'est connue. Pas de pages fabriquées en série
au-delà de ce que contient le catalogue : 34 pays et 25 itinéraires, chacun avec ses propres données.

## Limites honnêtes

| Limite | Conséquence |
|---|---|
| Les notes par pays ne sont ni sourcées ni datées | publiées avec cette réserve ; à sourcer avant de s'y fier (`CONTENT_NEEDED.md`) |
| Pages de destination peu fournies pour les petits pays (Finlande : 14 lieux, aucun incontournable) | le moteur les classe « contenu mince » ; elles ne contiennent que ce que l'Atlas sait |
| Aucun récit, aucune photographie | le site a peu de contenu original aujourd'hui : sa valeur est dans le catalogue et l'outil |
| Trois itinéraires portent un intitulé personnel | à valider (`17`) |
| Score SEO de Lighthouse : 91 | un seul contrôle échoue, `robots-txt` : `connect-src 'none'` empêche Lighthouse de le télécharger depuis la page. Politique non assouplie |

## Statut

`PARTIAL` : les fondamentaux sont en place et testés ; canonique, sitemap et `robots.txt` attendent l'adresse du
site ; aucun suivi de positionnement n'est possible ni prévu (aucune mesure d'audience).
