import { INDOOR_AIR_CONDITION } from "./climateProfile";
import {
  computeIndoorNaturalHeatLossW,
  computeIndoorSurfaceAreasM2,
  type HeatTransmittance,
  type IndoorDimensionsM,
} from "./heatBalance";
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

export interface IndoorVentilationInput {
  dimensions: IndoorDimensionsM; // W, H, D (製品図から)
  transmittance: HeatTransmittance; // URi, USi
  effectiveSupplyAreaM2: number;
  effectiveExhaustAreaM2: number;
  noFilterDischargeCoefficient: number;
  ventResistanceCoefficient: number;
  filterResistanceCoefficient: number | null;
  heightDiffM: number;
  hoodFlowCoefficientX: number;
  totalHeatGainW: number;
  fanCapacityM3PerHPerUnit: number | null;
  filterRatedVelocityMPerS: number | null;
}

export interface IndoorVentilationResult {
  roofAreaM2: number; // SRi
  sideAreaM2: number; // SSi
  naturalHeatLossW: number; // QBi
  dischargeCoefficient: number;
  effectiveVentAreaM2: number;
  naturalVentilationHeatRemovalW: number; // QV
  naturalVentilationSufficient: boolean;
  requiredForcedAirflowM3PerH: number | null;
  fanCount: number | null;
  staticPressurePa: number | null;
  perFanAirflowAtBaseCountM3PerH: number | null;
  filterLimitedFanCount: number | null;
  finalFanCount: number | null;
}

/**
 * JSIA-T1016:2019換気計算書「屋内キュービクルの換気計算」— 屋外と異なり
 * 「すべての地域で共通条件」(使用方法シートより) のため、気象条件は
 * INDOOR_AIR_CONDITION 定数を使い、地域選択を必要としない。
 */
export function computeIndoorVentilation(input: IndoorVentilationInput): IndoorVentilationResult {
  const { roofM2, sideM2 } = computeIndoorSurfaceAreasM2(input.dimensions);
  const naturalHeatLossW = computeIndoorNaturalHeatLossW(INDOOR_AIR_CONDITION, input.transmittance, {
    roofM2,
    sideM2,
  });

  const dischargeCoefficient = computeDischargeCoefficient(
    input.noFilterDischargeCoefficient,
    input.ventResistanceCoefficient,
    input.filterResistanceCoefficient,
  );
  const effectiveVentAreaM2 = computeEffectiveVentAreaM2(
    dischargeCoefficient,
    input.effectiveSupplyAreaM2,
    input.effectiveExhaustAreaM2,
    INDOOR_AIR_CONDITION.topTempC,
    INDOOR_AIR_CONDITION.ambientTempC,
  );
  const naturalVentilationHeatRemovalW = computeNaturalVentilationHeatRemovalW(
    INDOOR_AIR_CONDITION,
    effectiveVentAreaM2,
    input.heightDiffM,
  );

  const judgement = judgeNaturalVentilation(input.totalHeatGainW, naturalHeatLossW, naturalVentilationHeatRemovalW);

  const base = {
    roofAreaM2: roofM2,
    sideAreaM2: sideM2,
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
    INDOOR_AIR_CONDITION,
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
    INDOOR_AIR_CONDITION,
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
