import { describe, expect, it } from "vitest";
import {
  compareSyncSpeed,
  solveMotorPower,
  solveSlip,
  solveSyncSpeed,
} from "./motorFrequency";

describe("solveSyncSpeed — ns = 120f/p", () => {
  it("4極・50Hz → 1500 min⁻¹", () => {
    const r = solveSyncSpeed({ frequencyHz: 50, poles: 4 }, "nsRpm");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeCloseTo(1500);
  });

  it("4極・60Hz → 1800 min⁻¹", () => {
    const r = solveSyncSpeed({ frequencyHz: 60, poles: 4 }, "nsRpm");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeCloseTo(1800);
  });

  it("reverse: f from ns,poles", () => {
    const r = solveSyncSpeed({ nsRpm: 1500, poles: 4 }, "frequencyHz");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeCloseTo(50);
  });

  it("reverse: poles from ns,f", () => {
    const r = solveSyncSpeed({ nsRpm: 1500, frequencyHz: 50 }, "poles");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeCloseTo(4);
  });
});

describe("solveSlip", () => {
  it("s from ns,nr", () => {
    const r = solveSlip({ nsRpm: 1500, actualRpm: 1450 }, "slip");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeCloseTo((1500 - 1450) / 1500, 5);
  });

  it("reverse: nr from ns,s", () => {
    const r = solveSlip({ nsRpm: 1500, slip: 1 / 30 }, "actualRpm");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeCloseTo(1450, 0);
  });

  it("zero slip means actual rpm equals sync speed", () => {
    const r = solveSlip({ nsRpm: 1500, slip: 0 }, "actualRpm");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeCloseTo(1500);
  });
});

describe("solveMotorPower", () => {
  it("3φ: inputKw from voltage,current,pf", () => {
    const r = solveMotorPower({ voltage: 200, current: 100, pf: 0.85 }, "inputKw", "three");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeCloseTo((Math.sqrt(3) * 200 * 100 * 0.85) / 1000, 3);
  });

  it("1φ: current from inputKw,voltage,pf (reverse)", () => {
    const r = solveMotorPower({ inputKw: 17, voltage: 200, pf: 0.85 }, "current", "single");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeCloseTo((17 * 1000) / (200 * 0.85), 2);
  });

  it("multi-hop: outputKw,eta,voltage,pf → current (3φ)", () => {
    const r = solveMotorPower(
      { outputKw: 30, eta: 0.9, voltage: 200, pf: 0.85 },
      "current",
      "three",
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      const inputKw = 30 / 0.9;
      const expected = (inputKw * 1000) / (Math.sqrt(3) * 200 * 0.85);
      expect(r.value).toBeCloseTo(expected, 2);
    }
  });

  it("reports missing when underdetermined", () => {
    const r = solveMotorPower({ voltage: 200 }, "current", "three");
    expect(r.ok).toBe(false);
  });
});

describe("compareSyncSpeed — never claims real rpm scales 50/60", () => {
  it("returns ns at both frequencies for the same pole count", () => {
    const r = compareSyncSpeed(4);
    expect(r).not.toBeNull();
    if (r) {
      expect(r.ns50).toBeCloseTo(1500);
      expect(r.ns60).toBeCloseTo(1800);
      expect(r.note).toContain("すべり");
    }
  });

  it("returns null for invalid pole count", () => {
    expect(compareSyncSpeed(0)).toBeNull();
    expect(compareSyncSpeed(-4)).toBeNull();
  });
});
