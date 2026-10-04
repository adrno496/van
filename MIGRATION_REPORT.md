# Rapport de migration des données

## Stockage local du visiteur : aucune migration

| Donnée | Avant | Après | Migration |
|---|---|---|---|
| `localStorage` `atlasvan.v3` (trajet, notes, favoris, lieux personnels `cN`, parcours enregistrés, réglages) | format v3 | **inchangé** | aucune |
| IndexedDB `atlasvan.journal.v1` (carnet, photos) | v1 | **inchangé** | aucune |
| `atlasvan.privacy` | inchangé | inchangé | aucune |
| `atlasvan.partage.session` (nouveau, pages Partage seulement) | — | jetons de session Partage | création à la connexion, effacé à la déconnexion ou à la suppression du compte |

Ce que Partage apporte au Planner passe par les structures existantes : un spot devient un lieu personnel `cN`
(catégorie `perso`), un circuit devient des étapes du trajet ou un parcours de `ST.saved`. Aucune clé, aucun champ
nouveau n'est écrit dans `atlasvan.v3`, qui reste lisible par la version précédente du Planner et inversement.

Contrôles : `tests/migration.mjs --old audit-refonte-v3/baseline/index.v2-final.html --new index.html` (sauvegardes et
données de l'ancienne version relues par la nouvelle) — voir `TEST_REPORT.md` ; e2e « sauvegarde », « carnet »,
« lieux personnels » ; `tests/partage.mjs` (import d'un circuit et d'un spot : trajet enregistré dans `atlasvan.v3`, lieux personnels
retrouvés au chargement suivant sans doublon, catalogue inchangé).

Aucune donnée locale n'est effacée par cette version. La seule suppression nouvelle est volontaire et confirmée :
« Supprimer mon compte » (côté serveur Partage), qui n'efface rien sur l'appareil hormis la session Partage.

## Fichier d'export « pour le site » : version 1 → 2

| | Version 1 (avant) | Version 2 (maintenant) |
|---|---|---|
| Identifiant de la note | absent | `id` (identifiant stable de la note du carnet) |
| Lieu personnel | perdu (`placeId: null`) | `place` : nom, pays, position **arrondie à 0,1°** dès l'export |
| Lecteur | `build/import-articles.mjs` | le même, qui lit **les deux versions** |

Un fichier v1 reçoit un identifiant dérivé de sa date et de son titre (`v1-<empreinte>`) : réimporté, il est reconnu.
Essai : `tests/import.mjs` « ancien format accepté ».

## Fichiers de content/ : compatibles

Les nouveaux champs (`site.json` : `hero`, `currentVoyage`, `community` ; voyages : `state`, `planned`, `showPlanned` ;
articles : `place`, `onMap`, `source`) sont tous **facultatifs** : un `content/` d'avant se construit sans changement
(essai : contenu de test d'origine dans `tests/site.mjs`). Un article importé avant cette version n'a pas de `source` :
réimporter sa note crée un nouveau fichier (suffixe `-2`) plutôt que de l'écraser — à supprimer à la main si besoin.

## Base Partage

Première version du schéma (`backend/migrations/0001_community.sql`) : rien à migrer. Les migrations suivantes
s'ajouteront en `0002_…`, appliquées dans l'ordre ; ne jamais modifier une migration déjà appliquée.

## Retour en arrière

- Code : `git revert` des commits de cette transformation (liste dans `IMPLEMENTATION_REPORT.md`) ; le stockage local
  n'ayant pas changé, l'ancienne version relit les données telles quelles. Les lieux personnels créés depuis Partage
  restent des lieux personnels ordinaires.
- Articles importés : les fichiers v2 portent des clés (`source`, `place`, `onMap`) que l'ancienne version refuserait ;
  avant un retour en arrière, retirer ces clés (ou ces fichiers) de `content/articles/`.
