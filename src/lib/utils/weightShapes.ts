/**
 * 重量計算 > 基本重量計算 shape definitions — アングル/チャンネル/フラットバー/ハット形
 * only, per the confirmed spec. Each shape's area formula is data here (not
 * hard-coded per-component), so WeightShapeCalcSection stays one generic
 * component instead of near-duplicates per shape. Do not add more shapes
 * without an explicit request — this list is deliberately closed for now.
 *
 * フラットバー is listed first per the confirmed display order (moved to the
 * front); ハット形 is a formed/bent sheet profile with one uniform thickness
 * (unlike アングル/チャンネル's solid t1/t2 flange+web), so its area is the
 * standard thin-wall "developed length × t" used for hat-channel sections,
 * not a solid cross-section with corner-overlap subtraction.
 */

export type WeightShapeKey = "flatBar" | "angle" | "channel" | "hat";
export type WeightDimKey = "W" | "H" | "t1" | "t2" | "W1" | "W2" | "t";

export type WeightDims = Record<WeightDimKey, number>;

export interface WeightShapeDef {
  key: WeightShapeKey;
  /** Which dimension inputs this shape actually shows, in display order. */
  fields: WeightDimKey[];
  /**
   * Outer width/height fields, shown on one row together with 長さL
   * (max 2 — e.g. W + H). flatBar has no separate height field (its "H" is
   * actually 厚さ), so flatBar's primaryFields is just ["W"].
   */
  primaryFields: WeightDimKey[];
  /**
   * Thickness-like fields, shown on their own row below. Covers flatBar's
   * H (its one field, semantically 厚さ not 高さ) and the t1/t2/t fields
   * of the other shapes.
   */
  secondaryFields: WeightDimKey[];
  /** mm² */
  computeArea: (v: WeightDims) => number;
  areaFormulaSymbolic: string;
  areaFormulaSubstituted: (v: WeightDims) => string;
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
}

export const WEIGHT_SHAPES: WeightShapeDef[] = [
  {
    key: "flatBar",
    fields: ["W", "H"],
    primaryFields: ["W"],
    secondaryFields: ["H"],
    areaFormulaSymbolic: "A = W × H",
    computeArea: (v) => v.W * v.H,
    areaFormulaSubstituted: (v) => `A = ${fmt(v.W)} × ${fmt(v.H)}`,
  },
  {
    key: "angle",
    fields: ["W", "H", "t1", "t2"],
    primaryFields: ["W", "H"],
    secondaryFields: ["t1", "t2"],
    areaFormulaSymbolic: "A = W × t1 + H × t2 − t1 × t2",
    computeArea: (v) => v.W * v.t1 + v.H * v.t2 - v.t1 * v.t2,
    areaFormulaSubstituted: (v) =>
      `A = ${fmt(v.W)} × ${fmt(v.t1)} + ${fmt(v.H)} × ${fmt(v.t2)} − ${fmt(v.t1)} × ${fmt(v.t2)}`,
  },
  {
    key: "channel",
    fields: ["W", "H", "t1", "t2"],
    primaryFields: ["W", "H"],
    secondaryFields: ["t1", "t2"],
    areaFormulaSymbolic: "A = 2 × W × t1 + (H − 2 × t1) × t2",
    computeArea: (v) => 2 * v.W * v.t1 + (v.H - 2 * v.t1) * v.t2,
    areaFormulaSubstituted: (v) =>
      `A = 2 × ${fmt(v.W)} × ${fmt(v.t1)} + (${fmt(v.H)} − 2 × ${fmt(v.t1)}) × ${fmt(v.t2)}`,
  },
  {
    key: "hat",
    fields: ["W1", "W2", "H", "t"],
    primaryFields: ["W1", "H"],
    secondaryFields: ["W2", "t"],
    areaFormulaSymbolic: "A = t × (W1 + 2 × W2 + 2 × H)",
    computeArea: (v) => v.t * (v.W1 + 2 * v.W2 + 2 * v.H),
    areaFormulaSubstituted: (v) =>
      `A = ${fmt(v.t)} × (${fmt(v.W1)} + 2 × ${fmt(v.W2)} + 2 × ${fmt(v.H)})`,
  },
];

export function getWeightShape(key: WeightShapeKey): WeightShapeDef {
  const shape = WEIGHT_SHAPES.find((s) => s.key === key);
  if (!shape) throw new Error(`unknown-weight-shape:${key}`);
  return shape;
}

/** A reference drawing for one shape (アングル/チャンネル/フラットバー/ハット形), stored in Supabase Storage. Never bundled in the app — see weightShapeImageService. */
export interface WeightShapeImage {
  id: string;
  shapeKey: WeightShapeKey;
  fileName: string;
  storagePath: string;
  uploadedAt: string;
}
