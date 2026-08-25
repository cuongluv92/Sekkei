import { describe, expect, it } from "vitest";
import { computeOutdoorVentilation } from "./outdoorVentilation";

// End-to-end golden tests against the vendor 換気計算書 (JSIA-T1016:2019
// 準拠, JSIA HP掲載の使用例) — every numeric input below is transcribed
// directly from the workbook's own cells, and every expected output is the
// workbook's own live-computed result for that same cell.

const TOKYO_CLIMATE = { ambientTempC: 31, topTempC: 49, airSpecificHeatKjPerKgK: 1.024, airDensityKgPerM3: 1.146 };
const TOKYO_SOLAR = { roofC: 11.9, face1C: 3.2, face2C: 7.6, face3C: 4.6, face4C: 3 };
const NAHA_CLIMATE = { ambientTempC: 32, topTempC: 48, airSpecificHeatKjPerKgK: 1.025, airDensityKgPerM3: 1.141 };
const NAHA_SOLAR = { roofC: 13.4, face1C: 3.6, face2C: 5.8, face3C: 4.6, face4C: 3.5 };
const TRANSMITTANCE = { roofWPerM2K: 6.6, sideWPerM2K: 6.1 };
const SURFACE_AREAS = { roofM2: 7.5, face1M2: 5.39, face2M2: 7.35, face3M2: 5.39, face4M2: 7.05 };

describe("computeOutdoorVentilation — 東京・フィルタ無し", () => {
  it("matches the worked example end-to-end (forced ventilation required, 2 fans)", () => {
    const result = computeOutdoorVentilation({
      climate: TOKYO_CLIMATE,
      solar: TOKYO_SOLAR,
      transmittance: TRANSMITTANCE,
      surfaceAreas: SURFACE_AREAS,
      effectiveSupplyAreaM2: 0.168,
      effectiveExhaustAreaM2: 0.117,
      noFilterDischargeCoefficient: 0.65,
      ventResistanceCoefficient: 2.5,
      filterResistanceCoefficient: null,
      heightDiffM: 2.1,
      hoodFlowCoefficientX: 0.8,
      totalHeatGainW: 9791,
      fanCapacityM3PerHPerUnit: 1680,
      filterRatedVelocityMPerS: null,
    });

    expect(result.naturalHeatLossW).toBeCloseTo(958.1148, 3);
    expect(result.naturalVentilationHeatRemovalW).toBeCloseTo(1406.3325179468748, 3);
    expect(result.naturalVentilationSufficient).toBe(false);
    expect(result.requiredForcedAirflowM3PerH).toBeCloseTo(3164.263897717062, 3);
    expect(result.fanCount).toBe(2);
    expect(result.staticPressurePa).toBeCloseTo(11.053240740740739, 3);
    expect(result.perFanAirflowAtBaseCountM3PerH).toBeCloseTo(1582.131948858531, 3);
    expect(result.filterLimitedFanCount).toBeNull();
    expect(result.finalFanCount).toBe(2);
  });
});

describe("computeOutdoorVentilation — 東京・フィルタ有り", () => {
  it("matches the worked example end-to-end (4 fans, filter-limited count also 4)", () => {
    const result = computeOutdoorVentilation({
      climate: TOKYO_CLIMATE,
      solar: TOKYO_SOLAR,
      transmittance: TRANSMITTANCE,
      surfaceAreas: SURFACE_AREAS,
      effectiveSupplyAreaM2: 0.168,
      effectiveExhaustAreaM2: 0.117,
      noFilterDischargeCoefficient: 0.65,
      ventResistanceCoefficient: 2.5,
      filterResistanceCoefficient: 30,
      heightDiffM: 2.1,
      hoodFlowCoefficientX: 0.8,
      totalHeatGainW: 9791,
      fanCapacityM3PerHPerUnit: 1140,
      filterRatedVelocityMPerS: 1.5,
    });

    expect(result.naturalHeatLossW).toBeCloseTo(958.1148, 3);
    expect(result.naturalVentilationHeatRemovalW).toBeCloseTo(379.51852697770863, 3);
    expect(result.requiredForcedAirflowM3PerH).toBeCloseTo(3601.7630417204764, 3);
    expect(result.fanCount).toBe(4);
    expect(result.staticPressurePa).toBeCloseTo(66.16436070956158, 2);
    expect(result.filterLimitedFanCount).toBe(4);
    expect(result.finalFanCount).toBe(4);
  });
});

describe("computeOutdoorVentilation — 那覇・フィルタ有り", () => {
  it("matches the worked example end-to-end (60Hz region, 4 fans)", () => {
    const result = computeOutdoorVentilation({
      climate: NAHA_CLIMATE,
      solar: NAHA_SOLAR,
      transmittance: TRANSMITTANCE,
      surfaceAreas: SURFACE_AREAS,
      effectiveSupplyAreaM2: 0.168,
      effectiveExhaustAreaM2: 0.117,
      noFilterDischargeCoefficient: 0.65,
      ventResistanceCoefficient: 2.5,
      filterResistanceCoefficient: 30,
      heightDiffM: 2.1,
      hoodFlowCoefficientX: 0.8,
      totalHeatGainW: 9791,
      fanCapacityM3PerHPerUnit: 1140,
      filterRatedVelocityMPerS: 1.5,
    });

    expect(result.naturalHeatLossW).toBeCloseTo(677.3157, 3);
    expect(result.naturalVentilationHeatRemovalW).toBeCloseTo(316.9780092945867, 3);
    expect(result.requiredForcedAirflowM3PerH).toBeCloseTo(4230.903391138962, 2);
    expect(result.fanCount).toBe(4);
  });
});

describe("computeOutdoorVentilation — natural ventilation sufficient (no forced fields populated)", () => {
  it("returns null for every forced-ventilation field when QC <= QBO+QV", () => {
    const result = computeOutdoorVentilation({
      climate: TOKYO_CLIMATE,
      solar: TOKYO_SOLAR,
      transmittance: TRANSMITTANCE,
      surfaceAreas: SURFACE_AREAS,
      effectiveSupplyAreaM2: 0.168,
      effectiveExhaustAreaM2: 0.117,
      noFilterDischargeCoefficient: 0.65,
      ventResistanceCoefficient: 2.5,
      filterResistanceCoefficient: null,
      heightDiffM: 2.1,
      hoodFlowCoefficientX: 0.8,
      totalHeatGainW: 100, // artificially tiny heat load
      fanCapacityM3PerHPerUnit: 1680,
      filterRatedVelocityMPerS: null,
    });

    expect(result.naturalVentilationSufficient).toBe(true);
    expect(result.requiredForcedAirflowM3PerH).toBeNull();
    expect(result.fanCount).toBeNull();
    expect(result.finalFanCount).toBeNull();
  });
});
