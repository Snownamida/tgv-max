/** Core domain types shared across the app. */

/** A station/city as presented to the user (one entry per city name). */
export interface Station {
  /** Raw SNCF name, e.g. `"PARIS (intramuros)"` — used to query the API. */
  name: string;
  lat: number;
  lon: number;
  /** ISO country code prefix, e.g. `"FR"`, `"DE"`. */
  country: string;
  /** tgvmax occurrence count — used to rank the picker. */
  traffic: number;
  /** Annual ridership (passengers/year); `0` when unknown (e.g. foreign stations). */
  ridership: number;
  /** Normalized search key (accent/paren-insensitive, uppercase). */
  searchKey: string;
}

/** A single scheduled train on a given date and O/D. */
export interface Train {
  /** `"YYYY-MM-DD"`. */
  date: string;
  trainNo: string;
  /** `"HH:MM"`. */
  departure: string;
  /** `"HH:MM"`. */
  arrival: string;
  /** Network axis label, e.g. `"SUD EST"`, `"ATLANTIQUE"`. */
  axis: string;
  origin: string;
  destination: string;
  /** Whether a free MAX seat is available on this train (`od_happy_card === "OUI"`). */
  hasMaxSeat: boolean;
}

/** Map of `"YYYY-MM-DD"` → number of MAX trains that day. */
export type DailyCounts = Record<string, number>;

/** Aggregated availability toward one destination on a specific date. */
export interface DestinationAvailability {
  destination: string;
  trains: number;
  firstDeparture: string;
  fastestMinutes: number;
  list: Train[];
}

/** Aggregated availability toward one destination over the whole window. */
export interface RangeDestination {
  destination: string;
  trains: number;
  days: number;
}
