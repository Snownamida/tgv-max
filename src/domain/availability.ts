import type { DestinationAvailability, Train } from "./models";
import { durationMinutes } from "./time";

/** Heatmap intensity bucket (0 = none … 4 = 10+ trains) for the calendar. */
export type HeatLevel = 0 | 1 | 2 | 3 | 4;

export function heatLevel(n: number): HeatLevel {
  if (n === 0) return 0;
  if (n <= 2) return 1;
  if (n <= 5) return 2;
  if (n <= 9) return 3;
  return 4;
}

/**
 * Aggregate a flat list of MAX trains (one date, one origin) by destination:
 * count, earliest departure, fastest trip. Sorted by number of trains desc.
 */
export function aggregateByDestination(trains: Train[]): DestinationAvailability[] {
  const byDest = new Map<string, DestinationAvailability>();
  for (const t of trains) {
    let d = byDest.get(t.destination);
    if (!d) {
      d = {
        destination: t.destination,
        trains: 0,
        firstDeparture: "99:99",
        fastestMinutes: Infinity,
        list: [],
      };
      byDest.set(t.destination, d);
    }
    d.trains += 1;
    if (t.departure < d.firstDeparture) d.firstDeparture = t.departure;
    d.fastestMinutes = Math.min(d.fastestMinutes, durationMinutes(t.departure, t.arrival));
    d.list.push(t);
  }
  return [...byDest.values()].sort((a, b) => b.trains - a.trains);
}
