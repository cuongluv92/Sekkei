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

  it("rejects an odd pole count — motor poles are always even", () => {
    const r = solveSyncSpeed({ frequencyHz: 50, poles: 3 }, "nsRpm");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reasonKey).toBe("invalidInput");
  });

  it("rejects a DERIVED odd pole count too — f=50,ns=1200 implies p=5, which is not a valid motor", () => {
    const r = solveSyncSpeed({ frequencyHz: 50, nsRpm: 1200 }, "poles");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reasonKey).toBe("invalidInput");
  });

  it("accepts a derived pole count that lands cleanly on an even integer (f=50,ns=1500 -> p=4)", () => {
    const r = solveSyncSpeed({ frequencyHz: 50, nsRpm: 1500 }, "poles");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeCloseTo(4, 6);
  });

  it("rejects a non-integer pole count", () => {
    const r = solveSyncSpeed({ frequencyHz: 50, poles: 4.5 }, "nsRpm");
    expect(r.ok).toBe(false);
  });

  it("rejects zero or negative frequency", () => {
    expect(solveSyncSpeed({ frequencyHz: 0, poles: 4 }, "nsRpm").ok).toBe(false);
    expect(solveSyncSpeed({ frequencyHz: -50, poles: 4 }, "nsRpm").ok).toBe(false);
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

  it("rejects a slip outside [0,1]", () => {
    expect(solveSlip({ nsRpm: 1500, slip: -0.1 }, "actualRpm").ok).toBe(false);
    expect(solveSlip({ nsRpm: 1500, slip: 1.1 }, "actualRpm").ok).toBe(false);
  });

  it("rejects an actual rpm that exceeds sync speed (impossible for a motoring induction motor)", () => {
    const r = solveSlip({ nsRpm: 1500, actualRpm: 1600 }, "slip");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reasonKey).toBe("invalidInput");
  });

  it("s=1 (locked rotor) is a valid boundary, not rejected", () => {
    const r = solveSlip({ nsRpm: 1500, slip: 1 }, "actualRpm");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeCloseTo(0);
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

  it("pf is solvable from inputKw,voltage,current (previously an unsolvable declared target)", () => {
    const r = solveMotorPower({ inputKw: 17, voltage: 200, current: 100 }, "pf", "single");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeCloseTo((17 * 1000) / (200 * 100), 6);
  });

  it("pf: 3φ variant uses √3", () => {
    const r = solveMotorPower(
      { inputKw: 11.7779456, voltage: 400, current: 20 },
      "pf",
      "three",
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeCloseTo(0.85, 3);
  });

  it("rejects a derived pf outside (0,1] instead of returning a physically impossible power factor", () => {
    // inputKw way too large for V*I to represent any real cosφ ≤ 1.
    const r = solveMotorPower({ inputKw: 100, voltage: 200, current: 10 }, "pf", "single");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reasonKey).toBe("invalidInput");
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

  it("pf=1 and η=1 (ideal case): outputKw exactly equals V×I/1000 with no losses", () => {
    const r = solveMotorPower({ voltage: 200, current: 100, pf: 1, eta: 1 }, "outputKw", "single");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeCloseTo((200 * 100) / 1000, 6); // 20 kW
  });

  it("rejects pf/eta outside (0,1]", () => {
    expect(solveMotorPower({ voltage: 200, current: 10, pf: 1.1 }, "inputKw", "three").ok).toBe(false);
    expect(solveMotorPower({ inputKw: 10, eta: 0 }, "outputKw", "three").ok).toBe(false);
  });

  it("rejects output power exceeding input power", () => {
    const r = solveMotorPower({ inputKw: 10, outputKw: 20 }, "eta", "three");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reasonKey).toBe("invalidInput");
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

  it("returns null for a non-even-integer pole count (odd or fractional)", () => {
    expect(compareSyncSpeed(5)).toBeNull();
    expect(compareSyncSpeed(3.5)).toBeNull();
  });
});
