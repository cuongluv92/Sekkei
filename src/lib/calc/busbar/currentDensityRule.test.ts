import { describe, expect, it } from "vitest";
import {
  JIS_C_8480_2016_STRIP_BANDS,
  JIS_C_8480_SIMPLE_SELECTION_MAX_CURRENT_A,
  maxCurrentForArea,
  requiredCrossSectionArea,
} from "./currentDensityRule";

describe("requiredCrossSectionArea — boundary values (spec #6, #25)", () => {
  it("125A (inclusive upper bound of the first band) uses 3.0 A/mm²", () => {
    const r = requiredCrossSectionArea(125);
    expect(r.inRange).toBe(true);
    if (r.inRange) expect(r.densityAPerMm2).toBe(3.0);
  });

  it("126A (just past the first band) uses 2.5 A/mm², not 3.0", () => {
    const r = requiredCrossSectionArea(126);
    expect(r.inRange).toBe(true);
    if (r.inRange) expect(r.densityAPerMm2).toBe(2.5);
  });

  it("250A uses 2.5 A/mm²", () => {
    const r = requiredCrossSectionArea(250);
    expect(r.inRange).toBe(true);
    if (r.inRange) expect(r.densityAPerMm2).toBe(2.5);
  });

  it("251A uses 2.0 A/mm², not 2.5", () => {
    const r = requiredCrossSectionArea(251);
    expect(r.inRange).toBe(true);
    if (r.inRange) expect(r.densityAPerMm2).toBe(2.0);
  });

  it("400A uses 2.0 A/mm²", () => {
    const r = requiredCrossSectionArea(400);
    expect(r.inRange).toBe(true);
    if (r.inRange) expect(r.densityAPerMm2).toBe(2.0);
  });

  it("401A uses 1.7 A/mm², not 2.0", () => {
    const r = requiredCrossSectionArea(401);
    expect(r.inRange).toBe(true);
    if (r.inRange) expect(r.densityAPerMm2).toBe(1.7);
  });

  it("630A (the simplified table's ceiling) is still in range at 1.7 A/mm²", () => {
    const r = requiredCrossSectionArea(630);
    expect(r.inRange).toBe(true);
    if (r.inRange) expect(r.densityAPerMm2).toBe(1.7);
  });

  it("631A switches out of range — never extrapolated (spec #10, #25)", () => {
    const r = requiredCrossSectionArea(631);
    expect(r.inRange).toBe(false);
    if (!r.inRange) expect(r.reasonKey).toBe("outOfRange");
  });

  it("a current far beyond 630A is also out of range, not extrapolated", () => {
    const r = requiredCrossSectionArea(1000);
    expect(r.inRange).toBe(false);
    if (!r.inRange) expect(r.reasonKey).toBe("outOfRange");
  });
});

describe("requiredCrossSectionArea — worked examples", () => {
  it("180A → 72mm² (180 / 2.5), matching the spec's worked example", () => {
    const r = requiredCrossSectionArea(180);
    expect(r.inRange).toBe(true);
    if (r.inRange) {
      expect(r.densityAPerMm2).toBe(2.5);
      expect(r.requiredAreaMm2).toBeCloseTo(72, 10);
    }
  });

  it("every in-range result carries the JIS C 8480 source with its actual verification state", () => {
    const r = requiredCrossSectionArea(180);
    expect(r.inRange).toBe(true);
    if (r.inRange) {
      expect(r.source.standard).toBe("JIS C 8480");
      expect(r.source.edition).toBe("2016");
      // This must stay false until the 2023 text is actually checked — a
      // regression here would mean the app started claiming unverified
      // standard compliance, which is exactly what must never happen.
      expect(r.source.verified).toBe(false);
    }
  });
});

describe("requiredCrossSectionArea — invalid input", () => {
  it("rejects zero", () => {
    const r = requiredCrossSectionArea(0);
    expect(r.inRange).toBe(false);
    if (!r.inRange) expect(r.reasonKey).toBe("invalidInput");
  });

  it("rejects negative current", () => {
    const r = requiredCrossSectionArea(-10);
    expect(r.inRange).toBe(false);
    if (!r.inRange) expect(r.reasonKey).toBe("invalidInput");
  });

  it("rejects NaN", () => {
    const r = requiredCrossSectionArea(NaN);
    expect(r.inRange).toBe(false);
    if (!r.inRange) expect(r.reasonKey).toBe("invalidInput");
  });

  it("rejects Infinity", () => {
    const r = requiredCrossSectionArea(Infinity);
    expect(r.inRange).toBe(false);
    if (!r.inRange) expect(r.reasonKey).toBe("invalidInput");
  });
});

