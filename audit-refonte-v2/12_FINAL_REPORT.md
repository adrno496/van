# 12 — Rapport final du cycle 2

Atlas van — performance mobile, carte, appareil réel, version publique. Mission exécutée le 4 octobre 2026 sur
`/Users/dreano/Downloads/van-main`, à partir de la version livrée à la fin du cycle 1.

## En bref

Le temps de blocage mobile, qui avait augmenté au cycle 1, est passé de **426 ms à 62 ms** (Lighthouse, séries
appariées), le score mobile de **79 à 92**. La carte dessine un élément par lieu au lieu de quatre, le zoom par
pincement est deux fois plus fluide, et les catégories se distinguent par leur **forme**, plus seulement par leur
couleur. Le projet a son dépôt Git, et une **version publique** se construit sans les cinq lieux personnels, avec
un contrôle qui fait échouer la construction au moindre doute. Un défaut de restauration hérité du cycle 1 a été
trouvé et corrigé. Les 77 tests fonctionnels passent sur les deux versions.

Ce qui n'a **pas** été fait : aucun essai sur un vrai téléphone, aucun GPS réel, aucun lecteur d'écran — il n'y
avait pas d'appareil. C'est la raison principale du verdict public.

## Ce qui a changé

| Domaine | Changement | Rapport |
|---|---|---|
| Démarrage | catalogue en JSON, pays dessinés à la construction, quatre étapes courtes | `01`, `02` |
| Carte | un élément SVG par lieu, noms à la demande, écritures seulement en cas de changement | `02` |
| Zoom | contours et textes qui suivent le zoom sans recalcul | `02` |
| Recherche et filtres | clés et ordre de tri en cache | `02` |
| Accessibilité | une forme par catégorie, carte et légende ; deux couleurs ajustées à 3:1 | `04` |
| Mobile | le bouton « retour » referme le premier plan au lieu de quitter l'application | `06` |
| Données | restauration complète désormais atomique | `06`, lot 6 |
| Construction | `--mode personal` / `--mode public`, contrôle de confidentialité | `10` |
| Outillage | dépôt Git, profileur, comparaisons en alternance, 36 nouveaux contrôles | `05`, `07` |

Rien n'a été retiré. Le design n'a pas été refait. Aucune dépendance n'a été ajoutée. Les formats de données sont
inchangés.

## Mesures principales

| Mesure | Avant | Après | Source |
|---|---:|---:|---|
| Lighthouse mobile — performance | 79 | **92** | séries appariées, médiane de 3 |
| Lighthouse mobile — TBT | 426 ms | **62 ms** | idem |
| Lighthouse mobile — LCP | 3,04 s | 2,77 s | idem |
| Lighthouse ordinateur — performance / TBT | 100 / 14 ms | 100 / 0 ms | idem |
| Temps de blocage, mobile émulé ×4 | 383 ms | 104 ms | alternance, 9 passages, charge 7,6 |
| (même mesure, machine plus chargée) | 503 ms | 162 ms | alternance, 11 passages, charge 12,6 |
| Plus longue tâche, mobile ×4 | 355 ms | 114 ms | alternance |
| Pincement : durée d'une image, mobile ×4 | 38,5 ms | 18,9 ms | alternance |
| Éléments dans la page | 9 603 | 4 893 | profil |
| Poids du fichier | 1 601 923 octets | 1 505 829 octets | construction |
| axe-core : violations | 0 | 0 | Creative Engine, 11 scénarios |
| Contraste minimal des marqueurs sur la carte | 2,74 | 3,07 | calcul, 51 couples |

La machine est restée chargée pendant toute la mission ; les valeurs absolues sont majorées, les comparaisons sont
appariées. Détail et limites : `01_PERFORMANCE_ANALYSIS.md`.

## Priorités traitées

