import { RAILNET_URL } from "@/config";
import type { FetchFn } from "./SncfApiClient";

/** Speed bucket carried by each rail segment (see data/build_railnet.py). */
export type SpeedLevel = 0 | 1 | 2 | 3;

export interface RailFeature {
  type: "Feature";
  properties: { v: SpeedLevel };
  geometry: { type: "LineString"; coordinates: [number, number][] };
}

export interface RailFeatureCollection {
  type: "FeatureCollection";
  features: RailFeature[];
}

let cache: Promise<RailFeatureCollection> | null = null;

/** Load the simplified rail network GeoJSON once, then serve from cache. */
export function loadRailNetwork(
  fetchFn: FetchFn = (input, init) => fetch(input, init),
): Promise<RailFeatureCollection> {
  if (!cache) {
    cache = fetchFn(RAILNET_URL).then((res) => {
      if (!res.ok) throw new Error(`Rail network ${res.status}`);
      return res.json() as Promise<RailFeatureCollection>;
    });
  }
  return cache;
}
