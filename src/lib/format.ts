/** Human-friendly formatting helpers. */

/** Annual ridership → abbreviated French form: `12,3 M` · `512 k` · `""` if unknown (0). */
export function formatRidership(n: number): string {
  if (!n) return "";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(".", ",")} M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)} k`;
  return String(n);
}
