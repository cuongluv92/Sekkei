import { describe, expect, it } from "vitest";
import { computeFloorMountAnchorForces, computeShearStress, computeTensileStress } from "./floorMountAnchor";

/**
 * Golden values straight from JSIA-T1018:2012's own worked examples (7.1
 * 屋外形キュービクル p.11, 7.3 自立形盤類 p.19) — using the exact rounded
 * intermediate values the standard itself prints, so the comparison is
 * apples-to-apples (this codebase computes FH/FV/W from raw inputs at full
 * precision, which the standard's printed examples don't — feeding in their
 * own rounded numbers isolates "does the Rb/Q formula shape match" from
 * "does rounding-at-each-step match", which isn't something to reproduce).
 */
describe("computeFloorMountAnchorForces (JSIA-T1018:2012 7.3 自立形盤類 例)", () => {
  it("mass=174kg, hG=120cm, ℓ1=57cm, ℓ2=24cm, centered CG (ℓG=ℓ/2), n1=n2=2, n=4", () => {
    const result = computeFloorMountAnchorForces(2.6, 1.3, 1.7, {
      centerOfGravityHeightMm: 120,
      widthSpanMm: 57,
      depthSpanMm: 24,
      widthCenterToGravityMm: 28.5,
      depthCenterToGravityMm: 12,
      widthSideBoltCount: 2,
      depthSideBoltCount: 2,
      totalBoltCount: 4,
    });
    expect(result.pulloutWidthDirectionKn).toBeCloseTo(2.64, 2);
    expect(result.pulloutDepthDirectionKn).toBeCloseTo(6.4, 1);
    expect(result.pulloutForceKn).toBeCloseTo(6.4, 1);
    expect(result.governingDirection).toBe("depth");
    expect(result.shearForcePerBoltKn).toBeCloseTo(0.65, 2);
  });
});

describe("computeFloorMountAnchorForces (JSIA-T1018:2012 7.1 屋外形キュービクル 例)", () => {
  it("mass=1700kg, hG=101cm, ℓ1=150cm(ℓG1=70), ℓ2=165cm(ℓG2=74, OFF-CENTER — not ℓ2/2=82.5), n1=2,n2=3,n=6", () => {
    const result = computeFloorMountAnchorForces(25.1, 12.5, 16.7, {
      centerOfGravityHeightMm: 101,
      widthSpanMm: 150,
      depthSpanMm: 165,
      widthCenterToGravityMm: 70,
      depthCenterToGravityMm: 74,
      widthSideBoltCount: 2,
      depthSideBoltCount: 3,
      totalBoltCount: 6,
    });
    expect(result.pulloutWidthDirectionKn).toBeCloseTo(7.47, 2);
    expect(result.pulloutDepthDirectionKn).toBeCloseTo(4.5, 1);
    expect(result.pulloutForceKn).toBeCloseTo(7.47, 2);
    expect(result.governingDirection).toBe("width");
    expect(result.shearForcePerBoltKn).toBeCloseTo(4.18, 2);
  });

  it("σ and τ match the worked example (A=1.13cm2=113mm2, using kN/cm2 units to match the standard's own printed values)", () => {
    // JSIA-T1018 works this example in kN/cm2 (A=1.13cm2); this codebase's
    // BOLT_SHANK_AREA_MM2 uses mm2 (A=113mm2) — same ratio, different units.
    expect(computeTensileStress(7.47, 1.13)).toBeCloseTo(6.61, 2);
    expect(computeShearStress(4.18, 1.13)).toBeCloseTo(3.7, 2);
  });
});

/**
 * 7.2 屋内薄形キュービクル (p.15) — 屋外形キュービクル(7.1)と同じ(5-1-1-1)〜
 * (5-1-1-4)式を使っていることを、別の実例でも確認する。JSIA-T1018には
 * キュービクル専用の別式・別係数表は存在せず、自立形と全く同じ計算体系
 * であることがこの2つの公式例からも裏付けられる。
 */
describe("computeFloorMountAnchorForces (JSIA-T1018:2012 7.2 屋内薄形キュービクル 例)", () => {
  it("mass=1650kg, hG=85cm, ℓ1=230cm(ℓG1=95), ℓ2=79cm(ℓG2=37), n1=2,n2=3,n=6", () => {
    const result = computeFloorMountAnchorForces(24.3, 12.2, 16.2, {
      centerOfGravityHeightMm: 85,
      widthSpanMm: 230,
      depthSpanMm: 79,
      widthCenterToGravityMm: 95,
      depthCenterToGravityMm: 37,
      widthSideBoltCount: 2,
      depthSideBoltCount: 3,
      totalBoltCount: 6,
    });
    expect(result.pulloutWidthDirectionKn).toBeCloseTo(3.66, 2);
    expect(result.pulloutDepthDirectionKn).toBeCloseTo(8.1, 1);
    expect(result.pulloutForceKn).toBeCloseTo(8.1, 1);
    expect(result.governingDirection).toBe("depth");
    expect(result.shearForcePerBoltKn).toBeCloseTo(4.05, 2);
  });

  it("σ and τ match the worked example (A=1.13cm2)", () => {
    expect(computeTensileStress(8.10, 1.13)).toBeCloseTo(7.17, 2);
    expect(computeShearStress(4.05, 1.13)).toBeCloseTo(3.58, 2);
  });
});
