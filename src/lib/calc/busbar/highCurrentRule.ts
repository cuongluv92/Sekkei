/**
 * >630A high-current busbar selection. JIS C 8480's simplified
 * current-density table must never be extrapolated past its 630A range
 * (see currentDensityRule.ts) — this module is the honest fallback for
 * that range, not a real allowable-current calculation.
 *
 * The appropriate method for higher currents is expected to come from JSIA
 * technical publications (JSIA-T1006 and related JSIA 210 reference
 * material), which describe allowable-current calculation for copper
 * busbars including multi-bar arrangement and temperature rise. Both are
 * paid JSIA publications — WebSearch-only research (this system cannot
 * fetch full document text in this environment) confirms their existence,
 * title, and general method (thermal-balance equation + Stefan-Boltzmann
 * radiation law, worked examples for single and dual vertical-parallel
 * mounting) but not the actual coefficients/tables, so nothing here may be
 * presented as a verified calculation. Research also turned up JIS C
 * 4620 (キュービクル式高圧受電設備) 解説表4, described by multiple
 * independent secondary sources as the only other JIS-family published
 * copper-busbar ampacity table — but that table only extends to 500A
 * (100/225/400/500A breakpoints at 2.5/2.0/1.8/1.5 A/mm², a different
 * table from JIS C 8480's), so it does not help verify anything above
 * 630A either; it is recorded here only as a research note, not used.
 *
 * `findHighCurrentCandidates` (candidateSearch.ts sibling,
 * highCurrentCandidateSearch.ts) computes real geometry (A = t×W×n,
 * J = I/A — plain arithmetic, not standard-sourced) for size×bar-count
 * combinations so the UI has real numbers and a working 採用 flow, but
 * every result is judgment "requiresVerification" — never ok/caution/ng —
 * because there is no verified allowable-current source to compare
 * against. This is the honest fallback the spec itself calls for
 * (要技術確認) rather than a fabricated table or an ad-hoc extrapolation
 * of the ≤630A density value.
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
    "JSIA-T1006は日本配電制御システム工業会(JSIA)からの有償頒布物であり、当システムは本文（計算式・係数・配置条件別の許容電流表）を未入手・未検証。関連するJSIA 210等の参考資料も適用条件（周囲温度・温度上昇・裸銅帯/塗装有無・設置形態等）を個別に確認する必要がある。630A超の高電流母線選定はこれらの原資料を確認・購入した上で実装する必要がある — 現時点では実断面積・実電流密度という物理量のみを計算し、許容電流との判定は行わない。",
};

export const JSIA_210_SOURCE: TechnicalSource = {
  standard: "JSIA 210",
  edition: "2020",
  reference: "表B.2（銅バー許容電流、とされる — 未確認）",
  applicability:
    "配電盤類の銅バー選定。周囲温度・温度上昇・裸銅帯/塗装・設置形態など複数条件別の表と推定されるが、当システムは本文を未入手。",
  sourceType: "association_technical_document",
  verified: false,
  verificationNote:
    "JSIA 210:2020は日本配電制御システム工業会(JSIA)の有償頒布規格であり、表B.2を含む本文を未入手・未確認。JIS C 8480との関係・適用範囲の重複/差異も未確認のため、630A超の判定には使用していない。",
};

/** Never extrapolate the JIS C 8480 simplified table past 630A — this is the single source of truth for that boundary, shared by the calculation engine and the UI's out-of-range message. */
export function isWithinSimpleSelectionRange(ratedCurrentA: number): boolean {
  return ratedCurrentA <= 630;
}
