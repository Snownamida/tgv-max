import { addDays, iso, nextSaturday } from "@/lib/dates";
import type { Train } from "./models";
import { hhmmToMinutes } from "./time";

/** Trains grouped by `"YYYY-MM-DD"`. */
export type TrainsByDate = Record<string, Train[]>;

/** One feasible same-day round trip. */
export interface DayTrip {
  date: string;
  outbound: Train;
  back: Train;
  /** Minutes spent at destination between arrival and return departure. */
  stayMinutes: number;
}

/** One weekend with MAX seats available in both directions. */
export interface WeekendTrip {
  /** The Saturday anchoring the weekend. */
  saturday: string;
  /** Candidate outbound dates (Friday and/or Saturday). */
  departDates: string[];
  /** Candidate return dates (Sunday and/or Monday). */
  returnDates: string[];
}

export function groupByDate(trains: Train[]): TrainsByDate {
  const map: TrainsByDate = {};
  for (const t of trains) (map[t.date] ??= []).push(t);
  return map;
}

const earliestArrival = (list: Train[]): Train =>
  list.reduce((a, b) => (hhmmToMinutes(b.arrival) < hhmmToMinutes(a.arrival) ? b : a));

const latestDeparture = (list: Train[]): Train =>
  list.reduce((a, b) => (hhmmToMinutes(b.departure) > hhmmToMinutes(a.departure) ? b : a));

/**
 * Same-day round trips: for each date present in both directions, pick the
 * earliest-arriving outbound and latest-departing return, keeping those that
 * leave at least `minStayMinutes` at destination. Inputs should already be
 * filtered by any time constraints.
 */
export function planDayTrips(
  outboundByDate: TrainsByDate,
  inboundByDate: TrainsByDate,
  minStayMinutes: number,
): DayTrip[] {
  const trips: DayTrip[] = [];
  for (const date of Object.keys(outboundByDate)) {
    const outs = outboundByDate[date];
    const ins = inboundByDate[date];
    if (!outs?.length || !ins?.length) continue;
    const outbound = earliestArrival(outs);
    const back = latestDeparture(ins);
    const stayMinutes = hhmmToMinutes(back.departure) - hhmmToMinutes(outbound.arrival);
    if (stayMinutes >= minStayMinutes) trips.push({ date, outbound, back, stayMinutes });
  }
  return trips.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Weekend getaways: leave Friday or Saturday, return Sunday or Monday, with a
 * MAX seat available in each direction. Scans the next `weeks` weekends.
 */
export function planWeekends(
  outboundByDate: TrainsByDate,
  inboundByDate: TrainsByDate,
  from: Date,
  weeks = 6,
): WeekendTrip[] {
  const combos: WeekendTrip[] = [];
  const fromIso = iso(from);
  let d = nextSaturday(from);
  for (let w = 0; w < weeks; w += 1, d = addDays(d, 7)) {
    const fri = iso(addDays(d, -1));
    const sat = iso(d);
    const sun = iso(addDays(d, 1));
    const mon = iso(addDays(d, 2));
    const departDates = [fri, sat].filter(
      (x) => (outboundByDate[x]?.length ?? 0) > 0 && x >= fromIso,
    );
    const returnDates = [sun, mon].filter((x) => (inboundByDate[x]?.length ?? 0) > 0);
    if (departDates.length && returnDates.length)
      combos.push({ saturday: sat, departDates, returnDates });
  }
  return combos;
}
