# 10 — Performance

Mesures de laboratoire : Lighthouse 13.5, lancé par la fonction `runLighthouse` de Creative Engine 9.1.0
(`scripts/lighthouse-pages.mjs`), 3 passages par page et par profil, médiane. Serveur local, réseau et processeur
lents simulés pour le profil mobile. La machine était chargée (charge moyenne de 10 à 15 sur 10 cœurs).

## Site éditorial

| Page | Profil | Performance | Accessibilité | Bonnes pratiques | SEO | LCP | TBT | CLS |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| Accueil | mobile | **100** | 100 | 100 | 91 | 1,07 s | 0 ms | 0 |
| | ordinateur | 100 | 100 | 100 | 91 | 0,30 s | 0 ms | 0 |
| Destinations (liste) | mobile | 100 | 100 | 100 | 91 | 1,07 s | 0 ms | 0 |
| | ordinateur | 100 | 100 | 100 | 91 | 0,30 s | 0 ms | 0 |
| Destination (Italie) | mobile | 100 | 100 | 100 | 91 | 1,13 s | 0 ms | 0 |
| | ordinateur | 100 | 100 | 100 | 91 | 0,29 s | 0 ms | 0 |
| Road trips (liste) | mobile | 100 | 100 | 100 | 91 | 0,95 s | 0 ms | 0 |
| | ordinateur | 100 | 100 | 100 | 91 | 0,25 s | 0 ms | 0 |
| Road trip (Balkans) | mobile | 100 | 100 | 100 | 91 | 1,12 s | 0 ms | 0 |
| | ordinateur | 100 | 100 | 100 | 91 | 0,29 s | 0 ms | 0 |
| Guide (règles par pays) | mobile | 100 | 100 | 100 | 91 | 0,91 s | 0 ms | 0 |
| | ordinateur | 100 | 100 | 100 | 91 | 0,26 s | 0 ms | 0 |
| Voyage, **contenu de test**, avec image de couverture | mobile | 100 | 100 | 100 | 92 | 1,36 s | 0 ms | 0 |
| | ordinateur | 100 | 100 | 100 | 92 | 0,35 s | 0 ms | 0 |
| Récit, **contenu de test** | mobile | 100 | 100 | 100 | 92 | 1,06 s | 0 ms | 0 |
| | ordinateur | 100 | 100 | 100 | 92 | 0,29 s | 0 ms | 0 |

Statut du moteur : **PASS** sur toutes les pages du site, dans les deux profils. Passages individuels de l'accueil
mobile : 100 / 100 / 100, LCP 1 069 / 1 062 / 1 129 ms.

Preuves : `evidence/lighthouse-site.json`, `evidence/lighthouse-contenu-de-test.json`.

La page de voyage et la page de récit n'existent qu'avec un contenu de test (images en dégradé de 15 et 32 Ko) :
leurs chiffres montrent le comportement du gabarit, pas celui de vraies photographies. Avec des photos de plusieurs
centaines de kilo-octets, le LCP dépendra de leur poids — `NON TESTÉ`.

SEO à 91 : un seul contrôle échoue, `robots-txt`, parce que `connect-src 'none'` empêche Lighthouse de télécharger
ce fichier depuis la page. Politique non assouplie (même décision qu'aux cycles 1 et 2).

## Planner

| Mesure | Fin du cycle 2 | Dans le site (`/app/`) | Lecture |
|---|---:|---:|---|
| Mobile — performance | 92 | 91 | équivalent |
| Mobile — TBT | 62 ms (69 / 40 / 62) | 86 ms (121 / 86 / 67) | même ordre de grandeur ; l'objectif du cycle 2 (< 250 ms) est tenu avec une large marge |
| Mobile — LCP | 2,77 s | 2,78 s | inchangé ; statut du moteur PARTIAL (seuil 2,5 s), dû au poids du fichier unique |
| Mobile — CLS | 0 | 0,007 | négligeable |
| Ordinateur — performance / TBT / LCP | 100 / 0 ms / 0,65 s | 100 / 0 ms / 0,65 s | inchangé |

Les deux séries n'ont pas été prises sous la même charge ni au même moment : l'écart de TBT (62 → 86 ms) est dans la
dispersion d'une série (67 à 121 ms). Ce cycle n'a ajouté au démarrage du Planner que la lecture du fragment
d'adresse. Les optimisations du cycle 2 (catalogue en JSON, pays pré-dessinés, démarrage par étapes, un élément par
lieu) sont toutes conservées ; la suite `tests/v2.mjs` (36 / 36) le vérifie.

