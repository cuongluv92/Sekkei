/**
 * 耐震計算書（キュービクル） — 提供された実際の社内Excelツール
 * (キュービクル.xlsx、株式会社ニシナ製作所) に基づく。
 *
 * 重要: この計算は JSIA-T1018 5.1.1 (床、基礎据付けの場合＝自立形) とは
 * 別物であり、自立形・壁掛形と同じ式を流用できない。実際のExcelを行単位で
 * 確認したところ、以下の点が自立形/壁掛形と明確に異なっていた:
 *   - 単位が kN ではなく kgf のまま (盤総重量を ×9.8×0.001 で kN 換算しない)
 *   - 地域係数 Z の値・都道府県の割り振りが、自立形/壁掛形が使う昭55建告
 *     第1793号の表と異なる (例: 静岡=1.2 は他の表に存在しない値)
 *   - 設置階別係数 Ks が 1.5/1.0/0.6 (自立形/壁掛形は 1/0.6/0.4)
 *   - アンカーボルトの選定が「許容応力度(kN/mm2)」ではなく「ボルト1本
 *     当たりの許容荷重(kgf)」を表から直接引く方式
 * そのためこの表は JSIA-T1018 の一般表ではなく、このExcelツール固有の値
 * としてそのまま採用し、出典もそのように明記する (根拠不明な数値を標準の
 * 数値であるかのように偽装しない)。
 */

import type { BoltDiameter } from "@/lib/types";

/** 地域別 地震係数（Z） — キュービクル用Excel独自の表 (自立形/壁掛形の表とは異なる)。 */
export const CUBICLE_REGION_Z_TABLE: { z: number; prefectures: string[] }[] = [
  { z: 0.7, prefectures: ["沖縄"] },
  { z: 0.8, prefectures: ["鹿児島", "福岡", "長崎", "山口", "佐賀"] },
  {
    z: 0.9,
    prefectures: [
      "宮崎", "愛媛", "徳島", "島根", "富山", "山形",
      "熊本", "高知", "広島", "鳥取", "福島", "秋田",
      "大分", "香川", "岡山", "石川", "新潟", "青森",
    ],
  },
  { z: 1.2, prefectures: ["静岡"] },
  { z: 1.0, prefectures: [] }, // その他 — 上記に無い都道府県はすべてここ
];

export const CUBICLE_DEFAULT_Z = 1.0; // その他

export function lookupCubicleRegionZ(prefecture: string): number {
  const found = CUBICLE_REGION_Z_TABLE.find((row) => row.prefectures.includes(prefecture));
  return found ? found.z : CUBICLE_DEFAULT_Z;
}

/** 設置階別 垂直地震力（Ks） — キュービクル用Excel独自の表 (自立形/壁掛形の 1/0.6/0.4 とは異なる)。 */
export type CubicleInstallFloor = "upper" | "middle" | "ground";
export const CUBICLE_KS_TABLE: Record<CubicleInstallFloor, number> = {
  upper: 1.5, // 上層階・屋上・塔屋
  middle: 1.0, // 中間階
  ground: 0.6, // 地階・1階
};

/** Kh = Z × Ks */
export function computeCubicleHorizontalIntensity(z: number, ks: number): number {
  return z * ks;
}

export interface CubicleForces {
  fhKgf: number; // Fh = Kh × Wg
  fvKgf: number; // Fv = Fh / 2
}

/** Fh・Fv — 単位はこのシート内で一貫して kgf (kN換算しない)。 */
export function computeCubicleForces(kh: number, weightKgf: number): CubicleForces {
  const fhKgf = kh * weightKgf;
  return { fhKgf, fvKgf: fhKgf / 2 };
}

export interface CubicleGeometry {
  /** H — 盤重心高さ (mm)。 */
  centerOfGravityHeightMm: number;
  /** L — 左右方向アンカーピッチ (mm)。 */
  horizontalPitchMm: number;
  /** l — 前後方向アンカーピッチ (mm)。 */
  depthPitchMm: number;
  /** N — アンカー総数。 */
  totalBoltCount: number;
  /** Nt — 左右片側のアンカーボルト数。 */
  horizontalSideBoltCount: number;
  /** nt — 前後片側のアンカーボルト数。 */
  depthSideBoltCount: number;
}

