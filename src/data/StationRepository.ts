import stationsData from "@/assets/data/stations.json";
import type { Station } from "@/domain/models";
import { normalize } from "@/lib/text";

/** Shape of an entry in `stations.json` (searchKey is derived at load time). */
export interface RawStation {
  name: string;
  lat: number;
  lon: number;
  country: string;
  traffic: number;
  ridership: number;
}

/**
 * In-memory station catalogue: lookup by name and accent-insensitive search.
 * Data is injectable so the search/lookup logic can be unit-tested with fixtures.
 */
export class StationRepository {
  private readonly stations: Station[];
  private readonly byKey = new Map<string, Station>();

  constructor(data: RawStation[] = stationsData as unknown as RawStation[]) {
    this.stations = data.map((s) => ({ ...s, searchKey: normalize(s.name) }));
    for (const s of this.stations) this.byKey.set(s.searchKey, s);
  }

  /** All stations, ordered by popularity (as generated). */
  all(): Station[] {
    return this.stations;
  }

  /** Exact lookup by raw or pretty name (normalized). */
  get(name: string): Station | undefined {
    return this.byKey.get(normalize(name));
  }

  /**
   * Search stations by substring (accent-insensitive). Prefix matches rank
   * before inner matches; results keep the popularity order within each group.
   */
  search(term: string, limit = 40): Station[] {
    const t = normalize(term);
    if (!t) return this.stations.slice(0, limit);
    const starts: Station[] = [];
    const contains: Station[] = [];
    for (const s of this.stations) {
      const i = s.searchKey.indexOf(t);
      if (i === 0) starts.push(s);
      else if (i > 0) contains.push(s);
    }
    return [...starts, ...contains].slice(0, limit);
  }
}
