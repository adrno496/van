# 02 — Stratégie de sources

## Ce qui était prévu, ce qui a été possible

L'ordre de préférence demandé était : Wikidata/Wikipédia → UNESCO → parcs nationaux → offices de tourisme →
OpenStreetMap → sources locales. L'accès réseau de l'environnement de travail a été **vérifié avant de choisir** :

| Hôte | Résultat (2026-10-04) |
|---|---|
| `query.wikidata.org`, `www.wikidata.org` | refusé par le proxy (403, politique réseau) — aussi via l'outil WebFetch |
| `fr.wikipedia.org`, `commons.wikimedia.org`, `dumps.wikimedia.org` | refusé |
| `overpass-api.de`, `nominatim.openstreetmap.org`, `download.geofabrik.de` | refusé |
| `download.geonames.org`, `whc.unesco.org`, `data.europa.eu`, `zenodo.org`, `huggingface.co` | refusé |
| `registry.npmjs.org` | accessible |
| `raw.githubusercontent.com` | accessible |

Aucune donnée Wikidata/OSM n'a donc pu être interrogée pendant ce lot. Plutôt que de prétendre le contraire, le
pipeline a été construit sur ce qui était réellement accessible, et la provenance de chaque fiche le dit.

## Sources réellement utilisées

| Rôle | Source | Version / date | Licence | Où |
|---|---|---|---|---|
| Identité, description, saison, durée, importance des lieux | Curation par des agents rédacteurs (connaissances générales), selon le cahier de `data-sources/README.md` ; aucune donnée inventée volontairement : en cas de doute, pas de candidat | lot v10 | — | `data-sources/candidates/v10/*.json` |
| Contrôle des coordonnées (distance à la localité de référence déclarée), coordonnées des villes et villages | GeoNames, localités ≥ 1 000 hab. (npm `all-the-cities`) | 3.1.0 | CC BY 4.0 | `data-sources/reference/geonames-europe.json.gz` |
| Régions administratives (couverture) | GeoNames admin1 (npm `cities.json`) | 1.1.65 | CC BY 4.0 | idem |
| Biens UNESCO (lien `source`) | Liste du patrimoine mondial, instantané (npm `@worldwideview/wwv-plugin-unesco-sites`) | 1.0.0, 2026-08-23 | données UNESCO | `data-sources/reference/unesco-europe.json` |
| QID Wikidata des villes | Natural Earth *populated places* 10 m (GitHub `nvkelso/natural-earth-vector`) | branche master | domaine public | `data-sources/reference/naturalearth-places-europe.json` |
| Appartenance au pays | Contours des pays déjà embarqués dans la carte (`src/data/places.js`, `DATA.pays`) | — | (repris du projet) | — |

`scripts/places/fetch-reference.mjs` refait exactement ces téléchargements ; c'est le seul script qui utilise le
réseau. La construction et l'application n'en ont aucun besoin.

## Ce que garantit — et ne garantit pas — cette stratégie

- **Garanti par contrôle automatique** : le point est dans le pays annoncé (ou sur sa côte/frontière), pas en mer
  au large, pas inversé, à une distance cohérente de la localité de référence que le curateur a déclarée
  (`review/v10/<pays>.json` garde la localité GeoNames, ses coordonnées et l'écart mesuré) ; pas de doublon de nom
  (toutes langues, accents, articles, mots génériques) ni de point quasi identique à une fiche existante.
- **Garanti par la source** : pour les villes et villages reconnus par GeoNames, les coordonnées *sont* celles de
  GeoNames (lien `source`) ; pour les biens UNESCO dont le point est à moins de 4 km, le lien `source` pointe la
  fiche UNESCO.
- **Non garanti** : la précision fine d'un site naturel ou d'un monument isolé (les curateurs ont annoncé une
  confiance « haute » ≤ 1 km ou « moyenne » ≤ 5 km) — d'où la mention « Coordonnées de repérage, pas une entrée ni
  un parking », désormais affichée sur toutes les nouvelles fiches, même sans lien source. Aucune information
  volatile (horaires, tarifs, stationnement, bivouac, accès van) n'est affirmée : le champ tarifs indique
  « Horaires, accès et tarifs à vérifier avant la visite. »

## Suite recommandée quand Wikidata sera accessible

Autoriser `query.wikidata.org` dans la politique réseau de l'environnement, puis, pour chaque fiche `batch: v10`
sans QID : recherche par libellé + pays + rayon de 5 km autour du point, rattachement du QID, comparaison des
coordonnées (écart > 2 km → revue). Les fiches dont le contrôle est « partiel » (localité de référence absente du
gazetier) sont à traiter en premier ; leur liste est dans `review/v10/*.json` (`geo.status`).
