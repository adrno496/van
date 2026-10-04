# 05 — Trois directions visuelles, comparées sur preuves

## Méthode

1. **Creative Engine a réellement cherché** une direction pour chacun des trois briefs
   (`node audit-refonte/scripts/creative-directions.mjs` → `evidence/creative-directions.json`) : 100 candidats par
   brief, 3 directions retenues par brief.
2. Le moteur vise des sites vitrines : ses sorties sont **des graines** (4 couleurs, 2 piles de polices, densité,
   type de navigation, niveau de mouvement). J'ai étendu chaque graine en un jeu complet de 64 jetons
   (surfaces, bordures, états, couleurs de carte). Cette extension est mon travail, pas celui du moteur.
3. Les trois directions ne sont pas des maquettes : ce sont **trois versions fonctionnelles de l'application**, même
   code, mêmes écrans, un fichier de jetons différent (`variants/tokens-A.css`, `-B.css`, `-C.css`,
   construites par `node build.mjs --tokens …`). L'architecture de l'interface est commune : elle découle des
   constats d'usage (`04`), pas de l'esthétique.
4. Chaque version a été mesurée avec les mêmes outils. Ce qui n'a pas été mesuré est noté `NON TESTÉ`.

La recherche créative a tourné avec le moteur 9.0.0 ; rejouée en 9.1.0 (le moteur a été mis à jour pendant la
mission par un autre travail), elle donne exactement les mêmes directions. Les audits des variantes ont tourné en 9.1.0.

Les mesures ci-dessous ont été prises à mi-parcours, avant les corrections tirées de l'audit Creative Engine ; ces
corrections sont communes aux trois directions et ne changent pas leur classement.

## Ce que le moteur a proposé

| Brief | Direction retenue | Famille | Fond / texte / accent | Titres | Densité | Navigation | Mouvement |
|---|---|---|---|---|---|---|---|
| A — Atlas éditorial premium | V9-DIR-A | COMMERCE (éditorial), TACTILE | `#f9f7f6` / `#1b1913` / `#8b4618` (teinte 24°) | Georgia, serif | aérée | dock minimal | élégant |
| B — Outdoor moderne | V9-DIR-B | SPATIAL | `#f6f9f7` / `#131b19` / `#178244` (teinte 145°) | Helvetica Neue, sans | équilibrée | navigation par chapitres | élégant |
| C — Carnet contemporain | V9-DIR-A | SPATIAL, TACTILE | `#f9f7f6` / `#1b1913` / `#8b4618` (teinte 24°) | Helvetica Neue, sans | aérée | dock minimal | créatif |

Distance entre directions calculée par le moteur (0 à 100) : A–B 27, A–C 58, B–C 85.
Limite constatée : le moteur a donné la **même palette** à A et à C ; elles se distinguent par la typographie, la
densité et les formes. Ses scores « objectifs » sont des a priori (niveau E1), pas des mesures : ils ne figurent
pas dans la grille.

## Les trois directions réalisées

| | A — Atlas éditorial | B — Outdoor moderne | C — Carnet contemporain |
|---|---|---|---|
| Titres | serif (Iowan Old Style, Palatino, Georgia) | sans (Helvetica Neue, système) | sans, graisse forte (Avenir Next, système) |
| Texte | sans système, 15 px | sans, 15 px | sans système, 16 px, interligne 1,6 |
| Récits du carnet | serif | sans | serif |
| Accent | terre cuite `#8b4618` | vert `#178244` | terre cuite `#8b4618` |
| Surfaces | papier chaud | blanc, fond gris-vert | sable chaud |
| Formes | rayons 4–12 px, filets fins | rayons 6–14 px, bordures 1,5 px | rayons 8–22 px, ombres douces |
| Commandes | 44 px | 44 px | 48 px |
| Captures | `screenshots/variant-A/` | `screenshots/variant-B/` | `screenshots/variant-C/` |

## Grille de comparaison