describe("maxCurrentForArea — reverse direction (area → current)", () => {
  it("round-trips 180A → 72mm² → 180A", () => {
    const forward = requiredCrossSectionArea(180);
    expect(forward.inRange).toBe(true);
    if (!forward.inRange) return;
    const reverse = maxCurrentForArea(forward.requiredAreaMm2);
    expect(reverse.inRange).toBe(true);
    if (reverse.inRange) {
      expect(reverse.maxCurrentA).toBeCloseTo(180, 6);
      expect(reverse.densityAPerMm2).toBe(2.5);
      expect(reverse.cappedAtCeiling).toBe(false);
    }
  });

  it("round-trips every band boundary current exactly (125/250/400/630A)", () => {
    for (const currentA of [125, 250, 400, 630]) {
      const forward = requiredCrossSectionArea(currentA);
      expect(forward.inRange).toBe(true);
      if (!forward.inRange) continue;
      const reverse = maxCurrentForArea(forward.requiredAreaMm2);
      expect(reverse.inRange).toBe(true);
      if (reverse.inRange) {
        expect(reverse.maxCurrentA).toBeCloseTo(currentA, 6);
      }
    }
  });

  it("a tiny area still resolves to a small current in the first (3.0 A/mm²) band", () => {
    const reverse = maxCurrentForArea(1);
    expect(reverse.inRange).toBe(true);
    if (reverse.inRange) {
      expect(reverse.densityAPerMm2).toBe(3.0);
      expect(reverse.maxCurrentA).toBeCloseTo(3, 6);
    }
  });

  it("an area far larger than the 630A ceiling requires (400mm²) is capped at 630A, not extrapolated", () => {
    const reverse = maxCurrentForArea(400);
    expect(reverse.inRange).toBe(true);
    if (reverse.inRange) {
      expect(reverse.maxCurrentA).toBe(630);
      expect(reverse.cappedAtCeiling).toBe(true);
    }
  });

  it("the exact area the 630A boundary requires is not reported as capped (it genuinely is the boundary)", () => {
    const exactArea = 630 / 1.7;
    const reverse = maxCurrentForArea(exactArea);
    expect(reverse.inRange).toBe(true);
    if (reverse.inRange) {
      expect(reverse.maxCurrentA).toBe(630);
      expect(reverse.cappedAtCeiling).toBe(false);
    }
  });

  it("rejects invalid input", () => {
    expect(maxCurrentForArea(0).inRange).toBe(false);
    expect(maxCurrentForArea(-5).inRange).toBe(false);
    expect(maxCurrentForArea(NaN).inRange).toBe(false);
    expect(maxCurrentForArea(Infinity).inRange).toBe(false);
  });

  it("every in-range result carries the same JIS C 8480 source with its real verified state", () => {
    const reverse = maxCurrentForArea(72);
    expect(reverse.inRange).toBe(true);
    if (reverse.inRange) {
      expect(reverse.source.standard).toBe("JIS C 8480");
      expect(reverse.source.verified).toBe(false);
    }
  });
});

describe("table shape sanity", () => {
  it("the max in-range current matches the documented ceiling", () => {
    expect(JIS_C_8480_2016_STRIP_BANDS.at(-1)?.maxCurrentA).toBe(
      JIS_C_8480_SIMPLE_SELECTION_MAX_CURRENT_A,
    );
  });

  it("bands are sorted ascending by maxCurrentA", () => {
    const bounds = JIS_C_8480_2016_STRIP_BANDS.map((b) => b.maxCurrentA);
    expect(bounds).toEqual([...bounds].sort((a, b) => a - b));
  });

  it("density decreases as current range increases (higher current allows lower density, per the cited table)", () => {
    const densities = JIS_C_8480_2016_STRIP_BANDS.map((b) => b.densityAPerMm2);
    for (let i = 1; i < densities.length; i++) {
      expect(densities[i]).toBeLessThan(densities[i - 1]);
    }
  });
});
