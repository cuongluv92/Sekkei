/**
 * >630A high-current busbar selection — architecturally reserved, not
 * implemented. JIS C 8480's simplified current-density table must never be
 * extrapolated past its 630A range (see currentDensityRule.ts). The
 * appropriate method for higher currents is expected to come from JSIA
 * technical publications (JSIA-T1006 and related JSIA 210 reference
 * material), which describe allowable-current calculation for copper
 * busbars including multi-bar arrangement and temperature rise — but this
 * system has not purchased/read that document's actual formulas, tables,
 * or coefficients, so nothing here may be presented as a real calculation.
 *
 * This stub exists so the UI can show the correct "out of range, switch to
 * high-current mode" state (per spec) and so the data model has a place to
 * grow into once JSIA-T1006 is obtained and verified (Phase 3) — without
 * needing to restructure the busbar module's architecture at that point.
 */
import type { TechnicalSource } from "@/lib/calc/technicalSource";

export const JSIA_T1006_SOURCE: TechnicalSource = {
  standard: "JSIA-T1006",
  edition: "2017",
  reference:
    "配電盤類に使用する銅ブスバーの許容電流計算（日本配電制御システム工業会, 2017-06-27発行）",
  applicability:
    "JIS C 8480の簡易選定範囲（基準定格電流630A以下）を超える銅ブスバー、または温度上昇・複数枚並列配置の詳細検証が必要な場合の許容電流計算。JIS H 3140の銅ブスバーを対象に、熱平衡式・輻射（ステファンボルツマンの法則）等を用いた計算方法を規定するとされる（JSIA公開情報より）。",
  sourceType: "association_technical_document",
  verified: false,
  verificationNote:
    "JSIA-T1006は日本配電制御システム工業会(JSIA)からの有償頒布物であり、当システムは本文（計算式・係数・配置条件別の許容電流表）を未入手・未検証。関連するJSIA 210等の参考資料も適用条件（周囲温度・温度上昇・裸銅帯/塗装有無・設置形態等）を個別に確認する必要がある。630A超の高電流母線選定はこれらの原資料を確認・購入した上でPhase 3として実装する — 現時点では計算を行わず「範囲外」の表示のみを行う。",
};

/** Never extrapolate the JIS C 8480 simplified table past 630A — this is the single source of truth for that boundary, shared by the calculation engine and the UI's out-of-range message. */
export function isWithinSimpleSelectionRange(ratedCurrentA: number): boolean {
  return ratedCurrentA <= 630;
}
