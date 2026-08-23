import { describe, expect, it } from "vitest";
import {
  computeLineVoltageRatio,
  solveTransformer,
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
