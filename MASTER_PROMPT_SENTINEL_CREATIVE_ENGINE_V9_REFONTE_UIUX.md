# MASTER PROMPT — AUDIT + REFONTE PREMIUM UI/UX AVEC SENTINEL + CREATIVE_ENGINE_V9

## Contexte

Tu travailles dans VS Code sur un projet web existant correspondant à une application de voyage / van / road-trip de type **Atlas van**.

Le projet actuel doit être considéré comme **fonctionnel jusqu’à preuve du contraire**. Il contient notamment, selon l’état actuellement observé :

- une carte interactive ;
- une recherche de lieux ;
- environ 1 600 lieux / points d’intérêt ;
- des filtres ;
- des favoris / statuts / notes ;
- un itinéraire ;
- calculs de distances / budget / carburant ;
- gestion de trajets ;
- export / import ;
- carnet de voyage ;
- photos stockées localement ;
- IndexedDB ;
- localStorage ;
- géolocalisation ;
- modes mobile / tablette / desktop ;
- paramètres de confidentialité ;
- fonctions d’accessibilité déjà présentes ;
- sauvegarde / restauration ;
- liens/cartographie externe ;
- logique importante regroupée dans un très gros `index.html`.

Le projet fourni précédemment contient un `index.html` d’environ **1,5 Mo**, ce qui doit déclencher une analyse sérieuse de maintenabilité, mais **aucune refactorisation ne doit casser le fonctionnement actuel**.

Deux outils locaux doivent obligatoirement être exploités :

```text
/Users/dreano/Downloads/SENTINEL
/Users/dreano/Downloads/CREATIVE_ENGINE_V9
```

---

# 1. OBJECTIF PRINCIPAL

Transformer le projet en une version beaucoup plus :

- propre ;
- élégante ;
- moderne ;
- cohérente ;
- premium ;
- agréable à utiliser ;
- claire ;
- intuitive ;
- rapide ;
- responsive ;
- accessible ;
- maintenable ;
- robuste ;
- sécurisée ;
- visuellement maîtrisée ;

tout en conservant **100 % des fonctionnalités réellement utiles déjà présentes**.

Le résultat ne doit pas ressembler à une simple retouche CSS.

Je veux une vraie amélioration produit, UI/UX, technique et ergonomique.

---

# 2. RÈGLE ABSOLUE : ZÉRO RÉGRESSION

Toute modification doit respecter le principe :

> **ZÉRO RÉGRESSION FONCTIONNELLE, ZÉRO PERTE DE DONNÉES, ZÉRO SUPPRESSION SILENCIEUSE DE FONCTIONNALITÉ.**

Avant toute modification :

1. inventorier le projet ;
2. inventorier les fonctions disponibles ;
3. inventorier les données persistées ;
4. identifier les workflows principaux ;
5. créer une baseline de référence ;
6. sauvegarder l’état initial ;
7. déterminer comment revenir en arrière.

Ne jamais supprimer une fonction simplement parce qu’elle semble compliquée ou visuellement gênante.

Si une fonction doit être déplacée, simplifiée ou fusionnée, vérifier qu’elle reste accessible.

---

# 3. UTILISATION OBLIGATOIRE DE SENTINEL

Commence par analyser :

```text
/Users/dreano/Downloads/SENTINEL
```

Cherche notamment :

- README ;
- documentation ;
- SKILL.md ;
- scripts ;
- CLI ;
- runners ;
- modules ;
- scanners ;
- règles ;
- tests ;
- API configurator ;
- workflows disponibles.

## Important

Ne prétends jamais avoir utilisé une capacité SENTINEL si elle n’a pas réellement été exécutée.

Pour chaque capacité utilisée, note :

- commande exécutée ;
- fichier/module utilisé ;
- cible analysée ;
- résultat ;
- preuve disponible ;
- statut.

Utilise les capacités SENTINEL réellement pertinentes pour :

- inventaire ;
- audit code ;
- sécurité ;
- confidentialité ;
- dépendances ;
- erreurs ;
- dette technique ;
- robustesse ;
- performance ;
- accessibilité si disponible ;
- architecture ;
- stockage local ;
- actions dangereuses ;
- exfiltration potentielle ;
- entrées utilisateur ;
- imports ;
- fichiers ;
- géolocalisation ;
- URL externes ;
- XSS ;
- injection HTML ;
- validation des données ;
- gestion d’erreurs ;
- sauvegarde ;
- restauration ;
- cas limites ;
- régression.

### API SENTINEL

Si SENTINEL possède déjà des clés/API configurées pour ses propres outils :

