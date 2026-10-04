# 05 — Architecture technique du site

## Commandes

```bash
node build.mjs                        # index.html — le Planner seul, en un fichier (inchangé)
node build.mjs --mode personal        # dist/personal/ — site + Planner, tout le contenu, pages « noindex »
node build.mjs --mode public          # dist/public/ — site + Planner sans rien de personnel, contrôle de confidentialité
node build.mjs --mode public --check  # vérifie que dist/public/ correspond aux sources
```

Options : `--direction a|b|c`, `--content <dossier>`, `--site-url https://…`, `--demo` (version personnelle
seulement), `--dir <dossier de sortie>`.

## Fichiers

```text
build.mjs              entrée en ligne de commande
build/planner.mjs      assemblage du Planner (ancien build.mjs, déplacé tel quel) + contrôle de confidentialité du catalogue
build/site.mjs         pages du site, cartes illustrées, contrôle de confidentialité du contenu
build/content.mjs      lecture et validation de content/
build/import-articles.mjs   articles exportés du Planner → content/
src/site/css/site.css, direction-{a,b,c}.css
src/site/js/site.js    menu, apparition, recherche (65 lignes)
content/               contenu du propriétaire (vide aujourd'hui, sauf site.json et le mode d'emploi)
```

Aucune dépendance ajoutée : Node seul, comme aux cycles précédents.

## Sortie

```text
dist/public/
  index.html  404.html
  destinations/index.html   destinations/<pays>/index.html      (34)
  road-trips/index.html     road-trips/<slug>/index.html        (25)
  voyages/  carnet/  guides/  a-propos/  confidentialite/  mentions/  recherche/
  assets/site.css  assets/site.js
  media/…                   seulement les images des contenus publics
  app/index.html            le Planner, en un fichier
  sitemap.xml  robots.txt   seulement si l'adresse du site est connue
```

77 fichiers, 5 Mo, dont 1,5 Mo pour le Planner. Une page du site pèse de 5 à 80 Ko (la page de recherche, avec son index : 144 Ko).

## Décisions

| Question | Décision | Pourquoi |
|---|---|---|
| Une page ou plusieurs ? | plusieurs pages statiques | chaque destination, chaque itinéraire a une adresse, un titre, une description ; rien à exécuter pour lire |
| Compatible avec l'ouverture en fichier local ? | oui | tous les liens sont relatifs et nomment `index.html` ; vérifié dans Chromium, Firefox et WebKit, y compris le passage au Planner |
| Feuille de style et script | fichiers partagés (`assets/`), politique `'self'` | mis en cache une fois pour 74 pages ; `'self'` fonctionne aussi en fichier local (vérifié avant de choisir) |
| Planner | reste un fichier unique avec sa politique à empreintes | aucune régression possible sur son chargement ; il s'ouvre toujours seul |
| Cartes illustrées | SVG dans la page ; un fond de carte par page, auquel chaque carte renvoie | accueil 70 Ko au lieu de 150 ; aucune requête d'image |
| Contours | simplifiés à la construction (trois niveaux de détail) | 33 000 points ramenés à quelques milliers |
| Recherche | index JSON dans la page de recherche (145 Ko), filtré dans le navigateur | aucun serveur, aucune requête ; `connect-src 'none'` interdit de toute façon d'aller chercher un fichier |
| Adresses propres (`/destinations/italie/`) | oui sur un serveur ; les liens internes écrivent `…/italie/index.html` | compatibilité avec le fichier local |
| Liens vers le Planner | fragment : `app/index.html#pays=italie` | le Planner (1,5 Mo) reste en cache quelle que soit la cible ; un paramètre `?pays=` le ferait retélécharger à chaque lien |
| Page 404 | `404.html` à la racine | convention des hébergeurs statiques ; ses liens relatifs supposent un site servi à la racine du domaine |

## Politique de sécurité de chaque page du site

```text
default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:;
font-src 'none'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'
```

Aucun style en ligne, aucun gestionnaire en ligne, aucun script en ligne (les blocs JSON de données structurées et
d'index ne sont pas exécutés). `unsafe-inline` et `unsafe-eval` n'apparaissent nulle part. Vérifié sur les 74 pages
par `tests/site.mjs`.

## Garde-fous de la construction

- Le dossier de sortie est remplacé en entier, **seulement** s'il est vide ou s'il porte le marqueur d'une
  construction précédente (`.atlas-build`) : `--dir src` est refusé (testé).
- Deux pages ne peuvent pas avoir la même adresse ; deux itinéraires de même nom arrêtent la construction.
- Version publique : contrôle de confidentialité sur **tous** les fichiers produits avant toute écriture (`11`).
- La construction signale ce qui manque sans l'inventer : adresse du site, mentions, voyages, articles, photographies.

## Ce qui reste hors du dépôt

`dist/` n'est pas suivi par Git : il se reconstruit. `content/` l'est, et il est vide de tout contenu personnel
aujourd'hui.
