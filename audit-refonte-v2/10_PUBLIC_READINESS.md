# 10 — Version publique et confidentialité

## Deux fichiers, une seule base de code

| | Version personnelle | Version publique |
|---|---|---|
| Commande | `node build.mjs` | `node build.mjs --mode public` |
| Fichier | `index.html` | `dist-public/index.html` |
| Lieux | 1 600 | 1 595 |
| Idées de parcours | 25 | 25 (sans les étapes retirées) |
| Fonctions | toutes | toutes |
| Stockage, réseau, politique de sécurité | local, aucune requête, CSP à empreintes | identiques |

La différence tient au catalogue, filtré à la construction. Il n'y a ni branche de code « publique », ni option
cachée dans la page : la version publique ne contient pas les données retirées.

## Inventaire : ce qui est personnel dans le projet

| Élément | Où | Personnel ? | Traitement |
|---|---|---|---|
| 5 « bases » — La Roche-sur-Yon, Dijon, Annemasse / Léman, Alvaiázere, Milan : logements de proches, décrits par « chez ma mère », « chez mes grands-parents », « chez une amie », « maison des grands-parents », « chez ma marraine », avec usage (courrier, intérim, durée de séjour) | `src/data/places.js`, catégorie `base`, identifiants 0, 1, 2, 106, 133 | **oui** | retirées en entier |
| Étapes de parcours pointant vers ces bases | 7 parcours sur 25 (n° 0, 1, 2, 3, 10, 12, 23) | par ricochet | étapes retirées, parcours conservés |
| Rubrique « Bases d'hébergement » (Idées) | interface | vide sans base | masquée quand le catalogue n'a aucune base |
| « 1 600 lieux » dans le titre, la description, l'en-tête | gabarit | — | le nombre suit le catalogue livré (1 595) |
| Intitulés « Année 1 — l'arc latin », « Année 2 — sud, Balkans, est », « Deux semaines depuis la Vendée » ; description « Vendée → Bourgogne → … » | parcours | **à décider** : ils décrivent un projet et une région de départ, sans nommer personne | conservés — voir « Décision laissée au propriétaire » |
| Fiches « Intérim agro — Vendée », « Olives — Ansião / Alvaiázere », etc. | catalogue | non : informations publiques sur l'emploi saisonnier | conservées |
| Mentions repérées par mots-clés puis écartées : « Maman » (Bilbao, sculpture), « Papamoscas » (Burgos), « famille royale », « Le Parrain » (Savoca), « maison de Mozart »… | catalogue | non | conservées |
| Trajet, notes, favoris, lieux personnels, carnet, photos de l'utilisateur | navigateur (`localStorage`, IndexedDB) | oui | **jamais dans le fichier**, quel que soit le mode |
| Position GPS | mémoire vive | oui | jamais écrite, jamais envoyée |
| Rapports d'audit, baselines, captures | `audit-refonte*/` | contiennent le catalogue personnel | ne font pas partie de `dist-public/` : ne pas les publier |
| Chemins locaux, noms de machine, secrets | — | — | aucun dans les deux fichiers (gitleaks 0 ; contrôle `/Users/`, `file://`) |

Rien n'a été supprimé des sources : `src/data/places.js` est inchangé à l'octet près.

## Contrôle de confidentialité à la construction

`build.mjs`, bloc `PERSONAL` et fonction `privacyGate`. La construction publique **échoue** (code de sortie 1,
aucun fichier écrit) si :

- un texte d'une fiche retirée (résumé, détail, « à voir », intitulé du logement) figure encore dans la sortie ;
- une expression « chez ma / mon / mes / une amie / un ami », « grands-parents », « marraine », « port d'attache »,
  un chemin `/Users/` ou une adresse `file://` y figure ;
- une fiche de catégorie `base` subsiste, ou un parcours pointe vers un lieu absent ;
- aucune fiche personnelle n'a été trouvée (la règle ne correspondrait plus au catalogue : mieux vaut s'arrêter).

Le contrôle a réellement refusé une construction pendant le développement (« Le Parrain », film tourné à Savoca) :
le motif `parrain`, trop large et sans rapport avec les fiches retirées, a été enlevé.

Limite : le contrôle connaît les fiches de catégorie `base` et une liste d'expressions. Un texte personnel écrit
plus tard dans une autre fiche, avec d'autres mots, ne serait pas détecté. La règle est à tenir à jour avec le
catalogue.

## Tests de la version publique

