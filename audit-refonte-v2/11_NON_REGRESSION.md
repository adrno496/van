# 11 — Non-régression

Règle du cycle : aucune fonction retirée, aucune donnée perdue, aucun format modifié. Chaque ligne ci-dessous
renvoie à un test exécuté sur la version finale. Les mêmes suites passaient sur la baseline V2.

## Fonctions à préserver

| Fonction | Statut | Testé réellement ? | Preuve |
|---|---|---|---|
| Carte : affichage, zoom (boutons, molette, clavier), déplacement, double-clic | PASS | oui | `e2e` P1 (3 tests), `ui` |
| ~1 600 lieux sur la carte | PASS | oui | `e2e` P1 : 1 600 lieux, 1 600 marqueurs ; `smoke` dans 3 moteurs |
| Sélection d'un lieu au clic et au toucher, choix dans un groupe serré | PASS | oui | `e2e` P1, P6 |
| Recherche (résultats, clavier, sans résultat) | PASS | oui | `e2e` P1 (3 tests) |
| Filtres : catégorie, importance, pays, mois, favoris, faits, notes, proximité du trajet | PASS | oui | `e2e` P1, P2 |
| Liste des lieux : recherche, pagination, « dans cette vue », nouveautés | PASS | oui | `e2e` P1 |
| Favoris, statut « fait », notes, budget et date par lieu | PASS | oui | `e2e` P1, persistance après rechargement |
| Fiche d'un lieu, liens externes sûrs, lieux proches, modification, rétablissement | PASS | oui | `e2e` P1 (2 tests), `v2` sécurité |
| Lieux personnels : création, édition, suppression | PASS | oui | `e2e` P1 |
| Trajet : ajout, ordre, glisser-déposer, suppression, annuler et rétablir | PASS | oui | `e2e` P2 (4 tests) |
| Inverser, boucler, optimiser | PASS | oui | `e2e` P2 |
| Distance, durée, carburant, budget ; options persistantes | PASS | oui | `e2e` P2 ; migration : kilomètres et budget identiques |
| Idées de parcours, parcours enregistrés, ajout groupé par pays | PASS | oui | `e2e` P2 (3 tests) |
| Exports `.json`, `.gpx`, `.md`, copie ; import d'un parcours | PASS | oui | `e2e` P2 (3 tests) |
| Navigation Google Maps par tronçons, recherche le long du parcours | PASS | oui | `e2e` P2, `ui` |
| Carnet : création, brouillon automatique, modification, publication locale, lecture, recherche, suppression avec annulation, personnalisation | PASS | oui | `e2e` P3 (12 tests) |
| Photos : ajout, compression à 1 600 px, légende, refus des formats non pris en charge, limite de 12 | PASS | oui | `e2e` P3 |
| IndexedDB : persistance du carnet et des photos | PASS | oui | `e2e` P3, migration |
| `localStorage` : trajet, notes, fiches, réglages | PASS | oui | `e2e`, migration |
| Blog exporté (HTML autonome, sans script, brouillons exclus, carte des étapes) | PASS | oui | `e2e` P3 ; `v2` : fichier ouvert dans un navigateur |
| Sauvegarde complète et restauration dans un navigateur vierge | PASS | oui | `e2e` P4 ; migration (2 versions) ; `v2` : restauration pendant un enregistrement en attente |
| Sauvegarde légère (v3) et restauration ; sauvegarde invalide refusée ; réinitialisation | PASS | oui | `e2e` P4 |
| Stockage corrompu : l'application démarre ; quota atteint : message | PASS | oui | `e2e` P4 |
| Géolocalisation : autorisée, refusée, indisponible, délai, absente ; « Près de moi » | PASS (position simulée) | oui, en émulation | `e2e` P5 (7 tests) |
| Ouverture en fichier local (`file://`) | PASS | oui | `smoke` : Chromium, Firefox, WebKit |
| Fonctionnement sans réseau | PASS | oui | 0 requête ; `connect-src 'none'` |
| Mise en page : 320 à 1440 px, tablette tactile | PASS | oui | `ui` (42 contrôles), audit Creative Engine (5 largeurs) |
| Mobile : navigation inférieure, aperçu d'un lieu, pincement, dialogues, carnet | PASS | oui, en émulation | `e2e` P6 (9 tests) |
| Clavier : onglets, dialogues, focus visible, champs nommés | PASS | oui | `e2e`, `ui`, audit Creative Engine |
| Accessibilité automatisée | PASS | oui | axe-core : 0 violation sur 11 scénarios |
| Politique de sécurité à empreintes | PASS | oui | 0 violation ; test d'attaque |
| Confidentialité : aucune requête, discrétion (flou), position jamais enregistrée | PASS | oui | `e2e`, `v2` |
| Compatibilité des anciennes données (version d'origine et version du cycle 1), aller et retour | PASS | oui | migration 10 / 10 depuis chacune |

## Formats de données : inchangés

| Format | Vérification |
|---|---|
| `localStorage` `atlasvan.v3` | relu à l'identique depuis la version d'origine et depuis celle du cycle 1 ; relu par l'ancienne version après écriture par la nouvelle |
| IndexedDB `atlasvan.journal.v1` | idem (articles, photos, titre, auteur) |
| `atlasvan.privacy`, `atlasvan.location.enabled`, `atlasvan.v3.recovery` | inchangés |
| Sauvegardes v5 et v3, parcours `.json`, `.gpx`, `.md` | produits par l'ancienne version, importés par la nouvelle |
| Identifiants des lieux | inchangés (`src/data/places.js` identique à l'octet près) |

Aucune clé de stockage ajoutée, aucune migration nécessaire. Les repères internes ajoutés aux lieux en mémoire
(`_r`, `_off`, `_cls`, `_k`…) ne sont jamais enregistrés : les lieux personnels sont écrits champ par champ.

## Régressions rencontrées pendant le cycle, toutes corrigées avant commit

| Régression | Détectée par | Correction |
|---|---|---|
| Noms de pays : l'opacité n'était plus portée par chaque nom | `e2e` « noms de pays » (à la relecture du test, avant exécution) | retour à un attribut par nom |
| Preuves du cycle 1 écrasées par les rapports de test | `git status` | fichiers restaurés ; dossier de sortie par défaut changé |
| — | — | aucune autre : les quatre suites sont passées à chaque lot |

## Défaut antérieur corrigé

Restauration complète écrasée par un enregistrement en attente (voir `06`, lot 6) : ce n'est pas une régression de ce
cycle — le défaut existait dans la version livrée au cycle 1 — mais il touchait une fonction à préserver. Corrigé et
testé.

## Écarts volontaires de comportement

Formes des marqueurs, survol au plus proche, noms au-dessus des marqueurs, bouton « retour » mobile, démarrage en
étapes, deux couleurs assombries : liste et raisons dans `06_IMPLEMENTATION_LOG.md`. Aucun ne retire une possibilité.

## Ce que la non-régression ne couvre pas

| Point | Statut |
|---|---|
| Comparaison visuelle pixel à pixel avec le cycle 1 | NON TESTÉ — la carte a changé de dessin volontairement |
| Appareil réel, GPS réel, lecteurs d'écran | NON TESTÉ (`03`) |
| Très anciens navigateurs | NON TESTÉ — `MessageChannel`, `Intl.Collator`, `MutationObserver` sont requis ; ils sont présents dans tout navigateur qui a déjà `<dialog>`, déjà exigé au cycle 1 |
| Mode privé | NON TESTÉ |
