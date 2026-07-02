[Français](README.md) | **English** | [中文](README.zh-CN.md)

# 🚄 TGV MAX Planner

A website to **plan your trips with a TGV MAX subscription**, built on the
[SNCF open dataset "tgvmax"](https://ressources.data.sncf.com/explore/dataset/tgvmax/).

For every train over the next ~30 days, the raw dataset says whether a **MAX seat**
(a €0 ticket for MAX JEUNE / MAX SENIOR subscribers) is still available — but it is not
readable as-is. This site flips it around to the traveller's point of view, whose main
asset is **flexibility** (unlimited trips).

> ⏱️ The data is **not real-time**: SNCF exports the dataset **once a day** (early in the
> morning). A seat shown as "YES" may have been booked in the meantime; the app displays
> the timestamp of the latest export and links out to SNCF Connect to confirm.

## Features

| Tab                    | What it's for                                                                                                                                                                                                                     |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 📅 **Calendar**        | Heatmap of MAX seats over 30 days for an A → B route. Click a day → the trains.                                                                                                                                                    |
| 🧭 **Where to go?**    | Every destination with a MAX seat from a station, on a given date (today / tomorrow / weekend / 🎲). Shows the **footfall** of each station; sort by "busiest" or "most off-the-beaten-track".                                     |
| 🔀 **Connections**     | When the direct train is full: itineraries with **2 to 4 trains** (up to 3 connections), adjustable connection time, **night trains** 🌙 flagged (next-day arrival).                                                               |
| 🗺️ **Map**             | Destinations placed on the **real SNCF rail network coloured by speed**: **high-speed lines (LGV)** stand out in pink, classic lines in blue.                                                                                      |
| 🔁 **Round trip**      | Same-day round trips (min. time on site) or weekends, MAX seats in both directions, time filters, mini-map of the route.                                                                                                           |

Quick keyboard search: **⌘K / Ctrl+K** (departure station, then optional destination).

## Getting started

Requirements: **Node ≥ 20**. Then:

```bash
npm install
npm run dev        # dev server (Vite) at http://localhost:5173
npm run build      # typed production build -> dist/
npm run preview    # serves the production build
```

The SNCF API is CORS-open: the browser queries it directly, with no backend.

### Scripts

| Script                                      | Role                                          |
| ------------------------------------------- | --------------------------------------------- |
| `npm run dev` / `build` / `preview`         | Vite: dev, production build, preview          |
| `npm test` / `test:watch` / `test:coverage` | Vitest                                        |
| `npm run typecheck`                         | `tsc --noEmit` (strict)                       |
| `npm run lint` / `lint:fix`                 | ESLint (flat config + typescript-eslint)      |
| `npm run format` / `format:check`           | Prettier                                      |
| `npm run check`                             | typecheck + lint + test (what CI runs)        |
| `npm run data:stations` / `data:railnet`    | Regenerate the data (see below)               |

## Architecture

Strict TypeScript, **no framework**, structured in layers. The dependency rule points
**from the outside in**: `ui` → `services`/`data` → `domain`. The `domain` and `lib`
layers are pure (no DOM or network access), hence trivially testable; external
dependencies (`fetch`, data) are **injected** by the composition root.

```
src/
  main.ts                 composition root (wires the dependency graph)
  config.ts               constants (endpoints, links)
  app/
    App.ts                shell: layout, tab routing (hash), freshness banner
  domain/                 business core — PURE (types + rules, no DOM/fetch)
    models.ts             Station, Train, DestinationAvailability…
    time.ts               durations (handles crossing midnight)
    availability.ts       heatmap levels + aggregation by destination
    roundtrip.ts          same-day / weekend round-trip algorithms
  data/                   data access
    SncfApiClient.ts      typed OpenDataSoft client (injected fetch, pagination)
    query.ts              ODSQL clause building (pure)
    TgvmaxRepository.ts   business queries -> domain models
    StationRepository.ts  station catalogue (search, lookup)
    railNetwork.ts        loading the rail-network GeoJSON (lazy, cached)
  ui/                     presentation
    dom.ts                typed DOM helpers (el/clear/field/select)
    components/           StationPicker, trains, states, flags
    map/                  MapKit (Leaflet) + railLayer (colour by speed)
    views/                CalendarView, DestinationsView, MapView, RoundtripView
  lib/                    cross-cutting utilities (dates, format, text)
  assets/data/            stations.json (generated)
public/railnet.geojson    simplified rail network (generated)
tests/                    Vitest unit tests (mirror of src/)
data/                     Python data-generation scripts
```

### ADR — why no UI framework?

The value of this app is in its **business logic** (aggregations, date calculations,
round-trip combinations, API layer) — that's what benefits most from typing and tests,
and it's covered by pure functions. The views are few and mostly data-viz (including
Leaflet, imperative by nature). Rewriting everything in JSX would have added churn and a
heavy dependency with no proportional benefit. So we keep direct DOM rendering via a small
typed helper, with a clean boundary between logic (tested) and presentation. This choice
stays reversible: the `domain`/`data` layers do not depend on the UI.

## Tests

Unit tests targeting the pure logic and the data layer's contract:

```bash
npm test
```

- `domain/`: durations, heatmap levels, aggregation, round-trip algorithms (same-day & weekend).
- `lib/`: dates, format, text normalisation.
- `data/`: URL building + client pagination (with an injected fake `fetch`),
  ODSQL builders, station search.

## Regenerating the data

Two static datasets are precomputed by Python scripts (re-run them if SNCF updates its
data):

```bash
npm run data:stations   # -> src/assets/data/stations.json
npm run data:railnet    # -> public/railnet.geojson
```

## Sources & limits

- **tgvmax**: MAX seat availability, **updated daily**, rolling ~30-day window.
- **Stations**: coordinates + UIC via [trainline-eu/stations](https://github.com/trainline-eu/stations);
  **footfall** via [frequentation-gares](https://ressources.data.sncf.com/explore/dataset/frequentation-gares/) (UIC join).
- **Rail network & speeds**: [vitesse-maximale-nominale-sur-ligne](https://ressources.data.sncf.com/explore/dataset/vitesse-maximale-nominale-sur-ligne/)
  (Douglas-Peucker simplified geometry). Optional [OpenRailwayMap](https://www.openrailwaymap.org/) layer.
- **Unofficial** project, not affiliated with SNCF.
