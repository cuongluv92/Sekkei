import { describe, expect, it } from "vitest";
import {
  EARTH_WIRE_COEFFICIENT_PER_A,
  requiredEarthWireCrossSection,
} from "./requiredCrossSection";

describe("requiredEarthWireCrossSection — grounding type scope (spec #23, #28, #34)", () => {
  it("C種接地工事 applies the 0.052×In formula", () => {
    const r = requiredEarthWireCrossSection(400, "C");
    expect(r.applicable).toBe(true);
    if (r.applicable) {
      expect(r.groundingType).toBe("C");
      expect(r.coefficientPerA).toBe(EARTH_WIRE_COEFFICIENT_PER_A);
      expect(r.requiredAreaMm2).toBeCloseTo(20.8, 10);
    }
  });

  it("D種接地工事 applies the 0.052×In formula", () => {
    const r = requiredEarthWireCrossSection(100, "D");
    expect(r.applicable).toBe(true);
    if (r.applicable) {
      expect(r.requiredAreaMm2).toBeCloseTo(5.2, 10);
    }
  });

  it("A種接地工事 is NOT supported — never reuses the C/D formula", () => {
    const r = requiredEarthWireCrossSection(400, "A");
    expect(r.applicable).toBe(false);
    if (!r.applicable) expect(r.reasonKey).toBe("unsupportedGroundingType");
  });

  it("B種接地工事 is NOT supported — never reuses the C/D formula", () => {
    const r = requiredEarthWireCrossSection(400, "B");
    expect(r.applicable).toBe(false);
    if (!r.applicable) expect(r.reasonKey).toBe("unsupportedGroundingType");
  });

  it("every applicable result carries the source with its actual verification state", () => {
    const r = requiredEarthWireCrossSection(400, "C");
    expect(r.applicable).toBe(true);
    if (r.applicable) {
      expect(r.source.standard).toBe("内線規程 (JEAC 8001)");
      // Must stay false until the primary 内線規程 text is actually checked.
      expect(r.source.verified).toBe(false);
    }
  });
});

describe("requiredEarthWireCrossSection — invalid input", () => {
  it("rejects zero", () => {
    const r = requiredEarthWireCrossSection(0, "C");
    expect(r.applicable).toBe(false);
    if (!r.applicable) expect(r.reasonKey).toBe("invalidInput");
  });

  it("rejects negative current", () => {
    const r = requiredEarthWireCrossSection(-10, "D");
    expect(r.applicable).toBe(false);
    if (!r.applicable) expect(r.reasonKey).toBe("invalidInput");
  });

  it("rejects NaN", () => {
    const r = requiredEarthWireCrossSection(NaN, "C");
    expect(r.applicable).toBe(false);
    if (!r.applicable) expect(r.reasonKey).toBe("invalidInput");
  });

  it("invalid input is reported before unsupported grounding type", () => {
    const r = requiredEarthWireCrossSection(-10, "A");
    expect(r.applicable).toBe(false);
    if (!r.applicable) expect(r.reasonKey).toBe("invalidInput");
  });
});
