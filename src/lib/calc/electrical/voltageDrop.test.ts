import { describe, expect, it } from "vitest";
import {
  checkVoltageDropConformity,
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

  it("reverse: xOhmPerKm is solvable from ΔV,current,length,r,pf (previously an unsolvable declared target)", () => {
    const forward = solveVoltageDrop(
      { current: 20, rOhmPerKm: 0.5, xOhmPerKm: 0.3, pf: 0.8, lengthM: 50 },
      "deltaV",
      "single",
      "lagging",
    );
    expect(forward.ok).toBe(true);
    if (!forward.ok) return;
    const reverse = solveVoltageDrop(
      { deltaV: forward.value, current: 20, rOhmPerKm: 0.5, pf: 0.8, lengthM: 50 },
      "xOhmPerKm",
      "single",
      "lagging",
    );
    expect(reverse.ok).toBe(true);
    if (reverse.ok) expect(reverse.value).toBeCloseTo(0.3, 4);
  });

  it("xOhmPerKm is not derivable at pf=1 (sinφ=0 makes it genuinely indeterminate, not a bug)", () => {
    const r = solveVoltageDrop(
      { deltaV: 1, current: 20, rOhmPerKm: 0.1, pf: 1, lengthM: 50 },
      "xOhmPerKm",
      "single",
      "lagging",
    );
    expect(r.ok).toBe(false);
  });
});

