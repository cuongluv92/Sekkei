import type { OutdoorSolarCondition, VentilationAirCondition } from "./climateProfile";
import { computeOutdoorNaturalHeatLossW, type HeatTransmittance, type OutdoorSurfaceAreasM2 } from "./heatBalance";
import {
  computeDischargeCoefficient,
  computeEffectiveVentAreaM2,
  computeFanCount,
  computeFilterLimitedAirflowM3PerH,
  computeFilterLimitedFanCount,
  computeNaturalVentilationHeatRemovalW,
  computeRequiredForcedAirflowM3PerH,
  computeStaticPressurePa,
  computeTotalResistanceCoefficient,
  judgeNaturalVentilation,
} from "./ventilationFlow";

export interface OutdoorVentilationInput {
  climate: VentilationAirCondition; // to, tt, CP, ρE — 地域気象条件マスタから
  solar: OutdoorSolarCondition; // 方位別相当外気温度 — 同じく地域気象条件マスタから
  transmittance: HeatTransmittance; // URO, USO
  surfaceAreas: OutdoorSurfaceAreasM2; // SRO + 4面 (製品図から)
  effectiveSupplyAreaM2: number; // Ai (製品図から)
  effectiveExhaustAreaM2: number; // Ao (製品図から)
  noFilterDischargeCoefficient: number; // αi及びαo (フィルタ無し標準値、既定0.65)
  ventResistanceCoefficient: number; // ζC (換気口抵抗係数、既定2.5)
  filterResistanceCoefficient: number | null; // ζF (フィルタ有りのみ、カタログ値)
  heightDiffM: number; // h (給気口と排気口の高さの差)
  hoodFlowCoefficientX: number; // X (換気フードの流量係数、既定0.8)
  totalHeatGainW: number; // Qc
  fanCapacityM3PerHPerUnit: number | null; // 使用換気扇1台の風量 (カタログ値、強制換気が必要な場合のみ)
  filterRatedVelocityMPerS: number | null; // フィルタの標準風速 (カタログ値、フィルタ有りかつ強制換気が必要な場合のみ)
}

export interface OutdoorVentilationResult {
  naturalHeatLossW: number; // QBO
  dischargeCoefficient: number; // α
  effectiveVentAreaM2: number; // αxAx
  naturalVentilationHeatRemovalW: number; // QV
  naturalVentilationSufficient: boolean;
  requiredForcedAirflowM3PerH: number | null; // WK
  fanCount: number | null; // 5)の必要換気扇台数
  staticPressurePa: number | null; // 6)の静圧確認
  perFanAirflowAtBaseCountM3PerH: number | null; // 6)の風量F (WK/5)の台数)
  filterLimitedFanCount: number | null; // 7)のフィルタ通過風量からの必要台数
  finalFanCount: number | null; // 8)の使用換気扇台数 (5と7の多い方)
}

/** JSIA-T1016:2019換気計算書「屋外キュービクルの換気計算」を、盤形式共通の建物物理式に分解して実行する。 */
export function computeOutdoorVentilation(input: OutdoorVentilationInput): OutdoorVentilationResult {
  const naturalHeatLossW = computeOutdoorNaturalHeatLossW(input.climate, input.solar, input.transmittance, input.surfaceAreas);

  const dischargeCoefficient = computeDischargeCoefficient(
    input.noFilterDischargeCoefficient,
    input.ventResistanceCoefficient,
    input.filterResistanceCoefficient,
  );
  const effectiveVentAreaM2 = computeEffectiveVentAreaM2(
    dischargeCoefficient,
    input.effectiveSupplyAreaM2,
    input.effectiveExhaustAreaM2,
  );
  const naturalVentilationHeatRemovalW = computeNaturalVentilationHeatRemovalW(
    input.climate,
    effectiveVentAreaM2,
    input.heightDiffM,
  );

  const judgement = judgeNaturalVentilation(input.totalHeatGainW, naturalHeatLossW, naturalVentilationHeatRemovalW);

  const base = {
    naturalHeatLossW,
    dischargeCoefficient,
    effectiveVentAreaM2,
    naturalVentilationHeatRemovalW,
    naturalVentilationSufficient: judgement.sufficient,
  };

  if (judgement.sufficient) {
    return {
      ...base,
      requiredForcedAirflowM3PerH: null,
      fanCount: null,
      staticPressurePa: null,
      perFanAirflowAtBaseCountM3PerH: null,
      filterLimitedFanCount: null,
      finalFanCount: null,
    };
  }

  const requiredForcedAirflowM3PerH = computeRequiredForcedAirflowM3PerH(
    input.climate,
    input.totalHeatGainW,
    naturalHeatLossW,
    naturalVentilationHeatRemovalW,
    input.hoodFlowCoefficientX,
  );

  if (!input.fanCapacityM3PerHPerUnit || input.fanCapacityM3PerHPerUnit <= 0) {
    return {
      ...base,
      requiredForcedAirflowM3PerH,
      fanCount: null,
      staticPressurePa: null,
      perFanAirflowAtBaseCountM3PerH: null,
      filterLimitedFanCount: null,
      finalFanCount: null,
    };
  }

  const fanCount = computeFanCount(requiredForcedAirflowM3PerH, input.fanCapacityM3PerHPerUnit);
  const totalResistanceCoefficient = computeTotalResistanceCoefficient(
    input.ventResistanceCoefficient,
    input.filterResistanceCoefficient,
  );
  const staticPressurePa = computeStaticPressurePa(
    input.climate,
    totalResistanceCoefficient,
    input.fanCapacityM3PerHPerUnit,
    input.effectiveSupplyAreaM2,
  );
  const perFanAirflowAtBaseCountM3PerH = requiredForcedAirflowM3PerH / fanCount;

  let filterLimitedFanCount: number | null = null;
  if (input.filterResistanceCoefficient != null && input.filterRatedVelocityMPerS) {
    const filterLimitedAirflowM3PerH = computeFilterLimitedAirflowM3PerH(
      input.filterRatedVelocityMPerS,
      input.effectiveSupplyAreaM2,
    );
    filterLimitedFanCount = computeFilterLimitedFanCount(requiredForcedAirflowM3PerH, filterLimitedAirflowM3PerH);
  }
  const finalFanCount = filterLimitedFanCount != null ? Math.max(fanCount, filterLimitedFanCount) : fanCount;

  return {
    ...base,
    requiredForcedAirflowM3PerH,
    fanCount,
    staticPressurePa,
    perFanAirflowAtBaseCountM3PerH,
    filterLimitedFanCount,
    finalFanCount,
  };
}
