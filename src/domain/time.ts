/** Train-schedule time math (handles trips crossing midnight). */

export function hhmmToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

/** Minutes between two `"HH:MM"` times; adds 24h if the arrival is past midnight. */
export function durationMinutes(departure: string, arrival: string): number {
  let d = hhmmToMinutes(arrival) - hhmmToMinutes(departure);
  if (d < 0) d += 24 * 60;
  return d;
}

/** Minutes → `"3h20"` / `"2h00"`. */
export function formatDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h00`;
}
