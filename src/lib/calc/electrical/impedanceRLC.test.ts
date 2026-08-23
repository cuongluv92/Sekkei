import { describe, expect, it } from "vitest";
import {
  solveCapacitiveReactance,
  solveImpedance,
  solveInductiveReactance,
  solveParallelResistance,
  solveResonance,
  solveSeriesRX,
} from "./impedanceRLC";

describe("solveImpedance — Z = √(R²+X²)", () => {
  it("3-4-5 triangle forward", () => {
    const r = solveImpedance({ R: 3, X: 4 }, "Z");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeCloseTo(5);
  });

  it("reverse: R from Z,X", () => {
    const r = solveImpedance({ Z: 5, X: 4 }, "R");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeCloseTo(3);
  });

  it("X=0 (pure resistive) means Z=R", () => {
    const r = solveImpedance({ R: 10, X: 0 }, "Z");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeCloseTo(10);
  });
});

describe("solveInductiveReactance — XL = 2πfL", () => {
  it("forward: 50Hz, 0.1H", () => {
    const r = solveInductiveReactance({ f: 50, L: 0.1 }, "XL");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeCloseTo(2 * Math.PI * 50 * 0.1, 5);
  });

  it("reverse: L from XL,f", () => {
    const xl = 2 * Math.PI * 50 * 0.1;
    const r = solveInductiveReactance({ XL: xl, f: 50 }, "L");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeCloseTo(0.1, 5);
  });

  it("50Hz vs 60Hz gives a different XL for the same L", () => {
    const r50 = solveInductiveReactance({ f: 50, L: 0.1 }, "XL");
    const r60 = solveInductiveReactance({ f: 60, L: 0.1 }, "XL");
    expect(r50.ok && r60.ok).toBe(true);
    if (r50.ok && r60.ok) expect(r50.value).not.toBeCloseTo(r60.value, 5);
  });
});

describe("solveCapacitiveReactance — XC = 1/(2πfC)", () => {
  it("forward", () => {
    const r = solveCapacitiveReactance({ f: 50, C: 100e-6 }, "XC");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeCloseTo(1 / (2 * Math.PI * 50 * 100e-6), 3);
  });

  it("reverse: C from XC,f", () => {
    const xc = 1 / (2 * Math.PI * 50 * 100e-6);
    const r = solveCapacitiveReactance({ XC: xc, f: 50 }, "C");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeCloseTo(100e-6, 8);
  });
});

describe("solveResonance — f0 = 1/(2π√(LC))", () => {
  it("forward", () => {
    const r = solveResonance({ L: 0.1, C: 100e-6 }, "f0");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeCloseTo(1 / (2 * Math.PI * Math.sqrt(0.1 * 100e-6)), 3);
  });

  it("reverse: L from f0,C", () => {
    const f0 = 1 / (2 * Math.PI * Math.sqrt(0.1 * 100e-6));
    const r = solveResonance({ f0, C: 100e-6 }, "L");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeCloseTo(0.1, 5);
  });

  it("at resonance, XL equals XC (cross-check with the other two engines)", () => {
    const L = 0.1;
    const C = 100e-6;
    const resonance = solveResonance({ L, C }, "f0");
    expect(resonance.ok).toBe(true);
    if (!resonance.ok) return;
    const xl = 2 * Math.PI * resonance.value * L;
    const xc = 1 / (2 * Math.PI * resonance.value * C);
    expect(xl).toBeCloseTo(xc, 5);
  });
});

describe("solveSeriesRX", () => {
  it("Rtotal from R1,R2", () => {
    const r = solveSeriesRX({ R1: 3, R2: 7 }, "Rtotal");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeCloseTo(10);
  });

  it("reverse: R2 from Rtotal,R1", () => {
    const r = solveSeriesRX({ Rtotal: 10, R1: 3 }, "R2");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeCloseTo(7);
  });

  it("R and X totals are independent", () => {
    const r = solveSeriesRX({ R1: 3, R2: 7, X1: 2 }, "Xtotal");
    expect(r.ok).toBe(false); // X2 still missing, R-side knowns must not leak in
  });
});

describe("solveParallelResistance", () => {
  it("equal resistors halve", () => {
    const r = solveParallelResistance({ R1: 10, R2: 10 }, "Rtotal");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeCloseTo(5);
  });

  it("reverse: R2 from Rtotal,R1", () => {
    const r = solveParallelResistance({ Rtotal: 5, R1: 10 }, "R2");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeCloseTo(10);
  });
});
