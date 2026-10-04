# 03 — Système de design

## Principe

Un seul jeu de jetons pour les deux expériences. `src/css/tokens.css` (64 jetons, créé au cycle 1) reste la source
des couleurs, des polices, des rayons et des espacements ; le site y ajoute ce qu'une lecture demande
(`src/site/css/site.css`), et une direction visuelle ajuste quelques valeurs (`direction-a.css`).

```text
assets/site.css = tokens.css (partagé avec le Planner) + site.css (socle du site) + direction-<a|b|c>.css
```

## Identité

| Élément | Choix | Raison |
|---|---|---|
| Nom | **Atlas Van** | inchangé |
| Logo | typographique : « Atlas » en serif, « Van » en italique terre cuite | le même geste que dans le Planner ; aucun pictogramme inventé |
| Descripteur | « Atlas de l'Europe en van » | factuel. Les deux propositions du cahier des charges (« Carnets de route & voyages en van », « Voyager. Explorer. Raconter. ») promettent des récits qui n'existent pas encore : à reprendre quand le carnet sera publié. Modifiable dans `content/site.json` |
| Signature visuelle | la carte de l'Atlas elle-même : chaque lieu est un point | elle n'appartient qu'à ce projet et tient lieu de photographie tant qu'il n'y en a pas |

Aucune histoire de marque n'a été inventée.

## Palette

| Rôle | Jeton | Valeur | Usage |
|---|---|---|---|
| Papier | `--bg` / `--paper` | `#f1ede5` | fond des pages |
| Ivoire | `--surface` | `#fbf9f5` | surfaces, champs |
| Sable | `--sand` | `#e6dcc6` | aplats clairs |
| Terre cuite | `--accent` | `#8b4618` | action principale, liens |
| Vert forêt | `--forest` | `#1f3329` (première page : `#1a2c23`) | bandeaux, première page |
| Encre | `--text` | `#1b1913` | texte |
| Gris minéral | `--text-2`, `--border-strong` | `#514a41`, `#958978` | texte secondaire, filets |
| Bleu froid | `--focus` | `#1d5f8a` | uniquement l'anneau de focus |

Contrastes calculés par `contrastRatio` de Creative Engine sur les couleurs **réellement rendues** (lues dans le
navigateur) : 26 couples sur 26 conformes, plus faible contraste de texte 6,02 (`evidence/variant-metrics.json`).
Aucune couleur n'a été reprise de la référence d'ambiance, qui est sombre et orangée.

## Typographie

| Usage | Pile | Remarque |
|---|---|---|
| Titres | Iowan Old Style, Palatino, Georgia (serif) | polices du système |
| Texte et interface | system-ui | idem |
| Récits | serif, 18 à 20 px, interligne 1,75, 68 caractères par ligne au plus | confort de lecture |

**Aucune police externe.** Google Fonts a été retiré au cycle 1 pour la confidentialité et la vitesse ; rien n'est
réintroduit. Conséquence assumée : le serif varie d'un système à l'autre (Iowan sur Apple, Palatino ou Georgia
ailleurs).

Échelle : titre de première page de 44 à 100 px (fluide), titres de page de 30 à 52 px, chapeau de 18 à 22 px,
texte 17 px, mentions 14 px. Treize tailles au total sur l'accueil, contre 5 dans le Planner : un site de lecture
hiérarchise davantage.

## Composants

| Composant | Rôle | États prévus |
|---|---|---|
| En-tête, menu plein écran | navigation, accès permanent au Planner | courant, survol, focus, ouvert / fermé |
| Première page (`hero`) | image + une phrase + deux actions | grand écran : carte à droite ; téléphone : carte en haut, texte dessous |
| Carte illustrée (`plate`) | tient la place d'une image | pays, itinéraire, Europe entière ; remplacée par une photo si `cover` est fourni |
| Carte de contenu (`card`) | pays, itinéraire, voyage, récit | grande ou standard ; étiquettes « Raconté », « Privé », « Brouillon », « DÉMO » |
| Faits (`facts`) | chiffres d'une page de détail | chaque fait peut porter sa méthode en petit |
| Étapes (`stops`) | liste de lieux, numérotée ou non | le nom est le lien vers le Planner |
| Bandeau (`band`) | appel vers le Planner, chiffre de l'Atlas | une action |
| Mise en garde (`caveat`) | « notes non sourcées » | — |
| État vide, « à compléter » | absence de contenu dite clairement | le second n'existe qu'en version personnelle |
| Lecture (`prose`), galerie, navigation entre récits | articles | — |
| Tableau défilant | règles par pays | défilement horizontal au clavier |
| Recherche | champ + résultats | aucun résultat, trop de résultats |

Boutons et cibles : 44 px au minimum (48 px au toucher). Rayons : 12 px pour les images, pilule pour les boutons.

## Photographie

Aucune photographie n'a été téléchargée ni générée. Les visuels sont des **cartes dessinées à partir des données**
(contours simplifiés, lieux, tracés), produites à la construction, sans requête. L'emplacement d'image de chaque
voyage, récit ou guide accepte une photographie du propriétaire (`content/media/`) : dimensions réservées, texte
alternatif fourni par lui, chargement différé hors première image.

## Mouvement

| Effet | Détail |
|---|---|
| Apparition au défilement | glissement de 16 px, sans fondu (un texte à demi transparent n'est pas lisible — relevé par axe-core et corrigé) |
| Survol d'une carte | agrandissement de 3,5 % de l'image |
| Boutons, liens | flèche qui avance de 3 px |
| Menu | ouverture native, sans animation |

Tout est désactivé avec `prefers-reduced-motion` ; sans JavaScript, rien n'est masqué.

## Ce qui a été évité

Néon, verre dépoli, dégradés décoratifs (les deux dégradés présents sont des voiles de lisibilité sur la première
page), ombres portées, grilles de petites cartes identiques, carrousel, vidéo, compteurs animés.
