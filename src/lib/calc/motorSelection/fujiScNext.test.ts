import { describe, expect, it } from "vitest";
import { findFujiScNext } from "./fujiScNext";

describe("findFujiScNext", () => {
  it("returns the official Fuji 200 V direct data for 5.5 kW", () => {
    const result = findFujiScNext("direct", "200V", 5.5);
    expect(result).toMatchObject({
      ratedCurrentA: 21,
      startingCurrentA: 203,
      heatRange: "18～24 A",
      switchModel: "SW26XA-□◇T018",
    });
  });

  it("has aligned official rows for every supported method and voltage", () => {
    const supported = {
      direct: { "200V": [0.1, 0.2, 0.4, 0.75, 1.5, 2.2, 3.7, 5.5, 7.5, 11, 15], "400V": [0.1, 0.2, 0.4, 0.75, 1.5, 2.2, 3.7, 5.5, 7.5, 11, 15, 18.5, 22, 30] },
      starDelta: { "200V": [5.5, 7.5, 11, 15, 18.5, 22], "400V": [5.5, 7.5, 11, 15, 18.5, 22, 30, 37, 45, 55] },
    } as const;
    for (const [method, voltages] of Object.entries(supported)) {
      for (const [voltage, values] of Object.entries(voltages)) {
        for (const kw of values) {
          const result = findFujiScNext(method as "direct" | "starDelta", voltage as "200V" | "400V", kw);
          expect(result, `${method} ${voltage} ${kw} kW`).not.toBeNull();
          expect(result?.ratedCurrentA).toBeGreaterThan(0);
          expect(result?.heatRange).toMatch(/～/);
          expect(result?.mccb?.[0]).toBeTruthy();
          expect(result?.elcb?.[0]).toBeTruthy();
        }
      }
    }
  });

  it("falls back to the official MS scale for loads outside SC-NEXT", () => {
    expect(findFujiScNext("direct", "200V", 18.5)).toMatchObject({
      ratedCurrentA: 68,
      startingCurrentA: 548,
      heatRange: "53～80 A",
      switchModel: "SW-N4 ｼｭｶｲﾛ AC200V 18.5kW",
      catalog: "MSスケール",
    });
  });
});
