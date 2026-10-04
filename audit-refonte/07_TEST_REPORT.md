# 07 — Rapport de tests

Tous les tests pilotent un vrai navigateur (Playwright 1.63, pris dans CREATIVE_ENGINE_V9 : aucune dépendance n'a
été ajoutée au projet). Build testé : `index.html`, SHA-256 dans `evidence/FINAL_SHA256.txt`.

## Synthèse

| Suite | Commande | Baseline | Version finale | Statut | Preuve |
|---|---|---|---|---|---|
| Fonctionnelle (parcours 1 à 6, données, sécurité) | `node tests/e2e.mjs` | 69 / 77 | **77 / 77** | PASS | `evidence/e2e-baseline.json`, `e2e-refonte.json` |
| Interface (9 largeurs, clavier, tactile) | `node tests/ui.mjs` | 19 / 42 ¹ | **59 / 59** | PASS | `evidence/ui-baseline.json`, `ui-refonte.json` |
| Compatibilité des données | `node tests/migration.mjs` | — | **10 / 10** | PASS | `evidence/migration.json` |
| Navigateurs et fichier local | `node tests/smoke.mjs` | — | **6 / 6** | PASS | `evidence/smoke.json` |
| Captures | `node tests/screenshots.mjs` | 80 | 90 | PASS (0 erreur de console) | `screenshots/` |
| Performance | `node tests/perf.mjs` | mesuré | mesuré | voir `09` | `evidence/perf-*.json` |
| Variante à fichiers séparés | `node tests/e2e.mjs --dir <split> --only P1,securite` | — | 22 / 22 | PASS | exécution du 2026-10-04 |
| Synchronisation des sources | `node build.mjs --check` | — | conforme | PASS | sortie console |

¹ La baseline n'a pas les 17 contrôles propres à la nouvelle interface (aperçu mobile, menu d'outils…).

## Suite fonctionnelle — 77 tests

| Parcours du cahier des charges | Tests | Baseline | Finale |
|---|---:|---:|---:|
| **1 — Explorer** : ouvrir, rechercher (souris et clavier), zoomer (boutons, molette, touches), déplacer, cliquer un lieu, fiche et liens, filtres (catégorie, importance, pays, mois), liste, favoris/notes/budget persistants, noms, lieu personnel, modification, ajout rapide | 16 | 16 | 16 |
| **2 — Trajet** : ajouter, insérer, monter/descendre/position/glisser, distances et budget, options persistantes, supprimer, annuler/rétablir (boutons et Ctrl+Z), inverser/boucler/optimiser, exports `.json` `.gpx` `.md` et copie, import, fichier illisible, parcours prêts, parcours enregistrés, Google Maps, ajout par pays, proximité | 15 | 15 | 15 |
| **3 — Carnet** : état vide, article avec lieu/texte/photo (réduite à 1 600 px), brouillon automatique, titre obligatoire, modifier, finaliser, lire, photo agrandie, recherche/filtres, relecture IndexedDB, export du blog (brouillons exclus, aucun script), fil du voyage, suppression annulable, titre/auteur, photo refusée | 12 | 12 | 12 |
| **4 — Sauvegarde** : modifier, tout sauvegarder, navigateur vierge, restaurer, vérifier ; sauvegarde légère ; fichiers invalides refusés ; réinitialisation ; stockage corrompu ; quota atteint | 7 | 5 | 7 |
| **5 — Géolocalisation** : autorisée, refusée, indisponible, délai dépassé, arrêt manuel, navigateur sans GPS, lieux proches | 7 | 7 | 7 |
| **6 — Mobile 390 × 844** : navigation, toucher un lieu, ajouter, pincer, filtres, paramètres et discrétion, carnet, débordement | 9 | 9 | 9 |
| Clavier : dialogues, onglets, champs nommés, focus | 5 | 4 | 5 |
| Sécurité : 3 scénarios d'injection, requêtes tierces, politique de sécurité | 6 | 1 | 6 |

Les tests agissent par les identifiants et l'état interne de l'application : **le même fichier de tests s'exécute sur
la baseline et sur la version finale.**