- utilise-les uniquement conformément à sa documentation ;
- ne copie jamais les clés dans le projet ;
- ne les affiche jamais dans les logs ou rapports ;
- ne les commit jamais ;
- ne les déplace jamais ;
- ne contourne pas les mécanismes de sécurité de SENTINEL.

Si une API requise n’est pas configurée, indique :

`NON TESTÉ — API/clé indisponible`

Ne simule jamais un résultat.

---

# 4. UTILISATION OBLIGATOIRE DE CREATIVE_ENGINE_V9

Analyse ensuite :

```text
/Users/dreano/Downloads/CREATIVE_ENGINE_V9
```

Lis sa documentation et identifie :

- moteur de création ;
- audit visuel ;
- design system ;
- UI scoring ;
- génération de landing/pages/interfaces ;
- responsive ;
- SEO si présent ;
- accessibilité ;
- comparaison de variantes ;
- auto-évaluation ;
- composants ;
- heuristiques UX ;
- tests automatisables.

Creative Engine doit être utilisé comme **moteur de conception et d’évaluation**, pas comme générateur aveugle.

---

# 5. STRATÉGIE SENTINEL × CREATIVE ENGINE

Les deux outils doivent être combinés.

## Creative Engine

Responsable principalement de :

- exploration visuelle ;
- design system ;
- hiérarchie ;
- ergonomie ;
- navigation ;
- responsive ;
- composants ;
- cohérence visuelle ;
- densité ;
- lisibilité ;
- micro-interactions ;
- organisation des écrans ;
- amélioration UX ;
- comparaison de variantes.

## SENTINEL

Responsable principalement de :

- contrôle technique ;
- robustesse ;
- sécurité ;
- confidentialité ;
- stabilité ;
- performance ;
- architecture ;
- maintien des fonctionnalités ;
- contrôle des entrées ;
- stockage ;
- régression ;
- dette technique ;
- qualité d’implémentation.

## Boucle obligatoire

Utiliser cette boucle :

```text
BASELINE
→ AUDIT SENTINEL
→ AUDIT CREATIVE ENGINE
→ PROPOSITIONS
→ PROTOTYPE / IMPLÉMENTATION
→ TESTS
→ AUDIT SENTINEL
→ AUDIT CREATIVE ENGINE
→ COMPARAISON AVEC BASELINE
→ CORRECTIONS
→ TESTS DE NON-RÉGRESSION
→ VALIDATION FINALE
```

Faire plusieurs cycles si les problèmes restent significatifs.

---

# 6. INVENTAIRE 100 %

Inspecte récursivement le projet.

Produis une carte du projet comprenant :

- fichiers ;
- dossiers ;
- langages ;
- taille des fichiers ;
- dépendances ;
- ressources externes ;
- stockage local ;
- endpoints ;
- APIs ;
- permissions navigateur ;
- événements ;
- listeners ;
- fonctions globales ;
- fonctions critiques ;
- données intégrées ;
- données générées ;
- exports ;
- imports ;
- navigation ;
- modales ;
- formulaires ;
- composants logiques ;
- CSS ;
- JavaScript ;
- SVG ;
- éventuels assets.

Si le projet est principalement regroupé dans un énorme fichier HTML, mesure précisément :

- nombre de lignes ;
- poids ;
- quantité de CSS ;
- quantité de JS ;
- quantité de données embarquées ;
- fonctions ;
- globals ;
- duplication ;
- couplage ;
- sections pouvant être isolées proprement.

---

# 7. BASELINE AVANT MODIFICATION

Avant toute modification, créer une baseline.

Tester au minimum :

## Fonctionnel

- chargement initial ;
- carte ;
- zoom ;
- déplacement ;
- recherche ;
- sélection d’un lieu ;
- détail d’un lieu ;
- filtres ;
- favoris ;
- notes ;
- itinéraire ;
- ajout / suppression d’étapes ;
- réorganisation ;
- calculs ;
- budget ;
- export ;
- import ;
- sauvegarde ;
- restauration ;
- carnet ;
- création d’article ;
- modification d’article ;
- suppression d’article ;
- ajout de photos ;
- visualisation des photos ;
- stockage IndexedDB ;
- localStorage ;
- géolocalisation ;
- responsive ;
- navigation mobile ;
- paramètres ;
- confidentialité.

## Visuel

Capturer si possible des screenshots de référence :

- desktop 1440×900 ;
- laptop 1280×800 ;
- tablette 1024×768 ;
- tablette 768×1024 ;
- mobile 390×844 ;
- mobile 360×800.

Conserver ces captures pour comparaison.

---

# 8. AUDIT UI/UX COMPLET

Ne te limite pas aux couleurs.

Audite :

### Architecture de l’information

