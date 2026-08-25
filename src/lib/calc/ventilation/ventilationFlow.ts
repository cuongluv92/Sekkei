import { AVERAGE_INTERNAL_TEMP_C, GRAVITY_M_PER_S2, type VentilationAirCondition } from "./climateProfile";

/**
 * JSIA-T1016換気計算書の標準値。フィルタ無しの場合、給排気口の流量係数
 * αi・αoは換気口抵抗係数から計算せず、この標準値をそのまま使う (計算書の
 * 全例で共通して0.65) — フィルタを付けた場合のみ、換気口抵抗係数ζCと
 * フィルタ抵抗係数ζFを合成した別の式 (1/√(ζC+ζF)) に切り替わる。
 */
export const DEFAULT_DISCHARGE_COEFFICIENT_NO_FILTER = 0.65;
/** 換気口抵抗係数 ζC の標準値 (フィルタを付けた場合の合成計算でのみ使用)。 */
export const DEFAULT_VENT_RESISTANCE_COEFFICIENT = 2.5;

/** 給排気口の抵抗係数合計 ΣζC(+ζF) — フィルタなしなら換気口抵抗係数のみ。静圧計算でのみ使用。 */
export function computeTotalResistanceCoefficient(
  ventResistanceCoefficient: number,
  filterResistanceCoefficient: number | null,
): number {
  return ventResistanceCoefficient + (filterResistanceCoefficient ?? 0);
}

/**
 * 流量係数 α。フィルタが無ければ標準値 (既定0.65) をそのまま使う。フィルタを
 * 付けた場合のみ α = 1/√(ζC+ζF) に切り替わる (ζC・ζFを合成できるのはζ表示
 * のときだけのため、フィルタ無しの標準値0.65とは別の値になる — 1/√2.5≈0.633
 * ではなく0.65である点に注意)。
 */
export function computeDischargeCoefficient(
  noFilterDischargeCoefficient: number,
  ventResistanceCoefficient: number,
  filterResistanceCoefficient: number | null,
): number {
  if (filterResistanceCoefficient == null) return noFilterDischargeCoefficient;
  return 1 / Math.sqrt(computeTotalResistanceCoefficient(ventResistanceCoefficient, filterResistanceCoefficient));
}

/**
 * 実効換気口面積 αxAx (m2) — 給気口・排気口を直列とみなした合成有効面積。
 * JSIA-T1016換気計算書の式そのまま:
 * αxAx = 1 / √( (1/(α・Ai))² + (1/(α・Ao))²・(273+tt)/(273+to) )
 *
 * (273+tt)/(273+to) は固定定数ではなく、地域・盤形式ごとの tt・to から
 * 都度計算する値 ── 以前は東京の使用例 (tt=49, to=31 → 322/304) の数値を
 * そのまま固定定数として実装していたが、別の実在計算書 (動力制御盤・計装盤
 * 用キュービクル, tt=50, to=29.9) で式が「(273+tt)/(273+to)」という一般形で
 * 明記されているのを確認し、地域ごとに正しく計算し直すよう修正した。
 */
export function computeEffectiveVentAreaM2(
  dischargeCoefficient: number,
  effectiveSupplyAreaM2: number,
  effectiveExhaustAreaM2: number,
  topTempC: number,
  ambientTempC: number,
): number {
  const supplyTerm = 1 / (dischargeCoefficient * effectiveSupplyAreaM2);
  const exhaustTerm = 1 / (dischargeCoefficient * effectiveExhaustAreaM2);
  const tempRatio = (273 + topTempC) / (273 + ambientTempC);
  return 1 / Math.sqrt(supplyTerm ** 2 + exhaustTerm ** 2 * tempRatio);
}

/**
 * 自然換気放熱量 QV (W) — 温度差(重力)換気による除熱量。
 * QV = CP・ρE・αxAx・√(2gh(ti-to)/(273+ti))・(tt-to)・10³
 */
