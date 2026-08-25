/**
 * JSIA-T1018:2012 5.1.1「床、基礎据付けの場合」(自立形・キュービクル共通 —
 * 7.1/7.2/7.3 の計算手順例はどちらもこの式を使っている、パネルの大きさが
 * 違うだけ)。
 *
 * Rb = [FH×hG − (W−FV)×ℓG] / (ℓ×nt) … (5-1-1-1)式
 * 矩形配列のアンカーボルトは直交2方向 (横幅方向・奥行方向) を独立に計算し、
 * 不利な方向 (値が大きい方) を採用する。
 * σ = Rb/A … (5-1-1-2)式
 * Q = FH/n … (5-1-1-3)式
 * τ = Q/A … (5-1-1-4)式
 */
export interface FloorMountGeometry {
  /** hG — 据付面より機器重心までの高さ (mm)。 */
  centerOfGravityHeightMm: number;
  /** ℓ (横幅方向) — アンカーボルトのスパン (mm)。 */
  widthSpanMm: number;
  /** ℓ (奥行方向) — アンカーボルトのスパン (mm)。 */
  depthSpanMm: number;
  /**
   * ℓG (横幅方向) — ボルト中心から機器重心までの距離 (mm)、ただし
   * ℓG ≦ ℓ/2。JSIA-T1018 の7.1(屋外形キュービクル)例では重心が中心から
   * ずれているため ℓG2=74mm ≠ ℓ2/2=82.5mm — 盤内の重量物配置が偏っている
   * 実物では span/2 と一致しない。重心が中心にあると分かっている場合だけ
   * widthSpanMm/2 を入力する。
   */
  widthCenterToGravityMm: number;
  /** ℓG (奥行方向) — 同上。 */
  depthCenterToGravityMm: number;
  /** nt (横幅方向) — 検討方向片側のアンカーボルト本数。 */
  widthSideBoltCount: number;
  /** nt (奥行方向) — 検討方向片側のアンカーボルト本数。 */
  depthSideBoltCount: number;
  /** n — アンカーボルトの総本数 (せん断力の分担に使う)。 */
  totalBoltCount: number;
}

export interface FloorMountAnchorResult {
  /** 横幅方向で検討した引抜力 Rb (kN/本)。 */
  pulloutWidthDirectionKn: number;
  /** 奥行方向で検討した引抜力 Rb (kN/本)。 */
  pulloutDepthDirectionKn: number;
  /** 不利な方向 (大きい方) の引抜力 Rb (kN/本) — 以降の判定に使う値。 */
  pulloutForceKn: number;
  governingDirection: "width" | "depth";
  shearForcePerBoltKn: number; // Q
}

export function computeFloorMountAnchorForces(
  horizontalForceKn: number, // FH
  verticalForceKn: number, // FV
  weightKn: number, // W
  geometry: FloorMountGeometry,
): FloorMountAnchorResult {
  const pulloutWidthDirectionKn =
    (horizontalForceKn * geometry.centerOfGravityHeightMm -
      (weightKn - verticalForceKn) * geometry.widthCenterToGravityMm) /
    (geometry.widthSpanMm * geometry.widthSideBoltCount);
  const pulloutDepthDirectionKn =
    (horizontalForceKn * geometry.centerOfGravityHeightMm -
      (weightKn - verticalForceKn) * geometry.depthCenterToGravityMm) /
    (geometry.depthSpanMm * geometry.depthSideBoltCount);

  const governingDirection: "width" | "depth" = pulloutWidthDirectionKn >= pulloutDepthDirectionKn ? "width" : "depth";
  const pulloutForceKn = Math.max(pulloutWidthDirectionKn, pulloutDepthDirectionKn);

  return {
    pulloutWidthDirectionKn,
    pulloutDepthDirectionKn,
    pulloutForceKn,
    governingDirection,
    shearForcePerBoltKn: horizontalForceKn / geometry.totalBoltCount, // Q = FH/n
  };
}

export function computeTensileStress(pulloutForceKn: number, boltAreaMm2: number): number {
  return pulloutForceKn / boltAreaMm2; // σ = Rb/A
}

export function computeShearStress(shearForcePerBoltKn: number, boltAreaMm2: number): number {
  return shearForcePerBoltKn / boltAreaMm2; // τ = Q/A
}