### Tests adaptés pendant la refonte

Sept tests ont été ajustés parce que l'interface a changé par conception. Chaque ajustement garde le même
contrôle de fond et continue de passer sur la baseline (69 / 77 revérifié après ajustement).

| Test | Ajustement |
|---|---|
| Compteurs de lieux | lecture du nombre quel que soit le séparateur de milliers (« 1 600 ») |
| Suppression d'un lieu personnel | accepte une confirmation |
| Filtres depuis la carte | vérifie que le filtre survit à la fermeture du dialogue (au lieu du déplacement d'un bloc) |
| Paramètres sur mobile | ouvre par le bouton visible, ou par Plus |
| Sauvegardes, fiches pays, checklist | cherchés dans le dialogue **ou** dans la rubrique Plus |
| Toucher un lieu sur mobile | passe par l'aperçu, puis « Voir la fiche » |
| Titre de la fiche | accepte un titre de niveau 2 ou 3 |

Quatre erreurs d'hypothèse dans mes premiers tests ont été corrigées avant de figer la baseline (nombre de lieux
du Portugal, premier résultat pour « porto », glisser-déposer simulé, enchaînement de filtres).

## Compatibilité des données — 10 tests

L'ancienne et la nouvelle version sont servies tour à tour à la même adresse, donc sur les mêmes données de navigateur.

| Test | Statut |
|---|---|
| Ancienne version : création d'un jeu complet (6 étapes, notes, favori, lieu personnel, fiche modifiée, parcours enregistré, réglages, discrétion, 2 articles, 2 photos) | PASS |
| Nouvelle version : trajet, notes, lieux, fiches, parcours, réglages, distance et budget identiques | PASS |
| Nouvelle version : carnet et photos identiques (IndexedDB) | PASS |
| Nouvelle version : discrétion conservée et appliquée | PASS |
| Nouvelle version : aucune erreur, rien mis de côté | PASS |
| Nouvelle version : une modification s'enregistre et se relit | PASS |
| **Retour à l'ancienne version** : elle relit ce que la nouvelle a écrit | PASS |
| Sauvegarde complète de l'ancienne version restaurée par la nouvelle | PASS |
| Sauvegarde légère de l'ancienne version restaurée par la nouvelle | PASS |
| Parcours `.json` de l'ancienne version importé par la nouvelle | PASS |

## Navigateurs — 6 passages

Parcours : démarrage (1 600 lieux), recherche et fiche, ajout au trajet, dialogue des filtres, zoom, article du
carnet, rechargement, politique de sécurité.

| Moteur | Par serveur local | En fichier (`file://`) |
|---|---|---|
| Chromium 153 | PASS | PASS |
| Firefox 155 | PASS | PASS |
| WebKit 26.6 (moteur de Safari) | PASS | PASS |

## Non testé

| Élément | Statut | Raison |
|---|---|---|
| GPS réel sur un appareil | NON TESTÉ | la position est simulée par le navigateur de test |
| Appareils physiques (iPhone, Android, iPad) | NON TESTÉ | émulation uniquement : tailles, tactile, pointeur imprécis |
| Clavier virtuel | NON TESTÉ | non simulable ; seul le contrôle « champs ≥ 16 px » est fait |
| Encoches et zones sûres | NON TESTÉ | les marges `env(safe-area-inset-*)` sont en place, non vérifiées sur appareil |
| Lecteur d'écran (VoiceOver, NVDA, TalkBack) | NON TESTÉ | aucune écoute réelle |
| Navigation privée | NON TESTÉ | les chemins « stockage indisponible » sont codés ; seul l'échec d'écriture est testé |
| Quota réel du navigateur, carnet de plusieurs centaines de photos | NON TESTÉ | l'échec est simulé |
| Geste de pincement réel | PARTIAL | simulé par événements de pointeur |
| Glisser-déposer à la souris | PARTIAL | simulé par événements ; indisponible au doigt (les boutons d'étape le remplacent) |
| Anciens navigateurs (Safari < 15.4) | NON TESTÉ | un message s'affiche si les dialogues natifs manquent |
