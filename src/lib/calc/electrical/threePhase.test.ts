import { describe, expect, it } from "vitest";
import { solveThreePhaseConnection } from "./threePhase";

describe("solveThreePhaseConnection — Y結線", () => {
  it("線間電圧 from 相電圧 (forward, √3 factor)", () => {
    const r = solveThreePhaseConnection({ phaseVoltage: 100 }, "lineVoltage", "Y");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeCloseTo(Math.sqrt(3) * 100, 5);
  });

  it("相電圧 from 線間電圧 (reverse)", () => {
    const r = solveThreePhaseConnection(
      { lineVoltage: Math.sqrt(3) * 100 },
      "phaseVoltage",
      "Y",
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeCloseTo(100, 5);
  });

  it("線電流 = 相電流 (no √3 on current)", () => {
    const r = solveThreePhaseConnection({ phaseCurrent: 30 }, "lineCurrent", "Y");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeCloseTo(30, 5);
  });
});

describe("solveThreePhaseConnection — Δ結線", () => {
  it("線間電圧 = 相電圧 (no √3 on voltage)", () => {
    const r = solveThreePhaseConnection({ phaseVoltage: 200 }, "lineVoltage", "Delta");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeCloseTo(200, 5);
  });

  it("線電流 from 相電流 (forward, √3 factor)", () => {
    const r = solveThreePhaseConnection({ phaseCurrent: 30 }, "lineCurrent", "Delta");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeCloseTo(Math.sqrt(3) * 30, 5);
  });

  it("相電流 from 線電流 (reverse)", () => {
    const r = solveThreePhaseConnection(
      { lineCurrent: Math.sqrt(3) * 30 },
      "phaseCurrent",
      "Delta",
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeCloseTo(30, 5);
  });
});

describe("solveThreePhaseConnection — Y and Δ never mix", () => {
  it("the same 相電圧 input yields different 線間電圧 depending on connection", () => {
    const y = solveThreePhaseConnection({ phaseVoltage: 100 }, "lineVoltage", "Y");
    const d = solveThreePhaseConnection({ phaseVoltage: 100 }, "lineVoltage", "Delta");
    expect(y.ok && d.ok).toBe(true);
    if (y.ok && d.ok) expect(y.value).not.toBeCloseTo(d.value, 5);
  });

  it("current is unresolved when only a voltage variable is known", () => {
    const r = solveThreePhaseConnection({ phaseVoltage: 100 }, "lineCurrent", "Y");
    expect(r.ok).toBe(false);
  });
});
