import { describe, expect, it } from "vitest";
import {
  computeIndoorNaturalHeatLossW,
  computeIndoorSurfaceAreasM2,
  computeOutdoorNaturalHeatLossW,
  sumHeatSourcesW,
} from "./heatBalance";
import { INDOOR_AIR_CONDITION } from "./climateProfile";

// Golden values transcribed from the vendor 換気計算書 (JSIA-T1016:2019準拠,
// JSIA HP掲載の使用例) — 屋外キュービクル・東京 (フィルタ無し) シート.
describe("sumHeatSourcesW", () => {
  it("sums the worked-example heat sources to Qc = 9791W", () => {
    const items = [
      { name: "単相変圧器", heatW: 856 },
      { name: "三相変圧器", heatW: 4902 },
      { name: "三相変圧器", heatW: 3490 },
      { name: "進相コンデンサ", heatW: 350 },
      { name: "進相コンデンサ", heatW: 175 },
      { name: "リアクトル", heatW: 12 },
      { name: "リアクトル", heatW: 6 },
    ];
    expect(sumHeatSourcesW(items)).toBe(9791);
  });
});

describe("computeOutdoorNaturalHeatLossW", () => {
  it("matches the 屋外・東京・フィルタ無し worked example (QBO ≈ 958.1148W)", () => {
    const air = { ambientTempC: 31, topTempC: 49, airSpecificHeatKjPerKgK: 1.024, airDensityKgPerM3: 1.146 };
    const solar = { roofC: 11.9, face1C: 3.2, face2C: 7.6, face3C: 4.6, face4C: 3 };
    const u = { roofWPerM2K: 6.6, sideWPerM2K: 6.1 };
    const s = { roofM2: 7.5, face1M2: 5.39, face2M2: 7.35, face3M2: 5.39, face4M2: 7.05 };
    expect(computeOutdoorNaturalHeatLossW(air, solar, u, s)).toBeCloseTo(958.1148, 3);
  });

  it("matches the 屋外・那覇・フィルタ有り worked example (QBO ≈ 677.3157W)", () => {
    const air = { ambientTempC: 32, topTempC: 48, airSpecificHeatKjPerKgK: 1.025, airDensityKgPerM3: 1.141 };
    const solar = { roofC: 13.4, face1C: 3.6, face2C: 5.8, face3C: 4.6, face4C: 3.5 };
    const u = { roofWPerM2K: 6.6, sideWPerM2K: 6.1 };
    const s = { roofM2: 7.5, face1M2: 5.39, face2M2: 7.35, face3M2: 5.39, face4M2: 7.05 };
    expect(computeOutdoorNaturalHeatLossW(air, solar, u, s)).toBeCloseTo(677.3157, 3);
  });

  it("独立した別業者の換気計算書 (動力制御盤・計装盤用キュービクル, 非対称な外形寸法H1/H2) でも QBO ≈ 1006.2W と一致する", () => {
    const air = { ambientTempC: 29.9, topTempC: 50, airSpecificHeatKjPerKgK: 1.018, airDensityKgPerM3: 1.154 };
    const solar = { roofC: 12.0, face1C: 0.9, face2C: 8.9, face3C: 7.1, face4C: 0.9 };
    const u = { roofWPerM2K: 6.6, sideWPerM2K: 6.1 };
    const s = { roofM2: 5.712, face1M2: 4.7, face2M2: 5.64, face3M2: 4.7, face4M2: 5.52 };
    expect(computeOutdoorNaturalHeatLossW(air, solar, u, s)).toBeCloseTo(1006.2, 1);
  });
});

describe("computeIndoorSurfaceAreasM2 + computeIndoorNaturalHeatLossW", () => {
  it("matches the 屋内・フィルタ無し worked example (SRi=6.6m2, SSi=24.44m2, QBi ≈ 1609.24W)", () => {
    const areas = computeIndoorSurfaceAreasM2({ widthM: 3, heightM: 2.35, depthM: 2.2 });
    expect(areas.roofM2).toBeCloseTo(6.6, 6);
    expect(areas.sideM2).toBeCloseTo(24.44, 6);

    const u = { roofWPerM2K: 4.6, sideWPerM2K: 4.1 };
    expect(computeIndoorNaturalHeatLossW(INDOOR_AIR_CONDITION, u, areas)).toBeCloseTo(1609.24, 2);
  });
});
