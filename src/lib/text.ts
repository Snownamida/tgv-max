/** Text helpers for station names. */

/**
 * Normalize a station name for accent-insensitive search / lookup:
 * strip diacritics and parentheses, uppercase, collapse whitespace.
 * e.g. `"BESANÇON VIOTTE"` → `"BESANCON VIOTTE"`, `"PARIS (intramuros)"` → `"PARIS INTRAMUROS"`.
 */
export function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[()]/g, " ")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Prettify a raw SNCF name: `"PARIS (intramuros)"` → `"Paris centre-ville"`. */
export function prettyStation(name: string): string {
  let s = name.replace(/\(intramuros\)/i, "centre-ville");
  s = s.toLowerCase().replace(/\b([a-zà-ÿ])/g, (m) => m.toUpperCase());
  return s
    .replace(/\bTgv\b/gi, "TGV")
    .replace(/\b(Sbb|Hb|Hbf)\b/gi, (m) => (m.toLowerCase() === "hbf" ? "Hbf" : m.toUpperCase()));
}