- compréhension immédiate ;
- priorité des actions ;
- nombre de niveaux ;
- surcharge ;
- navigation ;
- logique des onglets ;
- menu mobile ;
- répétitions ;
- fonctions cachées ;
- réglages trop visibles ;
- actions rares trop présentes.

### Hiérarchie

- titre ;
- actions primaires ;
- secondaires ;
- tertiaires ;
- informations critiques ;
- aide ;
- états vides ;
- feedback utilisateur.

### Design system

Créer ou normaliser :

- palette ;
- surface ;
- fond ;
- texte ;
- texte secondaire ;
- bordures ;
- accent ;
- succès ;
- avertissement ;
- erreur ;
- focus ;
- ombres ;
- radius ;
- espacement ;
- grille ;
- typographies ;
- tailles ;
- boutons ;
- inputs ;
- selects ;
- cartes ;
- badges ;
- dialogs ;
- navigation ;
- tooltips.

### Cohérence

Identifier :

- composants semblables mais différents ;
- espacements incohérents ;
- boutons incohérents ;
- tailles incohérentes ;
- styles dupliqués ;
- niveaux de contraste insuffisants ;
- informations trop compactes.

---

# 9. DIRECTION VISUELLE

Je veux une interface :

- premium sans être luxueuse de façon artificielle ;
- chaleureuse ;
- voyage / aventure / nature ;
- moderne ;
- calme ;
- très lisible ;
- plus simple visuellement ;
- moins chargée ;
- plus professionnelle ;
- avec une vraie identité.

Éviter :

- effet dashboard SaaS générique ;
- accumulation de cartes inutiles ;
- gradients partout ;
- glassmorphism excessif ;
- animations gadgets ;
- couleurs trop saturées ;
- sur-utilisation d’icônes ;
- composants énormes ;
- menus complexes ;
- effets uniquement décoratifs.

L’application doit rester adaptée à une utilisation réelle **en voyage, sur ordinateur comme sur téléphone**.

---

# 10. TROIS EXPLORATIONS VISUELLES

Avant de refaire toute l’UI, CREATIVE_ENGINE_V9 doit produire ou simuler au moins **3 directions distinctes** :

### Variante A — Atlas éditorial premium

Inspirée :

- atlas papier ;
- carnet de voyage ;
- cartographie ;
- typographie éditoriale ;
- matériaux naturels ;
- sophistication discrète.

### Variante B — Outdoor moderne

Inspirée :

- application de navigation outdoor ;
- road trip ;
- simplicité ;
- lisibilité en mobilité ;
- actions rapides ;
- contraste maîtrisé.

### Variante C — Carnet de voyage contemporain

Inspirée :

- journal ;
- photographie ;
- storytelling ;
- expérience émotionnelle ;
- contenu personnel ;
- carte + carnet fortement intégrés.

Comparer ces 3 variantes avec une grille objective.

Ne pas choisir uniquement sur préférence esthétique.

---

# 11. GRILLE DE COMPARAISON

Évaluer chaque variante sur :

- lisibilité ;
- simplicité ;
- compréhension ;
- efficacité ;
- accessibilité ;
- responsive ;
- usage tactile ;
- densité ;
- identité ;
- cohérence ;
- différenciation ;
- maintenabilité ;
- performance ;
- compatibilité avec l’existant ;
- risque de régression.

Ne pas inventer de mesures.

Si un critère n’a pas été testé :

`NON TESTÉ`

Choisir la direction finale d’après les preuves disponibles et documenter pourquoi.

---

# 12. ACCUEIL / CARTE

L’écran carte est stratégique.

Optimiser :

- visibilité réelle de la carte ;
- quantité d’éléments superposés ;
- recherche ;
- filtres ;
- zoom ;
- géolocalisation ;
- découverte ;
- sélection des POI ;
- itinéraire ;
- feedback ;
- états chargement/erreur ;
- mobile.

Étudier la possibilité d’avoir une structure plus claire du type :

```text
[ Recherche principale ]
[ filtres contextuels ]
--------------------------------
|                              |
|            CARTE             |
|                              |
--------------------------------
[ informations / action contextuelle ]
```

mais ne pas imposer cette structure si une meilleure solution apparaît.

---

# 13. MOBILE FIRST RÉEL

Tester sérieusement :

- 320 px ;
- 360 px ;
- 390 px ;
- 430 px ;
- 768 px.

Contrôler :

- safe areas ;
- barre basse ;
- boutons tactiles ;
- modales ;
- clavier virtuel ;
- scroll ;
- double scroll ;
- carte ;
- panneau ;
- filtres ;
- recherche ;
- inputs ;
- photos ;
- dialogues ;
- carnet ;
- états vides.

Taille tactile cible :

- environ 44×44 CSS px lorsque pertinent.

