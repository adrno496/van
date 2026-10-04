# 11 — Non-régression

Règle suivie : zéro régression fonctionnelle, zéro perte de données, zéro suppression silencieuse.

## Preuve principale

La **même** suite de 77 tests donne 69 / 77 sur la baseline et **77 / 77** sur la version finale
(`evidence/e2e-baseline.json`, `evidence/e2e-refonte.json`). Aucun test qui passait sur la baseline n'échoue après.

## Fonction par fonction

| Fonction de la baseline | Conservée | Vérification |
|---|---|---|
| Carte, 1 600 marqueurs, 47 pays | oui | test de chargement |
| Zoom boutons / molette / pincement / double-clic / `+` `−` `0` | oui | tests ; double-clic non testé (code inchangé) |
| Déplacement souris et doigt | oui | tests |
| Barre d'échelle | oui | code inchangé, visible sur les captures |
| Infobulle au survol | oui | exercée dans les tests de sécurité |
| Recherche globale, résultats au clavier | oui | tests |
| Sélection d'un lieu, choix parmi plusieurs lieux proches, « Zoomer ici » | oui | tests |
| Fiche : résumé, badges, à voir, tarifs, 16 liens pratiques, contrats, fiche pays, sources, office de tourisme | oui | test (liens ≥ 10, tous `https` et `noopener`) ; lecture du code |
| Lieux à moins de 100 km, lieux à moins de 50 km | oui | test ; lecture |
| Statut, note, budget, date | oui | test + rechargement |
| Modifier une fiche, coordonnées refusées, rétablir l'original | oui | tests ; « rétablir » non testé (code repris) |
| Lieu personnel : créer, éditer, supprimer | oui (+ confirmation) | test |
| Filtres : 6 catégories, 3 importances, pays, mois, favoris, faits, notes, proximité du trajet, autour de moi | oui | tests |
| Noms des lieux / tous les noms / noms des pays | oui (le second fonctionne enfin) | test |
| Liste des lieux, recherche, nouveautés, dans cette vue, tout afficher, pagination | oui | tests |
| Trajet : ajouter, insérer, monter, descendre, déplacer, glisser, retirer, vider | oui | tests |
| Annuler / rétablir, Ctrl+Z | oui | tests |
| Inverser, boucler, optimiser | oui | tests |
| Distance, durée, gazole, budget détaillé, 8 réglages, alerte hors saison | oui | tests ; alerte non testée (code repris) |
| Google Maps par tronçons | oui | test |
| Chercher le long du trajet | oui (liens au lieu de fenêtres, toutes les étapes) | test |
| Exports `.json`, `.gpx`, `.md`, copie | oui | tests |
| Import d'un parcours | oui (+ contrôle) | tests |
| 25 parcours prêts, filtres, ajout à la suite, retour visuel, aperçu partagé sur mobile | oui | tests |
| Parcours enregistrés : créer, mettre à jour, supprimer | oui | test |
| Bases d'hébergement, ajout groupé par pays | oui | test ; bases : lecture |
| Carnet : tout | oui | 12 tests |
| Sauvegarde complète, légère, restauration, réinitialisation | oui (restauration unifiée et contrôlée) | tests |
| Localisation : tout, « aux alentours » | oui (renommé « Près de moi ») | 7 tests |
| Discrétion (flou par rubrique) | oui | test |
| Fiches pays, checklist, conseils, tarifs, sources | oui (rubrique Plus) | test de présence et de contenu |
| Navigation mobile | oui (5 entrées) | tests |
| Mode « clic = ajouter » | oui (« Ajout rapide ») | test |
| Vue d'ensemble | oui (menu, touche `0`) | test |

## Données

| Vérification | Résultat |
|---|---|
| Clés et formats de stockage | inchangés (`atlasvan.v3`, `atlasvan.journal.v1`, `atlasvan.privacy`, `atlasvan.location.enabled`) |
| Données écrites par l'ancienne version, lues par la nouvelle | identiques — trajet, notes, lieux, fiches, parcours, réglages, distance, budget, carnet, photos |
| Retour à l'ancienne version après usage de la nouvelle | fonctionne |
| Fichiers de l'ancienne version (sauvegarde complète, légère, parcours) | importés par la nouvelle |
| Catalogue | repris octet pour octet (`src/data/places.js`) |

Preuve : `tests/migration.mjs`, 10 / 10.

**Une différence à connaître.** La nouvelle version refuse une sauvegarde dont un champ a un type invalide, là où
l'ancienne l'acceptait sans regarder. Une sauvegarde produite par un usage normal passe (testé). Un fichier
modifié à la main pourrait être refusé : le message indique pourquoi, et rien n'est alors modifié.

## Régressions rencontrées et traitées

| Régression | Détectée par | Statut |
|---|---|---|
| Dialogue refermé par le clic fantôme d'un toucher (mobile) | suite fonctionnelle | corrigée |
| Formulaire inséré dans une section repliée | suite fonctionnelle | corrigée |
| Attribut ARIA interdit, infobulle sans nom, champs de fichier sans nom | audit Creative Engine | corrigées |
| Commandes inaccessibles au clavier (menu, onglets) | audit Creative Engine | corrigées |
| Pastilles coupées au bord de l'écran, onglets débordant à 200 % | audit Creative Engine | corrigées |
| Cibles tactiles de 28 à 36 px, texte de 11 px | `tests/ui.mjs` | corrigées |
| Numéros d'étape mal centrés (défaut de la baseline rendu visible) | capture | corrigé |

## Régressions restantes ou points de vigilance

| Point | Nature |
|---|---|
| Poids du fichier : +66 Ko (+4,3 %) | assumé |
| Temps de blocage Lighthouse mobile : 78 → 382 ms | **réelle dégradation de cet indicateur** : le travail de démarrage se fait après le premier affichage ; le démarrage total, lui, est plus court (1 581 → 698 ms en mobile simulé) |
| Score SEO Lighthouse : 100 → 91 | la politique de sécurité bloque le téléchargement de `robots.txt` par Lighthouse |
| Creative Engine `compare` : `regression: true` | 2 constats SEO introduits, sans objet pour une application locale |
| Sur mobile, ouvrir la fiche complète depuis la carte demande un toucher de plus | choix de conception (la carte reste visible) |
| Catégories : un toucher de plus sur mobile (dans « Filtres ») | choix de conception (carte moins encombrée) |
| Polices : Fraunces et Karla remplacées par les polices du système | le rendu varie selon l'appareil (Iowan Old Style sur Apple, Georgia ou serif ailleurs) |
| Modifier `index.html` à la main ne suffit plus | il faut modifier `src/` puis lancer `node build.mjs` |

## Contrôles après chaque lot (§39)

Tests relancés, comparaison à la baseline, console (0 erreur dans toutes les suites), responsive (9 largeurs),
stockage (rechargements), export/import (4 formats) : faits à chaque lot, sept passages complets de la suite
fonctionnelle au total (`evidence/e2e-run1.json` à `e2e-run5.json`, puis `e2e-refonte.json`).
