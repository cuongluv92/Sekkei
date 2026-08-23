import { describe, expect, it } from "vitest";
import {
  checkBreakingCapacity,
  SHORT_CIRCUIT_SIMPLIFIED_WARNING,
  solvePercentZBaseConversion,
  solveSimplifiedShortCircuit,
  solveTransformerRatedCurrent,
} from "./shortCircuit";

describe("solveTransformerRatedCurrent", () => {
  it("3φ: current from kva,voltage", () => {
    const r = solveTransformerRatedCurrent({ kva: 100, voltage: 200 }, "current", "three");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeCloseTo((100 * 1000) / (Math.sqrt(3) * 200), 3);
  });

  it("reverse: kva from current,voltage (1φ)", () => {
    const r = solveTransformerRatedCurrent({ current: 500, voltage: 200 }, "kva", "single");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeCloseTo(100, 3);
  });
});

describe("solveSimplifiedShortCircuit — Isc = In × 100 / %Z", () => {
  it("forward, and always carries the simplified-calc warning", () => {
    const r = solveSimplifiedShortCircuit({ ratedCurrentA: 500, percentZ: 5 }, "shortCircuitCurrentA");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value).toBeCloseTo(10000); // 500*100/5
      expect(r.warnings).toContain(SHORT_CIRCUIT_SIMPLIFIED_WARNING);
    }
  });

  it("reverse: %Z from In,Isc", () => {
    const r = solveSimplifiedShortCircuit({ ratedCurrentA: 500, shortCircuitCurrentA: 10000 }, "percentZ");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeCloseTo(5);
  });

  it("reverse: In from Isc,%Z", () => {
    const r = solveSimplifiedShortCircuit({ shortCircuitCurrentA: 10000, percentZ: 5 }, "ratedCurrentA");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeCloseTo(500);
  });

  it("never emits an ok/ng judgment field", () => {
    const r = solveSimplifiedShortCircuit({ ratedCurrentA: 500, percentZ: 5 }, "shortCircuitCurrentA");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(Object.keys(r)).not.toContain("judgment");
      expect(Object.keys(r)).not.toContain("breakingCapacityOk");
    }
  });

  it("percentZ of 0 is unresolved, never Infinity", () => {
    const r = solveSimplifiedShortCircuit({ ratedCurrentA: 500, percentZ: 0 }, "shortCircuitCurrentA");
    expect(r.ok).toBe(false);
  });
});

describe("solvePercentZBaseConversion", () => {
  it("forward: doubling the base capacity doubles %Z", () => {
    const r = solvePercentZBaseConversion(
      { percentZOld: 5, kvaOld: 100, kvaNew: 200 },
      "percentZNew",
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeCloseTo(10);
  });

  it("reverse: original %Z recovered from the converted value", () => {
    const r = solvePercentZBaseConversion(
      { percentZNew: 10, kvaOld: 100, kvaNew: 200 },
      "percentZOld",
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeCloseTo(5);
  });

  it("reverse: required kvaNew for a target %Z", () => {
    const r = solvePercentZBaseConversion(
      { percentZOld: 5, percentZNew: 10, kvaOld: 100 },
      "kvaNew",
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeCloseTo(200);
  });

  it("same base capacity leaves %Z unchanged", () => {
    const r = solvePercentZBaseConversion(
      { percentZOld: 5, kvaOld: 100, kvaNew: 100 },
      "percentZNew",
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeCloseTo(5);
  });

  it("rejects zero or negative %Z/kVA", () => {
    expect(
      solvePercentZBaseConversion({ percentZOld: 0, kvaOld: 100, kvaNew: 200 }, "percentZNew").ok,
    ).toBe(false);
  });
});

describe("shortCircuit — validation", () => {
  it("rejects zero or negative %Z (would imply an infinite fault current)", () => {
    const r = solveSimplifiedShortCircuit({ ratedCurrentA: 500, percentZ: 0 }, "shortCircuitCurrentA");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reasonKey).toBe("invalidInput");
  });

  it("rejects zero or negative rated current/voltage/capacity", () => {
    expect(solveTransformerRatedCurrent({ kva: 0, voltage: 200 }, "current", "three").ok).toBe(false);
    expect(solveTransformerRatedCurrent({ kva: 100, voltage: -200 }, "current", "three").ok).toBe(false);
  });

  it("flags a directly-given Isc that contradicts In and %Z", () => {
    const r = solveSimplifiedShortCircuit(
      { ratedCurrentA: 500, percentZ: 5, shortCircuitCurrentA: 1 },
      "shortCircuitCurrentA",
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reasonKey).toBe("inconsistentInput");
  });
});

describe("checkBreakingCapacity — pure arithmetic comparison against a user-supplied breaker rating", () => {
  it("sufficient when the breaker's rated breaking capacity meets or exceeds Isc", () => {
    const c = checkBreakingCapacity(2000, 2500);
    expect(c).not.toBeNull();
    expect(c?.sufficient).toBe(true);
    expect(c?.marginA).toBeCloseTo(500, 5);
  });

  it("insufficient when Isc exceeds the breaker's rated breaking capacity", () => {
    const c = checkBreakingCapacity(3000, 2500);
    expect(c?.sufficient).toBe(false);
    expect(c?.marginA).toBeCloseTo(-500, 5);
  });

  it("exactly equal is sufficient (inclusive)", () => {
    const c = checkBreakingCapacity(2500, 2500);
    expect(c?.sufficient).toBe(true);
    expect(c?.marginA).toBeCloseTo(0, 5);
  });

  it("rejects a non-positive breaker rating rather than fabricating a default", () => {
    expect(checkBreakingCapacity(1000, 0)).toBeNull();
    expect(checkBreakingCapacity(1000, -100)).toBeNull();
  });

  it("rejects a non-positive short-circuit current", () => {
    expect(checkBreakingCapacity(0, 2500)).toBeNull();
    expect(checkBreakingCapacity(-100, 2500)).toBeNull();
  });
});
