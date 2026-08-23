import { describe, expect, it } from "vitest";
import {
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
});
