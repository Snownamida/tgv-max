import * as L from "leaflet";
import { loadRailNetwork, type SpeedLevel } from "@/data/railNetwork";

/** Colour / weight / opacity per speed bucket (LGV stands out in rose). */
const COLOR: Record<SpeedLevel, string> = {
  3: "#e5007d",
  2: "#ff8a3d",
  1: "#2f6db0",
  0: "#9aa7bd",
};
const WEIGHT: Record<SpeedLevel, number> = { 3: 2.6, 2: 2, 1: 1.3, 0: 0.7 };
const OPACITY: Record<SpeedLevel, number> = { 3: 0.95, 2: 0.9, 1: 0.7, 0: 0.5 };

const LEGEND: [SpeedLevel, string][] = [
  [3, "LGV (≥ 250 km/h)"],
  [2, "Ligne rapide (200–249)"],
  [1, "Ligne classique (120–199)"],
  [0, "Ligne locale (< 120)"],
];

type RailProps = { v: SpeedLevel };

/** Build a Leaflet vector layer of the real rail network, coloured by speed. */
export async function createRailLayer(): Promise<L.GeoJSON> {
  const data = await loadRailNetwork();
  return L.geoJSON(data as unknown as GeoJSON.FeatureCollection, {
    interactive: false,
    style: (feature?: GeoJSON.Feature<GeoJSON.Geometry, RailProps>): L.PathOptions => {
      const v = feature?.properties?.v ?? 0;
      return { color: COLOR[v], weight: WEIGHT[v], opacity: OPACITY[v] };
    },
  });
}

/** HTML for the speed legend (rendered inside a Leaflet control). */
export function legendHtml(): string {
  return (
    `<div class="rail-legend"><b>Réseau ferré</b>` +
    LEGEND.map(([v, label]) => `<span><i style="background:${COLOR[v]}"></i>${label}</span>`).join(
      "",
    ) +
    `</div>`
  );
}
