import { describe, expect, it } from "vitest";
import {
  solveAcPower,
  solveDcCircuit,
  solveEfficiency,
} from "./ohmsLaw";

describe("solveDcCircuit — Ohm's law + Joule's law", () => {
  it("V from I,R (forward)", () => {
    const r = solveDcCircuit({ I: 10, R: 5 }, "V");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeCloseTo(50);
  });

  it("I from V,R (reverse of the same relation)", () => {
    const r = solveDcCircuit({ V: 50, R: 5 }, "I");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeCloseTo(10);
  });

  it("R from V,I", () => {
    const r = solveDcCircuit({ V: 50, I: 10 }, "R");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeCloseTo(5);
  });

  it("P from V,I", () => {
    const r = solveDcCircuit({ V: 50, I: 10 }, "P");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeCloseTo(500);
  });

  it("V from R,P (reverse via Joule's law, sqrt path)", () => {
    const r = solveDcCircuit({ R: 5, P: 500 }, "V");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeCloseTo(50);
  });

  it("I from R,P", () => {
    const r = solveDcCircuit({ R: 5, P: 500 }, "I");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeCloseTo(10);
  });

  it("reports missing variables when only one is known", () => {
    const r = solveDcCircuit({ V: 50 }, "I");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.missing?.length).toBeGreaterThan(0);
  });

  it("zero current never produces a resistance (division by zero is unresolved, not Infinity)", () => {
    const r = solveDcCircuit({ V: 50, I: 0 }, "R");
    expect(r.ok).toBe(false);
  });

  it("negative resistance is rejected as invalid input, not silently computed", () => {
    const r = solveDcCircuit({ I: 2, R: -5 }, "V");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reasonKey).toBe("invalidInput");
  });

  it("zero resistance is a valid physical state (short circuit) and is accepted", () => {
    const r = solveDcCircuit({ I: 2, R: 0 }, "V");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeCloseTo(0);
  });
});

describe("solveAcPower — single/three-phase power triangle", () => {
  it("1φ: S from V,I", () => {
    const r = solveAcPower({ V: 200, I: 30 }, "S", "single");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeCloseTo(6, 3); // 200*30/1000
  });

  it("3φ: S from V,I uses √3", () => {
    const r = solveAcPower({ V: 200, I: 30 }, "S", "three");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeCloseTo((Math.sqrt(3) * 200 * 30) / 1000, 3);
  });

  it("3φ: reverse — I from S,V", () => {
    const s = (Math.sqrt(3) * 200 * 30) / 1000;
    const r = solveAcPower({ S: s, V: 200 }, "I", "three");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeCloseTo(30, 2);
  });

  it("PF=1: P equals S exactly, Q is zero", () => {
    const r1 = solveAcPower({ S: 10, pf: 1 }, "P", "single");
    expect(r1.ok).toBe(true);
    if (r1.ok) expect(r1.value).toBeCloseTo(10);

    const r2 = solveAcPower({ S: 10, P: 10 }, "Q", "single");
    expect(r2.ok).toBe(true);
    if (r2.ok) expect(r2.value).toBeCloseTo(0);
  });

  it("multi-hop chain: V,I,pf → S → P (three-phase)", () => {
    const r = solveAcPower({ V: 200, I: 30, pf: 0.85 }, "P", "three");
    expect(r.ok).toBe(true);
    if (r.ok) {
      const expectedS = (Math.sqrt(3) * 200 * 30) / 1000;
      expect(r.value).toBeCloseTo(expectedS * 0.85, 3);
    }
  });

  it("power triangle: P,Q → S → pf (multi-hop reverse)", () => {
    const r = solveAcPower({ P: 8, Q: 6 }, "pf", "single");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeCloseTo(0.8, 3); // S=10, pf=P/S=0.8
  });

  it("reports missing variables when nothing usable is known", () => {
    const r = solveAcPower({ V: 200 }, "P", "single");
    expect(r.ok).toBe(false);
  });
});

describe("solveAcPower — validation", () => {
  it("rejects pf > 1 explicitly, not a silently-clamped garbage result", () => {
    const r = solveAcPower({ S: 10, pf: 1.5 }, "P", "single");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reasonKey).toBe("invalidInput");
  });

  it("rejects pf = 0", () => {
    const r = solveAcPower({ S: 10, pf: 0 }, "P", "single");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reasonKey).toBe("invalidInput");
  });

  it("rejects P > S — physically impossible (P must be ≤ S), never silently floored to 0 under a sqrt", () => {
    const r = solveAcPower({ S: 5, P: 10 }, "Q", "single");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reasonKey).toBe("invalidInput");
  });

  it("rejects Q > S", () => {
    const r = solveAcPower({ S: 5, Q: 10 }, "P", "single");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reasonKey).toBe("invalidInput");
  });

  it("rejects a negative voltage", () => {
    const r = solveAcPower({ V: -200, I: 30 }, "S", "single");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reasonKey).toBe("invalidInput");
  });

  it("input values that mutually contradict each other are flagged inconsistent, not silently resolved", () => {
    // V,I directly imply S=6kVA (single-phase), but S=999 is also supplied.
    const r = solveAcPower({ V: 200, I: 30, S: 999 }, "P", "single");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reasonKey).toBe("inconsistentInput");
  });
});

describe("solveEfficiency", () => {
  it("η from input/output", () => {
    const r = solveEfficiency({ inputKw: 10, outputKw: 9 }, "eta");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeCloseTo(0.9);
  });

  it("reverse: output from input,η", () => {
    const r = solveEfficiency({ inputKw: 10, eta: 0.9 }, "outputKw");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeCloseTo(9);
  });

  it("reverse: input from output,η", () => {
    const r = solveEfficiency({ outputKw: 9, eta: 0.9 }, "inputKw");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeCloseTo(10);
  });

  it("rejects η > 1 — no real machine exceeds 100% efficiency", () => {
    const r = solveEfficiency({ inputKw: 10, eta: 1.2 }, "outputKw");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reasonKey).toBe("invalidInput");
  });

  it("rejects η = 0", () => {
    const r = solveEfficiency({ inputKw: 10, eta: 0 }, "outputKw");
    expect(r.ok).toBe(false);
  });

  it("rejects output exceeding input directly", () => {
    const r = solveEfficiency({ inputKw: 10, outputKw: 15 }, "eta");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reasonKey).toBe("invalidInput");
  });
});
