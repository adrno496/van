# 01 — Inventaire complet du projet

## 1. Projet d'origine

| Élément | Constat |
|---|---|
| Racine | `/Users/dreano/Downloads/van-main` |
| Fichiers | `index.html` (l'application entière), `.DS_Store`, `.plugcode/extension-ready.json` (marqueur d'extension VS Code), le cahier des charges `.md` |
| Langages | HTML, CSS, JavaScript (ES2020, scripts classiques), SVG généré en JavaScript |
| Dépendances | aucune bibliothèque ; aucune étape de construction |
| Ressource externe chargée | Google Fonts (`fonts.googleapis.com`, `fonts.gstatic.com`) : Fraunces, Karla, JetBrains Mono |
| Points de terminaison, API serveur | aucun |

### Anatomie de `index.html` (1 535 959 octets, 1 499 lignes)

| Bloc | Lignes | Taille | Contenu |
|---|---|---:|---|
| `<style>` | 10–234 | 32,5 Ko | 464 règles, 12 `@media`, 47 couleurs hexadécimales, 22 tailles de police, 5 `!important` ; deux générations de styles empilées (les dernières règles écrasent les premières) |
| `<body>` | 236–406 | 9 Ko | structure de départ, ensuite profondément remaniée par le JavaScript au chargement |
| Données `var DATA` | 408 (une seule ligne) | 1 357 Ko | `pays` 47 contours (585 Ko), `lieux` 1 600 fiches (854 Ko), `parcours` 25 (5,5 Ko), `meta` 33 fiches pays (3,8 Ko) |
| Script 1 (cœur) | 409–1275 | 58 Ko | projection, carte SVG, fiches, trajet, calculs, exports, sauvegarde |
| Script 2 (couches ajoutées) | 1276–1496 | 77 Ko | navigation mobile, découverte, carnet (IndexedDB), photos, confidentialité, localisation ; lignes jusqu'à 2 932 caractères |

### Mesures de code (avant)

| Mesure | Valeur | Preuve |
|---|---:|---|
| Fonctions nommées | 146 | `evidence/code-metrics.json` |
| Fonctions redéfinies après coup (monkey-patching) | 23 (`show` ×4, `paint` ×4, `applyFilters` ×3, `rescale` ×3, `tab` ×3, `setMobileView` ×3, …) | idem ; semgrep : 32 occurrences du motif |
| Écritures HTML non littérales | 57 (23 `innerHTML`, 34 `insertAdjacentHTML`) | `evidence/semgrep/avant.json` |
| Dialogues bloquants natifs (`prompt`, `confirm`, `alert`) | 9 | idem |
| `window.open` | 2 | idem |
| Variables et fonctions globales | toutes (aucun module) | lecture du code |
| Écouteurs par marqueur | 4 × 1 600 = 6 400 fermetures | lecture du code |
| Styles en ligne dans le HTML généré | 33 | `evidence/code-metrics.json` |

### Fonctions disponibles (inventaire fonctionnel)