Ne pas réduire artificiellement tout le desktop.

Créer une vraie expérience mobile.

---

# 14. ACCESSIBILITÉ

Viser au minimum de bonnes pratiques compatibles WCAG 2.2 AA quand raisonnablement applicable.

Contrôler :

- contraste ;
- focus visible ;
- ordre tab ;
- navigation clavier ;
- labels ;
- aria-label ;
- rôle des dialogs ;
- focus trap si nécessaire ;
- fermeture Escape ;
- textes d’erreur ;
- messages status ;
- couleurs non utilisées seules ;
- taille tactile ;
- zoom navigateur ;
- `prefers-reduced-motion` ;
- lecteurs d’écran ;
- structure sémantique ;
- formulaires ;
- alt des images ;
- lien actif ;
- états disabled.

Ne jamais annoncer WCAG AA comme validé sans tests réels.

---

# 15. ARCHITECTURE ET MAINTENABILITÉ

Le gros `index.html` doit être examiné.

## Objectif

Réduire la dette technique **sans introduire une architecture disproportionnée**.

Évaluer la possibilité de séparer progressivement :

```text
/index.html
/assets/css/
/assets/js/
/assets/data/
/assets/icons/
```

ou une structure équivalente.

Exemples potentiels :

```text
assets/css/tokens.css
assets/css/base.css
assets/css/layout.css
assets/css/components.css
assets/css/responsive.css

assets/js/app.js
assets/js/map.js
assets/js/route.js
assets/js/storage.js
assets/js/journal.js
assets/js/import-export.js
assets/js/geolocation.js
assets/js/ui.js

assets/data/places.js
```

Mais :

> Ne réalise cette séparation que si elle est testable et ne casse pas l’usage local actuel.

Si le projet doit rester volontairement mono-fichier, propose une organisation interne plus claire :

- sections ;
- namespaces ;
- modules logiques ;
- commentaires structurants ;
- réduction des globals ;
- suppression de duplication.

---

# 16. PAS DE FRAMEWORK INUTILE

Ne migre pas automatiquement vers React, Vue, Svelte, Next, Vite ou autre.

Une migration n’est acceptable que si elle apporte un bénéfice démontrable nettement supérieur au risque.

Par défaut :

> préférer améliorer intelligemment l’architecture existante.

Éviter :

- dépendances inutiles ;
- gros bundler uniquement pour “moderniser” ;
- bibliothèque UI lourde ;
- abstraction excessive.

---

# 17. PERFORMANCE

Mesurer avant/après si possible.

Analyser :

- poids HTML ;
- CSS ;
- JS ;
- parsing ;
- DOM ;
- SVG ;
- nombre de POI ;
- rendu des marqueurs ;
- listeners ;
- redraw ;
- recalculs ;
- filtres ;
- recherche ;
- IndexedDB ;
- grosses images ;
- compression photo ;
- mémoire ;
- reflows ;
- timers ;
- `innerHTML` ;
- chargement des fonts ;
- dépendances réseau ;
- first interaction ;
- scroll mobile.

Optimisations possibles à évaluer :

- découpage des données ;
- lazy rendering ;
- cache ;
- délégation d’événements ;
- réduction des opérations DOM ;
- fonctions pures ;
- throttling/debounce ;
- requestAnimationFrame ;
- chargement différé ;
- font-display ;
- fallback system fonts ;
- compression ;
- réduction des duplications.

Ne pas optimiser à l’aveugle.

---

# 18. FONTS ET DÉPENDANCES EXTERNES

Le projet peut utiliser Google Fonts ou d’autres ressources externes.

Évaluer :

- vie privée ;
- fonctionnement hors connexion ;
- latence ;
- fallback ;
- dépendance réseau.

Si pertinent, proposer :

- fallback système ;
- auto-hébergement ;
- version locale ;

mais ne télécharge pas ou n’ajoute pas des assets propriétaires sans licence compatible.

---

# 19. STOCKAGE ET DONNÉES UTILISATEUR

Le projet utilise notamment :

- localStorage ;
- IndexedDB ;
- photos ;
- sauvegardes ;
- imports.

Auditer :

- compatibilité anciens formats ;
- migration ;
- corruption ;
- stockage saturé ;
- quota ;
- rollback ;
- import invalide ;
- fichier trop gros ;
- schéma ;
- cohérence ;
- versionnage ;
- perte de données ;
- doublons ;
- restauration partielle ;
- erreurs IndexedDB ;
- mode privé navigateur.

Une refonte UI ne doit jamais casser les données existantes.

---

# 20. SÉCURITÉ

SENTINEL doit vérifier notamment :

