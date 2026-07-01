import { describe, expect, it } from "vitest";
import { aggregateByDestination, heatLevel } from "@/domain/availability";
import type { Train } from "@/domain/models";

const t = (destination: string, departure: string, arrival: string): Train => ({
  date: "2026-07-04",
  trainNo: "1",
  departure,
  arrival,
  axis: "SUD EST",
  origin: "PARIS (intramuros)",
  destination,
  hasMaxSeat: true,
});

describe("heatLevel", () => {
  it("buckets counts into 0..4", () => {
    expect(heatLevel(0)).toBe(0);
    expect(heatLevel(1)).toBe(1);
    expect(heatLevel(2)).toBe(1);
    expect(heatLevel(3)).toBe(2);
    expect(heatLevel(5)).toBe(2);
    expect(heatLevel(6)).toBe(3);
    expect(heatLevel(9)).toBe(3);
    expect(heatLevel(10)).toBe(4);
    expect(heatLevel(99)).toBe(4);
  });
});

describe("aggregateByDestination", () => {
  it("aggregates count, earliest departure and fastest trip, sorted by count", () => {
    const result = aggregateByDestination([
      t("LYON", "09:00", "11:00"),
      t("LYON", "07:00", "09:30"),
      t("DIJON", "08:00", "09:35"),
    ]);
    expect(result.map((r) => r.destination)).toEqual(["LYON", "DIJON"]); // 2 trains vs 1
    const lyon = result[0];
    expect(lyon.trains).toBe(2);
    expect(lyon.firstDeparture).toBe("07:00");
    expect(lyon.fastestMinutes).toBe(120); // 09:00 → 11:00
    expect(lyon.list).toHaveLength(2);
  });

  it("returns an empty array for no trains", () => {
    expect(aggregateByDestination([])).toEqual([]);
  });
});
