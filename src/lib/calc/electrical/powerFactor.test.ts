import { describe, expect, it } from "vitest";
import {
  solveCapacitorCorrection,
  solvePowerTriangle,
} from "./powerFactor";

describe("solvePowerTriangle", () => {
  it("S from P,Q (3-4-5 triangle)", () => {
    const r = solvePowerTriangle({ activeP: 3, reactiveQ: 4 }, "apparentS");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeCloseTo(5);
  });

  it("reverse: Q from S,P", () => {
    const r = solvePowerTriangle({ apparentS: 5, activeP: 3 }, "reactiveQ");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeCloseTo(4);
  });

  it("pf from P,S", () => {
    const r = solvePowerTriangle({ activeP: 3, apparentS: 5 }, "pf");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeCloseTo(0.6);
  });

  it("pf=1 means Q resolves to 0 given P,S equal", () => {
    const r = solvePowerTriangle({ activeP: 10, apparentS: 10 }, "reactiveQ");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeCloseTo(0);
  });

  it("reports missing when underdetermined", () => {
    const r = solvePowerTriangle({ activeP: 10 }, "apparentS");
    expect(r.ok).toBe(false);
  });

  it("rejects P > S directly, instead of silently flooring Q to 0", () => {
    const r = solvePowerTriangle({ activeP: 10, apparentS: 5 }, "reactiveQ");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reasonKey).toBe("invalidInput");
  });

  it("rejects negative P/Q/S", () => {
    expect(solvePowerTriangle({ activeP: -3, reactiveQ: 4 }, "apparentS").ok).toBe(false);
  });
});

describe("solveCapacitorCorrection", () => {
  it("Qc from P, pf1→pf2 (typical 0.8→0.95 improvement)", () => {
    const r = solveCapacitorCorrection(
      { activePowerKw: 100, pfBefore: 0.8, pfAfter: 0.95 },
      "qcKvar",
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      const tan1 = Math.sqrt(1 - 0.8 * 0.8) / 0.8;
      const tan2 = Math.sqrt(1 - 0.95 * 0.95) / 0.95;
      expect(r.value).toBeCloseTo(100 * (tan1 - tan2), 5);
    }
  });

  it("reverse: pfAfter achieved from a known Qc", () => {
    const forward = solveCapacitorCorrection(
      { activePowerKw: 100, pfBefore: 0.8, pfAfter: 0.95 },
      "qcKvar",
    );
    expect(forward.ok).toBe(true);
    if (!forward.ok) return;
    const reverse = solveCapacitorCorrection(
      { activePowerKw: 100, pfBefore: 0.8, qcKvar: forward.value },
      "pfAfter",
    );
    expect(reverse.ok).toBe(true);
    if (reverse.ok) expect(reverse.value).toBeCloseTo(0.95, 3);
  });

  it("reverse: required P from Qc and pf1→pf2", () => {
    const tan1 = Math.sqrt(1 - 0.8 * 0.8) / 0.8;
    const tan2 = Math.sqrt(1 - 0.95 * 0.95) / 0.95;
    const qc = 100 * (tan1 - tan2);
    const r = solveCapacitorCorrection(
      { qcKvar: qc, pfBefore: 0.8, pfAfter: 0.95 },
      "activePowerKw",
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeCloseTo(100, 3);
  });

  it("pf1 already equal to pf2 needs no capacitor (Qc = 0)", () => {
    const r = solveCapacitorCorrection(
      { activePowerKw: 100, pfBefore: 0.9, pfAfter: 0.9 },
      "qcKvar",
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeCloseTo(0);
  });

  it("invalid pf (out of (0,1]) is treated as unresolved, never NaN leaking out", () => {
    const r = solveCapacitorCorrection(
      { activePowerKw: 100, pfBefore: 1.5, pfAfter: 0.9 },
      "qcKvar",
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reasonKey).toBe("invalidInput");
  });

  it("rejects zero or negative active power", () => {
    const r = solveCapacitorCorrection(
      { activePowerKw: 0, pfBefore: 0.8, pfAfter: 0.95 },
      "qcKvar",
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reasonKey).toBe("invalidInput");
  });

  it("rejects pfBefore > pfAfter — this formula only models improving (raising) power factor, never producing a negative Qc", () => {
    const r = solveCapacitorCorrection(
      { activePowerKw: 100, pfBefore: 0.95, pfAfter: 0.8 },
      "qcKvar",
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reasonKey).toBe("invalidInput");
  });
});
