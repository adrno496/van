# Backend de « Partage » (espace communautaire)

Ce dossier contient tout ce qui concerne le serveur de l'espace **Partage** : schéma PostgreSQL, règles d'accès (RLS),
et un serveur de **développement / test** qui imite Supabase. Le blog, l'Atlas et le Planner n'en dépendent pas :
sans configuration, le site se construit et fonctionne comme avant, et la rubrique Partage affiche « pas encore ouvert ».

```text
backend/
  migrations/0001_community.sql   tables, contraintes, déclencheurs, fonctions (API)
  policies/0001_rls.sql           privilèges, RLS, règles du stockage des photos (en commentaire, pour Supabase)
  test/supabase-shim.sql          TESTS SEULEMENT : rôles anon/authenticated/service_role et schéma auth minimal
  dev/db.mjs                      TESTS SEULEMENT : PostgreSQL local (PGlite) avec les migrations appliquées
  dev/server.mjs                  TESTS SEULEMENT : imitation de Supabase (Auth, PostgREST, Storage — sous-ensembles)
```

Rien de ce dossier n'est copié dans `dist/` (vérifié par `tests/partage.mjs`).

## Pourquoi Supabase

| Besoin | Réponse Supabase | Alternative examinée |
|---|---|---|
| Comptes (pseudo, e-mail jamais affiché) | Auth (e-mail + mot de passe, confirmation, limites de débit intégrées) | serveur maison : plus de code à sécuriser |
| Base relationnelle avec contraintes | PostgreSQL | Firebase : pas de contraintes déclaratives ni de SQL |
| Droits ligne par ligne, côté serveur | RLS PostgreSQL, testable localement (`tests/community.mjs`) | règles applicatives : à réécrire et tester à part |
| Photos privées jusqu'à publication | Storage + règles sur `storage.objects` | S3 + URLs signées : plus de pièces |
| Aucune dépendance dans le site | API HTTP (PostgREST) appelée par `fetch` : **aucune bibliothèque ajoutée** au site | SDK supabase-js : 50 Ko et une dépendance de plus, inutiles ici |

- **Coût** : l'offre gratuite suffit pour démarrer (base de 500 Mo, 1 Go de stockage, 50 000 utilisateurs actifs par mois
  selon les conditions publiées — à vérifier au moment de l'ouverture, elles changent). Un projet gratuit inactif est mis
  en pause : prévoir l'offre payante si Partage doit rester ouvert en permanence.
- **Hors ligne** : le Planner et le blog n'appellent jamais Supabase. Seules les pages `partage/` le font, avec un délai
  de 8 s, sans relance automatique, et un bandeau « le serveur ne répond pas ».
- **Sécurité** : la seule clé présente dans le site est la clé publique `anon`, faite pour être publiée. Les droits sont
  décidés par la base (RLS + déclencheurs + fonctions), jamais par le navigateur. La construction s'arrête si une clé de
  service est fournie (`service_role`, `sb_secret_…`) ou détectée dans un fichier produit.
- **CSP** : seules les pages `partage/*` (sauf les règles) reçoivent `connect-src <origine Supabase>` et
  `img-src … blob: <origine Supabase>`. Le reste du site garde `connect-src 'none'`.
- **Construction** : `node build.mjs` ne contacte aucun serveur. Les contributions ne sont pas dans les pages statiques
  (voir « Référencement » plus bas).
- **Migration / sortie** : schéma PostgreSQL standard ; un `pg_dump` suffit pour changer d'hébergeur. Les seules
  dépendances à Supabase sont `auth.uid()`, `auth.jwt()`, le schéma `auth.users` et `storage.objects`.
- **Maintenance** : appliquer les migrations dans l'ordre ; surveiller la file de modération ; tenir à jour la liste
  des modérateurs (app_metadata).

## Mise en place sur Supabase (NON TESTÉ dans cet environnement : Supabase n'y était pas joignable)

1. Créer un projet Supabase (région UE de préférence).
2. **SQL Editor** : exécuter `migrations/0001_community.sql`, puis `policies/0001_rls.sql`.
   Ne **pas** exécuter `test/supabase-shim.sql` (Supabase fournit déjà ces rôles et le schéma `auth`).
3. **Storage** : créer le compartiment `community-media` — *privé*, taille maximale 5 Mo, types autorisés
   `image/jpeg, image/png, image/webp`. Puis exécuter les trois `create policy … on storage.objects` donnés en
   commentaire à la fin de `policies/0001_rls.sql`.
4. **Authentication** : fournisseur e-mail ; activer la confirmation des adresses ; garder les limites de débit
   par défaut (ou les abaisser) ; adresse du site (`Site URL`) = adresse publique du site.
   CAPTCHA (hCaptcha / Turnstile) : **non activé par défaut**. Si le spam l'exige, l'activer côté Supabase demandera
   d'ajouter le domaine du fournisseur à la CSP des seules pages `partage/compte/` — décision à prendre en connaissance de cause.
