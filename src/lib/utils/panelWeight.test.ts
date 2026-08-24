import { describe, expect, it } from "vitest";
import {
  boxBodyAreaIndoor,
  boxBodyAreaOutdoor,
  busbarWeightKg,
  foldedPlateArea,
  roofArea,
  sheetWeightKg,
  woodWeightKg,
} from "./panelWeight";

describe("panelWeight formulas", () => {
  it("箱体屋内: back(1) + sides(2) + top&bottom(2)", () => {
    // W=600,H=1000,D=400 -> 600*1000 + 2*400*1000 + 2*600*400
    expect(boxBodyAreaIndoor(600, 1000, 400)).toBe(600 * 1000 + 2 * 400 * 1000 + 2 * 600 * 400);
  });

  it("箱体屋外: back(1) + sides(2) + bottom only(1)", () => {
    expect(boxBodyAreaOutdoor(600, 1000, 400)).toBe(600 * 1000 + 2 * 400 * 1000 + 1 * 600 * 400);
    // outdoor must be smaller than indoor by exactly one W×D face (the top the roof covers)
    expect(boxBodyAreaIndoor(600, 1000, 400) - boxBodyAreaOutdoor(600, 1000, 400)).toBe(600 * 400);
  });

  it("屋根: 5-face open-bottom shape (top + 4 skirt faces)", () => {
    // W=600, Droof=450, Hroof=50
    const expected = 600 * 450 + 2 * 600 * 50 + 2 * 450 * 50;
    expect(roofArea(600, 450, 50)).toBe(expected);
  });

  it("扉/中板・基板/保護板/金具・パネル等: folded plate matches user's given door formula A = W×H + 2×T×H + 2×W×T", () => {
    const W = 600, H = 1000, T = 40;
    expect(foldedPlateArea(W, H, T)).toBe(W * H + 2 * T * H + 2 * W * T);
  });

  it("銅帯: bar stock, no folding — W×L×t×density/1e6", () => {
    const kg = busbarWeightKg(15, 150, 3, 8.94);
    expect(kg).toBeCloseTo((15 * 150 * 3 * 8.94) / 1_000_000, 10);
  });

  it("木材: flat board, no folding — W×H×t×density/1e6", () => {
    const kg = woodWeightKg(600, 400, 21, 0.4);
    expect(kg).toBeCloseTo((600 * 400 * 21 * 0.4) / 1_000_000, 10);
  });

  it("sheetWeightKg: generic area×thickness×density/1e6 unit conversion", () => {
    // 1 m² (1,000,000 mm²) of 1mm-thick steel (density 7.87) should weigh 7.87 kg
    expect(sheetWeightKg(1_000_000, 1, 7.87)).toBeCloseTo(7.87, 10);
  });
});
