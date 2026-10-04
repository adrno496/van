# Rapport de sécurité

Statuts : **PASS** (essayé, réussi), **PARTIAL**, **FAIL**, **NON TESTÉ** (pas d'essai réel), **NON APPLICABLE**.
Environnement des essais : Node 22, Chromium 141 (Playwright 1.56.1), PostgreSQL 18.3 en WebAssembly (PGlite 0.5.8)
avec les migrations et la RLS de `backend/`, rôles `anon` / `authenticated` comme PostgREST, serveur d'imitation de
Supabase (`backend/dev/server.mjs`). **Aucun essai contre un vrai projet Supabase** : supabase.com n'était pas joignable
depuis cet environnement. Les règles éprouvées sont les vraies (même SQL) ; Auth, PostgREST et Storage, eux, sont imités.

## Les essais demandés

| # | Exigence | Essai | Statut |
|---|---|---|---|
| 1 | Un utilisateur A ne peut pas modifier le contenu de B | `community.mjs` 2 (fonction, UPDATE/DELETE directs, étape ajoutée) ; `partage.mjs` « sans droits » (PATCH/DELETE HTTP) | PASS (base réelle, API imitée) |
| 2 | Le public ne peut pas modifier le blog | le blog n'existe que dans `content/` + pages statiques ; aucune table ni fonction ne le concerne (`community.mjs` 16) ; aucune page n'a de formulaire qui poste (`form-action 'none'`) | PASS |
| 3 | Pas d'administration par le frontend | rôle lu dans `app_metadata` du jeton signé ; `user_metadata` « moderator » refusé (`community.mjs` 5) ; jeton signé par une autre clé et jeton `alg: none` refusés, page de modération vide pour un compte ordinaire (`partage.mjs`) | PASS |
| 4 | `owner_id` impossible à usurper | insertion au nom d'un autre, transfert de propriété (`community.mjs` 3) ; POST HTTP (`partage.mjs`) | PASS |
| 5 | Brouillons et contenus masqués jamais publics | `community.mjs` 1 (liste, fiche, table) ; `partage.mjs` « lecture sans compte » ; site : brouillons absents de `dist/public` (`site.mjs`) | PASS |
| 6 | Médias privés | photo non rattachée illisible, en attente lisible par l'auteur seul, publiée lisible (`partage.mjs` photos) | PASS (stockage imité ; règles `storage.objects` Supabase : NON TESTÉ) |
| 7 | XSS stockée | balises refusées par la base dans tous les champs texte (`community.mjs` 7) ; contenu hostile injecté en contournant les contraintes : affiché en texte, rien d'exécuté (`partage.mjs` XSS) | PASS |
| 8 | URL `javascript:` | refusée par la base (`source_url` https seulement) ; jamais rendue même si présente (`partage.mjs`) | PASS |
| 9 | HTML non exécuté | rendu `textContent` uniquement ; essais ci-dessus ; site : titres hostiles échappés (`site.mjs` 18) | PASS |
| 10 | IDOR | PATCH/DELETE par identifiant (`partage.mjs`) ; favori sur le brouillon d'un autre, fiche d'un brouillon par son adresse (`community.mjs` 1, 12) | PASS |
| 11 | Fichiers interdits | SVG, HTML, type annoncé faux, extension `.svg`, chemin `../` (`partage.mjs` photos ; `import.mjs` refus) | PASS |
| 12 | Limites de taille | titres, textes, étapes (60), saisons (`community.mjs` 9) ; photo > 5 Mo (Partage), > 8 Mo et > 12 photos (import) | PASS |
| 13 | Limitation de débit | base : 5 contributions / heure / compte, 20 / jour ; 20 signalements / jour (`community.mjs` 10 ; `partage.mjs` « débit » : HTTP 429) ; serveur imité : inscriptions et connexions par adresse (`partage.mjs` « débit ») | PARTIAL — contenu : PASS ; limites d'Auth du vrai Supabase : NON TESTÉ (celles du serveur imité : PASS) |
| 14 | Clé service-role absente | construction refusée si `anonKey` est une clé de service (JWT `service_role`, `sb_secret_…`) (`site.mjs` « réglages refusés ») ; tout jeton trouvé dans un fichier produit doit être `anon`, sinon la construction s'arrête (`build/site.mjs`) ; vérifié sur `dist/` (`partage.mjs` « dist ») | PASS |
| 15 | Secrets absents de `dist/public` | motifs interdits (`service_role`, `sb_secret_`, clés privées, jetons d'API connus) contrôlés à chaque construction publique ; aucun fichier de `backend/` publié (`partage.mjs`, `site.mjs` 13) | PASS |
| 16 | La CSP bloque | pages de Partage : seule l'origine du serveur ; requête vers une autre origine bloquée ; accueil : serveur communautaire hors de portée ; aucune page avec `*`, `unsafe-inline`, `unsafe-eval` (`partage.mjs` CSP, `site.mjs` 17) | PASS |

## Autres contrôles

| Contrôle | Essai | Statut |
|---|---|---|
| Contournement de la modération (se publier, se masquer, sortir d'un masquage) | `community.mjs` 4 | PASS |
| Élévation : niveau de confiance, suspension, journal, e-mails des comptes | `community.mjs` 5 | PASS |
| Nouveau compte : validation avant publication ; modification d'un contenu publié → revalidation | `community.mjs` 13 | PASS |
| Suspension : plus d'écriture, contenus retirés, pas d'auto-levée | `community.mjs` 14 | PASS |
| Trois signalements → retrait en attente de modération | `community.mjs` 11, `partage.mjs` | PASS |
| « Utile » sur sa propre contribution, compteur forcé | `community.mjs` 3, 12 | PASS |
| Injection SQL par la recherche, jokers `%` | `community.mjs` 17 | PASS |
| Coordonnées : arrondi ~1 km imposé par la base, hors d'Europe refusé | `community.mjs` 8 | PASS |
| Position du propriétaire : jamais en direct, arrondie, brouillons et étapes masquées absents | `site.mjs` « confidentialité du voyage » | PASS |
| Photos importées dans le blog : EXIF/GPS retirés, type réel, chemins sûrs | `import.mjs` | PASS |
| Photos de Partage : recompressées sur l'appareil, GPS absent du fichier stocké | `partage.mjs` photos | PASS |
| Liens de Partage vers le Planner piégés (JSON hors format, coordonnées absurdes, HTML) | `partage.mjs` spot | PASS |
| Partage d'un trajet : notes jamais transmises, lieu de base jamais cochable, rien sans confirmation | `partage.mjs` Planner → Partage | PASS |
| Planner public : aucune promesse de publication sur le blog | `site.mjs` « Planner public » | PASS |
| Serveur injoignable : pas de relance en boucle | `partage.mjs` | PASS |
| Firefox, WebKit | non installés | NON TESTÉ |

## Ce qui reste à faire contre le vrai Supabase (commandes)

1. Appliquer `migrations/0001_community.sql` puis `policies/0001_rls.sql` (SQL Editor), créer le compartiment
   `community-media` et ses trois règles (voir `backend/README.md`).
2. Avec la clé `anon` et deux comptes A et B (jetons `TA`, `TB`) :
   ```sh
   U=https://<projet>.supabase.co; K=<anon>
   # A ne modifie pas l'élément de B (attendu : [] ou 0 ligne)
   curl -s -X PATCH "$U/rest/v1/community_items?id=eq.<id de B>" -H "apikey: $K" -H "Authorization: Bearer $TA" -H "Content-Type: application/json" -H "Prefer: return=representation" -d '{"title":"x"}'
   # usurpation (attendu : 403 / new row violates row-level security)
   curl -s -X POST "$U/rest/v1/community_items" -H "apikey: $K" -H "Authorization: Bearer $TA" -H "Content-Type: application/json" -d '{"owner_id":"<id de B>","type":"astuce","title":"usurpé","summary":"usurpation de propriétaire"}'
   # modération sans rôle (attendu : moderator_only)
   curl -s -X POST "$U/rest/v1/rpc/moderation_queue" -H "apikey: $K" -H "Authorization: Bearer $TA" -H "Content-Type: application/json" -d '{"p_status":"pending"}'
   # journal et confiance (attendu : 401/403, permission denied)
   curl -s "$U/rest/v1/moderation_log" -H "apikey: $K" -H "Authorization: Bearer $TA"
   curl -s "$U/rest/v1/profiles?select=trust_level" -H "apikey: $K" -H "Authorization: Bearer $TA"
   # photo dans le dossier d'un autre (attendu : 403)
   curl -s -X POST "$U/storage/v1/object/community-media/<id de B>/$(uuidgen).jpg" -H "apikey: $K" -H "Authorization: Bearer $TA" -H "Content-Type: image/jpeg" --data-binary @photo.jpg
   ```
3. Vérifier les limites d'Auth du projet (inscriptions, connexions, e-mails) et la confirmation d'adresse.
4. Rejouer `tests/partage.mjs` en pointant un site construit avec la vraie configuration — **non prévu** dans le test
   actuel (il démarre son propre serveur) : à faire à la main en suivant les étapes du test.

## Risques connus et choix

- **Session dans `localStorage`** : comme le SDK Supabase par défaut. Une XSS volerait la session Partage (pas plus) ;
  défenses : CSP stricte sans script en ligne, rendu `textContent`, balises refusées par la base. Pas de cookie.
- **Clé `anon` publique** : attendu ; elle ne donne que ce que la RLS permet à un visiteur anonyme.
- **Fonctions `SECURITY DEFINER`** (modération, export, suppression, compteurs) : `search_path` fixé, rôle vérifié dans
  chaque fonction, exécution retirée à `anon` ; essais 5, 14, 15 de `community.mjs`.
- **Pas de `FORCE ROW LEVEL SECURITY`** : le propriétaire des tables (postgres) est celui des fonctions de modération ;
  les visiteurs passent par `anon` / `authenticated`, soumis à la RLS.
- **Pas de CAPTCHA** par défaut (choix de la consigne) ; débit limité par la base et par Supabase Auth.
- **Contributions rendues côté navigateur** : non indexées (voir `backend/README.md`, « Référencement »).
- **Textes juridiques** (règles, données personnelles) : projets marqués `HUMAN_REVIEW_REQUIRED`, sans valeur de validation.
