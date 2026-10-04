# 06 — Journal de mise en œuvre

Chaque lot a été suivi de la suite de tests complète. Une régression arrête le lot jusqu'à correction.

## Lot 0 — Sécurisation

- Copie de `index.html` en lecture seule dans `audit-refonte/baseline/`, empreinte vérifiée.
- Pas de commit Git : la racine du dépôt est le dossier personnel entier (voir `00_BASELINE.md`).
- Outillage de test écrit avant tout changement : `tests/e2e.mjs` (77 tests), `tests/screenshots.mjs`, `tests/perf.mjs`.
  Résultat sur la baseline : 69 / 77, les 8 échecs étant de vrais défauts.

## Lot 1 — Architecture : sources séparées, un seul fichier livré

**Décision.** L'application doit continuer à s'ouvrir par double-clic et à voyager en un fichier (elle l'annonce
elle-même). Les sources sont donc séparées dans `src/` (7 feuilles de style, 11 scripts, données, gabarit) et
réassemblées en un `index.html` unique par `build.mjs` (83 lignes, aucune dépendance). Pas de framework, pas
de bundler.

**Réécriture du JavaScript.** Le second script de la baseline surchargeait les fonctions du premier
(`show` ×4, `paint` ×4, `applyFilters` ×3, `rescale` ×3, `tab` ×3, `setMobileView` ×3…) et déplaçait le DOM au
chargement. Chaque fonction est maintenant définie une seule fois, dans le module de son domaine, et la structure
finale de la page est écrite dans le gabarit. Algorithmes, noms de fonctions, clés de stockage et formats de
fichiers sont conservés.

Premier passage de la suite sur la version réécrite : 74 / 77. Les 3 échecs :

| Régression détectée | Cause | Correction |
|---|---|---|
| Sur mobile, toucher un groupe de lieux n'ouvrait rien | les dialogues s'ouvrent désormais en bas d'écran ; le « clic fantôme » qui suit un toucher tombait à côté et les refermait aussitôt | les clics hors dialogue sont ignorés pendant 400 ms après l'ouverture |
| Ajout au trajet impossible après ce toucher | conséquence de la précédente | — |
| « Mettre à jour un parcours » : champ non visible | le formulaire s'insérait dans une section repliée | la section s'ouvre quand le formulaire apparaît |

Après correction : 77 / 77.

## Lot 2 — Données et sécurité

- `state.js` : tout état lu depuis le navigateur ou un fichier passe par `readTravelState`, qui vérifie chaque
  champ. Mode strict à l'import (refus en bloc), mode tolérant au démarrage (ce qui est illisible est écarté,
  l'original est conservé sous `atlasvan.v3.recovery` et téléchargeable).
- Un seul échappement (`esc`) pour tout texte inséré dans du HTML ; les 388 insertions ont été revues (`08`).
- Politique de sécurité du contenu à empreintes, calculée à la construction ; aucun style en ligne.
- Polices du système : plus d'appel à Google Fonts.
- Restauration unifiée pour les deux formats de sauvegarde, avec contrôle avant remplacement.
- Message visible quand l'enregistrement échoue ; enregistrement à la fermeture de la page.

## Lot 3 — Interface

- Jetons de design (64), 7 tailles de texte, un style par composant avec ses états.
- Cinq rubriques ; en-tête réduit à la marque, la recherche et les paramètres.
- Carte : filtres et catégories en haut, zoom et position regroupés, actions en bas, outils rares dans un menu.
- Fiche d'un lieu : une action principale, sections titrées, statut en un geste.
- Trajet : chiffres, ajout, outils, étapes, puis trois sections repliées.
- Rubrique Plus : données, réglages, guide pratique, à propos.
- Petit écran : en-tête sur une ligne, navigation à cinq entrées, aperçu d'un lieu sur la carte, dialogues en bas d'écran.
- Dialogues de l'application à la place de `prompt` / `confirm` / `alert`.

## Lot 4 — Trois directions, une retenue

Voir `05_VARIANTS_COMPARISON.md`. Direction A retenue.

## Lot 5 — Corrections issues des audits

L'audit Creative Engine des variantes a fait ressortir des défauts de ma propre refonte, corrigés ensuite :