| Priorité | Sujet | État |
|---|---|---|
| P0 | aucune régression fonctionnelle, aucune perte de données | tenu ; un défaut de perte de données antérieur corrigé |
| P1 | TBT mobile, rendu de la carte, dépôt Git | fait |
| P1 | formes des marqueurs, contrastes de la carte | fait |
| P2 | version publique sans données personnelles | fait ; trois intitulés de parcours à valider par le propriétaire |
| P2 | bouton « retour » mobile | fait, vérifié en émulation |
| P2 | appareil réel, GPS réel | **non fait — pas d'appareil** |
| P3 | chiffrement des données locales | non fait, volontairement : recommandation |

## Préparation par usage

| Usage | Statut | Preuve | Limite |
|---|---|---|---|
| Usage personnel local | **PASS** | 77 + 59 + 10 + 10 + 6 + 36 tests ; données du cycle 1 et d'origine relues à l'identique | jamais essayé sur un téléphone |
| Usage hors ligne | **PASS** | 0 requête ; `connect-src 'none'` ; fichier local dans 3 moteurs | idem |
| Partage du fichier à un tiers | **PARTIAL** | version publique : contrôle de confidentialité, 77 + 59 + 6 + 7 tests | trois intitulés de parcours évoquent le projet et la région de départ : à valider |
| Hébergement public | **PARTIAL** | idem + Lighthouse 92 / 100 / 100, CSP stricte, aucun traceur | appareil réel et lecteurs d'écran non testés ; LCP mobile 2,77 s ; ni mentions légales ni domaine (hors périmètre) |
| Données personnelles | **PASS** (fichier public) | inventaire, contrôle à la construction, tests | règle à tenir à jour avec le catalogue ; données locales non chiffrées |
| Sécurité | **PASS** pour ce qui a été testé | 16 scénarios d'attaque, CSP éprouvée, revue de 388 insertions HTML, 0 secret, 0 dépendance | pas de test d'intrusion par un tiers |
| Performance mobile | **PASS** en laboratoire | TBT 62 ms, score 92 | émulation ; LCP PARTIAL |
| Accessibilité | **PARTIAL** | axe 0 violation, contrastes calculés, clavier, zoom et texte 200 % | lecteurs d'écran NON TESTÉ |

## Matrice finale

| Domaine | Statut | Testé réellement ? | Avant | Après | Reste à faire |
|---|---|---|---|---|---|
| Fonctionnel | PASS | oui — 77 tests, navigateur réel | 77 / 77 | 77 / 77 (et 77 / 77 en version publique) | — |
| UI/UX | PASS | oui — 59 contrôles, 110 captures | 59 / 59 | 59 / 59 ; bouton « retour » mobile ; survol cohérent avec le clic | essai par des utilisateurs : NON TESTÉ |
| Responsive | PASS | oui — 8 largeurs, 320 à 1440 px, tablette tactile | 0 débordement | 0 débordement | — |
| Performance mobile | PASS (laboratoire) | oui, en émulation | Lighthouse 79, démarrage 839 ms (×4) | Lighthouse 92, démarrage 654 ms | LCP 2,77 s : PARTIAL — meilleure valeur stable obtenue |
| TBT mobile | PASS | oui — Lighthouse, 3 passages × 2 séries | 426 ms | 62 ms (objectif < 250, idéal < 200) | — |
| Carte 1 600 lieux | PASS | oui — profil, alternance, endurance | 6 405 éléments, pincement 38,5 ms/image | 1 600 éléments, 18,9 ms/image | — |
| Accessibilité | PARTIAL | oui pour l'automatisé et les contrastes | couleur seule ; 2 couleurs à 2,7:1 | formes ; 51 / 51 contrastes ; axe 0 | lecteurs d'écran, daltonisme réel, couleurs forcées : NON TESTÉ |
| Appareil réel | **NON TESTÉ — appareil réel absent** | non | non testé | non testé | 20 minutes avec un téléphone (`03`) |
| GPS réel | **NON TESTÉ — GPS réel indisponible** | non — position simulée seulement | simulé | simulé | essai dehors |
| Sécurité | PASS | oui — 16 scénarios, CSP attaquée | 5 scénarios | 16 scénarios ; restauration atomique | test d'intrusion tiers ; fichier de 100 Mo |
| Données | PASS | oui — migration depuis 2 versions, aller et retour | 10 / 10 | 10 / 10 + 10 / 10 ; défaut de restauration corrigé | chiffrement : recommandation P3 |
| Build public | PASS | oui — 77 + 59 + 6 + 7 tests, contrôle à la construction | inexistant | `node build.mjs --mode public`, 1 595 lieux | valider 3 intitulés de parcours |
| SENTINEL | PARTIAL | oui — 6 passages complets | 9 HIGH + 1 MEDIUM (stockage local), 0 secret, 0 vulnérabilité | identique ; aucun constat nouveau | les constats décrivent le fonctionnement voulu ; non masqués |
| Creative Engine | PARTIAL | oui — 5 audits, 4 séries Lighthouse, 2 comparaisons, moteur 9.1.0 constant | qualité 70 / 77, Lighthouse mobile 79 | qualité 70 / 77 (aucune régression), Lighthouse mobile 92 | certification du moteur FAIL : règles SEO d'un site public, NON APPLICABLE |
| Git / rollback | PASS | oui — `git revert` par lot, baselines conservées | aucun dépôt | dépôt du projet, 9 commits, 2 baselines | aucun dépôt distant (non demandé) |

