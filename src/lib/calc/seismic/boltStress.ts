import type { BoltDiameter, BoltMaterial } from "@/lib/types";

/**
 * JSIA-T1018:2012 表3「ボルトの軸断面積表」(p.9, 単位cm2) — そのまま mm2 に
 * 換算して持つ。「呼径による断面積」= 公称直径ベースの断面積であり、
 * JIS B 1082 の「有効断面積」(ねじ谷径ベース、M12で84.3mm2) とは異なる —
 * これは意図的: 表2 の許容応力度がこの断面積で使う前提で既に75%に補正
 * 済みなので (表2 直下の備考参照)、両方をこの組み合わせのまま使う必要が
 * ある。片方だけ JIS B 1082 に差し替えると二重に安全側/危険側へずれる。
 */
export const BOLT_SHANK_AREA_MM2: Record<BoltDiameter, number> = {
  M8: 50.3,
  M10: 78.5,
  M12: 113,
  M16: 201,
  M20: 314,
  M24: 452,
};

/**
 * JSIA-T1018:2012 表2「ボルト（SS400）及びステンレスボルト（A2-50）の
 * 許容応力度表」(p.9, 単位kN/cm2 → mm2 の kN/mm2 に換算) — そのまま。
 */
export interface BoltAllowableStress {
  longTermTensileKnPerMm2: number; // ｆt (長期)
  longTermShearKnPerMm2: number; // ｆs (長期)
  shortTermTensileKnPerMm2: number; // ｆt (短期)
  shortTermShearKnPerMm2: number; // ｆs (短期)
}

export const BOLT_ALLOWABLE_STRESS: Record<BoltMaterial, BoltAllowableStress> = {
  ss400: {
    longTermTensileKnPerMm2: 0.117,
    longTermShearKnPerMm2: 0.0678,
    shortTermTensileKnPerMm2: 0.176,
    shortTermShearKnPerMm2: 0.101,
  },
  stainless: {
    longTermTensileKnPerMm2: 0.105,
    longTermShearKnPerMm2: 0.0608,
    shortTermTensileKnPerMm2: 0.158,
    shortTermShearKnPerMm2: 0.0912,
  },
};

/**
 * JSIA-T1018 5.2 (5-2-2)式: ｆts＝1.4×ｆt－1.6×τ ただし ｆts≦ｆt。
 * 引張とせん断を同時に受けるボルトの許容引張応力度。
 */
export function computeCombinedTensileAllowable(shortTermTensileFt: number, shearStressTau: number): number {
  const fts = 1.4 * shortTermTensileFt - 1.6 * shearStressTau;
  return Math.min(fts, shortTermTensileFt);
}

export interface AnchorBoltJudgement {
  /** (5-2-1)式: Rb ≦ Ta。引抜力が発生しない (Rb<=0) 場合は対象外 (null)。 */
  pulloutOk: boolean | null;
  /** (5-2-2)式: σ ≦ min(ft, fts)。 */
  tensileOk: boolean;
  tensileAllowable: number; // min(ft, fts)
  /** (5-2-3)式: τ ≦ fs。 */
  shearOk: boolean;
  /** 3条件すべて満たす場合のみ合格。 */
  overallOk: boolean;
}

export function judgeAnchorBolt(params: {
  pulloutForceRbKn: number;
  allowablePulloutTaKn: number | null; // 社内選定マスタが空/未一致なら null (判定不可)
  tensileStressSigma: number; // kN/mm2
  shearStressTau: number; // kN/mm2
  material: BoltMaterial;
}): AnchorBoltJudgement {
  // JSIA-T1018 5.2 の判定式 (5-2-1)〜(5-2-3) は短期許容応力度基準なので、長期の値はここでは使わない。
  const { shortTermTensileKnPerMm2, shortTermShearKnPerMm2 } = BOLT_ALLOWABLE_STRESS[params.material];

  const fts = computeCombinedTensileAllowable(shortTermTensileKnPerMm2, params.shearStressTau);
  const tensileAllowable = Math.min(shortTermTensileKnPerMm2, fts);
  const tensileOk = params.tensileStressSigma <= tensileAllowable;
  const shearOk = params.shearStressTau <= shortTermShearKnPerMm2;

  const pulloutOk =
    params.pulloutForceRbKn <= 0
      ? null
      : params.allowablePulloutTaKn === null
        ? false
        : params.pulloutForceRbKn <= params.allowablePulloutTaKn;

  return {
    pulloutOk,
    tensileOk,
    tensileAllowable,
    shearOk,
    overallOk: pulloutOk !== false && tensileOk && shearOk,
  };
}