- XSS ;
- utilisation de `innerHTML` ;
- échappement ;
- URLs externes ;
- protocoles dangereux ;
- fichiers importés ;
- JSON ;
- contenu utilisateur ;
- noms ;
- notes ;
- descriptions ;
- captions photos ;
- paramètres ;
- liens ;
- ouverture de fenêtres ;
- géolocalisation ;
- données sensibles ;
- pollution du prototype si applicable ;
- injections ;
- DoS côté client ;
- fichiers énormes ;
- mémoire ;
- stockage corrompu.

Ne remplace pas automatiquement toutes les utilisations de `innerHTML`.

Analyse leur provenance et leur risque réel.

---

# 21. CONFIDENTIALITÉ

Contrôler :

- géolocalisation ;
- photos ;
- notes ;
- historique voyage ;
- stockage navigateur ;
- APIs tierces ;
- Google Fonts ;
- Google Maps ou équivalents ;
- liens externes.

L’utilisateur doit comprendre :

- ce qui reste local ;
- ce qui quitte l’appareil ;
- quand une permission est demandée.

---

# 22. UX DE CONFIDENTIALITÉ

Améliorer si nécessaire :

- explications ;
- consentement ;
- état de localisation ;
- arrêt de localisation ;
- réactivation ;
- erreurs ;
- permissions refusées ;
- accès rapide aux réglages.

Pas de dark pattern.

---

# 23. CARNET DE VOYAGE

Le carnet doit devenir une vraie partie premium de l’application.

Optimiser :

- liste des articles ;
- vide initial ;
- création ;
- édition ;
- photos ;
- légendes ;
- lieu associé ;
- date ;
- brouillon ;
- publication locale ;
- lisibilité ;
- storytelling ;
- responsive ;
- export.

Ne pas transformer le carnet en CMS complexe.

---

# 24. ITINÉRAIRE

Optimiser :

- ajout d’étapes ;
- suppression ;
- ordre ;
- feedback ;
- distances ;
- coût ;
- budget ;
- jours ;
- consommation ;
- nuits ;
- étapes trop longues ;
- usage mobile ;
- lecture rapide.

Rendre l’itinéraire plus lisible sans masquer les fonctions avancées.

---

# 25. PROGRESSIVE DISCLOSURE

Les fonctions rares ou avancées peuvent être placées dans :

- menu “Plus” ;
- paramètres ;
- panneau secondaire ;
- `details/summary` ;
- dialogue.

Mais les actions principales doivent rester immédiatement accessibles.

Objectif :

> moins d’interface visible, sans perdre de capacités.

---

# 26. MICRO-INTERACTIONS

Ajouter uniquement si utile :

- hover ;
- focus ;
- press ;
- sélection ;
- succès ;
- erreur ;
- apparition légère ;
- changement d’état ;
- toast.

Respecter :

```css
@media (prefers-reduced-motion: reduce)
```

Aucune animation ne doit ralentir l’usage.

---

# 27. ÉTATS UX À COUVRIR

Chaque fonctionnalité importante doit gérer :

- vide ;
- chargement ;
- succès ;
- erreur ;
- permission refusée ;
- stockage indisponible ;
- import invalide ;
- absence de résultat ;
- réseau indisponible si pertinent ;
- image trop lourde ;
- quota atteint ;
- géolocalisation indisponible ;
- navigateur incompatible.

---

# 28. TESTS AUTOMATISÉS ET MANUELS

Utilise tous les tests réellement disponibles dans le projet et les deux outils.

Si Playwright / browser automation est disponible, créer ou exécuter des tests E2E.

Tester au minimum les parcours suivants.

## Parcours 1 — Explorer

```text
ouvrir
→ rechercher un lieu
→ afficher
→ zoomer
→ filtrer
→ ouvrir détail
→ ajouter aux favoris
```

## Parcours 2 — Itinéraire

```text
ajouter plusieurs étapes
→ réordonner
→ vérifier distance
→ modifier options
→ exporter
→ supprimer une étape
→ annuler si disponible
```

## Parcours 3 — Carnet

```text
créer article
→ sélectionner lieu
→ ajouter texte
→ ajouter photo
→ sauvegarder brouillon
→ éditer
→ finaliser
→ exporter
```

## Parcours 4 — Sauvegarde

```text
modifier données
→ exporter sauvegarde
→ réinitialiser environnement de test
→ importer
→ vérifier restauration
```

## Parcours 5 — Géolocalisation

Tester :

- autorisée ;
- refusée ;
- indisponible ;
- timeout ;
- arrêt manuel.

## Parcours 6 — Mobile

Tester réellement les actions principales avec viewport mobile.

---

# 29. TESTS VISUELS

Pour chaque écran clé :