## Ce qui reste, par ordre d'utilité

1. **Essayer sur un téléphone** (Android et iPhone) : carte, clavier, photo, position, bouton « retour », plein jour.
   Liste en sept points dans `03_REAL_DEVICE_REPORT.md`.
2. **Décider** si « Année 1 », « Année 2 » et « depuis la Vendée » peuvent figurer dans un fichier public (`10`).
3. Lecteur d'écran : parcourir Explorer, Trajet et le carnet avec VoiceOver ou TalkBack.
4. Avant un hébergement : mentions légales, choix du domaine, en-têtes HTTP du serveur (la politique de sécurité est
   déjà dans la page), `noindex` ou non.
5. Si le LCP mobile compte : sortir le catalogue du fichier pour la variante hébergée (`--split` existe déjà) et
   servir compressé — à mesurer, pas fait ici.
6. Chiffrement par phrase secrète des données locales : à décider en connaissant le compromis (phrase oubliée =
   données perdues).

## Limites de ce rapport

- Toutes les mesures de performance sont des mesures de laboratoire, en émulation, sur une machine chargée.
- « PASS » veut dire : le test décrit a été exécuté et l'effet attendu observé. Cela ne couvre pas ce que les tests
  ne décrivent pas.
- La revue de sécurité repose sur des tests d'attaque automatisés et sur ma relecture ; ce n'est pas un test
  d'intrusion.
- SENTINEL n'analyse pas le JavaScript d'un fichier unique : seuls les audits « fichiers séparés » sont probants.
- La certification de Creative Engine reste FAIL ; elle vise des sites vitrines.

## Verdict

**READY_LOCAL = YES**

Toutes les fonctions sont préservées et testées (77 / 77, 59 / 59, 10 / 10 depuis deux versions, 6 / 6, 36 / 36), les
données existantes sont relues à l'identique, aucun P0 n'est ouvert, le retour en arrière est possible lot par lot,
et la version est plus rapide que celle du cycle 1 sur toutes les mesures. Réserve : jamais essayée sur un vrai
téléphone.

**READY_PUBLIC = NO**

Le fichier public est techniquement prêt — aucune donnée personnelle détectée, contrôle à la construction, 77 / 77
tests, politique de sécurité stricte, aucun traceur, Lighthouse mobile 92. Trois choses empêchent de l'affirmer :

1. **aucun essai sur appareil réel**, ni GPS réel, ni lecteur d'écran — pour une application faite pour être
   utilisée sur la route, c'est une condition, pas un détail ;
2. **trois intitulés de parcours** restent à valider par le propriétaire avant diffusion ;
3. le statut mobile de Lighthouse reste PARTIAL (LCP 2,77 s) et le contrôle de déploiement de SENTINEL reste en échec
   sur le stockage local non chiffré — deux points connus, expliqués, non masqués.

Les points 1 et 2 ne demandent pas de code. Une fois levés, le verdict public peut être réexaminé.
