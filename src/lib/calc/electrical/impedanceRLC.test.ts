import { describe, expect, it } from "vitest";
import {
  solveCapacitiveReactance,
  solveImpedance,
  solveInductiveReactance,
  solveParallelComplexImpedance,
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

  it("rejects zero resistance (division by zero in the parallel formula)", () => {
    const r = solveParallelResistance({ R1: 0, R2: 10 }, "Rtotal");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reasonKey).toBe("invalidInput");
  });
});

describe("solveImpedance — validation", () => {
  it("rejects R exceeding Z (impossible: R is a leg of the Z right triangle)", () => {
    const r = solveImpedance({ R: 10, Z: 5 }, "X");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reasonKey).toBe("invalidInput");
  });

  it("rejects a negative Z/R/X", () => {
    expect(solveImpedance({ R: -3, X: 4 }, "Z").ok).toBe(false);
  });

  it("flags a directly-given Z that contradicts R,X", () => {
    const r = solveImpedance({ R: 3, X: 4, Z: 999 }, "Z");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reasonKey).toBe("inconsistentInput");
  });
});

describe("solveInductiveReactance / solveCapacitiveReactance / solveResonance — validation", () => {
  it("rejects zero or negative frequency/L/C/XL/XC/f0", () => {
    expect(solveInductiveReactance({ f: 0, L: 0.1 }, "XL").ok).toBe(false);
    expect(solveInductiveReactance({ f: 50, L: -0.1 }, "XL").ok).toBe(false);
    expect(solveCapacitiveReactance({ f: 50, C: 0 }, "XC").ok).toBe(false);
    expect(solveResonance({ L: -0.1, C: 100e-6 }, "f0").ok).toBe(false);
  });
});

describe("solveParallelComplexImpedance — full complex-division parallel combination", () => {
  it("two identical impedances Z1=Z2=3+j4 in parallel halve to 1.5+j2 (Z/2)", () => {
    const rTotal = solveParallelComplexImpedance({ R1: 3, X1: 4, R2: 3, X2: 4 }, "Rtotal");
    const xTotal = solveParallelComplexImpedance({ R1: 3, X1: 4, R2: 3, X2: 4 }, "Xtotal");
    const zTotal = solveParallelComplexImpedance({ R1: 3, X1: 4, R2: 3, X2: 4 }, "Ztotal");
    expect(rTotal.ok).toBe(true);
    expect(xTotal.ok).toBe(true);
    expect(zTotal.ok).toBe(true);
    if (rTotal.ok) expect(rTotal.value).toBeCloseTo(1.5, 5);
    if (xTotal.ok) expect(xTotal.value).toBeCloseTo(2, 5);
    if (zTotal.ok) expect(zTotal.value).toBeCloseTo(2.5, 5);
  });

  it("pure resistors (X=0) reduce to the classic real-only parallel formula", () => {
    const r = solveParallelComplexImpedance({ R1: 6, X1: 0, R2: 3, X2: 0 }, "Rtotal");
    const x = solveParallelComplexImpedance({ R1: 6, X1: 0, R2: 3, X2: 0 }, "Xtotal");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeCloseTo(2, 5); // 6*3/(6+3)
    expect(x.ok).toBe(true);
    if (x.ok) expect(x.value).toBeCloseTo(0, 5);
  });

  it("conjugate impedances 4+j3 ‖ 4-j3 combine to a purely resistive result", () => {
    const r = solveParallelComplexImpedance({ R1: 4, X1: 3, R2: 4, X2: -3 }, "Rtotal");
    const x = solveParallelComplexImpedance({ R1: 4, X1: 3, R2: 4, X2: -3 }, "Xtotal");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeCloseTo(3.125, 5);
    expect(x.ok).toBe(true);
    if (x.ok) expect(x.value).toBeCloseTo(0, 5);
  });

  it("is forward-only — solving for an input variable (e.g. R1) is not supported", () => {
    const r = solveParallelComplexImpedance(
      { X1: 4, R2: 3, X2: 4, Rtotal: 1.5 },
      "R1",
    );
    expect(r.ok).toBe(false);
  });

  it("rejects a negative branch resistance", () => {
    expect(solveParallelComplexImpedance({ R1: -1, X1: 0, R2: 3, X2: 0 }, "Rtotal").ok).toBe(
      false,
    );
  });

  it("anti-resonant pure-reactance branches (zero total R and X) are not derivable, not a fabricated infinity", () => {
    const r = solveParallelComplexImpedance({ R1: 0, X1: 10, R2: 0, X2: -10 }, "Ztotal");
    expect(r.ok).toBe(false);
  });
});
