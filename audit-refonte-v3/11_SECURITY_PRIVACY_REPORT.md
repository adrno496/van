# 11 — Sécurité et confidentialité

## Surface nouvelle de ce cycle

| Entrée | D'où elle vient | Risque | Défense |
|---|---|---|---|
| Fichiers de `content/` | le propriétaire, ou un export du Planner | texte hostile, chemin d'image, lien, clé inattendue | validation stricte à la lecture, échappement à l'écriture |
| Adresse (`#pays`, `#lieu`, `#parcours`, `#q`) | n'importe quel lien | injection, valeur inattendue | comparaison au catalogue ; rien de l'adresse n'entre dans le HTML |
| Recherche du site (`#q`, saisie) | le visiteur | injection dans les résultats | résultats créés nœud par nœud (`textContent`), aucun `innerHTML` |
| Options de construction (`--site-url`, `--dir`, `--content`) | la ligne de commande | adresse hostile, dossier écrasé | protocole contrôlé ; un dossier existant non produit par la commande est refusé |
| Export pour le site, import d'articles | le Planner, puis un fichier | publication involontaire, photo hostile | toujours privé et brouillon ; formats d'image contrôlés |

## Tests d'attaque (`tests/site.mjs`)

| Attaque | Résultat observé | Statut |
|---|---|---|
| Titre, extrait, légende, texte alternatif, texte et intertitre d'article contenant `<img onerror>`, `<script>`, `" onload="` | affichés comme du texte sur 5 pages (article, liste, accueil, recherche, destination) ; 0 script, 0 gestionnaire, 0 image injectée | PASS |
| Titre de page (`<title>`) et description avec balises | échappés | PASS |
| `#q=<img src=x onerror=…>` sur la page de recherche | placé dans le champ ; absent du HTML | PASS |
| 10 liens d'entrée hostiles vers le Planner (`__proto__`, `constructor`, balises, `../../etc/passwd`, encodage cassé, 5 000 caractères) | ignorés ; aucun filtre, aucun trajet, aucune erreur | PASS |
| `slug` avec remontée de dossier, balise, majuscules | construction refusée | PASS |
| Image hors de `content/media` (`..`), par adresse distante, en `javascript:`, absente, illisible | refusée | PASS |
| Lien de source ou de réseau social en `javascript:` ou `data:` | refusé | PASS |
| Clé inconnue ; `__proto__` dans un fichier | refusé ; prototype intact | PASS |
| Visibilité inventée, date impossible, lieu inexistant, JSON illisible, adresse de site en `javascript:` | refusés | PASS |
| `--dir` pointant sur un dossier existant (`src/`) | refusé ; `src/` intact | PASS |
| Photo SVG dans un export d'articles ; second import du même article | refusés | PASS |
| Fichier d'export prétendant « public » et « publié » | importé en privé et brouillon | PASS |

17 fichiers de contenu hostiles ou invalides sont refusés ; aucun ne produit de page.
Les tests des cycles précédents (16 scénarios sur le Planner) passent toujours (`tests/e2e.mjs`, `tests/v2.mjs`).

## Politique de sécurité du contenu

| Pages | Politique |
|---|---|
| Site (74 pages) | `default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'none'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'` |
| Planner (`app/index.html`) | inchangée : scripts et feuille de style autorisés par empreinte SHA-256, `connect-src 'none'` |

- Ni `unsafe-inline`, ni `unsafe-eval`, nulle part.
- Aucune page du site ne contient de style en ligne, de gestionnaire en ligne ni de script en ligne exécutable
  (vérifié sur chaque fichier). Les blocs `application/json` et `application/ld+json` ne s'exécutent pas.
- 0 violation à l'exécution sur 16 pages parcourues.
- `'self'` plutôt que des empreintes pour le site : deux fichiers partagés par 74 pages, mis en cache une fois. Les
  empreintes restent pour le Planner, qui est un fichier unique.

## Aucun traceur

| Contrôle | Résultat |
|---|---|
| Requêtes vers un autre hôte, sur 16 pages | 0 |
| Cookies déposés | 0 |
| `localStorage` / `sessionStorage` écrits par le site | 0 (le Planner écrit les siens, comme avant) |
| Ressource externe (`script`, `link`, `img`, `iframe`…) dans les fichiers | 0 |
| Signature d'un outil de mesure (Google Analytics, Meta, Hotjar, Matomo, Plausible…) | 0 |
| Polices externes, lecteurs intégrés, boutons sociaux | aucun |

## Frontière public / privé

Deux contrôles s'enchaînent avant toute écriture de la version publique ; au moindre doute, la construction
s'arrête et **rien n'est écrit**.

| Contrôle | Ce qu'il cherche, dans tous les fichiers produits |
|---|---|
| Catalogue (`build/planner.mjs`, cycle 2) | textes des fiches personnelles retirées ; expressions familiales ; chemin `/Users/`, adresse `file://` ; fiche `base` restante ; étape absente du catalogue |
| Contenu (`build/site.mjs`) | tout titre, résumé, extrait, paragraphe, légende ou texte alternatif d'un contenu non public ; clés de service et clés privées ; signature d'une sauvegarde du Planner ; marqueurs « privé », « démo », « à compléter » ; image qui n'appartient à aucun contenu public ; photographie portant une position GPS |

Refus réellement provoqués et vérifiés : article public citant « chez ma marraine » ; article public citant un lieu
personnel ; chemin `/Users/…` dans un guide ; texte privé recopié dans un contenu public ; photographie publique
portant une position GPS ; jeton de service dans un texte ; contenu de démonstration demandé en version publique.

| Donnée | Dans la version publique ? |
|---|---|
| Domicile, adresse, proches (les cinq « bases ») | non — retirés du catalogue public, textes interdits |
| Notes privées, brouillons, sections privées | non — ni page, ni texte, ni image |
| Photographies privées | non — seules les images d'un contenu public sont copiées |
| Trajets, favoris, historique, carnet personnel | non — ils ne sont dans aucun fichier : ils vivent dans le navigateur |
| Sauvegardes | non — signature recherchée |
| Chemins locaux, clés, jetons | non — recherchés |

Limites du contrôle : il reconnaît ce qu'on lui a décrit. Un texte personnel **écrit dans un contenu marqué public**
est publié — c'est le sens de « public ». Une expression familiale absente de la liste, ou une photographie montrant
quelque chose de privé, ne sont pas détectables par une machine. La relecture avant publication reste nécessaire.

Points laissés au propriétaire (inchangés depuis le cycle 2) : trois intitulés d'itinéraires évoquent un projet
personnel et une région de départ.

## Stockage local

Inchangé : trajets et carnet en clair dans le navigateur ; constat relevé par SENTINEL et non masqué (`14`). Le site
éditorial, lui, n'enregistre rien.

## Ce qui n'a pas été fait

| Point | Statut |
|---|---|
| Test d'intrusion par un tiers | NON TESTÉ |
| En-têtes HTTP du serveur (HSTS, `X-Content-Type-Options`, politique en en-tête plutôt qu'en balise) | NON APPLICABLE — pas d'hébergement ; à poser le jour venu |
| Analyse du contenu des photographies (visages, plaques, écrans) | NON TESTÉ — aucune photographie fournie |
| Suppression des métadonnées des photographies | **non fait** : les images sont copiées telles quelles. En revanche, une photographie publique qui porte une **position GPS** dans ses métadonnées (JPEG, PNG, WebP) fait échouer la construction publique ; la version personnelle le signale. Les autres métadonnées (appareil, date, auteur) ne sont pas examinées |
