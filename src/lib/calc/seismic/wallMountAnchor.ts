/**
 * JSIA-T1018:2012 5.1.2「壁面取付けの場合」(壁掛形)。
 *
 * 上部側アンカーボルト1本当たりの引抜力Ｒbは、下記2式のうち大きい方:
 *  Rb = FH×ℓ3G/(ℓ1×nt2) + (W+FV)×ℓ3G/(ℓ2×nt1) … (5-1-2-1)式
 *  Rb = FH×(ℓ2-ℓ2G)/(ℓ2×nt1) + (W+FV)×ℓ3G/(ℓ2×nt1) … (5-1-2-2)式
 * σ = Rb/A … (5-1-2-3)式
 * Q = √(FH² + (W+FV)²) / n … (5-1-2-4)式
 * τ = Q/A … (5-1-2-5)式
 */
export interface WallMountGeometry {
  /** ℓ1 — 水平方向のボルトスパン (mm)。 */
  horizontalSpanMm: number;
  /** ℓ2 — 鉛直方向のボルトスパン (mm)。 */
  verticalSpanMm: number;
  /** ℓ2G — 上部側ボルト中心から機器重心までの鉛直方向の距離 (mm)。 */
  verticalCenterToGravityMm: number;
  /** ℓ3G — 壁面から機器重心までの距離 (mm)。 */
  wallToGravityMm: number;
  /** nt1 — 上下面に設けたアンカーボルトの片側本数。 */
  horizontalFaceBoltCount: number;
  /** nt2 — 側面に設けたアンカーボルトの片側本数。 */
  verticalFaceBoltCount: number;
  /** n — アンカーボルトの総本数。 */
  totalBoltCount: number;
}

export interface WallMountAnchorResult {
  pulloutFormula1Kn: number; // (5-1-2-1)式
  pulloutFormula2Kn: number; // (5-1-2-2)式
  pulloutForceKn: number; // 不利な方 (大きい方)
  governingFormula: 1 | 2;
  shearForcePerBoltKn: number; // Q
}

export function computeWallMountAnchorForces(
  horizontalForceKn: number, // FH
  verticalForceKn: number, // FV
  weightKn: number, // W
  geometry: WallMountGeometry,
): WallMountAnchorResult {
  const pulloutFormula1Kn =
    (horizontalForceKn * geometry.wallToGravityMm) / (geometry.horizontalSpanMm * geometry.verticalFaceBoltCount) +
    ((weightKn + verticalForceKn) * geometry.wallToGravityMm) / (geometry.verticalSpanMm * geometry.horizontalFaceBoltCount);

  const pulloutFormula2Kn =
    (horizontalForceKn * (geometry.verticalSpanMm - geometry.verticalCenterToGravityMm)) /
      (geometry.verticalSpanMm * geometry.horizontalFaceBoltCount) +
    ((weightKn + verticalForceKn) * geometry.wallToGravityMm) / (geometry.verticalSpanMm * geometry.horizontalFaceBoltCount);

  const governingFormula: 1 | 2 = pulloutFormula1Kn >= pulloutFormula2Kn ? 1 : 2;
  const pulloutForceKn = Math.max(pulloutFormula1Kn, pulloutFormula2Kn);

  // (5-1-2-4)式 — 自立形/キュービクルの Q=FH/n と違い、鉛直方向の力 (W+FV) も
  // 合成する (壁に対して垂直に引き剥がされる方向の力が加わるため)。
  const shearForcePerBoltKn =
    Math.sqrt(horizontalForceKn ** 2 + (weightKn + verticalForceKn) ** 2) / geometry.totalBoltCount;

  return { pulloutFormula1Kn, pulloutFormula2Kn, pulloutForceKn, governingFormula, shearForcePerBoltKn };
}
