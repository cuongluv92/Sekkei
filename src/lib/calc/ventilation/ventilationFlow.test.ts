import { describe, expect, it } from "vitest";
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

// Golden values transcribed from the vendor 換気計算書 (JSIA-T1016:2019準拠,
// JSIA HP掲載の使用例).

describe("屋外・東京・フィルタ無し (natural ventilation is sufficient... actually forced is required in this example)", () => {
  const air = { ambientTempC: 31, topTempC: 49, airSpecificHeatKjPerKgK: 1.024, airDensityKgPerM3: 1.146 };

  it("discharge coefficient with no filter uses the standard 0.65 (not 1/sqrt(ζC))", () => {
    expect(computeDischargeCoefficient(0.65, 2.5, null)).toBe(0.65);
  });

  it("effective vent area ≈ 0.0612 m2 (Ai=0.168, Ao=0.117)", () => {
    const alpha = computeDischargeCoefficient(0.65, 2.5, null);
    expect(computeEffectiveVentAreaM2(alpha, 0.168, 0.117)).toBeCloseTo(0.061198978118764145, 9);
  });

  it("natural ventilation heat removal QV ≈ 1406.3325W (h=2.1)", () => {
    const effectiveVentAreaM2 = 0.061198978118764145;
    expect(computeNaturalVentilationHeatRemovalW(air, effectiveVentAreaM2, 2.1)).toBeCloseTo(1406.3325179468748, 4);
  });

  it("judges QC=9791W > QBO(958.1148)+QV(1406.3325) → forced ventilation required", () => {
    const judgement = judgeNaturalVentilation(9791, 958.1148, 1406.3325179468748);
    expect(judgement.sufficient).toBe(false);
  });

  it("required forced airflow WK ≈ 3164.2639 m3/h", () => {
    const wk = computeRequiredForcedAirflowM3PerH(air, 9791, 958.1148, 1406.3325179468748, 0.8);
    expect(wk).toBeCloseTo(3164.263897717062, 3);
  });

  it("fan count = ROUNDUP(3164.2639/1680, 0) = 2", () => {
    expect(computeFanCount(3164.263897717062, 1680)).toBe(2);
  });

  it("static pressure ≈ 11.0532Pa (ζ=2.5, F=1680, Ai=0.168)", () => {
    const totalResistance = computeTotalResistanceCoefficient(2.5, null);
    expect(computeStaticPressurePa(air, totalResistance, 1680, 0.168)).toBeCloseTo(11.053240740740739, 4);
  });
});

describe("屋外・東京・フィルタ有り", () => {
  const air = { ambientTempC: 31, topTempC: 49, airSpecificHeatKjPerKgK: 1.024, airDensityKgPerM3: 1.146 };

  it("discharge coefficient with ζC=2.5, ζF=30 → 1/sqrt(32.5) ≈ 0.17541", () => {
    expect(computeDischargeCoefficient(0.65, 2.5, 30)).toBeCloseTo(0.17541160386140583, 9);
  });

  it("effective vent area ≈ 0.0165 m2", () => {
    const alpha = computeDischargeCoefficient(0.65, 2.5, 30);
    expect(computeEffectiveVentAreaM2(alpha, 0.168, 0.117)).toBeCloseTo(0.016515401394602308, 9);
  });

  it("QV ≈ 379.5185W", () => {
    expect(computeNaturalVentilationHeatRemovalW(air, 0.016515401394602308, 2.1)).toBeCloseTo(379.51852697770863, 4);
  });

  it("WK ≈ 3601.7630 m3/h, fan count=4, static pressure ≈ 66.1644Pa", () => {
    const wk = computeRequiredForcedAirflowM3PerH(air, 9791, 958.1148, 379.51852697770863, 0.8);
    expect(wk).toBeCloseTo(3601.7630417204764, 3);
    expect(computeFanCount(wk, 1140)).toBe(4);
    const totalResistance = computeTotalResistanceCoefficient(2.5, 30);
    expect(computeStaticPressurePa(air, totalResistance, 1140, 0.168)).toBeCloseTo(66.16436070956158, 3);
  });

  it("filter capacity check: standard velocity 1.5m/s over Ai=0.168m2 → 907.2 m3/h, filter-limited fan count = 4", () => {
    const filterLimited = computeFilterLimitedAirflowM3PerH(1.5, 0.168);
    expect(filterLimited).toBeCloseTo(907.2, 6);
    const wk = 3601.7630417204764;
    expect(computeFilterLimitedFanCount(wk, filterLimited)).toBe(4);
  });
});

describe("屋内・フィルタ有り (final fan count takes the max of the WK-based and filter-limited counts)", () => {
  const indoorAir = { ambientTempC: 30, topTempC: 50, airSpecificHeatKjPerKgK: 1.018, airDensityKgPerM3: 1.154 };

  it("QV ≈ 2361.7296W, WK ≈ 2229.3804 m3/h, base fan count = 2, filter-limited fan count = 1 → final = max(2,1) = 2", () => {
    const alpha = computeDischargeCoefficient(0.65, 2.5, 30);
    const effectiveVentAreaM2 = computeEffectiveVentAreaM2(alpha, 0.797, 0.797);
    expect(effectiveVentAreaM2).toBeCloseTo(0.09742406940577984, 9);

    const qv = computeNaturalVentilationHeatRemovalW(indoorAir, effectiveVentAreaM2, 1.7);
    expect(qv).toBeCloseTo(2361.72961882473, 3);

    const wk = computeRequiredForcedAirflowM3PerH(indoorAir, 9791, 1609.2400000000002, qv, 0.8);
    expect(wk).toBeCloseTo(2229.3804002213806, 3);

    const baseFanCount = computeFanCount(wk, 1140);
    expect(baseFanCount).toBe(2);

    const filterLimited = computeFilterLimitedAirflowM3PerH(1.5, 0.797);
    expect(filterLimited).toBeCloseTo(4303.8, 3);
    const filterLimitedFanCount = computeFilterLimitedFanCount(wk, filterLimited);
    expect(filterLimitedFanCount).toBe(1);

    expect(Math.max(baseFanCount, filterLimitedFanCount)).toBe(2);
  });
});