| Critère | Mesure | A | B | C | Source |
|---|---|---|---|---|---|
| **Lisibilité** | plus faible contraste de texte (seuil 4,5) | **5,42** | 4,87 | 5,04 | `contrastRatio` du moteur, 29 couples |
| | contraste du bouton principal | 7,03 | 4,87 | 7,03 | idem |
| | couples de couleurs conformes | 29 / 29 | 29 / 29 | 29 / 29 | idem |
| | lisibilité en plein soleil | NON TESTÉ | NON TESTÉ | NON TESTÉ | demande un essai sur appareil |
| **Simplicité** | commandes visibles, carte mobile | 16 | 16 | 16 | `tests/ui.mjs` — identique : même architecture |
| **Compréhension** | — | NON TESTÉ | NON TESTÉ | NON TESTÉ | demande des utilisateurs |
| **Efficacité** | étapes entières visibles, trajet mobile | **2** | **2** | 1 | `variant-density.json` |
| | lieux entiers visibles, liste mobile | **3** | **3** | 2 | idem |
| | position du bouton principal de la fiche, mobile | 277 px | **275 px** | 303 px | idem |
| **Accessibilité** | violations axe-core | identiques | identiques | identiques | audit Creative Engine |
| | scénarios signalés en plus | 0 | 0 | 1 (« focus masqué » à 390 px) | idem |
| **Responsive** | contrôles de mise en page réussis | **54 / 54** | **54 / 54** | 53 / 54 (libellé tronqué à 320 px) | `ui-variant-*.json` |
| | débordements signalés par le moteur | 1 (320 px) | 1 (320 px) | 1 (390 px) | audit Creative Engine |
| **Usage tactile** | commandes sous 44 px (écrans tactiles) | 0 | 0 | 0 | `ui-variant-*.json` |
| | hauteur des commandes | 44 px | 44 px | **48 px** | `variant-density.json` |
| **Densité** | hauteur de l'en-tête de fiche, mobile | 410 px | **408 px** | 446 px | idem |
| | première étape du trajet, mobile | 423 px | 423 px | 484 px | idem |
| **Identité** | — | NON TESTÉ | NON TESTÉ | NON TESTÉ | jugement, pas une mesure |
| **Cohérence** | tailles de texte utilisées | 5 | 5 | 5 | `ui-variant-*.json` |
| **Différenciation** | distance du moteur aux deux autres | 27 et 58 | 27 et 85 | 58 et 85 | `creative-directions.json` |
| **Maintenabilité** | jetons / code spécifique à la variante | 64 / 0 | 64 / 0 | 64 / 0 | même code |
| **Performance** | poids du fichier | 1 599,6 Ko | 1 599,1 Ko | 1 599,2 Ko | construction |
| | temps d'exécution | NON TESTÉ par variante | | | même code, écart attendu nul |
| **Compatibilité avec l'existant** | titres serif et accent terre cuite comme la baseline | oui / oui | non / non | non / oui | baseline : Fraunces, `#bd5228` |
| **Risque de régression** | tests fonctionnels | même code : 77 / 77 mesurés sur A | non rejoués | non rejoués | `e2e-refonte.json` |

## Décision : direction A, « Atlas éditorial »

Raisons, dans l'ordre où les preuves pèsent :

1. **C est écartée par les mesures** : un libellé tronqué à 320 px, un focus masqué signalé à 390 px, et un tiers
   de contenu en moins par écran (1 étape visible au lieu de 2, 2 lieux au lieu de 3). Pour un outil qu'on consulte
   en route, c'est un coût réel. Son seul avantage mesuré est la hauteur des commandes (48 px).
2. **A et B sont à égalité** sur la mise en page, l'accessibilité automatisée, la densité et le poids.
3. **A l'emporte sur deux points mesurés** : meilleur contraste minimal du texte (5,42 contre 4,87) et bouton
   principal nettement plus contrasté (7,03 contre 4,87, à la limite du seuil pour B).
4. **A conserve l'identité existante** (titres serif, papier chaud, terre cuite) : pas de rupture pour la personne
   qui utilise déjà l'application. B changerait la couleur et la typographie sans gain mesuré.

Ce que les preuves **ne tranchent pas** : la lisibilité en extérieur, où le blanc et le sans-serif de B pourraient
être meilleurs. Ce point est `NON TESTÉ`. Si un essai sur appareil le montrait, passer à B demande une commande :

```bash
node build.mjs --tokens audit-refonte/variants/tokens-B.css
```
