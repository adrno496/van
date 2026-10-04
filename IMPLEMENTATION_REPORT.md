# Rapport de mise en œuvre — Atlas Van, blog personnel de voyage en van + Partage

Point de départ : commit `8763598` (fin de l'enrichissement du catalogue). Commits de ce lot :
`c465062` (blog personnel, voyage en cours, import carnet → blog), `65daa82` (Partage), puis le commit des rapports.
Détails : `COMMUNITY_ARCHITECTURE.md`, `CONTENT_WORKFLOW.md`, `SECURITY_REPORT.md`, `TEST_REPORT.md`,
`MIGRATION_REPORT.md`, `backend/README.md`.

## INSPECTÉ

`build.mjs`, `build/planner.mjs`, `build/site.mjs`, `build/content.mjs`, `build/import-articles.mjs` ;
`src/index.template.html`, `src/js/{boot,shell,journal,places,route,state,util,geo,map}.js` (parties concernées),
`src/css/components.css` ; `src/site/js/site.js`, `src/site/css/{site,direction-a}.css` ; `content/README.md`,
`content/site.json` ; `vercel.json` ; `tests/{site,e2e,catalogue}.mjs`, `tests/lib/harness.mjs`,
`tests/fixtures/content/*` ; rapports `audit-places-v4/06–08`.

## MODIFIÉ

| Fichier | Changement |
|---|---|
| `build/content.mjs` | `site.json` : `hero`, `currentVoyage`, `community` (clé anon seulement, clé de service refusée) ; voyages : `state`, `planned`, `showPlanned` ; articles : `place` (arrondi 0,1°), `onMap`, `source` |
| `build/site.mjs` | nouvel accueil (voyage en cours d'abord), page `voyage-en-cours/`, « Mes voyages », navigation à sept rubriques + menu avec le carnet, cartes SVG (dernière étape, prévu en pointillés), CSP par page, pages Partage, détection de clés de service, textes de confidentialité et d'à-propos |
| `build/import-articles.mjs` | réécrit : idempotent, identifiant stable, retouches protégées, articles publiés protégés, photos nettoyées, `--dry-run`, `--voyage`, rattachement au voyage en cours |
| `build/planner.mjs` | `data-edition` / `data-site` sur `<html>`, module `community.js` |
| `src/js/journal.js` | export v2 (identifiant, lieu arrondi) ; plus de « Fichier pour le site » dans le Planner public |
| `src/js/shell.js`, `src/js/boot.js` | lien `#partage=…` |
| `src/index.template.html`, `src/css/components.css` | groupe « Partager dans l'espace Partage » |
| `src/site/css/site.css`, `src/site/js/site.js` | styles des nouveaux blocs et de Partage ; menu replié sous 1 180 px |
| `content/README.md` | nouveaux champs, voyage en cours, import |
| `tests/site.mjs` | adapté à la nouvelle accueil et à l'import idempotent (justifications dans `TEST_REPORT.md`), groupe « blog » |
| `index.html` | Planner autonome reconstruit |

## CRÉÉ

- Pages : `voyage-en-cours/`, `partage/` (liste et recherche), `partage/contribution/`, `partage/proposer/`,
  `partage/compte/`, `partage/auteur/`, `partage/moderation/`, `partage/regles/`.
- Code : `build/partage.mjs`, `build/media.mjs`, `src/site/js/partage.js`, `src/js/community.js`.
- Backend : `backend/migrations/0001_community.sql`, `backend/policies/0001_rls.sql`, `backend/test/supabase-shim.sql`,
  `backend/dev/db.mjs`, `backend/dev/server.mjs`, `backend/README.md`.
- Tests : `tests/import.mjs`, `tests/community.mjs`, `tests/partage.mjs`, `tests/fixtures/content-voyage/`,
  `tests/fixtures/images/`.
- Documents : `IMPLEMENTATION_REPORT.md`, `TEST_REPORT.md`, `SECURITY_REPORT.md`, `COMMUNITY_ARCHITECTURE.md`,
  `MIGRATION_REPORT.md`, `CONTENT_WORKFLOW.md` ; preuves dans `audit-transformation/evidence/`.

## EXÉCUTÉ

`git archive 8763598` (copie de référence) ; `node build.mjs`, `--check`, `--mode personal` (+ `--check`),
`--mode public` (+ `--check`) avant et après ; `node tests/{e2e,ui,v2,catalogue,smoke,migration,site}.mjs` avant et
après ; `node tests/{import,community,partage}.mjs` ; mesure de l'accueil (Chromium, ×4) ; captures de l'accueil,
du voyage en cours et des pages de Partage ; installation de PGlite hors du dépôt (dossier de travail).

## TESTÉ (résultats exacts)

| Suite | Avant | Après |
|---|---|---|
| e2e / e2e public | 76/77, 76/77 | 76/77, 76/77 (même échec préexistant) |
| ui | 58/59 | 58/59 (même échec préexistant) |
| v2 | 36/36 | 36/36 |
| catalogue | 13/13 | 13/13 |
| migration | 10/10 | 10/10 |
| smoke (+ public) | PASS Chromium | PASS Chromium |
| site | 30/34 | 38/39 (seul échec : Firefox absent) |
| import | — | 6/6 |
| community (base PostgreSQL réelle) | — | 17/17 |
| partage (bout en bout) | — | 19/19 |
| constructions + `--check` | OK | OK (6/6) |

## NON TESTÉ

Firefox et WebKit ; un vrai projet Supabase (Auth, PostgREST, Storage, limites d'Auth, e-mails) ; lecteurs d'écran
réels ; `perf.mjs` / `profile.mjs` / captures de référence ; déploiement Vercel réel.

## BLOQUÉ

| Besoin | Nature |
|---|---|
| Projet Supabase, clé `anon` | **compte** et **accès réseau** (supabase.com injoignable d'ici) |
| Envoi des commits (`git push`) | **accès** : refus HTTP 403 du dépôt pour cette session (déjà constaté au lot précédent) |
| Mentions légales, contact, hébergeur des données, durée de conservation du journal | **décision humaine** (textes marqués `HUMAN_REVIEW_REQUIRED`) |
| Voyage en cours, récits, « à propos » | **contenu réel** : aucun n'a été inventé ; le site public montre des états vides |
| Désignation des modérateurs | **décision humaine** |

## RECOMMANDÉ

1. Créer le projet Supabase et rejouer les essais de `SECURITY_REPORT.md` contre lui avant toute ouverture.
2. Page statique par contribution publiée à la construction (`--community-snapshot`) pour le référencement.
3. Purge des fichiers de photos orphelins dans Storage (contribution ou compte supprimés) par une tâche planifiée.
4. Rétention du journal de modération (un an ?) et contact RGPD à décider.
5. P2 de la consigne : commentaires, réputation, badges, notifications.
6. Firefox et WebKit dans l'environnement de test ; relancer `perf.mjs` et `profile.mjs`.
7. Séparer la feuille de style de Partage (11 Ko) si l'accueil doit maigrir encore.

## Retour en arrière

- Désactiver Partage sans toucher au code : retirer `community` de `content/site.json`, reconstruire, redéployer.
- Annuler le lot : `git revert 65daa82 c465062` (stockage local inchangé : aucune donnée perdue ; voir
  `MIGRATION_REPORT.md` pour les articles importés au format v2).

## VERDICT : PARTIAL

Tout ce qui est demandé est implémenté et testé dans cet environnement, sans régression (les seuls échecs restants
existaient avant et sont identiques). **PARTIAL** parce que le service communautaire n'a pas pu être essayé contre un
vrai Supabase : la base, ses règles et le site l'ont été réellement (PostgreSQL, Chromium), mais Auth, PostgREST et
Storage sont imités. Les commits ne sont pas envoyés (refus 403).

## Contrôle final — les vingt questions

1. **Blog personnel de voyage ?** Oui : accueil « Suivez mon voyage en van solo » (réglable), voyage en cours, journal,
   mes voyages ; l'Atlas et le Planner viennent ensuite.
2. **Voyage en cours en premier ?** Oui, juste après le héros (accueil : `site.mjs` 1 et « voyage en cours sur l'accueil »).
   Sans voyage en cours publié, la section n'apparaît pas (aucun faux voyage).
3. **Carte = circuit publié du propriétaire ?** Oui : étapes = récits publiés et situés du voyage désigné, dernière
   étape cerclée, prévu seulement si `showPlanned`, position arrondie, jamais en direct.
4. **Articles reliés au carnet sans double saisie ?** Oui : export du carnet → `import-articles.mjs` (idempotent,
   mise à jour des brouillons, rattachement au voyage en cours) ; seule la publication reste un geste manuel, voulu.
5. **Un visiteur peut-il modifier le carnet du propriétaire ?** **NON** : il vit dans `content/` et Git ; aucune page,
   aucune table, aucune fonction ne le touche (`community.mjs` 16).
6. **Itinéraires personnels toujours possibles ?** Oui : e2e 76/77 (échec préexistant d'affichage seulement).
7. **L'onglet Partage existe-t-il ?** Oui : rubrique « Partage » de la navigation, huit pages.
8. **Publier son circuit ?** Oui (formulaire, étapes ordonnées ; essai « formulaire »), avec validation pour un nouveau compte.
9. **Publier un spot ?** Oui (position arrondie à ~1 km, date de vérification, avertissement nuit).
10. **Publier une astuce ou une technique ?** Oui (essais « compte » et « photos »).
11. **Importer un circuit communautaire dans son Planner ?** Oui : « Ajouter à mon Planner » et « Créer mon circuit à
    partir de celui-ci » (copie locale, original inchangé).
12. **Modifier le contenu d'un autre ?** **NON** : refusé par la base (RLS + déclencheurs), essayé par l'interface, par
    l'API et en SQL direct.
13. **Permissions testées côté backend ?** Oui : 17 essais SQL sous les rôles `anon` / `authenticated` sur PostgreSQL
    réel, plus des requêtes HTTP directes ; mais pas contre un vrai Supabase.
14. **Données privées historiques préservées ?** Oui : formats `atlasvan.v3` et `atlasvan.journal.v1` inchangés,
    migration 10/10, aucune suppression silencieuse.
15. **`dist/public` exempt de secrets et de contenu privé ?** Oui : contrôle de confidentialité à chaque construction,
    recherche de motifs, jeton autre que `anon` refusé, aucun fichier de `backend/`.
16. **Planner hors connexion ?** Oui : `connect-src 'none'` inchangé, smoke en fichier local PASS (Chromium).
17. **Site sans service communautaire ?** Oui : sans configuration (« pas encore ouvert ») comme serveur injoignable
    (bandeau, une seule tentative, blog intact) — essais dédiés.
18. **Tests responsive exécutés ?** Oui : `site.mjs` 16 (dix largeurs), `ui.mjs`, Partage à 320/390/1 280 px.
19. **Tests sécurité exécutés ?** Oui : `community.mjs` 17/17, `partage.mjs` 19/19, `site.mjs` sécurité ;
    tableau des 17 exigences dans `SECURITY_REPORT.md`.
20. **Régressions recherchées ?** Oui : toutes les suites existantes rejouées avant et après sur des copies exactes ;
    aucun test qui passait avant n'échoue après.