export interface CubicleTensionResult {
  /** R1 — 左右方向に転倒した場合の引張力 (kgf/本)。 */
  tensionHorizontalKgf: number;
  /** R2 — 前後方向に転倒した場合の引張力 (kgf/本)。 */
  tensionDepthKgf: number;
  /** 不利な方向 (大きい方) の引張力 (kgf/本) — 以降の選定に使う値。 */
  tensionKgf: number;
  governingDirection: "horizontal" | "depth";
}

/**
 * R1＝Fh×H－（Wg－Fv）×Lg／（L×Nt）… 左右引張力
 * R2＝Fh×H－（Wg－Fv）×lg／（l×nt）… 前後引張力
 * Lg=L/2, lg=l/2 (実Excelの通り、盤重心は中心にあるものとして自動算出 —
 * 自立形のように重心オフセットを個別入力する項目はこのシートには無い)。
 * 転倒方向は不利な方 (値が大きい方) を採用する。
 */
export function computeCubicleAnchorTension(
  fhKgf: number,
  weightKgf: number,
  fvKgf: number,
  geometry: CubicleGeometry,
): CubicleTensionResult {
  const lgMm = geometry.horizontalPitchMm / 2;
  const lgDepthMm = geometry.depthPitchMm / 2;

  const tensionHorizontalKgf =
    (fhKgf * geometry.centerOfGravityHeightMm - (weightKgf - fvKgf) * lgMm) /
    (geometry.horizontalPitchMm * geometry.horizontalSideBoltCount);
  const tensionDepthKgf =
    (fhKgf * geometry.centerOfGravityHeightMm - (weightKgf - fvKgf) * lgDepthMm) /
    (geometry.depthPitchMm * geometry.depthSideBoltCount);

  const governingDirection: "horizontal" | "depth" =
    tensionHorizontalKgf >= tensionDepthKgf ? "horizontal" : "depth";

  return {
    tensionHorizontalKgf,
    tensionDepthKgf,
    tensionKgf: Math.max(tensionHorizontalKgf, tensionDepthKgf),
    governingDirection,
  };
}

/** Q＝Fh／N — 自立形と同じ単純平均 (壁掛形のような FH・(W+FV) の合成は無い)。 */
export function computeCubicleShear(fhKgf: number, totalBoltCount: number): number {
  return fhKgf / totalBoltCount;
}

const BOLT_ORDER: BoltDiameter[] = ["M8", "M10", "M12", "M16", "M20", "M24"];

/** ＜表Ａ-１＞ ボルト1本当りの短期荷重による引張力の許容値 (kgf)。 */
export const CUBICLE_ALLOWABLE_TENSION_KGF: Record<BoltDiameter, number> = {
  M8: 500,
  M10: 800,
  M12: 1200,
  M16: 2000,
  M20: 3200,
  M24: 4700,
};

/** ＜表Ａ-２＞ ボルト1本当りの短期荷重によるせん断力の許容値 (kgf)。 */
export const CUBICLE_ALLOWABLE_SHEAR_KGF: Record<BoltDiameter, number> = {
  M8: 900,
  M10: 1700,
  M12: 2000,
  M16: 3600,
  M20: 5600,
  M24: 8100,
};

export type CubicleAnchorMethod = "mechanical" | "chemical" | "lShape";
export const CUBICLE_ANCHOR_METHOD_LABEL: Record<CubicleAnchorMethod, string> = {
  mechanical: "おねじ形メカニカルアンカーボルト",
  chemical: "ケミカルアンカーボルト",
  lShape: "Ｌ形・ＬＡ形アンカーボルト",
};

export const CUBICLE_CONCRETE_THICKNESS_MM = [120, 150, 180, 200] as const;
export type CubicleConcreteThicknessMm = (typeof CUBICLE_CONCRETE_THICKNESS_MM)[number];

/**
 * ＜表Ｂ-１＞～＜表Ｂ-３＞ 施工方法別・コンクリート厚さ別の許容引抜荷重
 * (kgf)。"-" (施工不可) は null。 床スラブ上面施工のみ (実Excelに他の
 * 施工パターンは無い)。
 */
export const CUBICLE_PULLOUT_ALLOWABLE_KGF: Record<
  CubicleAnchorMethod,
  Record<BoltDiameter, Record<CubicleConcreteThicknessMm, number | null>>