- baseline ;
- version modifiée ;
- comparaison.

Vérifier :

- overflow ;
- texte coupé ;
- boutons superposés ;
- composants hors écran ;
- modales ;
- safe area ;
- carte ;
- zoom ;
- menus ;
- photo ;
- carnet ;
- clavier mobile simulé si possible.

---

# 30. PERFORMANCE BROWSER

Si Lighthouse, DevTools protocol ou un outil équivalent est disponible :

mesurer réellement :

- Performance ;
- Accessibility ;
- Best Practices ;
- SEO si pertinent.

Mais :

> Ne considère jamais un score comme “PASS” si le test n’a pas réellement été exécuté.

---

# 31. SEO — UNIQUEMENT SI PERTINENT

L’application est avant tout un outil interactif.

Vérifier malgré tout :

- title ;
- meta description ;
- lang ;
- viewport ;
- favicon ;
- theme-color ;
- partage social ;
- sémantique ;
- canonical si déploiement réel ;
- données structurées seulement si réellement pertinentes.

Ne surcharge pas l’application avec du SEO inutile.

---

# 32. PWA / OFFLINE — ÉVALUATION

Évaluer si transformer ou renforcer l’app en PWA apporte une vraie valeur pour l’usage van/voyage.

Cas d’usage intéressant :

- zones sans réseau ;
- voyage ;
- carte/données déjà embarquées ;
- carnet local.

Mais ne l’implémente que si :

- bénéfice réel ;
- complexité maîtrisée ;
- invalidation cache correctement gérée ;
- fonctionnement actuel préservé.

Sinon noter la proposition dans le rapport.

---

# 33. DESIGN RESPONSIVE CIBLE

### Desktop

- carte dominante ;
- panneau lisible ;
- navigation claire ;
- largeur optimale ;
- densité maîtrisée.

### Tablette

- usage paysage et portrait ;
- panneau adaptable ;
- carte suffisamment grande.

### Mobile

- priorité à la carte ;
- navigation inférieure ;
- panneau plein écran / sheet si pertinent ;
- actions principales accessibles au pouce ;
- filtres dans une modal/bottom sheet si pertinent.

---

# 34. REFONTE DES COMPOSANTS

Auditer et harmoniser :

- boutons ;
- inputs ;
- select ;
- range ;
- recherche ;
- tabs ;
- cartes ;
- listes ;
- badges ;
- dialogues ;
- toasts ;
- statistiques ;
- toolbar carte ;
- filtres ;
- item itinéraire ;
- carte carnet ;
- photo ;
- réglages.

Chaque composant doit avoir :

- normal ;
- hover ;
- focus ;
- active ;
- disabled ;
- erreur si applicable.

---

# 35. SIMPLIFICATION

Chercher activement :

- options dupliquées ;
- boutons redondants ;
- réglages trop visibles ;
- actions qui peuvent être contextuelles ;
- textes trop techniques ;
- termes peu clairs ;
- trop nombreuses tailles de police ;
- trop nombreuses couleurs ;
- trop nombreux types de boutons.

Simplifier l’expérience sans réduire les capacités.

---

# 36. COPYWRITING UX

Réviser les textes de l’interface.

Les rendre :

- courts ;
- clairs ;
- français naturel ;
- cohérents ;
- orientés action.

Éviter :

- jargon technique ;
- formulations ambiguës ;
- anglicismes non nécessaires.

Ne modifie pas le sens des fonctions.

---

# 37. ICÔNES

Si les symboles actuels sont incohérents :

- normaliser.

Éviter d’ajouter une grosse dépendance uniquement pour des icônes.

Préférer :

- SVG légers ;
- symboles inline ;
- set local cohérent ;
- accessible label.

---

# 38. RÉDUCTION DE LA COMPLEXITÉ

Après audit, cherche les améliorations qui permettent simultanément :

- meilleur design ;
- moins de code ;
- moins de duplication ;
- moins de dette ;
- plus de stabilité.

Une amélioration qui ajoute énormément de code pour un faible gain doit être rejetée.

---

# 39. CONTRÔLE DES RÉGRESSIONS

Après chaque lot important :

1. relancer les tests ;
2. comparer avec baseline ;
3. inspecter console ;
4. inspecter erreurs ;
5. inspecter responsive ;
6. inspecter stockage ;
7. inspecter export/import.

Si une régression apparaît :

```text
STOP
→ identifier la cause
→ corriger
→ retester
```

Ne continuer que lorsque la régression est maîtrisée.

---

# 40. COMMITS / SAUVEGARDES

Si Git est disponible :

Créer un point de restauration avant modification.

Exemple :

```bash
git status
git add -A
git commit -m "chore: baseline before Sentinel and Creative Engine refactor"
```

