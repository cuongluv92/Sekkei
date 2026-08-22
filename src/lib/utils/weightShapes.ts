/**
 * 重量計算 > 基本重量計算 shape definitions — アングル/チャンネル/フラットバー only, per
 * the confirmed spec. Each shape's area formula is data here (not hard-coded
 * per-component), so WeightShapeCalcSection stays one generic component
 * instead of three near-duplicates. Do not add more shapes without an
 * explicit request — this list is deliberately closed for now.
 */

export type WeightShapeKey = "angle" | "channel" | "flatBar";
export type WeightDimKey = "W" | "H" | "t1" | "t2";

export type WeightDims = Record<WeightDimKey, number>;

export interface WeightShapeDef {
  key: WeightShapeKey;
  /** Which dimension inputs this shape actually shows, in display order. */
  fields: WeightDimKey[];
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
    key: "angle",
    fields: ["W", "H", "t1", "t2"],
    areaFormulaSymbolic: "A = W × t1 + H × t2 − t1 × t2",
    computeArea: (v) => v.W * v.t1 + v.H * v.t2 - v.t1 * v.t2,
    areaFormulaSubstituted: (v) =>
      `A = ${fmt(v.W)} × ${fmt(v.t1)} + ${fmt(v.H)} × ${fmt(v.t2)} − ${fmt(v.t1)} × ${fmt(v.t2)}`,
  },
  {
    key: "channel",
    fields: ["W", "H", "t1", "t2"],
    areaFormulaSymbolic: "A = 2 × W × t1 + (H − 2 × t1) × t2",
    computeArea: (v) => 2 * v.W * v.t1 + (v.H - 2 * v.t1) * v.t2,
    areaFormulaSubstituted: (v) =>
      `A = 2 × ${fmt(v.W)} × ${fmt(v.t1)} + (${fmt(v.H)} − 2 × ${fmt(v.t1)}) × ${fmt(v.t2)}`,
  },
  {
    key: "flatBar",
    fields: ["W", "H"],
    areaFormulaSymbolic: "A = W × H",
    computeArea: (v) => v.W * v.H,
    areaFormulaSubstituted: (v) => `A = ${fmt(v.W)} × ${fmt(v.H)}`,
  },
];

export function getWeightShape(key: WeightShapeKey): WeightShapeDef {
  const shape = WEIGHT_SHAPES.find((s) => s.key === key);
  if (!shape) throw new Error(`unknown-weight-shape:${key}`);
  return shape;
}

/** A reference drawing for one shape (アングル/チャンネル/フラットバー), stored in Supabase Storage. Never bundled in the app — see weightShapeImageService. */
export interface WeightShapeImage {
  id: string;
  shapeKey: WeightShapeKey;
  fileName: string;
  storagePath: string;
  uploadedAt: string;
}
