import { WEIGHT_SHAPES, type WeightDimKey, type WeightDims, type WeightShapeKey } from "./weightShapes";

/**
 * 盤重量計算 > 盤本体重量 — formulas confirmed against 盤重量計算.xlsx (4 sheets:
 * 鈑金屋根付/鈑金屋根無し/Nitto/部材) plus the user's own explicit corrections:
 *
 * - 箱体屋内 (no roof) needs BOTH top and bottom faces (×2); 箱体屋外 (with a
 *   separate 屋根 part) only needs the bottom (×1) since 屋根 covers the top.
 * - 屋根 is a 5-face, open-bottom shape: one top face (W×Droof) + 4 skirt
 *   faces (2×W×Hroof + 2×Droof×Hroof). Droof/Hroof are real drawing
 *   dimensions (D1 etc.) — never hard-coded (the Excel's `=50`/`D+50` are
 *   template shortcuts, not real constants).
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

/** 箱体屋内 = 背面1 + 側面2 + 天板・底板2 (屋根なしのため天地とも自前). */
export function boxBodyAreaIndoor(W: number, H: number, D: number): number {
  return W * H + 2 * D * H + 2 * W * D;
}

/** 箱体屋外 = 背面1 + 側面2 + 底板1 (天板は屋根が別途担当). */
export function boxBodyAreaOutdoor(W: number, H: number, D: number): number {
  return W * H + 2 * D * H + 1 * W * D;
}

/** 屋根 (5面, 底面なし) = 天板1 (W×Droof) + 側面4 (2×W×Hroof + 2×Droof×Hroof). */
export function roofArea(W: number, Droof: number, Hroof: number): number {
  return W * Droof + 2 * W * Hroof + 2 * Droof * Hroof;
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
