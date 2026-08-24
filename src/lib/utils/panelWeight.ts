import { WEIGHT_SHAPES, type WeightDimKey, type WeightDims, type WeightShapeKey } from "./weightShapes";

/**
 * 盤重量計算 > 盤本体重量 — formulas confirmed against 盤重量計算.xlsx (4 sheets:
 * 鈑金屋根付/鈑金屋根無し/Nitto/部材) plus the user's own explicit corrections:
 *
 * - 箱体 is broken into 5 individually toggleable named faces (背面/天面/底面/
 *   左側面/右側面 — 前面は 扉 が別途担当) rather than one lumped formula, per
 *   explicit request: real cabinets vary in which faces actually exist
 *   (e.g. some 屋外盤 have both a box top face AND a 屋根 above it, some have
 *   only 屋根 with no separate box top), so this is a manual per-face choice,
 *   not a fixed rule inferred from 屋内/屋外. Showing each face's own
 *   dimensions/area/weight lets the result be cross-checked face by face.
 * - 屋根 is a 5-face, open-bottom shape: one top face (W×Droof) + 4 skirt
 *   faces (2×W×Hroof + 2×Droof×Hroof), also broken out and shown face by
 *   face. Droof/Hroof are real drawing dimensions (D1 etc.) — never
 *   hard-coded (the Excel's `=50`/`D+50` are template shortcuts, not real
 *   constants).
 * - 扉/中板・基板/保護板/金具・パネル等 share one "folded sheet" shape: a flat
 *   face (W×H) plus 4 folded edges of depth T (2×T×H + 2×W×T). The Excel's
 *   基板 formula on the 鈑金屋根無し sheet (`=(...)*$G$4*$G$4`, thickness
 *   squared) is a copy-paste bug — every other row uses 比重×板厚, which is
 *   what this shares. 金具・パネル等 uses this same shape too (per explicit
 *   correction — NOT the Excel's asymmetric (1,1,2) variant).
 * - 銅帯 is bar stock, not a sheet shape: weight = W×L×t×比重/1e6 (no folding).
 * - 木材 is a flat board: weight = W×H×比重×t/1e6 (no folding).
 *
 * 基台(L50×50)/基台(C100×50)/ダクト are deliberately NOT implemented here —
 * out of scope for this round (see PanelWeightCalc.tsx placeholders).
 */

export type PanelLayerKey = "indoor" | "outdoor" | "nitto";
export const PANEL_LAYER_KEYS: PanelLayerKey[] = ["indoor", "outdoor", "nitto"];

/** Reference-drawing key — the layer keys plus the two part-specific drawings (扉/屋根) the image frame can also show. */
export type PanelImageKey = PanelLayerKey | "door" | "roof";
export const PANEL_IMAGE_KEYS: PanelImageKey[] = [
  "indoor",
  "outdoor",
  "nitto",
  "door",
  "roof",
];

const MM2_MM_DENSITY_TO_KG = 1_000_000;

/** 扉/中板・基板/保護板/金具・パネル等 — flat face + 4 folded edges of depth T. */
export function foldedPlateArea(W: number, H: number, T: number): number {
  return W * H + 2 * T * H + 2 * W * T;
}

/**
 * 箱体 — 面ごとに個別集計する (前面は 扉 が別途担当するため対象外):
 * 背面(W×H)・天面(W×D)・底面(W×D)・左側面(D×H)・右側面(D×H)。
 * どの面が実在するかは実物によって違う (屋外盤は天面が屋根と重複することが多いが、
 * 両方持つ盤も、屋根のみで天面を持たない盤もある) ため、面ごとに含める/含めないを
 * 選べるようにする — ここでは固定の組み合わせを決め打ちしない。
 */
export type BoxFaceKey = "back" | "top" | "bottom" | "left" | "right";
export const BOX_FACE_KEYS: BoxFaceKey[] = ["back", "top", "bottom", "left", "right"];

export function boxFaceArea(face: BoxFaceKey, W: number, H: number, D: number): number {
  switch (face) {
    case "back":
      return W * H;
    case "top":
    case "bottom":
      return W * D;
    case "left":
    case "right":
      return D * H;
  }
}

/** 屋根の各面 — 天面(W×Droof)・前スカート/後スカート(W×Hroof、各1)・左スカート/右スカート(Droof×Hroof、各1)。5面合計で roofArea() と一致する。 */
export type RoofFaceKey = "top" | "frontSkirt" | "backSkirt" | "leftSkirt" | "rightSkirt";
export const ROOF_FACE_KEYS: RoofFaceKey[] = ["top", "frontSkirt", "backSkirt", "leftSkirt", "rightSkirt"];

export function roofFaceArea(face: RoofFaceKey, W: number, Droof: number, Hroof: number): number {
  switch (face) {
    case "top":
      return W * Droof;
    case "frontSkirt":
    case "backSkirt":
      return W * Hroof;
    case "leftSkirt":
    case "rightSkirt":
      return Droof * Hroof;
  }
}

/** 屋根 (5面, 底面なし) = 天板1 (W×Droof) + 側面4 (2×W×Hroof + 2×Droof×Hroof). roofFaceArea() の5面合計と同じ。 */
export function roofArea(W: number, Droof: number, Hroof: number): number {
  return ROOF_FACE_KEYS.reduce((sum, face) => sum + roofFaceArea(face, W, Droof, Hroof), 0);
}

/** 銅帯 — 断面(W×t)×長さL×比重、板金と違い折り曲げなし。 */
export function busbarWeightKg(W: number, L: number, t: number, density: number): number {
  return (W * L * t * density) / MM2_MM_DENSITY_TO_KG;
}

/** 木材 — 平板 W×H×比重×t、折り曲げなし。 */
export function woodWeightKg(W: number, H: number, t: number, density: number): number {
  return (W * H * t * density) / MM2_MM_DENSITY_TO_KG;
}

/** 汎用: 面積(mm²) × 板厚(mm) × 比重(g/cm³) / 1e6 × 数量 = kg. */
export function sheetWeightKg(areaMm2: number, thicknessMm: number, density: number): number {
  return (areaMm2 * thicknessMm * density) / MM2_MM_DENSITY_TO_KG;
}

/** 追加部材 (アングル/Cチャンネル/フラットバー/ハット形) — 基本重量計算と同じ、既に確定済みの断面式を再利用。鈑金 (flat sheet) は折り曲げなしの平板として同じ関数群で扱う。 */
export const ADDITIONAL_SHAPE_KEYS: WeightShapeKey[] = WEIGHT_SHAPES.map((s) => s.key);
export type { WeightDimKey, WeightDims, WeightShapeKey };
