import { describe, expect, it } from "vitest";
import { and, filters, literal } from "@/data/query";

describe("query builders", () => {
  it("quotes and escapes string literals", () => {
    expect(literal("A")).toBe('"A"');
    expect(literal('A"B')).toBe('"A\\"B"');
  });

  it("builds field filters", () => {
    expect(filters.from("PARIS (intramuros)")).toBe('origine="PARIS (intramuros)"');
    expect(filters.to("LYON (intramuros)")).toBe('destination="LYON (intramuros)"');
    expect(filters.maxSeat()).toBe('od_happy_card="OUI"');
    expect(filters.onDate("2026-07-04")).toBe('date>="2026-07-04" AND date<="2026-07-04"');
    expect(filters.dateRange("2026-07-01", "2026-07-08")).toBe(
      'date>="2026-07-01" AND date<="2026-07-08"',
    );
  });

  it("joins only truthy clauses with AND", () => {
    expect(and("a", "", "b", undefined, false)).toBe("a AND b");
    expect(and(filters.from("A"), filters.maxSeat())).toBe('origine="A" AND od_happy_card="OUI"');
  });
});
