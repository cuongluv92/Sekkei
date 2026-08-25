/**
 * JSIA-T1018:2012 4章「地震力」(4-1)〜(4-4)式。
 * KH = Z × KS
 * FH = KH × W (kN)
 * FV = KV × W (kN), KV = (1/2) × KH
 */
export function computeKh(regionCoefficientZ: number, standardIntensityKs: number): number {
  return regionCoefficientZ * standardIntensityKs;
}

/** kg → kN。JSIA-T1018 の全ての計算例が「質量kg × 9.80m/s2 × 10⁻³」で統一しているのでそれに合わせる (g=9.8、9.80665ではない)。 */
export function weightKgToKn(weightKg: number): number {
  return weightKg * 9.8 * 1e-3;
}

export function computeHorizontalForce(kh: number, weightKn: number): number {
  return kh * weightKn;
}

/** FV = (1/2) × FH — JSIA-T1018 (4-4)式。 */
export function computeVerticalForce(horizontalForceKn: number): number {
  return horizontalForceKn / 2;
}
