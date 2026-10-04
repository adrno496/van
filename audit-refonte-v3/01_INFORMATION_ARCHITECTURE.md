# 01 — Architecture de l'information

## Le parcours visé

```text
Accueil → inspiration (destinations, road trips, récits) → une page de détail → décision → Planner
```

Le Planner n'est plus le premier écran : il est l'outil derrière l'inspiration, à un geste de chaque page.

## Deux expériences, une identité

| | Site éditorial | Planner |
|---|---|---|
| Rôle | donner envie, orienter, expliquer | composer un trajet, estimer, noter, raconter |
| Forme | pages statiques, lecture, cartes illustrées | application en un fichier, carte interactive |
| Adresse | `index.html`, `destinations/…`, `road-trips/…` | `app/index.html` |
| Ton | narratif, calme | utilitaire |
| Partagé | nom, jetons de design, typographie, couleurs, vocabulaire (lieu, étape, parcours) | |

## Plan du site

```text
/                              Accueil
/voyages/                      Voyages réalisés (contenu du propriétaire)
/voyages/<slug>/
/destinations/                 34 pays de l'Atlas
/destinations/<pays>/
/road-trips/                   25 itinéraires du catalogue
/road-trips/<slug>/
/carnet/                       Récits publiés (contenu du propriétaire)
/carnet/<slug>/
/guides/                       4 guides tirés de l'Atlas + guides rédigés
/guides/<slug>/
/a-propos/
/confidentialite/   /mentions/   /recherche/   /404.html
/app/                          Atlas Planner
```

74 pages produites aujourd'hui (sans contenu rédigé) : 1 accueil, 35 pour les destinations, 26 pour les road trips,
5 pour les guides, 2 listes (voyages, carnet), 5 pages de service.

## Navigation

| Élément | Contenu | Décision |
|---|---|---|
| En-tête | marque, 6 rubriques, bouton « Préparer mon voyage » | le bouton est permanent, sur toutes les pages |
| Téléphone | marque + bouton de menu ; menu plein écran avec les rubriques, la recherche et le Planner | une seule action principale par écran |
| Fil d'Ariane | sur toutes les pages intérieures | repère et lien de retour |
| Pied de page | plan du site, Planner, confidentialité, mentions | aucun lien social tant qu'aucun n'est fourni |
| Depuis le Planner | la marque « Atlas van » ramène à l'accueil du site | dans `dist/` seulement ; le fichier autonome reste sans lien |

Intitulés : « Voyages », « Destinations », « Road trips », « Carnet », « Guides », « À propos » sont des noms
communs, ceux du cahier des charges. La référence d'ambiance en utilise d'autres ; aucun n'a été repris d'elle.

## Ce que chaque rubrique montre, et d'où cela vient

| Rubrique | Source | Si la source est vide |
|---|---|---|
| Destinations | catalogue : lieux par pays, saisons, itinéraires, notes par pays | jamais vide |
| Road trips | catalogue : 25 parcours | jamais vide |
| Guides | catalogue et code du Planner ; `content/guides/` | 4 guides au minimum |
| Voyages | `content/voyages/` | état vide honnête, renvoi vers les road trips |
| Carnet | `content/articles/` | état vide honnête, renvoi vers le carnet personnel |
| À propos | description factuelle du projet ; `content/site.json` | sections personnelles absentes (signalées en version personnelle) |

Sur l'accueil, une section sans contenu n'apparaît pas : pas de « Derniers voyages » vide.

## Distinctions tenues partout

- **Proposé / réalisé.** Un road trip est « une proposition, pas un voyage réalisé » ; la rubrique Voyages est
  réservée à ce qui a été parcouru.
- **Dans l'Atlas / raconté.** Un pays ne porte « Raconté » que si un voyage publié le traverse.
- **Public / privé.** Porté par les données (`02`), jamais par l'emplacement.
- **Estimé / mesuré.** Les distances sont dites « estimées » avec leur méthode ; aucune durée n'est affichée
  pour un itinéraire (elle dépend du rythme de chacun).

## Choix écartés

| Idée | Raison |
|---|---|
| Carte interactive complète sur l'accueil | 1,5 Mo et 1 600 marqueurs avant toute lecture ; remplacée par une carte dessinée (60 Ko, aucun script) |
| Carrousel, vidéo d'ambiance | exclus par le cahier des charges ; rien à y montrer |
| Durée « indicative » des itinéraires | le calcul par défaut du Planner donnait 121 jours pour « Balkans en six semaines » : un chiffre trompeur vaut moins que pas de chiffre |
| Étiquette « Dans l'Atlas » sur les 34 pays de la liste | information identique partout, donc bruit ; elle est dite une fois, en tête de page |
| Application installable (PWA) | NON APPLICABLE aujourd'hui : pas d'hébergement, et un cache mal invalidé ferait plus de mal que de bien |