| Constat du moteur | Correction |
|---|---|
| `aria-expanded` interdit sur un champ de recherche simple (critique) | champ déclaré `combobox`, `aria-controls` posé seulement quand la liste est affichée |
| Infobulle sans nom (sérieux) | infobulle décorative retirée de l'arbre d'accessibilité |
| 3 champs de fichier sans nom | `aria-label` |
| Commandes du menu d'outils et onglets « inaccessibles au clavier » | menu refait (bouton + panneau masqué, état annoncé) ; tous les onglets atteignables par Tab, flèches conservées |
| Pastilles de catégorie coupées par le bord de l'écran sur mobile | pastilles réservées aux grands écrans ; sur mobile elles sont dans « Filtres » |
| Niveaux de titre sautés (h2 → h4) | titre de lieu en h2, sections en h3 |
| Boutons vides dans le HTML généré | libellé présent dès la création |
| Onglets qui débordent quand le texte est agrandi à 200 % | les onglets passent à la ligne |

Mes propres contrôles (`tests/ui.mjs`) ont en plus relevé : cibles de 28 à 36 px sur écran tactile, texte de 11 px à
320 px, cibles trop petites sur tablette tactile en paysage. Tous corrigés (règle `pointer: coarse`).

**Décision annulée.** J'avais ajouté `<meta name="robots" content="noindex">` (les données contiennent des lieux
personnels). Je l'ai retirée : la baseline n'en avait pas, et changer le comportement d'indexation n'était pas
demandé. La recommandation figure dans `12_FINAL_REPORT.md`.

## Ce qui a été retiré, et où le retrouver

Aucune fonction n'a disparu. Trois raccourcis qui doublaient une commande ont été retirés :

| Retiré | La fonction reste accessible par |
|---|---|
| Bouton « Voir sur la carte » en double de « Zoomer » (même action) | un seul bouton « Voir sur la carte » |
| Bouton « Découvrir » sur chaque carte de lieu | le nom du lieu, qui ouvre la fiche |
| Bouton « Parcours prêts à partir » dans les paramètres | l'onglet « Idées », toujours visible |

Déplacés : « Point perso » → « Ajouter mon lieu » (menu de la carte et rubrique Explorer) ; « Clic = ajouter » →
« Ajout rapide au trajet » (menu de la carte) ; « Vue d'ensemble » → menu de la carte et touche `0` ;
« Aux alentours » → « Près de moi » ; sauvegardes, fiches pays, checklist, conseils → rubrique Plus.

## Comportements modifiés volontairement

| Avant | Après | Pourquoi |
|---|---|---|
| Sur mobile, un lieu touché ouvre la fiche plein écran | aperçu sur la carte, puis « Voir la fiche » | garder la carte visible |
| Sauvegarde v3 restaurée sans contrôle | contrôlée, refusée si un champ est invalide | sécurité |
| Suppression d'un lieu personnel immédiate | confirmation | action irréversible |
| « Chercher le long du parcours » ouvre 6 fenêtres | liste de liens pour toutes les étapes | les navigateurs bloquaient les fenêtres |
| « Tous les noms » sans effet | affiche tous les noms | corriger un réglage inopérant |
| Noms des lieux secondaires visibles en vue d'ensemble | visibles en zoomant | lisibilité |
| Ajout depuis « Aux alentours » non annulable | annulable | cohérence |
| Lien Google Maps du plan `.md` avec 10 points | 5 points | limite des liens sur mobile |

## Fichiers

**Créés** : `build.mjs`, `README.md`, `src/index.template.html`, `src/css/{tokens,base,layout,components,map,panes,journal}.css`,
`src/js/{util,geo,state,map,places,route,explore,journal,location,shell,boot}.js`, `src/data/places.js`,
`tests/{e2e,ui,migration,smoke,perf,screenshots}.mjs`, `tests/lib/harness.mjs`, `audit-refonte/**`.

**Modifié** : `index.html` (désormais assemblé à partir de `src/`).

**Supprimé** : aucun. `MASTER_PROMPT_…md`, `.DS_Store` et `.plugcode/` n'ont pas été touchés.
