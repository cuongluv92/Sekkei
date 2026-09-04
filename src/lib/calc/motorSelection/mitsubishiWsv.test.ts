import { describe, expect, it } from "vitest";
import { findMitsubishiWsv } from "./mitsubishiWsv";

describe("findMitsubishiWsv", () => {
  it("returns Mitsubishi table 4-11 values for 200 V 5.5 kW direct", () => {
    expect(findMitsubishiWsv("direct", "200V", 5.5)).toEqual({
      ratedCurrentA: 22.3,
      heaterA: 22,
      contactorFrame: "T25～T65",
      startingMultiplier: 12,
      startingConditionA: 267.6,
    });
  });

  it("covers every registered load at both voltages", () => {
    for (const voltage of ["200V", "400V"] as const) {
      for (const kw of [0.75, 1.5, 2.2, 3.7, 5.5, 7.5, 11, 15, 18.5, 22, 30, 37, 45, 55]) {
        expect(findMitsubishiWsv("direct", voltage, kw), `${voltage} ${kw} kW`).not.toBeNull();
        if (kw >= 5.5) expect(findMitsubishiWsv("starDelta", voltage, kw), `${voltage} Y-Δ ${kw} kW`).not.toBeNull();
      }
    }
  });
});