> = {
  mechanical: {
    M8: { 120: 300, 150: 300, 180: 300, 200: 300 },
    M10: { 120: 380, 150: 380, 180: 380, 200: 380 },
    M12: { 120: 670, 150: 670, 180: 670, 200: 670 },
    M16: { 120: 920, 150: 920, 180: 920, 200: 920 },
    M20: { 120: 1200, 150: 1200, 180: 1200, 200: 1200 },
    M24: { 120: 1200, 150: 1200, 180: 1200, 200: 1200 },
  },
  chemical: {
    M8: { 120: null, 150: null, 180: null, 200: null },
    M10: { 120: 760, 150: 760, 180: 760, 200: 760 },
    M12: { 120: 920, 150: 920, 180: 920, 200: 920 },
    M16: { 120: null, 150: 1200, 180: 1200, 200: 1200 },
    M20: { 120: null, 150: null, 180: 1200, 200: 1200 },
    M24: { 120: null, 150: null, 180: null, 200: null },
  },
  lShape: {
    M8: { 120: 320, 150: 440, 180: 570, 200: 650 },
    M10: { 120: 400, 150: 550, 180: 710, 200: 810 },
    M12: { 120: 480, 150: 670, 180: 850, 200: 970 },
    M16: { 120: null, 150: 890, 180: 1140, 200: 1200 },
    M20: { 120: null, 150: null, 180: 1200, 200: 1200 },
    M24: { 120: null, 150: null, 180: null, 200: 1200 },
  },
};

/** 各表から、許容値が要求値以上となる最小径を選ぶ (全径で満たせなければ null)。 */
function selectMinBolt(requiredKgf: number, allowableByBolt: Partial<Record<BoltDiameter, number | null>>): BoltDiameter | null {
  for (const bolt of BOLT_ORDER) {
    const allowable = allowableByBolt[bolt];
    if (allowable != null && allowable >= requiredKgf) return bolt;
  }
  return null;
}

function boltIndex(bolt: BoltDiameter): number {
  return BOLT_ORDER.indexOf(bolt);
}

export interface CubicleBoltSelection {
  tensionBolt: BoltDiameter | null; // ＜表Ａ-１＞による選定
  shearBolt: BoltDiameter | null; // ＜表Ａ-２＞による選定
  pulloutBolt: BoltDiameter | null; // ＜表Ｂ-1/2/3＞による選定 (施工方法・コンクリート厚さ)
  /** 3条件すべてを満たす最小径 (3つのうち最大のものを採用)。いずれかが選定不能なら null。 */
  selectedBolt: BoltDiameter | null;
  /** 弊社推奨: M12 未満の場合は M12 に切り上げる (実Excelの注記通り)。 */
  recommendedBolt: BoltDiameter | null;
}

export function selectCubicleAnchorBolt(params: {
  tensionKgf: number;
  shearKgf: number;
  method: CubicleAnchorMethod;
  concreteThicknessMm: CubicleConcreteThicknessMm;
}): CubicleBoltSelection {
  const tensionBolt = selectMinBolt(params.tensionKgf, CUBICLE_ALLOWABLE_TENSION_KGF);
  const shearBolt = selectMinBolt(params.shearKgf, CUBICLE_ALLOWABLE_SHEAR_KGF);
  const pulloutTable: Partial<Record<BoltDiameter, number | null>> = {};
  for (const bolt of BOLT_ORDER) {
    pulloutTable[bolt] = CUBICLE_PULLOUT_ALLOWABLE_KGF[params.method][bolt][params.concreteThicknessMm];
  }
  const pulloutBolt = selectMinBolt(params.tensionKgf, pulloutTable);

  const candidates = [tensionBolt, shearBolt, pulloutBolt];
  const selectedBolt = candidates.every((b) => b !== null)
    ? candidates.reduce((max, b) => (boltIndex(b as BoltDiameter) > boltIndex(max as BoltDiameter) ? b : max))
    : null;

  // ※但し弊社では M12 以上の使用を推奨します。
  const recommendedBolt =
    selectedBolt === null ? null : boltIndex(selectedBolt) < boltIndex("M12") ? "M12" : selectedBolt;

  return { tensionBolt, shearBolt, pulloutBolt, selectedBolt, recommendedBolt };
}
