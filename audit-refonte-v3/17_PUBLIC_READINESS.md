# 17 — Préparation à la publication

## Les deux versions

| | Personnelle (`dist/personal/`) | Publique (`dist/public/`) |
|---|---|---|
| Lieux | 1 600 | 1 595 |
| Contenu rédigé | tout, le privé étiqueté | seulement `public` + `published` |
| Emplacements « à compléter » | visibles | absents |
| Indexation | toutes les pages en `noindex` | pages publiques indexables |
| Planner | complet | complet, sans les cinq lieux personnels |
| Usage | chez soi, en fichier local ou sur un serveur privé | à héberger |

## Critères du cahier des charges

### READY_LOCAL

| Critère | État | Preuve |
|---|---|---|
| Planner complet | oui | 77 / 77 sur trois Planners ; 0 % de pixels différents avec le cycle 2 |
| Données compatibles | oui | migration 10 / 10 depuis trois versions ; aucun format modifié |
| Aucun P0 | oui | — |
| Anciens tests PASS | oui | 77, 59, 10, 6, 36 |
| Version personnelle fonctionnelle | oui | `dist/personal/` : site + Planner à 1 600 lieux |
| Retour en arrière | oui | `git checkout dd9ece5 -- .` ; `baseline/` |

### READY_PUBLIC

| Critère | État | Preuve ou manque |
|---|---|---|
| Version publique propre | **oui** | contrôle de confidentialité réussi ; `--check` OK |
| Aucune donnée privée | **oui**, pour ce qu'une machine sait reconnaître | 10 chaînes privées et 8 chaînes personnelles absentes de tous les fichiers ; 7 refus provoqués |
| Contenu public séparé explicitement | **oui** | `visibility` + `status`, privé par défaut |
| Navigation publique complète | **oui**, avec deux rubriques vides | Voyages et Carnet affichent un état vide honnête |
| Responsive | **PASS** | 10 largeurs × 8 pages ; 5 largeurs du moteur |
| Sécurité | **PASS** pour ce qui a été testé | `11` ; pas de test d'intrusion tiers |
| Accessibilité automatisée propre | **oui** | axe 0 violation, 121 scénarios sans échec |
| Lighthouse acceptable | **oui** | site : 100 / 100 / 100 / 91 ; Planner mobile : 91 |
| SEO fondamental | **PARTIAL** | titres, descriptions, h1, Open Graph : oui ; lien canonique, sitemap, `robots.txt` : **absents tant que l'adresse du site est inconnue** |
| Politique de sécurité | **oui** | stricte, 0 violation |
| Aucune erreur de console | **oui** | 0 |
| Tests du site PASS | **oui** | 34 / 34 |
| Aucun contenu fictif présenté comme réel | **oui** | itinéraires dits « propositions » ; aucun voyage, aucune photo, aucune biographie inventés ; démonstration refusée en version publique |

## Ce qui bloque la publication

Aucun de ces points n'est un défaut de code.

| # | Blocage | Qui peut le lever |
|---:|---|---|
| 1 | **Mentions de l'éditeur et de l'hébergeur absentes** : la page Mentions dit qu'elles ne sont pas renseignées | le propriétaire (`content/site.json`) |
| 2 | **Adresse du site inconnue** : ni lien canonique, ni sitemap, ni `robots.txt` | le propriétaire (`siteUrl`) |
| 3 | **Trois intitulés d'itinéraires** évoquent un projet personnel et une région de départ, et paraissent sur des pages publiques | le propriétaire |
| 4 | **Notes par pays non sourcées, non datées** (prix du gazole, péages, règles de nuit), publiées avec cette réserve | le propriétaire |
| 5 | **Aucun essai sur un vrai téléphone, aucun lecteur d'écran** | 20 minutes avec un appareil |
| 6 | **Le site promet un carnet et des voyages qu'il n'a pas** : deux rubriques vides, aucune photographie | le propriétaire (`CONTENT_NEEDED.md`) |

Le point 6 n'empêche pas techniquement la mise en ligne : les états vides sont honnêtes. Mais un site « éditorial »
sans récit ni photographie est un atlas avec un outil, pas encore un magazine.

## Le jour de la mise en ligne

```bash
# 1. Renseigner content/site.json : siteUrl, legal
# 2. Construire et vérifier
node build.mjs --mode public
node build.mjs --mode public --check
node tests/site.mjs && node tests/e2e.mjs --dir dist/public/app --catalogue public
# 3. Ne déposer chez l'hébergeur QUE le contenu de dist/public/
```

À faire côté hébergeur (non fait ici, pas d'hébergement) : servir compressé ; servir `404.html` pour les adresses
inconnues ; envoyer la politique de sécurité en en-tête HTTP en plus de la balise ; HTTPS ; ne pas publier le dépôt
lui-même.

**Attention au dépôt.** Le dépôt Git contient le catalogue personnel (`src/data/places.js`, `index.html`, les
baselines, les rapports). Publier le dépôt, ou héberger sa racine, publie la version personnelle — pas
`dist/public/`, qui n'est pas suivi par Git.

## Tableau de préparation

| Usage | Statut | Limite |
|---|---|---|
| Usage personnel local (Planner seul, ou site personnel) | PASS | appareil réel non testé |
| Usage hors ligne | PASS | — |
| Partage du Planner public en un fichier (`--mode public --out`) | PARTIAL | trois intitulés à valider |
| Hébergement du site public | PARTIAL | blocages 1 à 5 |
| Données personnelles | PASS pour les fichiers publics | relecture humaine nécessaire avant de marquer un contenu « public » |
| Indexation par les moteurs | PARTIAL | adresse du site inconnue |
