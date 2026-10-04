# 18 — Rapport final du cycle 3

Atlas Van — un site éditorial devant le Planner. Mission exécutée le 4 octobre 2026 sur
`/Users/dreano/Downloads/van-main`, à partir de la version finale du cycle 2.

## A. Résumé

Le projet produit maintenant deux choses avec une seule commande : un **site éditorial** de 74 pages — accueil,
34 destinations, 25 road trips, guides, à propos — et le **Planner**, intact, derrière le bouton « Préparer mon
voyage ». Le site est construit à partir de ce qui existe réellement : le catalogue. Il n'invente ni voyage, ni
photographie, ni biographie ; là où le contenu manque, il le dit.

Ce que le site n'est pas encore : un magazine. Il n'y a ni récit ni photographie. Les images sont des cartes
dessinées à partir des données — c'est son identité, et aussi sa limite.

Toutes les suites passent (77, 59, 10, 6, 36, et 34 nouveaux contrôles) ; le Planner est identique au pixel près à
celui du cycle 2.

## B. Architecture, avant et après

| | Avant | Après |
|---|---|---|
| Ce qu'on ouvre | `index.html` : le Planner | `dist/<mode>/index.html` : l'accueil du site ; `app/index.html` : le Planner |
| Pages | 1 | 74 + le Planner |
| Construction | `build.mjs` (un fichier) | `build.mjs` + `build/{planner,site,content,import-articles}.mjs` |
| Contenu | le catalogue | le catalogue + `content/` (voyages, articles, guides, photographies) |
| Modes | personnel, public (Planner seul) | personnel, public (site + Planner) ; le Planner seul reste `node build.mjs` |
| Dépendances | aucune | aucune |
| Fichier local | oui | oui, site compris (vérifié dans trois moteurs) |

## C. Direction visuelle

Trois directions construites et mesurées (`04`) : A « cinématique », B « carnet de route », C « outdoor minimal ».
**A retenue** : la plus immersive (image sur 63 % du premier écran, 43 mots), sans toucher aux jetons de marque du
Planner. Les trois sont à égalité sur le contraste (26 / 26), la performance (100) et l'accessibilité ; B deviendra
la meilleure candidate le jour où le carnet sera rempli. Changer : `--direction b`.

## D. Accueil

Première page sombre : l'Europe, chaque lieu de l'Atlas en point de lumière, un itinéraire tracé. Une phrase, deux
actions. Puis destinations, le chiffre de l'Atlas, road trips, guides, appel vers le Planner. Les sections « Derniers
voyages » et « Carnet » n'apparaissent que s'il y a du contenu publié. 69 Ko, LCP 1,07 s en mobile simulé, aucun
script bloquant.

## E. Pages éditoriales

| Rubrique | État |
|---|---|
| Destinations | 34 pays : carte, lieux incontournables, saison d'après les fiches, itinéraires, notes pratiques signalées comme non sourcées |
| Road trips | 25 itinéraires : carte, étapes ordonnées, distance estimée avec sa méthode, pays ; présentés comme des propositions |
| Guides | 4 guides tirés de l'Atlas (règles par pays, avant de partir, travail saisonnier, méthode de calcul) + guides rédigés |
| Voyages | gabarit complet (faits, récit, étapes, galerie, récits liés) ; **vide** |
| Carnet | gabarit de lecture, navigation entre récits ; **vide** |
| À propos | description factuelle du projet ; sections personnelles à fournir |
| Confidentialité, mentions, recherche, 404 | en place ; mentions à renseigner |

## F. Planner

Aucune fonction retirée. Trois ajouts : liens d'entrée validés (`#pays`, `#lieu`, `#parcours`, `#q`), lien de la
marque vers le site, export « Fichier pour le site ». Un parcours demandé alors qu'un trajet existe est proposé,
jamais imposé. Performance conservée (mobile 91, TBT 86 ms).

## G. Données publiques et privées

