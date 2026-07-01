import { describe, expect, it } from "vitest";
import type { Train } from "@/domain/models";
import { groupByDate, planDayTrips, planWeekends } from "@/domain/roundtrip";

function train(
  date: string,
  departure: string,
  arrival: string,
  origin = "A",
  destination = "B",
): Train {
  return {
    date,
    trainNo: "1",
    departure,
    arrival,
    axis: "SUD EST",
    origin,
    destination,
    hasMaxSeat: true,
  };
}

describe("groupByDate", () => {
  it("buckets trains by their date", () => {
    const g = groupByDate([
      train("2026-07-01", "08:00", "10:00"),
      train("2026-07-01", "09:00", "11:00"),
      train("2026-07-02", "07:00", "09:00"),
    ]);
    expect(Object.keys(g).sort()).toEqual(["2026-07-01", "2026-07-02"]);
    expect(g["2026-07-01"]).toHaveLength(2);
  });
});

describe("planDayTrips", () => {
  it("keeps only days meeting the minimum stay, using earliest arrival + latest return", () => {
    const out = groupByDate([
      train("2026-07-01", "06:00", "09:00"),
      train("2026-07-01", "08:00", "11:00"),
    ]);
    const back = groupByDate([
      train("2026-07-01", "17:00", "20:00", "B", "A"),
      train("2026-07-01", "15:00", "18:00", "B", "A"),
    ]);
    const trips = planDayTrips(out, back, 4 * 60);
    expect(trips).toHaveLength(1);
    expect(trips[0].outbound.arrival).toBe("09:00"); // earliest arrival
    expect(trips[0].back.departure).toBe("17:00"); // latest departure
    expect(trips[0].stayMinutes).toBe(8 * 60); // 09:00 → 17:00
  });

  it("drops days below the minimum stay", () => {
    const out = groupByDate([train("2026-07-01", "10:00", "13:00")]);
    const back = groupByDate([train("2026-07-01", "14:00", "17:00", "B", "A")]);
    expect(planDayTrips(out, back, 4 * 60)).toHaveLength(0); // only 1h on site
  });

  it("ignores dates missing one direction", () => {
    const out = groupByDate([train("2026-07-01", "06:00", "09:00")]);
    expect(planDayTrips(out, {}, 0)).toHaveLength(0);
  });
});

describe("planWeekends", () => {
  const from = new Date(2026, 6, 1); // Wed 1 July 2026 (Saturday = 4 July)

  it("matches Fri/Sat departures with Sun/Mon returns", () => {
    const out = groupByDate([train("2026-07-04", "08:00", "11:00")]); // Saturday
    const back = groupByDate([train("2026-07-05", "18:00", "21:00", "B", "A")]); // Sunday
    const combos = planWeekends(out, back, from);
    expect(combos).toHaveLength(1);
    expect(combos[0].saturday).toBe("2026-07-04");
    expect(combos[0].departDates).toEqual(["2026-07-04"]);
    expect(combos[0].returnDates).toEqual(["2026-07-05"]);
  });

  it("requires both a departure and a return", () => {
    const out = groupByDate([train("2026-07-04", "08:00", "11:00")]);
    expect(planWeekends(out, {}, from)).toHaveLength(0);
  });

  it("excludes past departure dates", () => {
    const out = groupByDate([train("2026-06-27", "08:00", "11:00")]); // before `from`
    const back = groupByDate([train("2026-06-28", "18:00", "21:00", "B", "A")]);
    expect(planWeekends(out, back, from)).toHaveLength(0);
  });
});
