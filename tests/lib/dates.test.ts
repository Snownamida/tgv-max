import { describe, expect, it } from "vitest";
import { addDays, dateOnly, frDate, iso, isWeekend, nextSaturday, parseISO } from "@/lib/dates";

describe("dates", () => {
  it("formats and parses ISO dates in local time", () => {
    expect(iso(new Date(2026, 6, 4))).toBe("2026-07-04");
    const d = parseISO("2026-07-04T00:00:00+00:00");
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 6, 4]);
    expect(dateOnly("2026-07-04T09:12:00Z")).toBe("2026-07-04");
  });

  it("adds days across month boundaries", () => {
    expect(iso(addDays(new Date(2026, 6, 30), 3))).toBe("2026-08-02");
    expect(iso(addDays(new Date(2026, 6, 4), -1))).toBe("2026-07-03");
  });

  it("renders French short dates", () => {
    expect(frDate("2026-07-04")).toBe("sam. 4 juil.");
  });

  it("finds the upcoming Saturday", () => {
    expect(iso(nextSaturday(new Date(2026, 6, 1)))).toBe("2026-07-04"); // Wed → Sat
    expect(iso(nextSaturday(new Date(2026, 6, 4)))).toBe("2026-07-04"); // Sat → same day
  });

  it("detects weekends", () => {
    expect(isWeekend("2026-07-04")).toBe(true); // Saturday
    expect(isWeekend("2026-07-05")).toBe(true); // Sunday
    expect(isWeekend("2026-07-06")).toBe(false); // Monday
  });
});
