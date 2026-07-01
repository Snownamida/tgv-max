import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import { createRailLayer, legendHtml } from "./railLayer";

const OSM_TILES = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const ORM_TILES = "https://{s}.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png";

/** Rose SNCF, used to highlight a selected route. */
export const ACCENT = "#e5007d";

export interface MapHandle {
  map: L.Map;
  /** Layer for O/D route highlights. */
  routes: L.LayerGroup;
  /** Layer for station markers. */
  markers: L.LayerGroup;
}

export interface MapOptions {
  center?: [number, number];
  zoom?: number;
}

/**
 * Create a Leaflet map with an OSM base, the SNCF speed-coloured rail network
 * (default on), an optional OpenRailwayMap overlay, and a legend.
 */
export function createMap(node: HTMLElement, opts: MapOptions = {}): MapHandle {
  const map = L.map(node, { scrollWheelZoom: true, preferCanvas: true }).setView(
    opts.center ?? [46.6, 2.4],
    opts.zoom ?? 6,
  );
  L.tileLayer(OSM_TILES, { maxZoom: 18, attribution: "© OpenStreetMap" }).addTo(map);

  const railGroup = L.layerGroup().addTo(map);
  void createRailLayer().then((layer) => layer.addTo(railGroup));

  const orm = L.tileLayer(ORM_TILES, {
    maxZoom: 19,
    opacity: 0.85,
    attribution:
      'Voies © <a href="https://www.openrailwaymap.org/" target="_blank" rel="noopener">OpenRailwayMap</a>',
  });

  L.control
    .layers(
      undefined,
      { "Réseau ferré SNCF (vitesse)": railGroup, "Voies OpenRailwayMap": orm },
      { collapsed: true, position: "topright" },
    )
    .addTo(map);

  const legend = new L.Control({ position: "bottomleft" });
  legend.onAdd = () => {
    const div = L.DomUtil.create("div");
    div.innerHTML = legendHtml();
    return div;
  };
  legend.addTo(map);

  const routes = L.layerGroup().addTo(map);
  const markers = L.layerGroup().addTo(map);
  return { map, routes, markers };
}

export const originIcon = (): L.DivIcon =>
  L.divIcon({
    className: "map-pin",
    html: '<div class="opin">🚉</div>',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });

export const destIcon = (): L.DivIcon =>
  L.divIcon({
    className: "map-pin",
    html: '<div class="opin dpin">📍</div>',
    iconSize: [26, 30],
    iconAnchor: [13, 28],
  });