Portée par les données : `visibility` (`private` par défaut) et `status` (`draft` par défaut). Seul ce qui est
`public` et `published` entre dans la version publique. Le carnet du Planner n'est pas modifié ; l'export vers le site
arrive toujours privé. La construction publique s'arrête, sans rien écrire, au moindre texte privé, lieu personnel,
chemin local, clé, sauvegarde, contenu de démonstration ou photographie portant une position GPS.

## H. Sécurité

Politique stricte sur chaque page (`'self'`, sans `unsafe-*`), aucun script ni style en ligne dans le site, aucune
écriture HTML dans son script. Contenu hostile affiché comme du texte ; 17 fichiers de contenu refusés ; 10 liens
d'entrée hostiles ignorés ; options de construction contrôlées. Aucun traceur, aucun cookie, aucune requête tierce.

## I. Accessibilité

axe-core : 0 violation sur 121 scénarios (80 PASS, 41 « à vérifier », 0 FAIL). Clavier, menu, cibles de 44 px,
zoom et texte à 200 %, mouvement réduit, sans JavaScript : PASS. Lighthouse accessibilité : 100 partout.
Lecteurs d'écran : NON TESTÉ.

## J. Performance

| | Mobile | Ordinateur |
|---|---|---|
| Site (9 pages mesurées) | 100, LCP 0,9 à 1,4 s, TBT 0 ms, CLS 0 | 100, LCP 0,25 à 0,35 s |
| Planner | 91, LCP 2,78 s, TBT 86 ms | 100, LCP 0,65 s |

## K. Référencement

Titres et descriptions uniques, un h1, hiérarchie, Open Graph, adresses lisibles, liens internes : en place et testés.
Lien canonique, sitemap, `robots.txt`, données structurées : produits **dès que l'adresse du site est fournie** ;
elle ne l'est pas. Aucune note, aucun avis, aucun prix inventé.

## L. Tests

