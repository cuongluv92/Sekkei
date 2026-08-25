import { describe, expect, it } from "vitest";
import { computeWallMountAnchorForces } from "./wallMountAnchor";
import { computeShearStress } from "./floorMountAnchor";

/** Golden values from JSIA-T1018:2012's own worked example (7.6 壁掛形盤類, p.25). */
describe("computeWallMountAnchorForces (JSIA-T1018:2012 7.6 壁掛形盤類 例)", () => {
  it("mass=50kg, ℓ1=40cm, ℓ2=60cm, ℓ2G=30cm, ℓ3G=10cm, nt1=nt2=2, n=4", () => {
    const result = computeWallMountAnchorForces(0.735, 0.368, 0.49, {
      horizontalSpanMm: 40,
      verticalSpanMm: 60,
      verticalCenterToGravityMm: 30,
      wallToGravityMm: 10,
      horizontalFaceBoltCount: 2,
      verticalFaceBoltCount: 2,
      totalBoltCount: 4,
    });
    expect(result.pulloutFormula1Kn).toBeCloseTo(0.163, 2);
    expect(result.pulloutFormula2Kn).toBeCloseTo(0.255, 2);
    expect(result.pulloutForceKn).toBeCloseTo(0.255, 2);
    expect(result.governingFormula).toBe(2);
    expect(result.shearForcePerBoltKn).toBeCloseTo(0.282, 2);
  });

  it("τ matches the worked example (A=0.785cm2 for M10, using kN/cm2 units to match the standard's own printed values)", () => {
    expect(computeShearStress(0.282, 0.785)).toBeCloseTo(0.36, 2);
  });
});
