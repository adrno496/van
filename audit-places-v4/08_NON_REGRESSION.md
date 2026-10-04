# 08 — Non-régression

| Élément à préserver | Preuve | Statut |
|---|---|---|
| Lieux existants | `validate.mjs` compare chaque fiche d'origine à son empreinte SHA-256 (`data-sources/baseline-v10.json`) : 1 600/1 600 présentes et identiques, champ par champ | PASS |
| Identifiants existants | inchangés (0–1 599) ; nouveaux identifiants à partir de 1 600, jamais réattribués ; lieux personnels (`c1`, `c2`…) dans un autre espace de noms : aucune collision possible | PASS |
| Ordre et format de `DATA.lieux` | lot 0 : construction identique octet pour octet après la séparation par pays ; `validate.mjs` contrôle les types des champs lus par l'application | PASS |
| Parcours existants | les 25 parcours d'origine identiques (comparaison JSON avec 367042f) ; 10 ajoutés à la suite ; e2e « parcours prêts » et v2 « toutes les idées de parcours se chargent » PASS | PASS |
| Favoris, lieux faits, notes, budgets, dates | stockés par identifiant (`atlasvan.v3`) : identifiants inchangés ; e2e (P1-explorer, P2-itineraire), migration 10/10 | PASS |
| Sauvegardes et imports | format inchangé (versions 3 et 5) ; e2e P4-sauvegarde, v2 « 16 fichiers invalides », migration (sauvegardes de l'ancienne version restaurées par la nouvelle) | PASS |
| Carnet et photos | IndexedDB inchangé ; e2e P3-carnet, smoke « carnet : écrire et enregistrer » + rechargement | PASS |
| Lieux personnels | e2e création, modification, suppression, import de parcours avec lieux perso | PASS |
| Bases privées | toujours 5 ; retirées de la version publique ; contrôle de confidentialité réussi ; aucune expression interdite dans les nouvelles fiches (vérifié par `enrich.mjs` et `validate.mjs`) | PASS |
| Mode public | `build --mode public` + `--check` OK ; e2e public 76/77 (même échec préexistant), v2 public PASS, `tests/catalogue.mjs` « version publique » PASS | PASS |
| Mode personnel | `build --mode personal` + `--check` OK ; site « Planner complet dans le site » PASS | PASS |
| Fonctionnement hors ligne | aucune dépendance réseau ajoutée au Planner ni au site : `connect-src 'none'` inchangé ; smoke en `file://` PASS ; les références (GeoNames…) ne servent qu'au pipeline | PASS |
| Filtres | e2e P1 « filtres : catégorie, importance, pays, mois, compteur » PASS ; catalogue « filtre pays » (Italie, France, Espagne, Andorre, Luxembourg) PASS | PASS |
| Recherche | e2e recherche PASS ; 30 nouveaux lieux trouvés ; recherche plus rapide qu'avant (index préparé) | PASS |
| Carte | v2 marqueurs (forme par catégorie, contour 1,2 px, survol = clic, halo des bases) PASS ; lisibilité des noms (catalogue) PASS ; gestes aussi fluides ou plus qu'avant (`06`) ; liseré clair des marqueurs ordinaires retiré seulement pendant un geste | PASS |
| Itinéraire, « Ajouter tout un pays » | e2e P2-itineraire PASS ; catalogue « Ajouter tout un pays » PASS | PASS |
| Liens profonds `#pays=`, `#lieu=`, `#parcours=`, `#q=` | site « liens d'entrée » PASS ; catalogue « liens profonds » (nouveaux lieux) PASS | PASS |
| « Voir 24 lieux de plus », « Près de moi », fiches, liens Google Maps | catalogue (Explorer, Près de moi, fiche) PASS ; e2e P5-geolocalisation PASS | PASS |
| « Nouveautés » | affiche désormais le lot le plus récent (v10, 1 800 lieux) au lieu du lot v9 figé : évolution voulue du sens « nouveautés » | PASS (comportement mis à jour) |
| Responsive, mobile, tactile | ui 58/59 et e2e P6 : mêmes échecs qu'avant (`#loop` déborde à 320 px ; « Trajet51 » tronqué à 320 px), aucun nouveau | PARTIAL — préexistant |
| Accessibilité | e2e « accessibilité clavier » PASS ; site 15 « focus visible » : FAIL avant comme après | PARTIAL — préexistant |
| Sécurité | e2e et v2 sécurité PASS (imports piégés, CSP, prototype) ; site 17 : seul l'échec d'image de test préexistant | PASS |
| Site éditorial (destinations, road trips, recherche, compteurs, sitemap, SEO) | compteurs et descriptions tirés du catalogue (3 395 lieux, 35 itinéraires, pages pays) ; 10 pages road trip ajoutées ; `sitemap.xml` produit avec `--site-url` : 81 adresses dont 36 sous road-trips/ (index + 35 itinéraires) ; site 30-31/34 comme avant | PARTIAL — préexistant |
| Démarrage | plus long qu'avant (prêt 1 423 → 1 978 ms sur mobile ralenti ×4 ; 286 → 419 ms sans ralentissement) : conséquence du doublement des données, réduite par les optimisations (`06`) | PARTIAL — régression de performance documentée |
| Firefox, WebKit | non installés : NON TESTÉ avant comme après | NON TESTÉ |

## Verdict

**Zéro régression fonctionnelle : PASS** — aucun test qui passait avant n'échoue après, les données des utilisateurs
restent lisibles et les fiches d'origine sont intactes.

**Zéro régression de performance : PARTIAL** — les gestes sur la carte, la recherche et le déplacement sont aussi
rapides ou plus rapides qu'avant ; le démarrage, le zoom ponctuel, les filtres et la création des listes restent plus
lents, en proportion du catalogue doublé (détail et pistes dans `06_PERFORMANCE_REPORT.md`).

## Retour en arrière

- Tout le lot : `git revert` des commits du lot (architecture `7b02884`, lot 1 `66b2dc7`, lot 2 `f5f44a1`,
  performances `b65d794`, parcours `c262268`, `790697d`, `4fdc162`).
- Seulement les nouvelles fiches : retirer les lignes `"batch":"v10"` de `src/data/lieux/*.json` (les fiches d'origine
  ne portent pas ce lot) et les 10 derniers parcours de `src/data/places.js` ; reconstruire.
- Les données des utilisateurs ne dépendent d'aucun nouvel identifiant tant que la version n'est pas publiée ; après
  publication, une note posée sur un nouveau lieu serait ignorée sans erreur par une version antérieure (« note d'un
  lieu disparu : sans effet », `state.js`).