export function computeNaturalVentilationHeatRemovalW(
  air: VentilationAirCondition,
  effectiveVentAreaM2: number,
  heightDiffM: number,
): number {
  const ti = AVERAGE_INTERNAL_TEMP_C;
  const stackVelocityTerm = Math.sqrt(
    (2 * GRAVITY_M_PER_S2 * heightDiffM * (ti - air.ambientTempC)) / (273 + ti),
  );
  return air.airSpecificHeatKjPerKgK * air.airDensityKgPerM3 * effectiveVentAreaM2 * stackVelocityTerm *
    (air.topTempC - air.ambientTempC) * 1000;
}

export interface VentilationJudgement {
  totalHeatGainW: number;
  naturalHeatRemovalW: number;
  /** true = 自然換気のみで盤内温度が40℃以下に保たれる。false = 強制換気が必要。 */
  sufficient: boolean;
}

/** 換気熱量の判定 — QC ≦ [QBO(またはQBi)+QV] なら自然換気で足りる。 */
export function judgeNaturalVentilation(
  totalHeatGainW: number,
  naturalHeatLossW: number,
  naturalVentilationHeatRemovalW: number,
): VentilationJudgement {
  const naturalHeatRemovalW = naturalHeatLossW + naturalVentilationHeatRemovalW;
  return { totalHeatGainW, naturalHeatRemovalW, sufficient: totalHeatGainW <= naturalHeatRemovalW };
}

/**
 * 強制換気の必要風量 WK (m3/h)。
 * WK = 3.6・(QC-(QBO+QV)) / (CP・ρE・(ti-to)・X)
 */
export function computeRequiredForcedAirflowM3PerH(
  air: VentilationAirCondition,
  totalHeatGainW: number,
  naturalHeatLossW: number,
  naturalVentilationHeatRemovalW: number,
  hoodFlowCoefficientX: number,
): number {
  const ti = AVERAGE_INTERNAL_TEMP_C;
  const remainingHeatW = totalHeatGainW - naturalHeatLossW - naturalVentilationHeatRemovalW;
  return (3.6 * remainingHeatW) / (air.airSpecificHeatKjPerKgK * air.airDensityKgPerM3 * (ti - air.ambientTempC) * hoodFlowCoefficientX);
}

/** 強制換気の換気扇必要数 — ROUNDUP(必要風量/1台あたり風量, 0)。 */
export function computeFanCount(requiredAirflowM3PerH: number, fanCapacityM3PerHPerUnit: number): number {
  return Math.ceil(requiredAirflowM3PerH / fanCapacityM3PerHPerUnit);
}

/** 換気扇の能力確認用の静圧 P (Pa) = Σζ・(ρE/2)・(F/(Ai・3600))² — 選定した換気扇1台の風量Fで、有効給気口面積Aiを通過させた時の圧力損失。 */
export function computeStaticPressurePa(
  air: VentilationAirCondition,
  totalResistanceCoefficient: number,
  fanCapacityM3PerHPerUnit: number,
  effectiveSupplyAreaM2: number,
): number {
  return (
    totalResistanceCoefficient *
    (air.airDensityKgPerM3 / 2) *
    (fanCapacityM3PerHPerUnit / (effectiveSupplyAreaM2 * 3600)) ** 2
  );
}

/** フィルタを介して有効給気口面積を通過できる最大風量 (m3/h) = フィルタの標準風速(カタログ値) × 有効給気口面積 × 3600。 */
export function computeFilterLimitedAirflowM3PerH(filterRatedVelocityMPerS: number, effectiveSupplyAreaM2: number): number {
  return filterRatedVelocityMPerS * effectiveSupplyAreaM2 * 3600;
}

/** フィルタの通過風量制限から決まる必要換気扇台数 — ROUNDUP(必要風量/フィルタ通過可能風量, 0)。 */
export function computeFilterLimitedFanCount(requiredAirflowM3PerH: number, filterLimitedAirflowM3PerH: number): number {
  return Math.ceil(requiredAirflowM3PerH / filterLimitedAirflowM3PerH);
}