| Suite | Résultat |
|---|---|
| Fonctionnel (Planner autonome, personnel du site, public du site) | 77 / 77 × 3 |
| Interface (autonome, public du site) | 59 / 59 × 2 |
| Migration (depuis l'origine, le cycle 1, le cycle 2) | 10 / 10 × 3 |
| Trois moteurs × serveur et fichier local | 6 / 6 × 2 |
| Contrôles du cycle 2 | 36 / 36 |
| **Site** (les 20 points demandés + 14 autres) | **34 / 34** |
| Planner, comparaison pixel à pixel avec le cycle 2 | 0 % de différence sur 20 écrans |

## M. SENTINEL

Quatre audits complets : 0 secret, 0 vulnérabilité, 0 sortie réseau ; **0 constat sur le site** ; sur le Planner, les
mêmes dix constats de stockage local qu'au cycle 2, non masqués. Statut PARTIAL (`14`).

## N. Creative Engine

Moteur 9.1.0 du début à la fin. Qualité du site : 64 avant corrections, **79** après ; navigateur : 0 échec ;
certification du moteur toujours FAIL (blocages sans rapport avec un défaut d'usage). 764 des constats restants sont
des faux positifs de liens, laissés tels quels plutôt que de dégrader le cache du Planner (`15`).

## O. Régressions détectées et corrigées

| Régression ou défaut | Détecté par | État |
|---|---|---|
| Marque du Planner devenue lien : cible tactile de 25 px | `tests/ui.mjs` sur le Planner du site | corrigé |
| Textes illisibles pendant l'apparition (16 violations axe) | Creative Engine | corrigé |
| Titre sauté, focus du champ de recherche, état du menu | Creative Engine | corrigés |
| Cible du fil d'Ariane, « 1 lieux », descriptions courtes | `tests/site.mjs` | corrigés |
| Durée d'itinéraire trompeuse (121 jours pour « six semaines ») | relecture | retirée |
| Photographies publiées avec leur position GPS | relecture du rapport de confidentialité | refusées à la construction publique |

Aucune régression fonctionnelle du Planner.

## P. Contenu encore nécessaire

`CONTENT_NEEDED.md`. L'essentiel : mentions de l'éditeur, adresse du site, décision sur trois intitulés
d'itinéraires, sources des notes par pays ; puis photographies, voyages, récits, présentation.

## Q. Limites

- Aucun essai sur appareil réel, aucun lecteur d'écran, aucun GPS réel.
- Mesures de laboratoire, sur une machine chargée.
- Aucun lecteur n'a vu le site : « premium », « vivant », « identifiable » ne sont pas mesurés.
- Le contrôle de confidentialité reconnaît ce qu'on lui a décrit ; il ne remplace pas une relecture.
- Les scripts de construction n'ont pas été soumis à SENTINEL ; ils sont couverts par des tests.
- Pas d'hébergement : en-têtes HTTP, compression, page 404 servie, indexation réelle — NON TESTÉ.
- Une répétition mineure signalée par le moteur (« lieux et règles », 10 pages) n'a pas été corrigée.

## Matrice finale

| Domaine | Avant V3 | Après V3 | Statut | Preuve | Reste |
|---|---|---|---|---|---|
| Planner fonctionnel | 77 / 77 | 77 / 77 sur 3 Planners ; 0 % de pixels différents | PASS | `e2e-*`, `planner-visual-diff` | — |
| Homepage | le Planner tenait lieu d'accueil | accueil immersif, 69 Ko, LCP 1,07 s | PASS | `site-final`, `lighthouse-site`, captures | une vraie photographie |
| Voyages | inexistant | liste et page de voyage ; rubrique vide | PARTIAL | tests avec contenu de test | des voyages réels |
| Destinations | inexistant | 34 pays | PASS | `site-final` | sources des notes par pays |
| Road Trips | liste dans le Planner | 25 pages, passerelle vers le Planner | PASS | idem | valider trois intitulés |
| Carnet public | blog exporté en un fichier | liste, lecture, navigation ; rubrique vide | PARTIAL | tests avec contenu de test | des récits publiés |
| Guides | rubrique « Plus » du Planner | 4 guides de l'Atlas + guides rédigés | PASS | `site-final` | guides d'expérience |
| À propos | absent | description factuelle ; sections personnelles vides | PARTIAL | idem | présentation, van |
| Deep links Planner | aucun | `#pays`, `#lieu`, `#parcours`, `#q`, validés | PASS | `site-final`, groupe planner | — |
| Responsive | Planner : PASS | site : 10 largeurs × 8 pages, 0 débordement | PASS | `site-final`, Creative Engine | appareil réel |
| Accessibilité | axe 0 (Planner) | axe 0 sur 121 scénarios ; clavier, menu, cibles | PARTIAL | `audit-apres-site-public`, `site-final` | lecteurs d'écran |
| Performance public | — | 100 / 100, LCP ≈ 1 s, TBT 0 | PASS | `lighthouse-site` | vraies photographies, hébergeur |
| Performance Planner | mobile 92, TBT 62 ms | mobile 91, TBT 86 ms | PASS | idem | LCP 2,78 s (PARTIAL) |
| SEO | Planner seul | titres, descriptions, h1, Open Graph ; canonique et sitemap prêts | PARTIAL | `site-final` | adresse du site |
| Confidentialité | catalogue assaini | + contenu public / privé, contrôle à la construction, GPS | PASS | `site-final`, groupe confidentialité | relecture humaine avant publication |
| Build public | Planner seul | site + Planner, `--check` | PASS | sortie de la commande | mentions, adresse |
| Build personal | `index.html` | `dist/personal/` + `index.html` inchangé | PASS | `e2e-personal-site` | — |
| SENTINEL | 9 HIGH + 1 MEDIUM (stockage) | identique ; 0 sur le site | PARTIAL | `sentinel/SUMMARY.json` | constats voulus, non masqués |
| Creative Engine | qualité 70 (Planner) | 79 (site), 0 échec navigateur | PARTIAL | `creative-engine/` | certification du moteur FAIL |
| Non-régression | — | toutes les suites antérieures PASS | PASS | `16` | — |

## R. Verdict

**READY_LOCAL = YES**

Le Planner est complet et inchangé à l'usage ; les données existantes sont relues à l'identique depuis trois
versions ; tous les anciens tests passent ; la version personnelle se construit et fonctionne ; le retour en arrière
est possible. Aucun P0.

**READY_PUBLIC = NO**

Le site public est techniquement propre : aucune donnée privée détectée, contenu public séparé explicitement,
navigation complète, responsive, accessibilité automatisée sans violation, Lighthouse à 100, politique de sécurité
stricte, aucune erreur, 34 tests sur 34, rien de fictif présenté comme réel. Ce qui manque n'est pas du code :

1. les **mentions de l'éditeur** ne sont pas renseignées ;
2. l'**adresse du site** est inconnue (pas de lien canonique, de sitemap, de `robots.txt`) ;
3. **trois intitulés d'itinéraires** à valider par le propriétaire ;
4. les **notes par pays** ne sont ni sourcées ni datées ;
5. **aucun essai sur un vrai téléphone**, aucun lecteur d'écran ;
6. le site annonce des voyages et un carnet qui sont **vides**, et n'a aucune photographie.

## Auto-critique

1. **Le site ressemble-t-il encore trop à une application ?** Non pour l'accueil et les pages de lecture. Mais sans
   photographie ni récit, il tient plus de l'atlas illustré que du magazine de voyage.
2. **Ressemble-t-il trop à la référence ?** Non. Un trait commun — une première page sombre. Ni texte, ni image, ni
   structure, ni couleur, ni mécanique n'en viennent ; la référence est photographique et vidéo, Atlas Van est
   cartographique.
3. **L'identité Atlas Van est-elle reconnaissable ?** Oui par la carte de points et le couple papier / terre cuite /
   vert forêt, partagés avec le Planner. Non testé auprès de lecteurs.
4. **Les photos dominent-elles ?** Non : il n'y en a aucune. C'est le principal écart avec le cahier des charges, et
   il ne se comble pas sans les photographies du propriétaire.
5. **Le Planner reste-t-il facile à trouver ?** Oui : bouton permanent, première page, bandeaux, menu, pied de page,
   et un lien contextuel sur chaque destination, itinéraire et lieu.
6. **Une fonction du Planner a-t-elle été perdue ?** Non : 77 tests sur trois Planners, 0 % de pixels différents.
7. **Le mobile est-il réellement agréable ?** En émulation : pas de débordement de 320 à 430 px, cibles de 44 px,
   menu au pouce. Réellement : je ne peux pas le dire, aucun téléphone n'a été utilisé.
8. **Des données privées peuvent-elles fuiter dans la version publique ?** Pas par les chemins testés. Oui si un
   texte personnel est écrit dans un contenu marqué public, ou si une photographie montre quelque chose de privé :
   aucune machine ne le voit. Et publier le dépôt au lieu de `dist/public/` publierait la version personnelle.
9. **Le site fonctionne-t-il sans traceur ?** Oui : 0 requête tierce, 0 cookie, et la politique de sécurité interdit
   toute connexion sortante.
10. **L'architecture est-elle maintenable ?** Un générateur de 580 lignes sans dépendance, une feuille de style, un
    script de 65 lignes, un modèle de contenu validé, 34 tests. Le point faible : `build/site.mjs` mêle données,
    gabarits et textes dans un seul fichier.
11. **Les scores ont-ils été obtenus sans tricher ?** Oui. La politique de sécurité n'a pas été assouplie, les liens
    n'ont pas été déformés pour effacer 738 constats, les pages minces n'ont pas été gonflées, aucun `noindex` n'a
    été retiré, et la certification du moteur reste FAIL.
12. **Qu'est-ce qui reste NON TESTÉ ?** Appareil réel, GPS réel, lecteurs d'écran, couleurs forcées sous Windows,
    mode privé, IndexedDB indisponible, hébergement réel, vraies photographies, perception par des lecteurs, test
    d'intrusion.

READY_LOCAL = YES
READY_PUBLIC = NO
