/**
 * JSIA-T1016:2019「配電盤類の換気計算」準拠の気象条件。
 *
 * 盤内平均温度 ti は、換気計算書 (JSIA-T1016:2019準拠) のすべての使用例
 * (屋外東京/屋外那覇/屋内) で共通して 40℃ — JSIA-T1016 の設計目標値
 * (自然換気で盤内温度を40℃以下に保つ) そのもの。地域や盤形式で変わらない
 * ため定数として扱う。
 */
export const AVERAGE_INTERNAL_TEMP_C = 40;

const GRAVITY_M_PER_S2 = 9.8;
export { GRAVITY_M_PER_S2 };

export interface VentilationAirCondition {
  /** 周囲温度 to (℃) */
  ambientTempC: number;
  /** 上部温度 tt (℃) */
  topTempC: number;
  /** 空気の定圧比熱 CP (kJ/kg・K) */
  airSpecificHeatKjPerKgK: number;
  /** 空気の密度 ρE (kg/m3) */
  airDensityKgPerM3: number;
}

/** 方位別の相当外気温度 (℃) — 屋外キュービクルの日射による熱負荷を表す (屋内では使用しない)。 */
export interface OutdoorSolarCondition {
  roofC: number; // tSH (屋根/上面)
  face1C: number; // 側面1 (例: SE)
  face2C: number; // 側面2 (例: WS)
  face3C: number; // 側面3 (例: NW)
  face4C: number; // 側面4 (例: NE)
}

/**
 * 屋内キュービクルの設計気象条件 — JSIA-T1016換気計算書は「屋内キュービクルは、
 * すべての地域で共通条件」としており、地域による違いを持たない。したがって
 * 屋外のような地域別マスタではなく、エンジン定数として固定する。
 */
export const INDOOR_AIR_CONDITION: VentilationAirCondition = {
  ambientTempC: 30,
  topTempC: 50,
  airSpecificHeatKjPerKgK: 1.018,
  airDensityKgPerM3: 1.154,
};
