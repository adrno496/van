# 08 — Sécurité et confidentialité

## Méthode

| Moyen | Ce qu'il couvre | Limite |
|---|---|---|
| SENTINEL `audit local` (gitleaks, syft, grype, vibe-qualify, code-graph, RECURSIVE) | secrets, dépendances, stockage, structure | pas de règle d'injection HTML côté navigateur ; aveugle au JavaScript enfoui dans une page |
| semgrep (chaîne d'outils SENTINEL), règles locales | inventaire des écritures HTML, dialogues, `window.open` | inventaire, pas de preuve d'exploitabilité |
| Relecture intégrale du code (135 Ko avant, 162 Ko après) | provenance de chaque valeur insérée | humaine |
| Revue AST (`scripts/html-sinks.mjs`, analyseur TypeScript) | les 388 valeurs insérées dans du HTML | classe « à relire » ce qu'elle ne sait pas prouver |
| Tests d'attaque exécutés dans le navigateur (`tests/e2e.mjs`, groupe sécurité) | fichiers piégés, saisie piégée, CSP, requêtes tierces | 3 scénarios ; ne remplace pas un test d'intrusion |

## Défauts trouvés sur la baseline

| # | Défaut | Gravité | Preuve | Statut après |
|---|---|---|---|---|
| S1 | **Injection de script par un fichier de parcours.** L'import `.json` reprenait tous les champs sans contrôle ; `entree_eur`, `saison`, `duree`, `pays`, `categorie`, `mon_budget` arrivaient dans `innerHTML` sans échappement (infobulle, fiche, liste d'étapes, recherche). Un fichier reçu d'un tiers suffit. | Élevée | test « import de parcours piégé » : 2 scripts exécutés | **Corrigé** — 0 |
| S2 | **Injection de script par une sauvegarde « trajets et fiches ».** Le fichier était recopié tel quel dans `localStorage` puis relu à chaque démarrage : l'injection devenait permanente. | Élevée | test « sauvegarde v3 piégée » : 7 scripts exécutés | **Corrigé** — 0, y compris avec une sauvegarde aux types valides |
| S3 | **Injection par saisie.** Un texte saisi dans une fiche (nom d'une base, saison, durée) était réaffiché sans échappement. | Moyenne (auto-infligée, mais persistante) | test « saisie piégée » : 3 scripts exécutés | **Corrigé** — 0 |
| S4 | **Application bloquée par un stockage corrompu.** Une valeur de mauvais type dans `atlasvan.v3` arrêtait le script au chargement ; aucun moyen de s'en sortir depuis l'interface. | Élevée (perte d'accès aux données) | test « stockage corrompu » | **Corrigé** — démarrage, original conservé |
| S5 | **Perte silencieuse.** Si l'enregistrement échoue (quota), aucun message visible. | Élevée (perte de données) | test « quota atteint » | **Corrigé** — message d'erreur |
| S6 | Aucune politique de sécurité du contenu. | Moyenne | test CSP | **Corrigé** |
| S7 | Appel à Google Fonts à chaque ouverture : l'adresse IP et l'heure d'usage partent chez un tiers ; l'application annonce pourtant fonctionner hors connexion. | Moyenne (confidentialité) | 103 requêtes tierces relevées par Creative Engine | **Corrigé** — 0 requête |
| S8 | Sauvegarde v3 restaurée sans aucune validation ; import de parcours sans limite de taille. | Moyenne | lecture du code | **Corrigé** |
| S9 | Suppression d'un lieu personnel sans confirmation. | Faible | lecture du code | **Corrigé** |
| S10 | Jusqu'à 6 `window.open` en rafale. | Faible | semgrep | **Corrigé** — liens |
| S11 | Certains liens sortants sans `noreferrer`. | Faible | lecture du code | **Corrigé** — `rel="noopener noreferrer"` partout, `<meta name="referrer" content="no-referrer">` |

## Corrections en profondeur

1. **Contrôle à l'entrée** (`src/js/state.js`, `readTravelState`). Tout état venu du navigateur ou d'un fichier est
   reconstruit champ par champ : identifiants (`c` + chiffres), coordonnées finies et bornées, catégories connues,
   importance 1–3, tarifs positifs, textes de type chaîne et tronqués, dates au format `AAAA-MM-JJ`, étapes
   existantes. Import : refus en bloc à la première anomalie, rien n'est modifié. Démarrage : ce qui est illisible
   est écarté, l'original est conservé et téléchargeable (Plus › Mes données).
2. **Échappement à la sortie.** Une seule fonction (`esc`) ; tout texte inséré dans du HTML y passe, qu'il vienne du
   catalogue, d'une saisie ou d'un fichier.
3. **Politique de sécurité du contenu**, dans le fichier, calculée à la construction :

   ```text
   default-src 'none'; script-src 'sha256-…' 'sha256-…'; style-src 'sha256-…';
   img-src data: blob:; connect-src 'none'; font-src 'none'; object-src 'none';
   base-uri 'none'; form-action 'none'
   ```

   Seuls les deux scripts et la feuille de style du fichier s'exécutent. Un gestionnaire injecté
   (`onerror=…`) est refusé par le navigateur même si un échappement était oublié. Aucune requête réseau n'est
   possible depuis la page. Vérifiée sans violation dans Chromium, Firefox et WebKit, par serveur et en fichier local.
4. **Plus aucun style en ligne** dans le HTML de l'application (condition pour une politique sans `unsafe-inline`).
5. **Blog exporté** : il porte sa propre politique (`default-src 'none'; img-src data:; style-src 'unsafe-inline'`)
   et ne contient aucun script (testé).
6. **Limites de taille** : parcours 5 Mo et 2 000 étapes ; sauvegarde 100 Mo ; 1 000 articles, 12 photos par
   article, 8 Mo par photo (inchangé).

## Revue des écritures HTML

`node audit-refonte/scripts/html-sinks.mjs` — 97 expressions HTML, 388 valeurs insérées :

| Classement | Nombre |
|---|---:|
| passent par `esc()` | 182 |
| produites par un constructeur qui échappe (`extLink`, `ic`, `postCard`…) | 67 |
| numériques | 20 |
| choix entre chaînes fixes | 35 |
| **à relire à la main** | 58 |

Les 58 ont été relues une à une (`evidence/html-sinks.json`) : compteurs et indices (`all.length`, `i`, `k`),
valeurs de tables constantes (`WN[w]`, `PTN[p.t]`, `RN[L.r]`, `MFULL[…]`), libellés fixes passés par le
développeur (`ic(name)`, `field(id, label, …)`), HTML déjà construit avec `esc` (`h`, `content`, `label`),
coordonnées numériques contrôlées. **Aucune n'insère un texte libre non échappé.** Cette conclusion repose sur
ma relecture, pas sur un outil.

## Stockage

| Risque examiné | Constat | Statut |
|---|---|---|
| Compatibilité des anciens formats | relus à l'identique ; ancien enregistrement unique du carnet encore accepté | PASS (test de migration) |
| Corruption | démarrage garanti, original conservé | PASS (testé) |
| Quota atteint | message, puis invitation à sauvegarder dans un fichier | PASS (échec simulé) |
| Import invalide | refusé avant toute écriture | PASS (testé) |
| Restauration partielle | carnet et trajets restaurés ensemble ou pas du tout (retour à l'état précédent si l'un échoue) | PARTIAL — logique conservée de la baseline, échec en cours de route non simulé |
| Fichier trop gros | refusé au-delà des limites | PARTIAL — limite codée, non testée avec un vrai fichier de 100 Mo |
| Modification perdue à la fermeture | enregistrement à la fermeture de la page | PARTIAL — codé, non testé isolément |
| Mode privé | messages prévus | NON TESTÉ |
| Pollution de prototype | les états importés sont reconstruits avec des clés connues ; aucune fusion d'objet arbitraire | PASS (lecture du code) |

## Confidentialité

| Question | Réponse | Preuve |
|---|---|---|
| Qu'est-ce qui reste sur l'appareil ? | tout : trajets, notes, lieux, carnet, photos | 0 requête au chargement et à l'usage (test, CSP `connect-src 'none'`) |
| Qu'est-ce qui en sort ? | uniquement ce que contient un lien quand on le touche (nom ou coordonnées du lieu vers Google Maps, Google, Wikipédia) et les fichiers qu'on exporte soi-même | lecture du code |
| La position ? | demandée seulement sur action ; gardée en mémoire ; jamais écrite | test : absente de `localStorage` |
| L'utilisateur le sait-il ? | rubrique Plus › « Ce qui reste sur cet appareil, ce qui en sort » ; texte dans les paramètres de localisation et dans « Près de moi » | interface |
| Mesure d'audience, publicité, compte | aucun | — |

## Risques restants

| Risque | Gravité | Commentaire |
|---|---|---|
| Données non chiffrées dans le navigateur | Moyenne | relevé par SENTINEL (9 constats). Quiconque accède au profil du navigateur lit notes et carnet. Le floutage n'est pas une protection. Chiffrement par phrase secrète : proposé en P3. |
| Lieux personnels dans le catalogue | Moyenne | 5 « bases » décrites en termes familiaux sont dans le fichier. Ne pas héberger le fichier publiquement sans les retirer, ou ajouter `noindex`. |
| Le fichier de sauvegarde n'est pas chiffré | Faible | il contient tout, photos comprises ; à ranger comme un document personnel. |
| Liens Google | Faible | ouvrir un lien révèle à Google le lieu consulté. Par conception ; indiqué dans l'interface. |
| Très ancien navigateur | Faible | sans `<dialog>`, les fenêtres ne s'ouvrent pas ; un message le dit. |

Aucun secret n'est présent dans le projet ni dans ces rapports (gitleaks : 0 ; analyse des artefacts d'audit par
SENTINEL : PASS).
