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
 * - 屋根 (a mono-slope hood over the box, per explicit correction): a flat
 *   top (W×Droof) + a low front skirt H1 + a high back skirt H2 (front/back
 *   heights genuinely differ on a sloped roof, unlike the earlier shared-
 *   Hroof version) + left/right skirts as the trapezoid between H1 and H2
 *   running the roof's depth (Droof×(H1+H2)/2) + the overhang's underside
 *   — the horizontal strip where the roof extends past the box's own
 *   depth D, W×max(0,Droof−D). No longer individually toggleable (unlike
 *   箱体) — every real 屋根 has all of these, so a per-face on/off checkbox
 *   was needless complexity; the breakdown is still shown, just read-only.
 *   Droof/H1/H2 are real drawing dimensions — never hard-coded (the
 *   Excel's `=50`/`D+50` are template shortcuts, not real constants).
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
 *
 * 左側面/右側面は連結盤 (複数の盤を横に並べて設置) の場合、隣の盤と接する面が
 * ほぼ開口 (開口部) になっていることがある — ケーブル/母線を通すための開口で、
 * 実際に鈑金が残っているのは開口の周りの縁だけ。`opening` (開口の幅×高さ) を渡すと
 * D×H からその分を差し引く (負にはならない) — 他の面には適用しない。
 */
export type BoxFaceKey = "back" | "top" | "bottom" | "left" | "right";
export const BOX_FACE_KEYS: BoxFaceKey[] = ["back", "top", "bottom", "left", "right"];

export function boxFaceArea(
  face: BoxFaceKey,
  W: number,
  H: number,
  D: number,
  opening?: { W: number; H: number },
): number {
  switch (face) {
    case "back":
      return W * H;
    case "top":
    case "bottom":
      return W * D;
    case "left":
    case "right": {
      const full = D * H;
      if (!opening) return full;
      return Math.max(0, full - opening.W * opening.H);
    }
  }
}

/**
 * 屋根の各面 — 天面(W×Droof)・前スカート(W×H1、低い方)・後スカート(W×H2、高い方)・
 * 左右スカート(Droof×(H1+H2)/2、前後の高さが違う片流れ屋根の台形部分)・
 * 張り出し下面(W×max(0,Droof−D)、屋根が箱体の奥行きより前に出ている分の下面)。
 * 6面合計で roofArea() と一致する。
 */
export type RoofFaceKey = "top" | "frontSkirt" | "backSkirt" | "leftSkirt" | "rightSkirt" | "overhang";
export const ROOF_FACE_KEYS: RoofFaceKey[] = [
  "top",
  "frontSkirt",
  "backSkirt",
  "leftSkirt",
  "rightSkirt",
  "overhang",
];

/** 屋根が箱体の奥行きより前にどれだけ出ているか (負にはならない)。 */
export function roofOverhangDepth(Droof: number, D: number): number {
  return Math.max(0, Droof - D);
}

export function roofFaceArea(
  face: RoofFaceKey,
  W: number,
  Droof: number,
  D: number,
  H1: number,
  H2: number,
): number {
  switch (face) {
    case "top":
      return W * Droof;
    case "frontSkirt":
      return W * H1;
    case "backSkirt":
      return W * H2;
    case "leftSkirt":
    case "rightSkirt":
      return Droof * ((H1 + H2) / 2);
    case "overhang":
      return W * roofOverhangDepth(Droof, D);
  }
}

/** 屋根 (6面) = roofFaceArea() の6面合計と同じ。 */
export function roofArea(W: number, Droof: number, D: number, H1: number, H2: number): number {
  return ROOF_FACE_KEYS.reduce((sum, face) => sum + roofFaceArea(face, W, Droof, D, H1, H2), 0);
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
