import { describe, expect, it } from "vitest";
import {
  solveSimplifiedVoltageDrop,
  solveVoltageDrop,
} from "./voltageDrop";

describe("solveVoltageDrop — DC", () => {
  it("ΔV from current,r,length (forward)", () => {
    const r = solveVoltageDrop(
      { current: 50, rOhmPerKm: 1.0, lengthM: 100 },
      "deltaV",
      "dc",
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeCloseTo((2 * 50 * 1.0 * 100) / 1000, 5); // 10V
  });

  it("reverse: required length from a ΔV limit", () => {
    const r = solveVoltageDrop(
      { deltaV: 10, current: 50, rOhmPerKm: 1.0 },
      "lengthM",
      "dc",
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeCloseTo(100, 3);
  });

  it("reverse: required r from a ΔV limit", () => {
    const r = solveVoltageDrop(
      { deltaV: 10, current: 50, lengthM: 100 },
      "rOhmPerKm",
      "dc",
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeCloseTo(1.0, 5);
  });
});

describe("solveVoltageDrop — 単相2線式 (R/X method, pf=1 means x term vanishes into sinφ=0)", () => {
  it("pf=1 uses only r (sinφ=0, x term contributes nothing)", () => {
    const withX = solveVoltageDrop(
      { current: 20, rOhmPerKm: 0.5, xOhmPerKm: 0.3, pf: 1, lengthM: 50 },
      "deltaV",
      "single",
    );
    const withoutXTerm = (2 * 20 * 0.5 * 50) / 1000;
    expect(withX.ok).toBe(true);
    if (withX.ok) expect(withX.value).toBeCloseTo(withoutXTerm, 5);
  });

  it("lagging pf<1 includes the reactance term (result differs from pf=1 case)", () => {
    const r = solveVoltageDrop(
      { current: 20, rOhmPerKm: 0.5, xOhmPerKm: 0.3, pf: 0.8, lengthM: 50 },
      "deltaV",
      "single",
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      const sinPhi = Math.sqrt(1 - 0.8 * 0.8);
      const expected = (2 * 20 * (0.5 * 0.8 + 0.3 * sinPhi) * 50) / 1000;
      expect(r.value).toBeCloseTo(expected, 5);
    }
  });
});

describe("solveVoltageDrop — 三相3線式 uses √3", () => {
  it("forward matches the √3 formula exactly", () => {
    const r = solveVoltageDrop(
      { current: 30, rOhmPerKm: 0.4, xOhmPerKm: 0.25, pf: 0.9, lengthM: 80 },
      "deltaV",
      "three",
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      const sinPhi = Math.sqrt(1 - 0.9 * 0.9);
      const expected = (Math.sqrt(3) * 30 * (0.4 * 0.9 + 0.25 * sinPhi) * 80) / 1000;
      expect(r.value).toBeCloseTo(expected, 5);
    }
  });
});

describe("solveVoltageDrop — %/末端電圧 relations, mode-independent", () => {
  it("chains current+r+length → ΔV → ΔV% given sourceVoltage", () => {
    const r = solveVoltageDrop(
      { current: 50, rOhmPerKm: 1.0, lengthM: 100, sourceVoltage: 200 },
      "deltaVPercent",
      "dc",
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeCloseTo(5, 3); // 10V / 200V *100
  });

  it("末端電圧 from sourceVoltage,deltaV", () => {
    const r = solveVoltageDrop(
      { sourceVoltage: 200, deltaV: 10 },
      "endVoltage",
      "dc",
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeCloseTo(190);
  });

  it("never emits a 適合/不適合 judgment field — SolveResult carries no such key", () => {
    const r = solveVoltageDrop({ sourceVoltage: 200, deltaV: 10 }, "endVoltage", "dc");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(Object.keys(r)).not.toContain("judgment");
      expect(Object.keys(r)).not.toContain("pass");
    }
  });

  it("reports missing when underdetermined", () => {
    const r = solveVoltageDrop({ current: 50 }, "deltaV", "dc");
    expect(r.ok).toBe(false);
  });
});

describe("solveSimplifiedVoltageDrop — 単相2線式(35.6)/三相3線式(30.8), verified:false", () => {
  it("forward: ΔV from current,length,area (単相)", () => {
    const r = solveSimplifiedVoltageDrop(
      { current: 20, lengthM: 50, areaMm2: 5.5 },
      "deltaV",
      "single2wire",
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value).toBeCloseTo((35.6 * 50 * 20) / (1000 * 5.5), 4);
      expect(r.sources[0].verified).toBe(false);
    }
  });

  it("三相3線式 uses the 30.8 coefficient, differs from 単相", () => {
    const single = solveSimplifiedVoltageDrop(
      { current: 20, lengthM: 50, areaMm2: 5.5 },
      "deltaV",
      "single2wire",
    );
    const three = solveSimplifiedVoltageDrop(
      { current: 20, lengthM: 50, areaMm2: 5.5 },
      "deltaV",
      "three3wire",
    );
    expect(single.ok && three.ok).toBe(true);
    if (single.ok && three.ok) expect(single.value).not.toBeCloseTo(three.value, 5);
  });

  it("reverse: required area from a ΔV limit", () => {
    const forward = solveSimplifiedVoltageDrop(
      { current: 20, lengthM: 50, areaMm2: 5.5 },
      "deltaV",
      "single2wire",
    );
    expect(forward.ok).toBe(true);
    if (!forward.ok) return;
    const reverse = solveSimplifiedVoltageDrop(
      { deltaV: forward.value, current: 20, lengthM: 50 },
      "areaMm2",
      "single2wire",
    );
    expect(reverse.ok).toBe(true);
    if (reverse.ok) expect(reverse.value).toBeCloseTo(5.5, 3);
  });
});