Ne force pas un commit si le dépôt contient des changements utilisateur non compris.

Dans ce cas :

- inspecter ;
- sauvegarder ;
- ne pas écraser.

---

# 41. INTERDICTIONS

Ne pas :

- supprimer silencieusement une fonction ;
- perdre des données ;
- modifier le format de stockage sans migration ;
- introduire une API payante sans raison ;
- exposer des clés ;
- ajouter tracking/analytics sans demande ;
- ajouter publicité ;
- ajouter authentification si inutile ;
- migrer vers un framework sans justification ;
- ajouter une base cloud par défaut ;
- introduire une dépendance uniquement pour l’esthétique ;
- annoncer qu’un test est passé sans l’avoir exécuté ;
- annoncer qu’une fonctionnalité fonctionne sans test ;
- masquer un échec.

---

# 42. STATUTS OBLIGATOIRES

Utilise uniquement :

- `PASS`
- `PARTIAL`
- `FAIL`
- `NON TESTÉ`
- `NON APPLICABLE`

Exemples :

```text
Responsive mobile 390×844 : PASS
IndexedDB import/export : PASS
Géolocalisation réelle GPS : NON TESTÉ
Lighthouse : PASS — réellement exécuté
PWA : NON APPLICABLE — non implémentée
```

---

# 43. CRITÈRES D’ACCEPTATION

La mission est terminée uniquement si :

### Fonctionnel

- les fonctionnalités principales continuent de fonctionner ;
- aucun flux principal n’est cassé ;
- les données existantes restent compatibles.

### UI

- hiérarchie nettement plus claire ;
- design cohérent ;
- rendu plus premium ;
- navigation simplifiée ;
- densité réduite ;
- meilleure lisibilité.

### UX

- actions principales plus rapides ;
- mobile nettement meilleur ;
- erreurs compréhensibles ;
- états vides améliorés.

### Technique

- dette réduite ou au minimum mieux structurée ;
- aucune dépendance injustifiée ;
- erreurs console significatives corrigées ;
- architecture documentée.

### Accessibilité

- navigation clavier contrôlée ;
- focus visible ;
- contrastes contrôlés ;
- champs correctement nommés ;
- modales utilisables.

### Performance

- aucune dégradation importante non justifiée ;
- améliorations mesurées lorsque les outils le permettent.

### Sécurité

- problèmes critiques / élevés identifiés par SENTINEL corrigés ou documentés ;
- pas de secret exposé.

---

# 44. LIVRABLES

Créer dans le projet un dossier :

```text
audit-refonte/
```

avec au minimum :

```text
audit-refonte/
├── 00_BASELINE.md
├── 01_INVENTAIRE.md
├── 02_SENTINEL_AUDIT.md
├── 03_CREATIVE_ENGINE_AUDIT.md
├── 04_UI_UX_FINDINGS.md
├── 05_VARIANTS_COMPARISON.md
├── 06_IMPLEMENTATION_LOG.md
├── 07_TEST_REPORT.md
├── 08_SECURITY_REPORT.md
├── 09_PERFORMANCE_REPORT.md
├── 10_ACCESSIBILITY_REPORT.md
├── 11_NON_REGRESSION_REPORT.md
├── 12_FINAL_REPORT.md
└── screenshots/
```

Ne mets aucun secret dans ces rapports.

---

# 45. RAPPORT FINAL

Le rapport final doit inclure :

## A. Résumé

- ce qui a été amélioré ;
- ce qui a été conservé ;
- ce qui a été refactorisé ;
- direction visuelle retenue.

## B. SENTINEL

- modules réellement utilisés ;
- commandes réellement exécutées ;
- résultats ;
- problèmes corrigés ;
- problèmes restant.

## C. Creative Engine

- fonctionnalités réellement utilisées ;
- variantes étudiées ;
- décision finale ;
- raisons.

## D. Fichiers

Lister :

- créés ;
- modifiés ;
- supprimés.

## E. Tests

Pour chaque test :

- commande ;
- résultat ;
- statut.

## F. Régressions

- détectées ;
- corrigées ;
- restantes.

## G. Améliorations non implémentées

Pour chaque proposition :

- bénéfice ;
- coût ;
- difficulté ;
- risque ;
- priorité.

---

# 46. PRIORISATION DES AMÉLIORATIONS

Classer les améliorations avec :

### P0 — indispensable

- perte de données ;
- bug critique ;
- sécurité élevée ;
- fonction cassée.

### P1 — forte valeur

- UX principale ;
- responsive ;
- performances majeures ;
- architecture critique ;
- accessibilité importante.

### P2 — amélioration

- polish ;
- micro-interactions ;
- simplification secondaire.