5. **API → CORS** : Supabase accepte toutes les origines par défaut ; rien à faire.
6. **Modérateurs** : dans *Authentication › Users*, ou en SQL (côté serveur uniquement) :
   ```sql
   update auth.users set raw_app_meta_data = raw_app_meta_data || '{"role":"moderator"}' where email = 'moderation@exemple.fr';
   ```
   Le rôle est lu dans `app_metadata` du jeton, que l'utilisateur **ne peut pas** modifier. Jamais dans
   `user_metadata`, jamais par comparaison d'adresse e-mail. Le changement prend effet à la prochaine connexion.
7. **Site** : dans `content/site.json`,
   ```json
   "community": { "url": "https://<projet>.supabase.co", "anonKey": "<clé anon publique>" }
   ```
   puis `node build.mjs --mode public` et déploiement de `dist/public/`.
8. Vérifier, connecté en anonyme puis avec deux comptes : la liste, une proposition (« en attente »), la modération,
   l'export et la suppression du compte. Le tableau de `SECURITY_REPORT.md` donne les essais à refaire contre le vrai projet.

**Ne jamais** mettre dans le site, dans `content/`, dans `localStorage` ou dans un dépôt Git : la clé `service_role`,
une clé `sb_secret_…`, le secret JWT, le mot de passe de la base.

## Essais locaux (sans compte Supabase)

PGlite (PostgreSQL compilé en WebAssembly) n'est **pas** une dépendance du dépôt ; l'installer à part :

```sh
npm install --prefix ~/outils-atlas @electric-sql/pglite@0.5.8
export PGLITE_FROM=~/outils-atlas/
node tests/community.mjs                      # sécurité de la base : 17 essais
PLAYWRIGHT_FROM=<…> node tests/partage.mjs    # bout en bout dans Chromium : 19 essais
```

Serveur de développement, pour essayer à la main :

```sh
PGLITE_FROM=~/outils-atlas/ node backend/dev/server.mjs --port 54321
# copier la ligne "community" affichée dans une COPIE de content/ (jamais dans le content/ publié), puis :
node build.mjs --mode personal --content /tmp/content-essai --dir /tmp/site-essai
```

La base du serveur de développement vit en mémoire : elle disparaît à l'arrêt. Le serveur imite seulement ce qu'utilise
le site ; ce n'est pas Supabase, et un essai réussi contre lui ne remplace pas un essai contre le vrai projet.

## Modèle de données

| Table | Contenu | Écrit par |
|---|---|---|
| `profiles` | pseudo (unique, sans balise), présentation, date d'inscription, niveau de confiance, suspension | l'utilisateur (pseudo, présentation) ; la modération (confiance, suspension) |
| `community_items` | contributions : `type` (circuit, spot, astuce, technique, retour), `status` (draft, pending, published, hidden, rejected), champs communs et propres au type | l'auteur, via `save_item` ; statuts publiés/masqués : modération |
| `community_route_stops` | étapes ordonnées d'un circuit (nom, lieu de l'Atlas éventuel, position arrondie, nuits, note) | l'auteur |
| `community_media` | photos : chemin `<uid>/<uuid>.<ext>`, description, dimensions | l'auteur |
| `community_bookmarks`, `community_reactions` | favoris, « utile » | chacun pour soi |
| `community_reports` | signalements (motif contrôlé, précisions) | chacun pour soi ; anonymisés à la suppression du compte |
| `moderation_log` | journal des décisions | fonctions de modération seulement |

Pour ajouter un type de contribution : l'ajouter à la contrainte `type` (nouvelle migration), à `TYPES` dans
`build/partage.mjs` et `src/site/js/partage.js`, et, s'il a des champs propres, les ajouter comme colonnes facultatives
avec leurs contraintes.

## Référencement

Les contributions sont lues par le navigateur : les robots qui n'exécutent pas JavaScript ne les voient pas, et les fiches
`partage/contribution/` sont en `noindex`. Seule la page d'accueil de Partage et ses règles sont indexables.
Proposition (non réalisée) : à la construction publique, une option `--community-snapshot` lirait les contributions
**publiées** (clé anon, `list_items`) et produirait une page statique par contribution, avec `noindex` levé et entrée
dans `sitemap.xml` ; une contribution masquée disparaîtrait à la construction suivante.

## Désactiver Partage (retour en arrière)

- **Sans toucher au code** : retirer `community` de `content/site.json`, reconstruire, redéployer. Les pages `partage/`
  affichent « pas encore ouvert », aucune page ne contacte plus de serveur, `assets/partage.js` n'est plus publié.
  Le blog, l'Atlas et le Planner ne changent pas. Les données restent dans Supabase.
- **Couper l'accès en écriture immédiatement** (côté Supabase, SQL) :
  ```sql
  revoke execute on function public.save_item(jsonb) from authenticated;
  ```
- **Tout retirer** : `git revert` des commits de Partage ; dans Supabase, `drop table` des tables ci-dessus (après un
  export si besoin).
