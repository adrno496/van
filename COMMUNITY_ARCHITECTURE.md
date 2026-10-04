# Architecture — blog, Planner, Partage

Trois domaines, séparés par construction et non par des boutons cachés.

| | **Blog du propriétaire** | **Planner du visiteur** | **Partage (communauté)** |
|---|---|---|---|
| Qui écrit | le propriétaire seul | chaque visiteur, pour lui-même | les membres connectés |
| Où vivent les données | `content/` (Git) → pages statiques | navigateur du visiteur (`atlasvan.v3`, `atlasvan.journal.v1`) | base PostgreSQL (Supabase) |
| Comment ça change | fichiers modifiés, `node build.mjs`, déploiement | sur l'appareil, hors ligne | API, contrôlée par la base (RLS) |
| Réseau | aucun | aucun (`connect-src 'none'`) | pages `partage/*` → serveur communautaire seulement |
| Peut écrire dans un autre domaine ? | — | non | non : aucune table, aucune fonction ne touche au blog |

## Le site

```text
build.mjs ─┬─ build/planner.mjs   Planner (un fichier autonome, CSP par empreintes)
           ├─ build/content.mjs   lecture stricte de content/ (types, longueurs, clés connues, GPS des photos, clés de service)
           ├─ build/site.mjs      pages : accueil, voyage en cours, voyages, carnet, destinations, road trips, guides…
           └─ build/partage.mjs   pages statiques de Partage (vides de contenu), CSP propre à ces pages
src/site/js/site.js       menu, apparition, recherche locale — toutes les pages
src/site/js/partage.js    client de Partage — pages partage/* seulement, et seulement si « community » est configuré
src/js/community.js       Planner : recevoir un circuit/spot (#partage=…), préparer un partage (#depuis-planner=…)
```

### Accueil et voyage en cours

Ordre : héros (texte réglable dans `site.json`, trois actions) → voyage en cours (carte des étapes publiées, légende,
liste textuelle, dernière étape) → dernier récit → journal (jusqu'à 6) → chiffres (seulement ce qui est publié) →
mes voyages → explorer l'Atlas (destinations, carte, road trips) → Partage et guides (en retrait) → Planner → à propos.
L'accueil ne charge **aucune** donnée de Partage et ne contacte aucun serveur.

Source unique : `site.json › currentVoyage` + les récits rattachés (`voyage`). Les cartes sont des dessins SVG produits à
la construction (aucune tuile, aucune bibliothèque) ; la carte a un nom accessible qui résume les étapes, suivi de la
liste des étapes en texte.

## Partage

```text
navigateur (partage/*)                         Supabase (ou serveur de dev pour les tests)
  partage.js ── fetch, 8 s, sans relance ──▶  /auth/v1/*          comptes (GoTrue)
                                              /rest/v1/rpc/*       fonctions SQL (PostgREST), SECURITY INVOKER : RLS appliquée
                                              /storage/v1/object/* photos, compartiment privé
                                                     │
                                              PostgreSQL : contraintes + déclencheurs + RLS + fonctions de modération
```

- **API par fonctions** (`list_items`, `get_item`, `save_item`, `set_bookmark`, `set_useful`, `report_item`,
  `my_profile`, `save_profile`, `export_my_data`, `delete_my_account`, et pour la modération `moderation_queue`,
  `moderate_item`, `suspend_user`, `set_trust`, `moderation_history`). Les tables restent protégées si quelqu'un les
  attaque directement (essais dans `tests/community.mjs` et `tests/partage.mjs`).
- **Statuts** : `draft` (auteur seul) → `pending` (en attente) → `published` ; `hidden` / `rejected` par la modération.
  Un nouveau compte passe par `pending` ; après trois contributions validées, il publie directement ; s'il modifie une
  contribution publiée avant cela, elle repasse en attente. Trois signalements retirent une contribution de l'affichage.
- **Modèle extensible** : une table `community_items` avec un `type` contrôlé et des colonnes facultatives propres à
  chaque type (circuit : distance, durées effectuée/conseillée, véhicule, difficultés, routes déconseillées, étapes ;
  spot : genre, position arrondie, nuit, dernière vérification) ; les étapes dans `community_route_stops`.
- **Comptes** : pseudo public unique, présentation facultative, date d'inscription, contributions, favoris. L'adresse
  e-mail ne sort jamais d'`auth.users` (sauf dans l'export de ses propres données).
- **Rendu** : `textContent` uniquement ; liens externes seulement en `https`, `rel="noopener noreferrer nofollow ugc"`.
- **Distinction visuelle** : badge « Communauté » sur chaque carte et chaque fiche, pseudo et dates, phrase
  « elle n'est pas écrite par l'auteur du blog ».

### Planner ↔ Partage

