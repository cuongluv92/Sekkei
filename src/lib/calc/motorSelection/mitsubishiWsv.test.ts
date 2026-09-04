import { describe, expect, it } from "vitest";
import { findMitsubishiWsv } from "./mitsubishiWsv";

describe("findMitsubishiWsv", () => {
  it("returns Mitsubishi table 4-11 values for 200 V 5.5 kW direct", () => {
    expect(findMitsubishiWsv("direct", "200V", 5.5)).toMatchObject({
      ratedCurrentA: 22.3,
      heaterA: 22,
      contactorFrame: "T25～T65",
      startingMultiplier: 12,
      startingConditionA: 267.6,
      heaterRange: "18～26",
      starterModel: "MSO-T25",
      contactorModel: "S-T25",
      thermalModel: "TH-T25",
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

  it("returns complete equipment values for the reported 18.5 kW case", () => {
    expect(findMitsubishiWsv("direct", "200V", 18.5)).toMatchObject({
      ratedCurrentA: 68.2,
      heaterA: 67,
      heaterRange: "54～80",
      contactorModel: "S-T80",
      starterModel: "MSO-T80",
      thermalModel: "TH-T100",
    });
  });

  it("returns individual Mitsubishi star-delta contactors", () => {
    expect(findMitsubishiWsv("starDelta", "200V", 18.5)).toMatchObject({
      mainContactor: "S-T50",
      starContactor: "S-T35",
      deltaContactor: "S-T50",
      thermalModel: "TH-N120",
    });
  });
});