## Pourquoi le site est léger

| Choix | Effet |
|---|---|
| Aucune carte interactive sur l'accueil | l'accueil pèse 69 Ko (21 Ko compressé) ; le Planner, 1 507 Ko (406 Ko compressé), ne se charge qu'à la demande |
| Cartes illustrées en SVG dans la page, un fond de carte par page | aucune requête d'image ; accueil ramené de 150 à 69 Ko |
| Contours simplifiés à la construction | quelques milliers de points au lieu de 33 000 |
| Lieux dessinés en un seul tracé | 1 595 points = 2 éléments SVG ; l'accueil compte 291 éléments au total |
| Un script de 4,9 Ko, différé | TBT 0 ms ; sans lui la page reste lisible |
| Une feuille de style de 27 Ko (7 Ko compressée), partagée | mise en cache pour les 74 pages |
| Aucune police à télécharger, aucun tiers | rien n'attend le réseau |
| Images de contenu : dimensions réservées, chargement différé hors couverture | CLS 0 (vérifié par un test) |

Poids des pages (octets, puis compressé) :

| Page | Poids | gzip |
|---|---:|---:|
| Accueil | 69 234 | 21 434 |
| Destinations (liste, 34 cartes) | 69 065 | 22 038 |
| Destination (Italie, 362 lieux) | 76 725 | 27 281 |
| Road trips (liste, 25 cartes) | 55 100 | 14 140 |
| Road trip (Balkans, 28 étapes) | 50 833 | 18 484 |
| Guide (33 pays) | 13 046 | 3 597 |
| Recherche (index d’environ 1 660 entrées) | 144 351 | 27 406 |
| `assets/site.css` | 26 729 | 7 264 |
| `assets/site.js` | 4 887 | 2 100 |
| Planner (`app/index.html`) | 1 506 924 | 406 141 |

## Objectifs du cahier des charges

| Objectif | Résultat | Statut |
|---|---|---|
| Accueil : très bon LCP | 1,07 s (mobile simulé), 0,30 s (ordinateur) | PASS |
| Pas de script lourd avant interaction | 4,9 Ko différés ; TBT 0 ms | PASS |
| Pas de carte complète au-dessus de la ligne de flottaison | carte dessinée, statique | PASS |
| Chargement différé, dimensions réservées | oui ; CLS 0 | PASS |
| Pas de carrousel automatique | aucun | PASS |
| Images optimisées, plusieurs tailles, WebP ou AVIF | NON APPLICABLE — aucune photographie fournie ; aucune variante n'est produite. À traiter avec les premières photos |
| Planner : conserver les performances du cycle 2 | 91 contre 92, TBT 86 contre 62 ms | PASS (dans le bruit) |

## Limites

- Laboratoire, serveur local, sans compression HTTP mesurée : les poids « gzip » ci-dessus sont calculés, pas servis.
- Core Web Vitals de terrain et INP : `NON TESTÉ` (aucun utilisateur, aucune mesure d'audience).
- Téléphone réel : `NON TESTÉ`.
- Le LCP mobile du Planner (2,78 s) reste au-dessus de 2,5 s. Servi compressé par un hébergeur, le fichier passerait
  de 1,5 Mo à 0,4 Mo ; l'effet sur le LCP n'a pas été mesuré.
