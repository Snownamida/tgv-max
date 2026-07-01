import { describe, expect, it } from "vitest";
import { formatRidership } from "@/lib/format";

describe("formatRidership", () => {
  it("abbreviates millions with a French decimal comma", () => {
    expect(formatRidership(5_000_000)).toBe("5,0 M");
    expect(formatRidership(511_202_252)).toBe("511,2 M");
  });

  it("abbreviates thousands", () => {
    expect(formatRidership(250_000)).toBe("250 k");
    expect(formatRidership(1_500)).toBe("2 k");
  });

  it("keeps small numbers as-is and returns empty for unknown", () => {
    expect(formatRidership(999)).toBe("999");
    expect(formatRidership(0)).toBe("");
  });
});