| Contrôle | Résultat | Preuve |
|---|---|---|
| Démarrage : 1 595 lieux, 1 595 marqueurs, aucune base, aucun halo, nombre annoncé « 1 595 » | PASS | `tests/v2.mjs`, groupe `public` |
| Aucun texte personnel dans le fichier, dans la page affichée, ni dans les données en mémoire | PASS | idem |
| Rubrique « Bases d'hébergement » masquée ; recherche « marraine » sans résultat | PASS | idem |
| Les 25 idées de parcours se chargent, aucune étape manquante | PASS | idem |
| Données d'une version personnelle déjà présentes dans le navigateur (trajet et notes sur des bases) : démarrage sans erreur, étapes publiques et notes conservées, état d'origine mis de côté | PASS | idem |
| Politique de sécurité stricte, aucune requête, aucune erreur de console | PASS | idem |
| Chromium, Firefox, WebKit × serveur et fichier local | PASS — 6 / 6 | `evidence/smoke-public.json` |
| Mise en page, clavier, tactile | PASS — 59 / 59 | `evidence/ui-public.json` |
| Suite fonctionnelle complète (`--catalogue public` : 1 595 lieux, premier parcours de 45 étapes) | PASS — 77 / 77 | `evidence/e2e-public.json` |
| Audit Creative Engine | qualité 70, axe 0 violation, 0 requête tierce, CSP PASS — identique à la version personnelle | `evidence/creative-engine/audit-public-fichier-unique.summary.json` |
| Lighthouse | mobile 92 / 100 / 100 / 91, TBT 14 ms, LCP 2,72 s ; ordinateur 100 / 100 / 100 / 91 | `evidence/creative-engine/lighthouse.json` |
| SENTINEL | 0 secret, 0 vulnérabilité, 0 sortie réseau ; mêmes 10 constats de stockage local | `evidence/sentinel/SUMMARY.json` |

## Stockage local : ce que l'utilisateur doit savoir

| Donnée | Où | Sort de l'appareil ? |
|---|---|---|
| Trajet, notes, statuts, fiches modifiées, lieux personnels, parcours, réglages | `localStorage`, clé `atlasvan.v3` | non |
| Carnet et photos | IndexedDB `atlasvan.journal.v1` | non, sauf export volontaire (blog `.html`, sauvegarde `.json`) |
| Préférences (rubriques floutées, localisation au démarrage) | `localStorage` | non |
| Position | mémoire vive, le temps de la session | non |
| Lien ouvert vers Google Maps, Google ou Wikipédia | — | oui : le nom ou les coordonnées du lieu, au moment où l'on touche le lien |

Ces données ne sont **pas chiffrées**. Quiconque a accès au profil du navigateur peut les lire ; le floutage des
rubriques est une discrétion d'écran, pas une protection. SENTINEL le relève (`SENSITIVE_DATA_PERSISTED`) ; ce
constat n'a pas été masqué. Le chiffrement par phrase secrète reste une recommandation P3 : il change le modèle
d'usage (une phrase oubliée = données perdues) et ne se décide pas pour faire passer un contrôle.

L'interface le dit déjà : rubrique Plus › « Ce qui reste sur cet appareil, ce qui en sort ».

## Deux précautions pratiques

1. **Essayer la version publique à part.** Ouverte sur le même appareil et dans le même navigateur que la version
   personnelle (en fichier local, deux fichiers de dossiers différents partagent le même stockage : vérifié dans Chromium, Firefox et WebKit), elle
   lit les mêmes données. Les étapes pointant vers une base y sont ignorées ; l'état d'origine est conservé sous
   `atlasvan.v3.recovery` et téléchargeable, mais le trajet enregistré ensuite ne contient plus ces étapes. Utiliser
   une fenêtre privée ou un autre navigateur.
2. **Ne publier que `dist-public/index.html`.** Le dépôt, `index.html`, `src/data/places.js` et les dossiers
   d'audit contiennent le catalogue personnel.

## Décision laissée au propriétaire

Les intitulés « Année 1 », « Année 2 » et « depuis la Vendée » ne désignent ni une personne ni une adresse, mais
ils racontent un projet et une région de départ. Je ne les ai ni réécrits (ce serait inventer du contenu) ni
retirés (ce sont des parcours publics valides). Si la région de départ doit rester privée : renommer ces trois
parcours dans `src/data/places.js`, ou ajouter leur titre aux expressions interdites de `PERSONAL.patterns` pour
que la construction publique s'arrête tant que ce n'est pas fait.

## Tableau de préparation

| Usage | Statut | Preuve | Limite |
|---|---|---|---|
| Usage personnel local | PASS | suites complètes, migration depuis deux versions | appareil réel non testé |
| Usage hors ligne | PASS | 0 requête ; `connect-src 'none'` ; fichier local dans 3 moteurs | essai sur téléphone non fait |
| Partage du fichier (envoi à un tiers) | PARTIAL — version publique uniquement | contrôle de confidentialité, tests `public` | intitulés de 3 parcours à valider |
| Hébergement public | PARTIAL | idem + audits | appareil réel non testé ; pas de domaine, pas de `robots.txt`, pas de mentions légales : hors du périmètre |
| Données personnelles | PASS pour le fichier public | inventaire ci-dessus | règle à tenir à jour |
| Sécurité | PASS pour ce qui a été testé | 16 scénarios d'attaque, CSP éprouvée | revue humaine, pas un test d'intrusion |
| Performance mobile | PASS en laboratoire | TBT 62 ms, score 92 | émulation ; LCP 2,77 s |
| Accessibilité | PARTIAL | axe 0 violation, 51 contrastes calculés, clavier | lecteurs d'écran non testés |

Verdict d'ensemble et raisons : `12_FINAL_REPORT.md` (READY_LOCAL = YES, READY_PUBLIC = NO).
