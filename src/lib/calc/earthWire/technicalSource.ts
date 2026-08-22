/**
 * 接地線 (grounding/earth wire) sizing — S = 0.052 × In, cited across
 * multiple independent secondary engineering references as 内線規程
 * （JEAC 8001）資料1-3-6, explicitly scoped to C種 or D種接地工事 only
 * (C種/D種接地工事は1350-3表を参照するとされる; A種接地工事は別表の1350-4表による、
 * とWebSearchで確認した複数の二次資料が一致して説明— この使い分け自体がスコープの
 * 根拠). This system has not read 内線規程 (JEAC 8001-2022, 第14版) itself —
 * WebFetch to the publisher/explainer sites is blocked in this environment
 * — so `verified` stays `false` pending direct confirmation of the exact
 * clause and coefficient. Never apply this formula to A種/B種接地工事.
 */
import type { TechnicalSource } from "@/lib/calc/technicalSource";

export type GroundingType = "A" | "B" | "C" | "D";

export const EARTH_WIRE_0052_SOURCE: TechnicalSource = {
  standard: "内線規程 (JEAC 8001)",
  edition: "2022 (第14版)",
  reference: "資料1-3-6 断面積 = 0.052 × 定格電流（C種・D種接地工事：1350-3表）",
  applicability:
    "C種接地工事またはD種接地工事の接地線太さ選定のみ。A種接地工事は別表（1350-4表）により本式は適用しない。B種接地工事は対象外（変圧器の1線地絡電流等に基づく別計算）。",
  sourceType: "secondary_reference",
  verified: false,
  verificationNote:
    "複数の独立した二次資料（電気設計の解説サイト等）が一致してこの式と適用範囲（C種/D種接地工事、1350-3表）を内線規程 資料1-3-6として説明しているが、当システムは内線規程（JEAC 8001-2022, 第14版）の原本を未参照（このWeb環境ではJEAC/日本電気協会サイトへのアクセスがブロックされている）。本番運用前に原本で該当条項・係数0.052・適用条件（接地工事種別、遮断器種類等）を直接確認すること。A種・B種接地工事に本式を適用してはならない。",
};

/** Only C種/D種接地工事 use the 0.052×In formula per the (unverified) source above — A種/B種 have no implemented rule here. */
export function isSupportedGroundingType(
  groundingType: GroundingType,
): groundingType is "C" | "D" {
  return groundingType === "C" || groundingType === "D";
}