describe("solveVoltageDrop — leading (進み/capacitive) load flips the reactance sign", () => {
  it("leading pf<1 subtracts the reactance term instead of adding it", () => {
    const lagging = solveVoltageDrop(
      { current: 20, rOhmPerKm: 0.5, xOhmPerKm: 0.3, pf: 0.8, lengthM: 50 },
      "deltaV",
      "single",
      "lagging",
    );
    const leading = solveVoltageDrop(
      { current: 20, rOhmPerKm: 0.5, xOhmPerKm: 0.3, pf: 0.8, lengthM: 50 },
      "deltaV",
      "single",
      "leading",
    );
    expect(lagging.ok).toBe(true);
    expect(leading.ok).toBe(true);
    if (lagging.ok && leading.ok) {
      const sinPhi = Math.sqrt(1 - 0.8 * 0.8);
      const expectedLagging = (2 * 20 * (0.5 * 0.8 + 0.3 * sinPhi) * 50) / 1000;
      const expectedLeading = (2 * 20 * (0.5 * 0.8 - 0.3 * sinPhi) * 50) / 1000;
      expect(lagging.value).toBeCloseTo(expectedLagging, 5);
      expect(leading.value).toBeCloseTo(expectedLeading, 5);
      // A leading load's reactive term reduces the drop relative to the same lagging load.
      expect(leading.value).toBeLessThan(lagging.value);
    }
  });

  it("defaults to lagging when loadType is omitted (backward-compatible call sites)", () => {
    const withDefault = solveVoltageDrop(
      { current: 20, rOhmPerKm: 0.5, xOhmPerKm: 0.3, pf: 0.8, lengthM: 50 },
      "deltaV",
      "single",
    );
    const explicitLagging = solveVoltageDrop(
      { current: 20, rOhmPerKm: 0.5, xOhmPerKm: 0.3, pf: 0.8, lengthM: 50 },
      "deltaV",
      "single",
      "lagging",
    );
    expect(withDefault.ok).toBe(true);
    expect(explicitLagging.ok).toBe(true);
    if (withDefault.ok && explicitLagging.ok) {
      expect(withDefault.value).toBeCloseTo(explicitLagging.value, 10);
    }
  });

  it("leading load: reverse-solving r from ΔV correctly inverts the flipped sign", () => {
    const forward = solveVoltageDrop(
      { current: 20, rOhmPerKm: 0.5, xOhmPerKm: 0.3, pf: 0.8, lengthM: 50 },
      "deltaV",
      "single",
      "leading",
    );
    expect(forward.ok).toBe(true);
    if (!forward.ok) return;
    const reverse = solveVoltageDrop(
      { deltaV: forward.value, current: 20, xOhmPerKm: 0.3, pf: 0.8, lengthM: 50 },
      "rOhmPerKm",
      "single",
      "leading",
    );
    expect(reverse.ok).toBe(true);
    if (reverse.ok) expect(reverse.value).toBeCloseTo(0.5, 4);
  });

  it("three-phase leading load also flips the sign under √3", () => {
    const leading = solveVoltageDrop(
      { current: 30, rOhmPerKm: 0.4, xOhmPerKm: 0.25, pf: 0.9, lengthM: 80 },
      "deltaV",
      "three",
      "leading",
    );
    expect(leading.ok).toBe(true);
    if (leading.ok) {
      const sinPhi = Math.sqrt(1 - 0.9 * 0.9);
      const expected = (Math.sqrt(3) * 30 * (0.4 * 0.9 - 0.25 * sinPhi) * 80) / 1000;
      expect(leading.value).toBeCloseTo(expected, 5);
    }
  });

  it("a dominant reactive term (r·cosφ − x·sinφ < 0) produces a genuine voltage RISE, flagged with a warning", () => {
    // r=0.1, x=0.5, pf=0.6 (sinφ=0.8): 0.1*0.6 - 0.5*0.8 = 0.06 - 0.4 = -0.34 < 0.
    const forward = solveVoltageDrop(
      { current: 20, rOhmPerKm: 0.1, xOhmPerKm: 0.5, pf: 0.6, lengthM: 50 },
      "deltaV",
      "single",
      "leading",
    );
    expect(forward.ok).toBe(true);
    if (forward.ok) {
      expect(forward.value).toBeLessThan(0);
      expect(forward.value).toBeCloseTo((2 * 20 * (0.1 * 0.6 - 0.5 * 0.8) * 50) / 1000, 6);
      expect(forward.warnings?.some((w) => w.includes("電圧上昇"))).toBe(true);
    }
  });

  it("forward/reverse are consistent — a negative ΔV from the forward case can be fed back in as a known input", () => {
    const forward = solveVoltageDrop(
      { current: 20, rOhmPerKm: 0.1, xOhmPerKm: 0.5, pf: 0.6, lengthM: 50 },
      "deltaV",
      "single",
      "leading",
    );
    expect(forward.ok).toBe(true);
    if (!forward.ok) return;
    expect(forward.value).toBeLessThan(0);
    // Previously this reverse call would have been rejected outright because
    // known.deltaV was negative — that inconsistency (allowed forward,
    // blocked reverse) is exactly what this fix removes.
    const reverse = solveVoltageDrop(
      { deltaV: forward.value, rOhmPerKm: 0.1, xOhmPerKm: 0.5, pf: 0.6, lengthM: 50 },
      "current",
      "single",
      "leading",
    );
    expect(reverse.ok).toBe(true);
    if (reverse.ok) expect(reverse.value).toBeCloseTo(20, 4);
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

describe("solveVoltageDrop — validation", () => {
  it("rejects zero or negative current/length/source voltage", () => {
    expect(solveVoltageDrop({ current: 0, rOhmPerKm: 1, lengthM: 100 }, "deltaV", "dc").ok).toBe(false);
    expect(solveVoltageDrop({ current: 50, rOhmPerKm: 1, lengthM: -100 }, "deltaV", "dc").ok).toBe(false);
    expect(solveVoltageDrop({ sourceVoltage: -200, deltaV: 10 }, "endVoltage", "dc").ok).toBe(false);
  });

  it("rejects pf outside (0,1]", () => {
    const r = solveVoltageDrop(
      { current: 20, rOhmPerKm: 0.5, xOhmPerKm: 0.3, pf: 1.2, lengthM: 50 },
      "deltaV",
      "single",
    );
    expect(r.ok).toBe(false);
  });

  it("an end voltage exceeding the source voltage is now a valid voltage RISE, not an error", () => {
    // endVoltage > sourceVoltage implies a negative ΔV (voltage rise) — this must be
    // accepted, not blocked, and must carry a warning explaining what a negative
    // ΔV means rather than silently flipping its sign.
    const r = solveVoltageDrop({ sourceVoltage: 200, endVoltage: 210 }, "deltaV", "dc");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value).toBeCloseTo(-10, 6);
      expect(r.warnings?.some((w) => w.includes("電圧上昇"))).toBe(true);
    }
  });

  it("flags a directly-supplied deltaV that contradicts current/r/length", () => {
    // current=50, r=1.0, length=100 (dc) implies ΔV=10V exactly.
    const r = solveVoltageDrop(
      { current: 50, rOhmPerKm: 1.0, lengthM: 100, deltaV: 999 },
      "deltaV",
      "dc",
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reasonKey).toBe("inconsistentInput");
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

describe("checkVoltageDropConformity — pure arithmetic comparison against a user-supplied threshold", () => {
  it("conforms when actual is within the user's allowed percent", () => {
    const c = checkVoltageDropConformity(1.5, 2);
    expect(c).not.toBeNull();
    expect(c?.conforms).toBe(true);
    expect(c?.marginPercent).toBeCloseTo(0.5, 5);
  });

  it("does not conform when actual exceeds the user's allowed percent", () => {
    const c = checkVoltageDropConformity(3.2, 2);
    expect(c?.conforms).toBe(false);
    expect(c?.marginPercent).toBeCloseTo(-1.2, 5);
  });

  it("exactly at the threshold conforms (inclusive)", () => {
    const c = checkVoltageDropConformity(2, 2);
    expect(c?.conforms).toBe(true);
    expect(c?.marginPercent).toBeCloseTo(0, 5);
  });

  it("rejects a non-positive allowed threshold rather than fabricating a default", () => {
    expect(checkVoltageDropConformity(1, 0)).toBeNull();
    expect(checkVoltageDropConformity(1, -2)).toBeNull();
  });

  it("rejects a negative actual percent", () => {
    expect(checkVoltageDropConformity(-1, 2)).toBeNull();
  });
});
