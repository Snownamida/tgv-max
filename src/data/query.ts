/** Small, pure helpers to build ODSQL `where` clauses for the OpenDataSoft API. */

/** Quote a value as an ODSQL string literal. */
export const literal = (v: string): string => `"${v.replace(/"/g, '\\"')}"`;

export const filters = {
  from: (name: string): string => `origine=${literal(name)}`,
  to: (name: string): string => `destination=${literal(name)}`,
  /** A free MAX seat is available. */
  maxSeat: (): string => 'od_happy_card="OUI"',
  /** Exactly one day (equality on a date field 400s, so a range is used). */
  onDate: (d: string): string => `date>="${d}" AND date<="${d}"`,
  dateRange: (a: string, b: string): string => `date>="${a}" AND date<="${b}"`,
};

/** Join non-empty clauses with `AND`. */
export const and = (...parts: Array<string | false | undefined>): string =>
  parts.filter(Boolean).join(" AND ");
