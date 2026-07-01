# 🚄 TGV MAX Planner

Un site pour **planifier ses voyages avec un abonnement TGV MAX**, construit sur les
[données ouvertes SNCF « tgvmax »](https://ressources.data.sncf.com/explore/dataset/tgvmax/).

Le jeu de données brut liste, pour chaque train des ~30 prochains jours, s'il reste une
**place MAX** (billet à 0 € pour les abonnés MAX JEUNE / MAX SENIOR) — mais il n'est pas
lisible tel quel. Ce site le retourne du point de vue du voyageur, dont l'atout principal
est la **flexibilité** (voyages illimités).

> ⏱️ Les données ne sont **pas temps réel** : la SNCF exporte le jeu de données **une fois
> par jour** (tôt le matin). Une place affichée « OUI » a pu être réservée entre-temps ;
> l'app affiche l'horodatage du dernier export et renvoie vers SNCF Connect pour confirmer.

## Fonctionnalités

| Onglet              | À quoi ça sert                                                                                                                                                                                                         |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 📅 **Calendrier**   | Carte de chaleur des places MAX sur 30 jours pour un trajet A → B. Clic sur un jour → les trains.                                                                                                                      |
| 🧭 **Où partir ?**  | Toutes les destinations avec place MAX depuis une gare, à une date (aujourd'hui / demain / week-end / 🎲). Affiche la **fréquentation** de chaque gare ; tri « les plus fréquentées » ou « les plus confidentielles ». |
| 🗺️ **Carte**        | Destinations posées sur le **vrai réseau ferré SNCF coloré par vitesse** : les **LGV** ressortent en rose, les lignes classiques en bleu.                                                                              |
| 🔁 **Aller-retour** | Allers-retours dans la journée (temps min. sur place) ou week-ends, places MAX dans les deux sens, filtres horaires, mini-carte de l'axe.                                                                              |

## Démarrer

Pré-requis : **Node ≥ 20**. Puis :

```bash
npm install
npm run dev        # serveur de dev (Vite) sur http://localhost:5173
npm run build      # build de production typé -> dist/
npm run preview    # sert le build de production
```

L'API SNCF est ouverte en CORS : le navigateur l'interroge directement, sans backend.

### Scripts

| Script                                      | Rôle                                        |
| ------------------------------------------- | ------------------------------------------- |
| `npm run dev` / `build` / `preview`         | Vite : dev, build de prod, prévisualisation |
| `npm test` / `test:watch` / `test:coverage` | Vitest                                      |
| `npm run typecheck`                         | `tsc --noEmit` (strict)                     |
| `npm run lint` / `lint:fix`                 | ESLint (flat config + typescript-eslint)    |
| `npm run format` / `format:check`           | Prettier                                    |
| `npm run check`                             | typecheck + lint + test (ce que fait la CI) |
| `npm run data:stations` / `data:railnet`    | Régénère les données (voir plus bas)        |

## Architecture

TypeScript strict, **sans framework**, structuré en couches. La règle de dépendance va
**de l'extérieur vers l'intérieur** : `ui` → `services`/`data` → `domain`. Le `domain` et
les `lib` sont purs (aucun accès au DOM ni au réseau), donc trivialement testables ; les
dépendances externes (`fetch`, données) sont **injectées** par le point de composition.

```
src/
  main.ts                 point de composition (câble le graphe de dépendances)
  config.ts               constantes (endpoints, liens)
  app/
    App.ts                coquille : layout, routage par onglets (hash), bandeau fraîcheur
  domain/                 cœur métier — PUR (types + règles, sans DOM/fetch)
    models.ts             Station, Train, DestinationAvailability…
    time.ts               durées (gère le passage de minuit)
    availability.ts       niveaux de heatmap + agrégation par destination
    roundtrip.ts          algos aller-retour jour / week-end
  data/                   accès aux données
    SncfApiClient.ts      client typé OpenDataSoft (fetch injecté, pagination)
    query.ts              construction des clauses ODSQL (pur)
    TgvmaxRepository.ts   requêtes métier -> modèles du domaine
    StationRepository.ts  catalogue des gares (recherche, lookup)
    railNetwork.ts        chargement du GeoJSON réseau ferré (lazy, caché)
  ui/                     présentation
    dom.ts                helpers DOM typés (el/clear/field/select)
    components/           StationPicker, trains, états, drapeaux
    map/                  MapKit (Leaflet) + railLayer (couleur par vitesse)
    views/                CalendarView, DestinationsView, MapView, RoundtripView
  lib/                    utilitaires transverses (dates, format, texte)
  assets/data/            stations.json (généré)
public/railnet.geojson    réseau ferré simplifié (généré)
tests/                    tests unitaires Vitest (miroir de src/)
data/                     scripts Python de génération des données
```

### ADR — pourquoi pas de framework UI ?

La valeur de cette app est dans la **logique métier** (agrégations, calculs de dates,
combinaisons d'allers-retours, couche API) — c'est ce qui bénéficie le plus du typage et
des tests, et c'est couvert par des fonctions pures. Les vues sont peu nombreuses et
majoritairement de la data-viz (dont Leaflet, impératif par nature). Réécrire tout en
JSX aurait ajouté du churn et une dépendance lourde sans bénéfice proportionnel. On garde
donc un rendu DOM direct via un petit helper typé, avec une frontière nette entre logique
(testée) et présentation. Ce choix reste réversible : le `domain`/`data` ne dépend pas de l'UI.

## Tests

Tests unitaires ciblant la logique pure et le contrat de la couche data :

```bash
npm test
```

- `domain/` : durées, niveaux de heatmap, agrégation, algos aller-retour (jour & week-end).
- `lib/` : dates, format, normalisation de texte.
- `data/` : construction d'URL + pagination du client (avec un `fetch` factice injecté),
  builders ODSQL, recherche de gares.

## Régénérer les données

Deux jeux de données statiques sont pré-calculés par des scripts Python (à relancer si la
SNCF met à jour ses données) :

```bash
npm run data:stations   # -> src/assets/data/stations.json
npm run data:railnet    # -> public/railnet.geojson
```

## Sources & limites

- **tgvmax** : disponibilité des places MAX, **maj quotidienne**, fenêtre glissante ~30 j.
- **Gares** : coordonnées + UIC via [trainline-eu/stations](https://github.com/trainline-eu/stations) ;
  **fréquentation** via [frequentation-gares](https://ressources.data.sncf.com/explore/dataset/frequentation-gares/) (jointure UIC).
- **Réseau ferré & vitesses** : [vitesse-maximale-nominale-sur-ligne](https://ressources.data.sncf.com/explore/dataset/vitesse-maximale-nominale-sur-ligne/)
  (géométrie simplifiée Douglas-Peucker). Calque optionnel [OpenRailwayMap](https://www.openrailwaymap.org/).
- Projet **non officiel**, sans lien avec la SNCF.