1. **Carte** : SVG maison (projection conique de Lambert), 47 pays, 1 600 marqueurs, zoom molette/boutons/pincement/double-clic/clavier, déplacement, barre d'échelle, noms de lieux et de pays, infobulle.
2. **Recherche** : nom, pays, résumé, contenu des fiches ; résultats au clavier.
3. **Découverte** : liste paginée, recherche, « nouveautés », « dans cette vue », réinitialisation.
4. **Filtres** : 6 catégories, 3 niveaux d'importance, pays, mois de visite, favoris, lieux faits, avec note, proximité du trajet (10–100 km), lieux autour de ma position (20–100 km), affichage des noms.
5. **Fiche d'un lieu** : résumé, saison, durée, tarifs, « à voir sur place », liens pratiques (Google Maps, recherche, Wikipédia), logistique van, contrats saisonniers, fiche pays, lieux proches (50 km et 100 km), sources.
6. **Suivi personnel** : statut (à voir / favori / fait), note, budget, date de passage.
7. **Modification** : toute fiche du catalogue (avec retour à l'original) ; lieux personnels (création sur la carte, édition, suppression).
8. **Trajet** : ajout (fiche, carte, recherche, ajout rapide, ajout groupé par pays), insertion à une position, monter/descendre/déplacer/glisser, annuler/rétablir (60 niveaux, Ctrl+Z), inverser, boucler, optimiser (2-opt), vider.
9. **Calculs** : distance (vol d'oiseau × 1,25), durée, gazole par pays, nuitées, vie courante, vignettes, visites, ferries, budgets personnels ; 8 réglages ; alerte « hors saison ».
10. **Navigation externe** : Google Maps par tronçons de 5 points, recherche le long du parcours.
11. **Exports / imports** : `.json`, `.gpx`, plan `.md`, copie texte ; import `.json`.
12. **Parcours** : 25 parcours prêts filtrables, ajout à la suite, parcours enregistrés (créer, mettre à jour, supprimer), 5 bases d'hébergement.
13. **Carnet** : articles (titre, date, lieu, texte, 12 photos légendées, couverture), brouillon automatique, « à partager », recherche, filtres, lecture, visionneuse, suppression annulable, titre/auteur, fil du voyage sur la carte, trajet depuis le carnet, export d'un blog HTML autonome.
14. **Sauvegardes** : complète (v5, photos incluses), légère (v3), restauration, réinitialisation.
15. **Localisation** : position, précision, centrage, arrêt, réactivation automatique, messages d'erreur.
16. **Confidentialité** : floutage par rubrique ; position jamais enregistrée.
17. **Référence** : fiches pays, checklist, conseils, sources.

### Données persistées

| Stockage | Clé | Contenu |
|---|---|---|
| `localStorage` | `atlasvan.v3` | `edits`, `notes`, `custom`, `route`, `opts`, `cSeq`, `prAppend`, `saved` |
| `localStorage` | `atlasvan.privacy` | rubriques floutées |
| `localStorage` | `atlasvan.location.enabled` | `yes` / `no` |
| IndexedDB | `atlasvan.journal.v1` › `state` | `meta` + un enregistrement `post:<id>` par article (photos en `data:` JPEG) ; ancien format à enregistrement unique encore lu |

### Permissions du navigateur

Géolocalisation (à la demande), presse-papiers en écriture (copie de la liste), sélection de fichiers
(photos, sauvegardes), téléchargements. Aucune notification, caméra, micro.

### Liens sortants (ouverts seulement au clic)

`google.com/maps` (lieu, itinéraire, recherche), `google.com/search`, `fr.wikipedia.org`, 3 offices de
tourisme, 4 liens de sources. Tous en `target="_blank"` avec `rel="noopener"`.

### Donnée sensible embarquée

Le catalogue contient 5 « bases d'hébergement » décrites en termes personnels (adresses familiales approximatives).
Elles font partie du fichier : à garder en tête avant de le partager ou de l'héberger publiquement.

## 2. Projet après refonte

```text
index.html               1 602 Ko   fichier livré, assemblé par build.mjs
build.mjs                           assemblage, empreintes de la politique de sécurité
README.md
src/index.template.html    34 Ko    structure, 32 icônes SVG, 2 dialogues permanents
src/css/  (7 fichiers)     47 Ko    tokens · base · layout · components · map · panes · journal
src/js/   (11 fichiers)   162 Ko    util · geo · state · map · places · route · explore · journal · location · shell · boot
src/data/places.js      1 358 Ko    catalogue, repris octet pour octet
tests/    (6 scripts)               e2e · ui · migration · smoke · perf · screenshots
audit-refonte/                      rapports, preuves, captures, variantes, baseline
```

### Mesures de code (après)

| Mesure | Avant | Après |
|---|---:|---:|
| Fichiers source | 1 | 20 (assemblés en 1) |
| JavaScript | 135,8 Ko, 1 085 lignes, ligne la plus longue 2 932 car. | 162 Ko, 2 093 lignes, ligne la plus longue 1 358 car. |
| CSS | 32,5 Ko | 46,7 Ko |
| Fonctions nommées | 146 | 194 |
| Fonctions redéfinies après coup | 23 | **0** |
| Dialogues bloquants natifs | 9 | **0** |
| `window.open` | 2 | **0** |
| Écritures HTML non littérales | 57 | 33 |
| Valeurs insérées dans du HTML sans échappement vérifié | non mesuré | **0** sur 388 (revue AST, `evidence/html-sinks.json`) |
| Styles en ligne dans le HTML de l'application | 33 + 15 | **0** |
| Couleurs hexadécimales distinctes | 47 | 34, dont 33 dans `tokens.css` |
| Tailles de police distinctes | 22 | 7 |
| Requêtes réseau au chargement | 1 feuille + polices Google | **0** |

**Le volume de code a augmenté** (JavaScript +19 %, CSS +44 %, fichier livré +4,3 %). L'augmentation vient du
contrôle des données importées, des dialogues accessibles qui remplacent `prompt`/`confirm`, de l'aperçu mobile,
des icônes et des états des composants. L'objectif « moins de code » n'est pas atteint ; l'objectif « mieux
structuré » l'est.
