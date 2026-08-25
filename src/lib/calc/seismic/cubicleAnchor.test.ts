import { describe, expect, it } from "vitest";
import {
  computeCubicleAnchorTension,
  computeCubicleForces,
  computeCubicleHorizontalIntensity,
  computeCubicleShear,
  CUBICLE_KS_TABLE,
  lookupCubicleRegionZ,
  selectCubicleAnchorBolt,
  type CubicleGeometry,
} from "./cubicleAnchor";

describe("lookupCubicleRegionZ — キュービクル専用の地域係数表 (自立形/壁掛形の表とは別)", () => {
  it("表に明記された県はその係数を返す", () => {
    expect(lookupCubicleRegionZ("沖縄")).toBe(0.7);
    expect(lookupCubicleRegionZ("福岡")).toBe(0.8);
    expect(lookupCubicleRegionZ("新潟")).toBe(0.9);
    expect(lookupCubicleRegionZ("静岡")).toBe(1.2);
  });

  it("表に無い県 (東京など) は「その他」= 1.0 になる", () => {
    expect(lookupCubicleRegionZ("東京")).toBe(1.0);
    expect(lookupCubicleRegionZ("大阪")).toBe(1.0);
  });
});

describe("CUBICLE_KS_TABLE — 自立形/壁掛形の 1/0.6/0.4 とは異なる 1.5/1.0/0.6", () => {
  it("上層階・中間階・地階の値が実Excelどおり", () => {
    expect(CUBICLE_KS_TABLE.upper).toBe(1.5);
    expect(CUBICLE_KS_TABLE.middle).toBe(1.0);
    expect(CUBICLE_KS_TABLE.ground).toBe(0.6);
  });
});

describe("computeCubicleHorizontalIntensity / computeCubicleForces", () => {
  it("Kh = Z × Ks", () => {
    expect(computeCubicleHorizontalIntensity(1.2, 1.0)).toBe(1.2);
  });

  it("Fh = Kh × Wg, Fv = Fh / 2 — 単位はkgfのまま (kN変換しない)", () => {
    const { fhKgf, fvKgf } = computeCubicleForces(0.6, 1000);
    expect(fhKgf).toBe(600);
    expect(fvKgf).toBe(300);
  });
});

describe("computeCubicleAnchorTension — R1(左右)/R2(前後)、不利な方向を採用", () => {
  const geometry: CubicleGeometry = {
    centerOfGravityHeightMm: 500,
    horizontalPitchMm: 800,
    depthPitchMm: 400,
    totalBoltCount: 4,
    horizontalSideBoltCount: 2,
    depthSideBoltCount: 2,
  };

  it("R1 = (Fh×H − (Wg−Fv)×(L/2)) / (L×Nt)", () => {
    const result = computeCubicleAnchorTension(600, 1000, 300, geometry);
    // (600*500 - (1000-300)*400) / (800*2) = (300000-280000)/1600 = 12.5
    expect(result.tensionHorizontalKgf).toBeCloseTo(12.5, 6);
  });

  it("R2 = (Fh×H − (Wg−Fv)×(l/2)) / (l×nt)", () => {
    const result = computeCubicleAnchorTension(600, 1000, 300, geometry);
    // (600*500 - (1000-300)*200) / (400*2) = (300000-140000)/800 = 200
    expect(result.tensionDepthKgf).toBeCloseTo(200, 6);
  });

  it("大きい方 (不利な方向) を tensionKgf として採用する", () => {
    const result = computeCubicleAnchorTension(600, 1000, 300, geometry);
    expect(result.governingDirection).toBe("depth");
    expect(result.tensionKgf).toBeCloseTo(200, 6);
  });
});

describe("computeCubicleShear — Q = Fh / N (自立形と同じ単純平均、壁掛形の合成力とは違う)", () => {
  it("せん断力を等分する", () => {
    expect(computeCubicleShear(600, 4)).toBe(150);
  });
});

describe("selectCubicleAnchorBolt — 表A-1/表A-2/表B-1〜3 いずれも満たす最小径を選定", () => {
  it("小さい荷重ならM8で足り、弊社推奨によりM12へ切り上げる", () => {
    const result = selectCubicleAnchorBolt({
      tensionKgf: 200,
      shearKgf: 150,
      method: "mechanical",
      concreteThicknessMm: 120,
    });
    expect(result.tensionBolt).toBe("M8");
    expect(result.shearBolt).toBe("M8");
    expect(result.pulloutBolt).toBe("M8");
    expect(result.selectedBolt).toBe("M8");
    expect(result.recommendedBolt).toBe("M12"); // ※弊社ではM12以上を推奨
  });

  it("3表のうち最も大きい径が最終選定になる (表B-1のM8は300kgfしかない)", () => {
    // 引張荷重400kgfはA-1的にはM8(500)で足りるが、表B-1(メカニカル)のM8許容荷重300kgfでは不足 → M10(380)が必要
    const result = selectCubicleAnchorBolt({
      tensionKgf: 350,
      shearKgf: 100,
      method: "mechanical",
      concreteThicknessMm: 120,
    });
    expect(result.tensionBolt).toBe("M8");
    expect(result.pulloutBolt).toBe("M10");
    expect(result.selectedBolt).toBe("M10");
  });

  it("ケミカルアンカーはM8に対応する行が無い (表B-2に無い) ためM10以上になる", () => {
    const result = selectCubicleAnchorBolt({
      tensionKgf: 100,
      shearKgf: 100,
      method: "chemical",
      concreteThicknessMm: 150,
    });
    expect(result.pulloutBolt).toBe("M10");
  });

  it("ケミカルアンカーはM16/M20が薄いコンクリート(120mm)では施工不可 (\"-\") で選定対象から外れる", () => {
    const result = selectCubicleAnchorBolt({
      tensionKgf: 1000,
      shearKgf: 100,
      method: "chemical",
      concreteThicknessMm: 120,
    });
    // 120mmではM10=760,M12=920のみ有効、どちらも1000kgf未満なので選定不能
    expect(result.pulloutBolt).toBeNull();
    expect(result.selectedBolt).toBeNull();
    expect(result.recommendedBolt).toBeNull();
  });

  it("すべての径で許容値を超える荷重なら null (選定不能)", () => {
    const result = selectCubicleAnchorBolt({
      tensionKgf: 99999,
      shearKgf: 99999,
      method: "mechanical",
      concreteThicknessMm: 200,
    });
    expect(result.tensionBolt).toBeNull();
    expect(result.selectedBolt).toBeNull();
  });
});
