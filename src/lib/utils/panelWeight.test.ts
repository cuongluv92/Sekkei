import { describe, expect, it } from "vitest";
import {
  BOX_FACE_KEYS,
  boxFaceArea,
  busbarWeightKg,
  foldedPlateArea,
  roofArea,
  ROOF_FACE_KEYS,
  roofFaceArea,
  roofOverhangDepth,
  sheetWeightKg,
  woodWeightKg,
} from "./panelWeight";

describe("panelWeight formulas", () => {
  it("箱体: each face computed individually (前面は扉が別途担当のため対象外)", () => {
    const W = 600, H = 1000, D = 400;
    expect(boxFaceArea("back", W, H, D)).toBe(W * H);
    expect(boxFaceArea("top", W, H, D)).toBe(W * D);
    expect(boxFaceArea("bottom", W, H, D)).toBe(W * D);
    expect(boxFaceArea("left", W, H, D)).toBe(D * H);
    expect(boxFaceArea("right", W, H, D)).toBe(D * H);
  });

  it("箱体: summing all 5 faces matches the whole-box formula previously confirmed", () => {
    const W = 600, H = 1000, D = 400;
    const sumAllFaces = BOX_FACE_KEYS.reduce((sum, f) => sum + boxFaceArea(f, W, H, D), 0);
    // back(1) + top&bottom(2) + sides(2) — 屋内盤 (no separate 屋根) whole-box total
    expect(sumAllFaces).toBe(W * H + 2 * W * D + 2 * D * H);
    // excluding "top" (typical 屋外盤 with a separate 屋根 covering the top) drops exactly one W×D face
    const withoutTop = BOX_FACE_KEYS.filter((f) => f !== "top").reduce(
      (sum, f) => sum + boxFaceArea(f, W, H, D),
      0,
    );
    expect(sumAllFaces - withoutTop).toBe(W * D);
  });

  it("箱体: 左側面/右側面 の開口 (連結盤の隣接面) は D×H から開口幅×開口高さを差し引く", () => {
    const W = 600, H = 1000, D = 400;
    const opening = { W: 150, H: 300 };
    expect(boxFaceArea("left", W, H, D, opening)).toBe(D * H - opening.W * opening.H);
    expect(boxFaceArea("right", W, H, D, opening)).toBe(D * H - opening.W * opening.H);
    // 開口が面より大きい場合でも負にはならない
    expect(boxFaceArea("left", W, H, D, { W: 9999, H: 9999 })).toBe(0);
    // 背面/天面/底面には開口の概念がない — 渡しても無視される
    expect(boxFaceArea("back", W, H, D, opening)).toBe(W * H);
  });

  it("屋根 (片流れ: 前H1低い/後H2高い): each face computed individually, summing to roofArea()", () => {
    const W = 600, Droof = 450, D = 400, H1 = 30, H2 = 70;
    expect(roofFaceArea("top", W, Droof, D, H1, H2)).toBe(W * Droof);
    expect(roofFaceArea("frontSkirt", W, Droof, D, H1, H2)).toBe(W * H1);
    expect(roofFaceArea("backSkirt", W, Droof, D, H1, H2)).toBe(W * H2);
    // 左右スカートは前後の高さが違う分の台形 — 平均高さ×奥行き
    expect(roofFaceArea("leftSkirt", W, Droof, D, H1, H2)).toBe(Droof * ((H1 + H2) / 2));
    expect(roofFaceArea("rightSkirt", W, Droof, D, H1, H2)).toBe(Droof * ((H1 + H2) / 2));
    // 張り出し下面 = 屋根が箱体の奥行きより前に出ている分 (Droof−D) × W
    expect(roofFaceArea("overhang", W, Droof, D, H1, H2)).toBe(W * (Droof - D));
    const sum = ROOF_FACE_KEYS.reduce((s, f) => s + roofFaceArea(f, W, Droof, D, H1, H2), 0);
    expect(sum).toBe(roofArea(W, Droof, D, H1, H2));
  });

  it("roofOverhangDepth: 屋根が箱体より奥行き短い/等しい場合は0 (負にならない)", () => {
    expect(roofOverhangDepth(450, 400)).toBe(50);
    expect(roofOverhangDepth(400, 400)).toBe(0);
    expect(roofOverhangDepth(350, 400)).toBe(0);
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
