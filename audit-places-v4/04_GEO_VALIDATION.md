# 04 — Contrôle géographique

## Contrôles

Faits pour chaque candidat par `scripts/places/enrich.mjs`, puis revérifiés sur le catalogue final par
`scripts/places/validate.mjs` (bloquant pour les nouvelles fiches, signalement pour les fiches d'origine) :

| Contrôle | Méthode |
|---|---|
| Valeurs | latitude ∈ [-90, 90], longitude ∈ [-180, 180], pas (0, 0), dans le cadre Europe (34–72° N, 25° O–45° E) |
| Inversion | le point (lat, lon) inversé tombe dans le pays annoncé alors que le point donné n'y est pas |
| Pays annoncé | point dans le contour du pays (contours de la carte, `DATA.pays`) ; Åland rattachée à la Finlande ; tolérance côtière et frontalière : dans un autre pays à plus de 2 km → rejet ; à plus de 12 km du pays sans localité GeoNames du pays à moins de 15 km → rejet (« en mer ») ; entre 3 et 12 km → signalement (côte, île) |
| Distance à la localité de référence | le curateur déclare la localité de plus de 2 000 habitants la plus proche (`near`) et la distance (`nearKm`) ; le pipeline mesure la distance réelle au point GeoNames de cette localité. Écart toléré : max(5 km, 50 % de la distance annoncée) |
| Homonymes | si le nom déclaré ne correspond qu'à un homonyme à plus de 100 km alors qu'une localité du pays est tout près (« Irakleio » d'Attique pour Héraklion de Crète), contrôle par la localité la plus proche |
| Localité absente du gazetier | contrôle de repli : localité du pays la plus proche à moins de 40 km (90 km si le point est franchement dans le pays : Laponie, nord de Gotland) — statut « partiel » |
| Ville ou village reconnu | s'il figure dans GeoNames sous le même nom à moins de 6 km, ses coordonnées deviennent celles de GeoNames (lien `source`) |
| Monument / centre de ville | les coordonnées sont des **coordonnées de repérage**, pas une entrée ni un parking : la mention est affichée sur chaque nouvelle fiche (`coordinateNote`) |

## Résultats sur les 1 800 nouvelles fiches

| Mesure | Valeur |
|---|---|
| Position vérifiée par la localité déclarée | **1 771** |
| Position contrôlée par la localité la plus proche (« partiel ») | 29 (liste ci-dessous) |
| Écart entre distance mesurée et distance annoncée | médiane 0,3 km · 90 % ≤ 0,8 km · 99 % ≤ 2,4 km · maximum 5,4 km |
| Coordonnées remplacées par GeoNames (villes, villages) | 693 (lien `source` GeoNames) |
| Liens `source` UNESCO | 29 (point de la liste UNESCO à moins de 4 km) |
| QID Wikidata (Natural Earth) | 148 |
| Hors des contours simplifiés de la carte, mais sur la côte ou une île (3–12 km) | 4, signalés et gardés |
| Points hors pays, inversés, en mer, à (0, 0) | **0** (`validate.mjs` : PASS) |

**Coordonnées fausses interceptées et rejetées** (erreurs réelles des curateurs) :

| Candidat | Mesure | Interprétation |
|---|---|---|
| Dunes de Corrubedo (Espagne) | à 53,5 km de Ribeira, annoncé 5 km | point hors de la presqu'île |
| Nuraghe Arrubiu (Italie) | à 11,1 km d'Orroli, annoncé 3 km | latitude décalée de 0,1° |
| Neuvième Fort (Lituanie) | à 0,6 km du centre de Kaunas, annoncé 6 km | point au centre-ville |
| Kukkolaforsen (Suède) | 2 km en Finlande | rapides frontaliers : point du mauvais côté |
| Hemavan (Suède) | aucune localité suédoise à moins de 90 km | non vérifiable : écarté |

**Faux positifs corrigés dans l'outil** (et non dans les données) : Héraklion (le gazetier ne connaît qu'un
« Irakleio » en Attique), Ithaque (« Vathý » renvoyait à Samos), Usedom (« Heringsdorf » renvoyait à un homonyme du
Holstein) étaient bien placés — à 1,5 km, 0,2 km et 1,9 km de la localité GeoNames la plus proche. La règle des
homonymes lointains a été ajoutée ; Fårö (nord de Gotland, localité la plus proche à 60 km) est accepté par la
tolérance des zones peu peuplées. Héraklion, Ithaque et Usedom sont désormais acceptés par les contrôles et classés « réserve » (cible de leur pays
atteinte par de meilleurs candidats).

**Positions « partielles »** (la localité déclarée n'est pas dans le gazetier ; la localité la plus proche confirme
la zone) : Meissen, Wittenberg, Externsteine, vallée du Madriu-Perafita-Claror, Lech am Arlberg, mémorial de
Mauthausen, Orbaneja del Castillo, Minas de Riotinto, Nauvo, Nez de Jobourg, Domfront, enclos de Saint-Thégonnec,
Thassos, grotte de Melissani, temple d'Aphaïa (Égine), Véria, Tre Cime di Lavaredo, Rossano, grottes de Castellana,
Fiesole, Štip, route du Sognefjell, stavkirke de Lom, château de Santa Maria da Feira, sanctuaire de la Peneda,
Viminacium, château de Strečno, Fårö, Soglio. À vérifier en priorité lors d'une future passe Wikidata.

## Ce que ces contrôles ne garantissent pas

La distance à une localité ne détecte pas une erreur de quelques kilomètres dans la bonne direction : pour un site
naturel étendu (parc, lac, massif), le point est un repère représentatif (le curateur l'a décrit dans `pt`, gardé
dans `data-sources/candidates/v10/`). Les curateurs ont annoncé une confiance « haute » (≤ 1 km) ou « moyenne »
(≤ 5 km) ; aucune fiche « basse » n'a été proposée. Les fiches de confiance moyenne sont listées par pays dans leurs
fichiers de candidats (`conf`).

## Anomalies des fiches d'origine (non modifiées, signalées)

`validate.mjs` signale 15 fiches antérieures au lot dont le point n'est pas dans le pays annoncé. Elles n'ont pas été
corrigées, la consigne étant de ne pas toucher aux fiches existantes ; corrections proposées :

| Fiche | Constat | Correction proposée |
|---|---|---|
| 306 Chaussée des Géants (Irlande) | en Irlande du Nord | pays « Royaume-Uni » |
| 979 Colonies de l'Église morave (Danemark) | point en Irlande du Nord (bien UNESCO transnational) | point à Christiansfeld (Danemark) |
| 988 Patrimoine du mercure (Espagne) | point à Idrija (Slovénie), bien transnational | point à Almadén (Espagne) |
| 936 Chemin de fer rhétique (Italie) | point en Suisse | pays « Suisse » |
| 1514 Lac de Neusiedl (Hongrie) | point en Autriche | point côté hongrois (Fertőrákos) ou pays « Autriche » |
| 1419 Štrbački buk (Croatie) | sur la frontière, côté bosnien | pays « Bosnie » |
| 1559 Siklawica (Pologne) | point en Slovaquie (homonyme probable) | vérifier le lieu visé |
| 859, 887, 927, 1546 (Serbie) | au Kosovo | choix éditorial à trancher |
| 506 Gibraltar — carburant | Gibraltar n'a pas de contour sur la carte | sans effet |
| 762 Cabrera, 861 Skellig Michael, 910 Saint-Kilda | îles au large, hors contours simplifiés | sans effet |
