import { describe, expect, it } from "vitest";
import { computeHorizontalForce, computeKh, computeVerticalForce, weightKgToKn } from "./seismicForce";

/** JSIA-T1018:2012 7.1 屋外形キュービクル計算例 (p.11): Z=1.0, KS=1.5, mass=1700kg. */
describe("seismicForce (JSIA-T1018:2012 7.1 屋外形キュービクル計算例)", () => {
  it("Kh = Z x Ks", () => {
    expect(computeKh(1.0, 1.5)).toBeCloseTo(1.5, 6);
  });

  it("W = mass(kg) x 9.8 x 10^-3, matches the worked example's rounded 16.7kN", () => {
    expect(weightKgToKn(1700)).toBeCloseTo(16.7, 1);
  });

  it("FH = Kh x W, matches the worked example's rounded 25.1kN", () => {
    const w = weightKgToKn(1700);
    expect(computeHorizontalForce(1.5, w)).toBeCloseTo(25.1, 0);
  });

  it("FV = FH / 2, matches the worked example's rounded 12.5kN", () => {
    expect(computeVerticalForce(25.1)).toBeCloseTo(12.55, 1);
  });
});
