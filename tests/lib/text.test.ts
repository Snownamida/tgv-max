import { describe, expect, it } from "vitest";
import { normalize, prettyStation } from "@/lib/text";

describe("normalize", () => {
  it("strips accents and parentheses, uppercases, collapses spaces", () => {
    expect(normalize("PARIS (intramuros)")).toBe("PARIS INTRAMUROS");
    expect(normalize("Besançon Viotte")).toBe("BESANCON VIOTTE");
    expect(normalize("  Genève   Cornavin ")).toBe("GENEVE CORNAVIN");
  });
});

describe("prettyStation", () => {
  it("humanizes raw SNCF names", () => {
    expect(prettyStation("PARIS (intramuros)")).toBe("Paris Centre-Ville");
    expect(prettyStation("MARSEILLE ST CHARLES")).toBe("Marseille St Charles");
    expect(prettyStation("STRASBOURG")).toBe("Strasbourg");
  });
});