### P3 — optionnel

- expérimentation ;
- fonction non essentielle.

---

# 47. AUTO-CRITIQUE FINALE

Après implémentation, pose-toi explicitement les questions :

- L’interface est-elle réellement plus simple ?
- Ai-je seulement changé le look ou réellement amélioré l’UX ?
- Ai-je ajouté de la complexité inutile ?
- Le mobile est-il vraiment meilleur ?
- Une fonction est-elle devenue plus difficile à trouver ?
- Les données existantes sont-elles toujours lisibles ?
- Ai-je testé les imports ?
- Ai-je testé les exports ?
- Ai-je testé IndexedDB ?
- Ai-je testé localStorage ?
- Ai-je testé les modales ?
- Ai-je testé les erreurs ?
- Ai-je vérifié la console ?
- Ai-je testé au clavier ?
- Ai-je comparé avec la baseline ?
- SENTINEL a-t-il réellement été exécuté ?
- Creative Engine a-t-il réellement été exécuté ?

Si la réponse est non pour un élément critique, continuer le travail ou marquer clairement :

`NON TESTÉ`

---

# 48. CONTRÔLE FINAL SENTINEL

Une fois la refonte terminée :

Relancer SENTINEL sur l’état final.

Comparer :

```text
AVANT
vs
APRÈS
```

Sur :

- sécurité ;
- stabilité ;
- code ;
- dette ;
- performance ;
- confidentialité ;
- erreurs ;
- architecture ;
- risques.

Aucune nouvelle vulnérabilité ou régression importante introduite par la refonte ne doit être laissée sans traitement ou documentation.

---

# 49. CONTRÔLE FINAL CREATIVE ENGINE

Relancer CREATIVE_ENGINE_V9 sur la version finale.

Vérifier :

- cohérence ;
- hiérarchie ;
- UX ;
- responsive ;
- lisibilité ;
- identité ;
- accessibilité visuelle ;
- densité ;
- clarté des actions.

Comparer à la baseline et aux variantes initiales.

---

# 50. MODE D’EXÉCUTION

Tu es autorisé à :

- analyser ;
- modifier ;
- créer ;
- refactoriser ;
- lancer les tests ;
- ouvrir le projet localement ;
- lancer un serveur local ;
- utiliser les navigateurs/outils de test disponibles ;
- utiliser SENTINEL ;
- utiliser CREATIVE_ENGINE_V9 ;
- corriger automatiquement les problèmes sûrs.

Tu ne dois pas attendre une validation à chaque micro-étape.

Travaille de façon autonome.

Mais :

> en cas d’action destructive ou de risque de perte de données, crée d’abord une sauvegarde ou utilise une stratégie réversible.

---

# 51. DÉMARRAGE IMMÉDIAT

Commence maintenant.

Ordre recommandé :

```text
1. Identifier la racine du projet actif.
2. Sauvegarder / relever Git status.
3. Inventorier 100 % des fichiers.
4. Lire SENTINEL.
5. Lire CREATIVE_ENGINE_V9.
6. Déterminer leurs vraies commandes/capacités.
7. Créer la baseline.
8. Lancer audit SENTINEL.
9. Lancer audit Creative Engine.
10. Établir P0/P1/P2/P3.
11. Créer trois explorations UI.
12. Sélectionner la meilleure direction à partir de critères documentés.
13. Implémenter progressivement.
14. Tester après chaque lot.
15. Relancer audits.
16. Corriger les écarts.
17. Faire tests finaux.
18. Produire le rapport final.
```

---

# 52. DERNIÈRE RÈGLE

Ne termine jamais avec un simple :

> “Tout est parfait.”

Termine avec une matrice factuelle :

| Domaine | Statut | Testé réellement ? | Preuve | Reste à faire |
|---|---|---:|---|---|
| Fonctionnel | ... | Oui/Non | ... | ... |
| UI/UX | ... | Oui/Non | ... | ... |
| Responsive | ... | Oui/Non | ... | ... |
| Accessibilité | ... | Oui/Non | ... | ... |
| Performance | ... | Oui/Non | ... | ... |
| Sécurité | ... | Oui/Non | ... | ... |
| Données | ... | Oui/Non | ... | ... |
| Import/export | ... | Oui/Non | ... | ... |
| IndexedDB | ... | Oui/Non | ... | ... |
| Géolocalisation | ... | Oui/Non | ... | ... |
| SENTINEL final | ... | Oui/Non | ... | ... |
| Creative Engine final | ... | Oui/Non | ... | ... |

Puis indique clairement :

```text
READY / NOT READY
```

avec les raisons factuelles.

Ne déclare `READY` que si les éléments bloquants ont réellement été contrôlés.
