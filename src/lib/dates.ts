/**
 * Date helpers working with local `Date` objects and ISO `"YYYY-MM-DD"` strings.
 * All pure; no timezone surprises (local midnight is used consistently).
 */
const MONTHS = [
  "janv.",
  "févr.",
  "mars",
  "avr.",
  "mai",
  "juin",
  "juil.",
  "août",
  "sept.",
  "oct.",
  "nov.",
  "déc.",
];
const DOWS = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];

const pad = (n: number): string => String(n).padStart(2, "0");

/** Local `Date` → `"YYYY-MM-DD"` (no UTC shift). */
export function iso(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Today at local midnight. */
export function today(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** `"YYYY-MM-DD"` (or full ISO datetime) → local `Date` at midnight. */
export function parseISO(s: string): Date {
  const [y, m, d] = s.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Keep only the `"YYYY-MM-DD"` part of an ISO datetime. */
export function dateOnly(s: string): string {
  return s.slice(0, 10);
}

/** `"sam. 12 juil."` */
export function frDate(s: string): string {
  const d = parseISO(s);
  return `${DOWS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** `"sam. 12 juil. 2026"` */
export function frDateLong(s: string): string {
  const d = parseISO(s);
  return `${DOWS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** An instant → date + time in Paris time, e.g. `"1 juil. à 06:24"`. */
export function frDateTime(isoInstant: string): string {
  try {
    const d = new Date(isoInstant);
    const day = d.toLocaleDateString("fr-FR", {
      timeZone: "Europe/Paris",
      day: "numeric",
      month: "short",
    });
    const hm = d.toLocaleTimeString("fr-FR", {
      timeZone: "Europe/Paris",
      hour: "2-digit",
      minute: "2-digit",
    });
    return `${day} à ${hm}`;
  } catch {
    return isoInstant.slice(0, 10);
  }
}

export function isWeekend(s: string): boolean {
  const g = parseISO(s).getDay();
  return g === 0 || g === 6;
}

/** The upcoming Saturday (today if today is Saturday). */
export function nextSaturday(from: Date = today()): Date {
  return addDays(from, (6 - from.getDay() + 7) % 7);
}

export { MONTHS, DOWS };
