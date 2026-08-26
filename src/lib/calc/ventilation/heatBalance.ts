import { AVERAGE_INTERNAL_TEMP_C, type OutdoorSolarCondition, type VentilationAirCondition } from "./climateProfile";

export interface HeatSourceItem {
  name: string;
  heatW: number;
  /** 容量 (F列) — 実物のJSIA-T1016様式では自由記入の型式・容量表記 (例: "300kVA"、"50kVar")。任意。 */
  capacity?: string;
  /** 負荷率 % (H列) — 実物の様式にある入力欄。発熱量Wはこの値からの逆算ではなく引き続き直接入力(捏造しない)。任意。 */
  loadFactorPercent?: number | null;
}

/** 合計発熱量 Qc (W) — 盤内の全発熱機器の発熱量の単純合計。 */
export function sumHeatSourcesW(items: HeatSourceItem[]): number {
  return items.reduce((sum, item) => sum + item.heatW, 0);
}

export interface OutdoorSurfaceAreasM2 {
  roofM2: number; // SRO
  face1M2: number; // SSE
  face2M2: number; // SWS
  face3M2: number; // SNW
  face4M2: number; // SNE
}

export interface HeatTransmittance {
  /** 屋根/上面の総合熱貫流率 (W/m2・K) — URO または URi */
  roofWPerM2K: number;
  /** 側面の総合熱貫流率 (W/m2・K) — USO または USi */
  sideWPerM2K: number;
}

/**
 * 盤外面の放出熱流 QBO (W) — 屋外キュービクル。JSIA-T1016換気計算書の式:
 * QBO = URO(tt-to)SRO + USO(ti-to)ΣS側面 - URO・tSH・SRO - USO・Σ(相当外気温度×側面積)
 * 方位ごとの相当外気温度 (日射による熱負荷) を、周囲温度基準の熱貫流から
 * 差し引く形で表される。
 */
export function computeOutdoorNaturalHeatLossW(
  air: VentilationAirCondition,
  solar: OutdoorSolarCondition,
  u: HeatTransmittance,
  s: OutdoorSurfaceAreasM2,
): number {
  const sideTotalM2 = s.face1M2 + s.face2M2 + s.face3M2 + s.face4M2;
  const baseLoss =
    u.roofWPerM2K * (air.topTempC - air.ambientTempC) * s.roofM2 +
    u.sideWPerM2K * (AVERAGE_INTERNAL_TEMP_C - air.ambientTempC) * sideTotalM2;
  const solarAdjustment =
    u.roofWPerM2K * solar.roofC * s.roofM2 +
    u.sideWPerM2K *
      (solar.face1C * s.face1M2 + solar.face2C * s.face2M2 + solar.face3C * s.face3M2 + solar.face4C * s.face4M2);
  return baseLoss - solarAdjustment;
}

export interface IndoorDimensionsM {
  widthM: number; // W
  heightM: number; // H
  depthM: number; // D
}

export interface IndoorSurfaceAreasM2 {
  roofM2: number; // SRi
  sideM2: number; // SSi
}

/** 盤表面積 (屋内) — W×D(上面) と、側面4面 (W×H を2面、D×H を2面) の単純な箱形状。 */
export function computeIndoorSurfaceAreasM2(d: IndoorDimensionsM): IndoorSurfaceAreasM2 {
  return {
    roofM2: d.widthM * d.depthM,
    sideM2: 2 * (d.widthM * d.heightM) + 2 * (d.depthM * d.heightM),
  };
}

/**
 * 盤外面の放出熱流 QBi (W) — 屋内キュービクル。屋内は日射を考慮しないため
 * (共通条件)、屋外のような相当外気温度の補正項を持たない単純な熱貫流式。
 * QBi = URi(tt-to)SRi + USi(ti-to)SSi
 */
export function computeIndoorNaturalHeatLossW(
  air: VentilationAirCondition,
  u: HeatTransmittance,
  s: IndoorSurfaceAreasM2,
): number {
  return (
    u.roofWPerM2K * (air.topTempC - air.ambientTempC) * s.roofM2 +
    u.sideWPerM2K * (AVERAGE_INTERNAL_TEMP_C - air.ambientTempC) * s.sideM2
  );
}
