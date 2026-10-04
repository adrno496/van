# 03 — Appareil réel, GPS réel, clavier mobile

## Ce qui était disponible

| Moyen | Recherché par | Résultat |
|---|---|---|
| Téléphone Android relié | `adb devices` | `adb` absent de la machine |
| Simulateur iOS | `xcrun simctl list` | outil absent (Xcode non installé) |
| Appareil relié en USB | `system_profiler SPUSBDataType` | aucun téléphone ni tablette détecté |
| Navigateurs de bureau pilotés | Playwright 1.63 : Chromium 153, Firefox 155, WebKit 26.6 | disponibles |

## Statuts

| Domaine | Statut | Ce qui a réellement été fait |
|---|---|---|
| Appareil réel (Android, iPhone, tablette) | **NON TESTÉ — appareil réel absent** | rien sur un appareil |
| Toucher, pincement, déplacement | **PARTIAL — émulation uniquement** | événements tactiles émulés dans Chromium (390 × 844, 430 × 932, 360 × 800, 320 × 568, tablette 1024 × 768) : toucher un lieu, pincement à deux doigts, navigation inférieure, dialogues — `tests/e2e.mjs` groupe mobile, `tests/ui.mjs` |
| Fluidité sur processeur de téléphone | **PARTIAL — émulation uniquement** | processeur ralenti ×4 dans Chromium ; ce n'est ni un vrai processeur mobile, ni un vrai processeur graphique mobile |
| GPS réel | **NON TESTÉ — GPS réel indisponible** | position simulée par le navigateur (autorisée, refusée, indisponible, délai dépassé, navigateur sans géolocalisation) — 6 tests au cycle 1, rejoués à l'identique |
| Précision, dérive, suivi en mouvement | **NON TESTÉ** | demande un appareil qui se déplace |
| Safari iOS | **PARTIAL — émulation uniquement** | moteur WebKit de bureau, pas Safari sur iPhone : barre d'adresse rétractable, zones sûres (encoche), retour par balayage, mémoire limitée ne sont pas reproduits |
| Bouton « retour » Android | **PARTIAL — émulation uniquement** | `history.back()` piloté dans Chromium mobile émulé (5 tests) ; le geste système lui-même n'a pas été essayé |
| Clavier virtuel | **PARTIAL — émulation uniquement** | voir ci-dessous |
| Lecteurs d'écran (VoiceOver, TalkBack) | **NON TESTÉ** | aucun essai avec une synthèse vocale |
| Plein soleil, gants, une main | **NON TESTÉ** | demande un essai en situation |
| Mode privé des navigateurs mobiles | **NON TESTÉ** | messages d'erreur prévus, non déclenchés sur appareil |
| Ouverture en fichier local sur téléphone | **NON TESTÉ** | sur iOS et Android, ouvrir un `.html` local passe par l'application Fichiers et un navigateur dont le stockage peut être éphémère : à vérifier avant de s'y fier |

## Clavier mobile (émulation)

`audit-refonte-v2/scripts/mobile-keyboard.mjs`, Chromium et WebKit, 390 × 844 → `evidence/mobile-keyboard.json`.

| Contrôle | Chromium | WebKit |
|---|---|---|
| Taille de texte des 9 champs de saisie (recherche, liste, note, budget, date, titre, texte, date et lieu d'un article) | 16 px partout | 16 px partout |
| Conséquence | sous 16 px, Safari iOS agrandit la page quand un champ prend le focus : ce n'est pas le cas ici | |
| Clavier simulé (hauteur visible réduite de 844 à 508 px), éditeur du carnet : champ actif visible | oui | oui |
| Bouton « Enregistrer » atteignable par défilement | oui | oui |
| Débordement horizontal | 0 px | 0 px |
| Recherche : premiers résultats visibles au-dessus du clavier | oui | oui |

La balise `viewport` déclare `interactive-widget=resizes-content` : sur Chrome Android, l'ouverture du clavier
réduit la zone de mise en page, ce que la simulation reproduit. Sur Safari iOS, le clavier **recouvre** la page
sans la redimensionner : ce comportement n'est pas simulé. Statut : `PARTIAL — émulation uniquement`.

## Ce qu'il faudrait faire avec un téléphone (20 minutes)

1. Ouvrir la version hébergée (ou le fichier) dans Chrome Android et Safari iOS.
2. Carte : pincer, déplacer, toucher un lieu isolé puis un groupe serré ; juger la fluidité.
3. Rédiger un article du carnet avec le clavier, ajouter une photo prise sur place, fermer et rouvrir.
4. « Me localiser » dehors, puis « Près de moi » ; refuser la permission une fois pour lire le message.
5. Bouton ou geste « retour » depuis une fiche, une rubrique, un dialogue.
6. Lire l'écran en plein jour ; activer VoiceOver ou TalkBack et parcourir Explorer et Trajet.
7. Fermer le navigateur, le rouvrir : trajet, notes et carnet doivent être là.

Aucun de ces sept points n'est déclaré testé dans ce rapport.
