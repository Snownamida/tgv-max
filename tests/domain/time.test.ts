import { describe, expect, it } from "vitest";
import { durationMinutes, formatDuration, hhmmToMinutes } from "@/domain/time";

describe("time", () => {
  it("converts HH:MM to minutes", () => {
    expect(hhmmToMinutes("00:00")).toBe(0);
    expect(hhmmToMinutes("03:20")).toBe(200);
    expect(hhmmToMinutes("23:59")).toBe(1439);
  });

  it("computes duration, wrapping past midnight", () => {
    expect(durationMinutes("08:00", "11:20")).toBe(200);
    expect(durationMinutes("23:30", "01:10")).toBe(100);
    expect(durationMinutes("10:00", "10:00")).toBe(0);
  });

  it("formats durations", () => {
    expect(formatDuration(200)).toBe("3h20");
    expect(formatDuration(120)).toBe("2h00");
    expect(formatDuration(65)).toBe("1h05");
  });
});