| Sens | Comment | Garanties |
|---|---|---|
| Partage → Planner | lien `app/index.html#partage=<base64url>` (« Ajouter à mon Planner », « Créer mon circuit à partir de celui-ci », « Ajouter à mes lieux ») | données dans l'ancre (jamais envoyées), contrôlées champ par champ, confirmation, **copie** locale ; lieu inconnu → lieu personnel ; aucun doublon ; catalogue et contribution d'origine inchangés |
| Planner → Partage | « Partager dans l'espace Partage » (Planner du site seulement) → aperçu des étapes à cocher → `partage/proposer/#depuis-planner=…` | seuls noms et positions arrondies (~1 km) des étapes cochées ; lieux de base jamais cochables ; notes, dates, budgets, favoris jamais repris ; formulaire prérempli, **rien n'est envoyé** sans connexion, aperçu et confirmation ; `atlasvan.v3` n'est jamais synchronisé |

## Auth, permissions, RLS, médias, modération

- **Auth** : Supabase Auth, e-mail + mot de passe (10 caractères au moins côté site ; confirmation d'adresse à activer
  dans le projet). Jeton JWT signé par Supabase ; le site ne garde que la session de l'utilisateur.
- **Permissions** (défense en profondeur, `backend/policies/0001_rls.sql`) : privilèges retirés puis rendus colonne par
  colonne et fonction par fonction ; RLS sur chaque table ; déclencheurs qui imposent propriétaire, statuts, champs
  protégés et débit (`backend/migrations/0001_community.sql`).
- **RLS** en une phrase par table : publié pour tous, le sien quel que soit son statut, tout en lecture pour un
  modérateur ; écriture seulement de ses propres lignes ; signalements lisibles par leur auteur et les modérateurs ;
  journal de modération invisible.
- **Modérateur** : `app_metadata.role = "moderator"`, posé côté serveur (console ou SQL), lu dans le jeton signé ;
  jamais `user_metadata`, jamais une adresse e-mail comparée dans le navigateur. Chaque fonction de modération vérifie
  le rôle (`require_moderator`) et écrit au journal.
- **Médias** : compartiment Storage **privé** `community-media`, un dossier par compte (`<uid>/<uuid>.jpg`), 5 Mo,
  JPEG/PNG/WebP. Le navigateur réduit et réenregistre chaque photo avant l'envoi (métadonnées et GPS retirés), exige
  une description, puis la lit par une requête authentifiée : la base décide (photo d'une contribution publiée, ou la
  sienne, ou modérateur).
- **Modération** : file « en attente », « signalées », « masquées », « publiées » ; décisions publier / masquer /
  refuser / remettre en attente / suspendre l'auteur, avec motif ; trois signalements retirent une contribution ;
  nouveau compte relu avant publication, confiance après trois contributions validées.

## Configuration, déploiement, sauvegardes, retour en arrière

| | |
|---|---|
| Configuration | `content/site.json › community` : `url` (https) et `anonKey` (clé publique). Rien d'autre ; toute autre clé arrête la construction |
| Déploiement | Supabase : migrations puis règles (SQL Editor), compartiment et ses règles, Auth — pas à pas dans `backend/README.md`. Site : `node build.mjs --mode public`, `dist/public/` (Vercel : `vercel.json`) |
| Sauvegardes | Blog : Git (`content/`). Partage : sauvegardes de Supabase selon l'offre, et `pg_dump` régulier du schéma `public` (+ export du compartiment `community-media`) ; chaque membre peut télécharger ses données (« Mon compte ») |
| Retour en arrière | retirer `community` de `site.json` et reconstruire (Partage « pas encore ouvert », blog et Planner intacts) ; couper l'écriture en SQL (`revoke execute on function public.save_item(jsonb) from authenticated`) ; `git revert` des commits — détail dans `backend/README.md` et `MIGRATION_REPORT.md` |

## Fonctionnement dégradé

| Situation | Comportement |
|---|---|
| `community` absent de `site.json` | pages Partage « pas encore ouvert », CSP inchangée, aucun script de Partage publié |
| serveur injoignable | une tentative (8 s au plus), bandeau « le serveur ne répond pas », bouton « Réessayer » ; blog, Atlas et Planner intacts |
| jeton expiré | un renouvellement, sinon déconnexion propre |
| JavaScript désactivé | message dans les pages Partage ; le reste du site se lit sans script |

## Données et versions

Aucun format de stockage local n'a changé (`atlasvan.v3`, `atlasvan.journal.v1`) : ce que Partage ajoute au Planner
utilise les structures existantes (lieux personnels `cN`, parcours enregistrés `ST.saved`, trajet). Seul le fichier
d'export « pour le site » passe en version 2 ; l'import accepte les versions 1 et 2 (voir `MIGRATION_REPORT.md`).

## Non réalisé (P2 de la consigne)

Commentaires, réputation, badges, notifications : non faits. La table `profiles.trust_level` et le journal de modération
en posent les bases. Page statique par contribution pour le référencement : proposée dans `backend/README.md`.
