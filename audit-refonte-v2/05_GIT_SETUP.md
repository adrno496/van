# 05 — Dépôt Git du projet

## Situation de départ

`git rev-parse --show-toplevel` répondait `/Users/dreano` : le projet se trouvait dans un dépôt dont la racine est
le dossier personnel entier, sans aucun commit. Un `git add -A` lancé à cet endroit aurait pris `.ssh`, l'historique
du terminal et les fichiers de configuration. Aucune commande Git n'a été lancée dans ce dépôt parent, ni au
cycle 1 ni à celui-ci.

## Ce qui a été fait

```bash
cd /Users/dreano/Downloads/van-main
git init                                   # dépôt propre au projet
git rev-parse --show-toplevel              # → /Users/dreano/Downloads/van-main
git add <fichiers du projet>               # jamais depuis le dépôt parent
git commit -m "chore: baseline before V2 hardening (state after V1 redesign)"
```

Chaque commit a été précédé d'un `git rev-parse --show-toplevel` ou d'un `git status` montrant que la racine est
bien le dossier du projet.

`.gitignore` :

```text
.DS_Store
node_modules/
*.log
.plugcode/
dist-public/
test-results/
```

- `dist-public/` : la version publique se reconstruit par `node build.mjs --mode public`.
- `test-results/` : rapports des tests lancés sans `--out`. Au cycle 1 ils s'écrivaient par défaut dans
  `audit-refonte/evidence/`, au risque d'écraser les preuves : ce défaut a été corrigé pendant ce cycle (deux
  fichiers de preuve du cycle 1, écrasés par une de mes exécutions, ont été restaurés depuis Git avant tout commit).
- Les rapports, les preuves et les deux baselines **sont suivis** : ils servent au retour en arrière.

## Historique

| Commit | Contenu | Suites après le lot |
|---|---|---|
| `4da7788` | baseline V2 : état à la fin du cycle 1 | 77 / 59 / 10 / 6 |
| `9fcbc89` | repères de démarrage et profileur (aucun changement de comportement) | idem |
| `5a3ae9a` | marqueurs : un élément par lieu, formes, noms à part ; caches de recherche et de tri | 77 / 59 / 10 / 6 |
| `dea6921` | catalogue en JSON, pays dessinés à la construction, démarrage par étapes, `--mode public` | 77 / 59 / 10 / 6 |
| `4e1679b` | zoom par pincement fluide | 77 / 59 / 10 / 6 |
| `eb25a74` | bouton « retour » mobile, suite de tests V2 | 77 / 59 / 10 / 6 / 35 |
| `09d9f78` | deux couleurs de marqueur assombries, README | 77 / 59 / 10 / 6 / 35 |
| (suivant) | rapports et preuves finales du cycle 2 | voir `07` |

## Retour en arrière

```bash
git revert 4e1679b            # annule un lot (ici : le zoom), sans toucher aux autres
git checkout 4da7788 -- .     # ramène tous les fichiers à la baseline V2
node build.mjs --check        # vérifie que index.html correspond aux sources après un retour
```

## Ce qui n'a pas été fait

- Aucun dépôt distant : rien n'a été poussé nulle part.
- Le dépôt parent (`/Users/dreano`) existe toujours ; il n'a pas été modifié. Le supprimer ou non est une décision
  du propriétaire de la machine.
- Git n'a pas servi de coffre : aucun secret dans le projet (gitleaks : 0, voir `08`). Les clés de SENTINEL n'ont
  été ni lues, ni copiées, ni déplacées.
