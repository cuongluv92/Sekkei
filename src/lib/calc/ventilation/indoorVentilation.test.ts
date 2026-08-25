import { describe, expect, it } from "vitest";
import { computeIndoorVentilation } from "./indoorVentilation";

// Golden values from the vendor 換気計算書 (JSIA-T1016:2019準拠, JSIA HP
// 掲載の使用例) — 屋内キュービクル シート.

describe("computeIndoorVentilation — フィルタ無し (natural ventilation is sufficient)", () => {
  it("matches the worked example end-to-end (QC < QBi+QV, no forced ventilation)", () => {
    const result = computeIndoorVentilation({
      dimensions: { widthM: 3, heightM: 2.35, depthM: 2.2 },
      transmittance: { roofWPerM2K: 4.6, sideWPerM2K: 4.1 },
      effectiveSupplyAreaM2: 0.797,
      effectiveExhaustAreaM2: 0.797,
      noFilterDischargeCoefficient: 0.65,
      ventResistanceCoefficient: 2.5,
      filterResistanceCoefficient: null,
      heightDiffM: 1.7,
      hoodFlowCoefficientX: 0.8,
      totalHeatGainW: 9791,
      fanCapacityM3PerHPerUnit: null,
      filterRatedVelocityMPerS: null,
    });

    expect(result.roofAreaM2).toBeCloseTo(6.6, 6);
    expect(result.sideAreaM2).toBeCloseTo(24.44, 6);
    expect(result.naturalHeatLossW).toBeCloseTo(1609.2400000000002, 2);
    expect(result.naturalVentilationHeatRemovalW).toBeCloseTo(8737.148873185093, 2);
    expect(result.naturalVentilationSufficient).toBe(true);
    expect(result.requiredForcedAirflowM3PerH).toBeNull();
    expect(result.finalFanCount).toBeNull();
  });
});

describe("computeIndoorVentilation — フィルタ有り (forced ventilation required, final count from the filter-check max rule)", () => {
  it("matches the worked example end-to-end (base count=2, filter-limited=1, final=max=2)", () => {
    const result = computeIndoorVentilation({
      dimensions: { widthM: 3, heightM: 2.35, depthM: 2.2 },
      transmittance: { roofWPerM2K: 4.6, sideWPerM2K: 4.1 },
      effectiveSupplyAreaM2: 0.797,
      effectiveExhaustAreaM2: 0.797,
      noFilterDischargeCoefficient: 0.65,
      ventResistanceCoefficient: 2.5,
      filterResistanceCoefficient: 30,
      heightDiffM: 1.7,
      hoodFlowCoefficientX: 0.8,
      totalHeatGainW: 9791,
      fanCapacityM3PerHPerUnit: 1140,
      filterRatedVelocityMPerS: 1.5,
    });

    expect(result.naturalHeatLossW).toBeCloseTo(1609.2400000000002, 2);
    expect(result.naturalVentilationHeatRemovalW).toBeCloseTo(2357.8419954173414, 2);
    expect(result.naturalVentilationSufficient).toBe(false);
    expect(result.requiredForcedAirflowM3PerH).toBeCloseTo(2230.869566232594, 2);
    expect(result.fanCount).toBe(2);
    expect(result.staticPressurePa).toBeCloseTo(2.9603784388725236, 2);
    expect(result.filterLimitedFanCount).toBe(1);
    expect(result.finalFanCount).toBe(2);
  });
});
