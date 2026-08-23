import { describe, expect, it } from "vitest";
import {
  computeLineVoltageRatio,
  solveTransformer,
  TRANSFORMER_VECTOR_GROUP_SOURCE,
  TRANSFORMER_VECTOR_GROUPS,
} from "./transformer";

describe("solveTransformer — 単相", () => {
  it("kva from v1,i1 (forward — 100kVA class example)", () => {
    const r = solveTransformer({ v1: 6600, i1: 15.15 }, "kva", "single");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeCloseTo(100, 0);
  });

  it("i2 from kva,v2 (reverse — the exact case in the spec: 100kVA + 200V → A)", () => {
    const r = solveTransformer({ kva: 100, v2: 200 }, "i2", "single");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeCloseTo(500, 0); // 100000/200
  });

  it("kva from i2,v2 (the reverse direction: A + V known → kVA)", () => {
    const r = solveTransformer({ i2: 500, v2: 200 }, "kva", "single");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeCloseTo(100, 3);
  });

  it("turnsRatio from v1,v2, and reverse v1 from turnsRatio,v2", () => {
    const r1 = solveTransformer({ v1: 6600, v2: 200 }, "turnsRatio", "single");
    expect(r1.ok).toBe(true);
    if (r1.ok) expect(r1.value).toBeCloseTo(33, 0);

    const r2 = solveTransformer({ turnsRatio: 33, v2: 200 }, "v1", "single");
    expect(r2.ok).toBe(true);
    if (r2.ok) expect(r2.value).toBeCloseTo(6600, 0);
  });

  it("chains v1,i1 → kva → i2 given v2 (multi-hop both sides)", () => {
    const r = solveTransformer({ v1: 6600, i1: 15.15, v2: 200 }, "i2", "single");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeCloseTo(500, -1);
  });

  it("reports missing variables when underdetermined", () => {
    const r = solveTransformer({ v1: 6600 }, "kva", "single");
    expect(r.ok).toBe(false);
  });
});

describe("solveTransformer — 三相 (never assumes turnsRatio)", () => {
  it("kva from v1,i1 using √3", () => {
    const r = solveTransformer({ v1: 6600, i1: 10 }, "kva", "three");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeCloseTo((Math.sqrt(3) * 6600 * 10) / 1000, 3);
  });

  it("v2 from kva,i2 (reverse)", () => {
    const kva = (Math.sqrt(3) * 6600 * 10) / 1000;
    const r = solveTransformer({ kva, i2: 300 }, "v2", "three");
    expect(r.ok).toBe(true);
    if (r.ok) {
      const expectedV2 = (kva * 1000) / (Math.sqrt(3) * 300);
      expect(r.value).toBeCloseTo(expectedV2, 3);
    }
  });

  it("turnsRatio is never solvable in three-phase mode (no rule offers it)", () => {
    const r = solveTransformer({ v1: 6600, v2: 200 }, "turnsRatio", "three");
    expect(r.ok).toBe(false);
  });
});

describe("solveTransformer — validation", () => {
  it("rejects zero or negative voltage/current/capacity", () => {
    expect(solveTransformer({ v1: -6600 }, "kva", "single").ok).toBe(false);
    expect(solveTransformer({ kva: 0, v2: 200 }, "i2", "single").ok).toBe(false);
  });

  it("flags a contradicting kva against what v1,i1 already imply", () => {
    const r = solveTransformer({ v1: 6600, i1: 15.15, kva: 999 }, "v2", "single");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reasonKey).toBe("inconsistentInput");
  });
});

describe("computeLineVoltageRatio — explicitly not called 巻数比", () => {
  it("computes the ratio and always attaches the winding-configuration caveat", () => {
    const r = computeLineVoltageRatio(6600, 200);
    expect(r).not.toBeNull();
    if (r) {
      expect(r.ratio).toBeCloseTo(33, 0);
      expect(r.note).toContain("巻数比");
      expect(r.note).toContain("結線");
    }
  });

  it("returns null for invalid input rather than Infinity/NaN", () => {
    expect(computeLineVoltageRatio(6600, 0)).toBeNull();
    expect(computeLineVoltageRatio(NaN, 200)).toBeNull();
  });
});

describe("TRANSFORMER_VECTOR_GROUPS — clock number only, no unverified signed angle", () => {
  it("includes the required audit set: Yy0, Yd1, Dd0, Dyn11", () => {
    const codes = TRANSFORMER_VECTOR_GROUPS.map((g) => g.code);
    expect(codes).toContain("Yy0");
    expect(codes).toContain("Yd1");
    expect(codes).toContain("Dd0");
    expect(codes).toContain("Dyn11");
  });

  it("every entry carries an integer clock number in [0, 11], never a signed degree field", () => {
    for (const g of TRANSFORMER_VECTOR_GROUPS) {
      expect(Number.isInteger(g.clockNumber)).toBe(true);
      expect(g.clockNumber).toBeGreaterThanOrEqual(0);
      expect(g.clockNumber).toBeLessThanOrEqual(11);
      expect(g).not.toHaveProperty("phaseShiftDeg");
    }
  });

  it("Yy0/Dd0 are clock 0, Yd1/Dyn1/Ynd1 are clock 1, Dyn11/Ynd11 are clock 11", () => {
    const byCode = Object.fromEntries(TRANSFORMER_VECTOR_GROUPS.map((g) => [g.code, g.clockNumber]));
    expect(byCode["Yy0"]).toBe(0);
    expect(byCode["Dd0"]).toBe(0);
    expect(byCode["Yd1"]).toBe(1);
    expect(byCode["Dyn1"]).toBe(1);
    expect(byCode["Ynd1"]).toBe(1);
    expect(byCode["Dyn11"]).toBe(11);
    expect(byCode["Ynd11"]).toBe(11);
  });

  it("source stays unverified and its note explains why signed angles are withheld", () => {
    expect(TRANSFORMER_VECTOR_GROUP_SOURCE.verified).toBe(false);
    expect(TRANSFORMER_VECTOR_GROUP_SOURCE.verificationNote).toContain("符号");
  });
});
