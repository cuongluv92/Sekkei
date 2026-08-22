/**
 * Pure rectangular-copper-busbar geometry — no standard-specific rule
 * lives here, just the arithmetic every busbar rule builds on:
 *   A = t × W × n        (総断面積, mm²)
 *   J = I / A             (電流密度, A/mm²)
 */

/** A = t × W × n — total cross-section of `n` parallel bars per phase. */
export function crossSectionArea(
  thicknessMm: number,
  widthMm: number,
  barsPerPhase: number,
): number {
  return thicknessMm * widthMm * barsPerPhase;
}

/** J = I / A — actual current density for a given current and cross-section. `areaMm2` must be > 0. */
export function currentDensity(currentA: number, areaMm2: number): number {
  return currentA / areaMm2;
}
