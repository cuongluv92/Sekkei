/**
 * アースバー（盤内接地母線）— a SEPARATE calculation/selection from 接地線
 * (see `src/lib/calc/earthWire/`). Per spec, this must never default to
 * "AT×0.052" (that formula's scope is 接地線 太さ, i.e. 内線規程 1350-3表,
 * not 短絡耐量 for a bus-bar-shaped protective conductor) and must never
 * compute capacity by summing load current like the main busbar module —
 * the relevant technical question for アースバー is short-circuit
 * withstand (短絡耐量) given the upstream protective device's fault
 * current and clearing time, not steady-state ampacity.
 *
 * The generally-cited method for this is the adiabatic equation from
 * JIS C 60364-5-54 (IEC 60364-5-54 相当), S = I√t / k, where k depends on
 * conductor material, insulation/bare condition, and initial/final
 * temperature (a table of k values, not a single constant). This system
 * has NOT obtained the JIS C 60364-5-54:2023 text itself or its k-value
 * table (WebFetch to JSA/publisher sites is blocked in this environment —
 * same limitation already recorded for JIS C 8480/JEAC 8001/JSIA 210), so
 * no k value is hardcoded anywhere in this module and no required-area
 * number is ever computed from fault current/clearing time. A second
 * candidate source, JIS C 4620 (解説表4, cubicle-type high-voltage
 * receiving equipment, ≤500A), was found during 母線銅帯 research but is a
 * different equipment context (高圧受電設備キュービクル, not 低圧分電盤内
 * アースバー) and has not been confirmed applicable here either.
 *
 * Until one of these is directly verified, this module computes only real
 * geometry (A = t × W × n, reusing 母線銅帯's pure-math functions — see
 * candidateSearch.ts) and marks every candidate's short-circuit judgment
 * "短絡耐量：未検証" (`judgment: "requiresVerification"`), never a
 * fabricated OK/NG — the same honest-fallback shape already used for
 * 母線銅帯's >630A path.
 */
import type { TechnicalSource } from "@/lib/calc/technicalSource";

export const JIS_C60364_5_54_ADIABATIC_SOURCE: TechnicalSource = {
  standard: "JIS C 60364-5-54",
  edition: "2023",
  reference:
    "断熱法（アディアバティック法） S = I√t / k による保護導体の最小断面積（k値表は規格本文中、未入手）",
  applicability:
    "低圧電気設備における保護導体（アースバー・接地線等）の短絡時耐量検証。k値は導体材料・絶縁の有無・敷設条件・事故時の初期温度と最終許容温度により異なり、複数の表から選定するとされる。",
  sourceType: "secondary_reference",
  verified: false,
  verificationNote:
    "断熱法の式 S = I√t / k 自体は複数の独立した二次資料（電気設計解説サイト等）で一致して説明されているが、当システムはJIS C 60364-5-54:2023の原本およびk値表を未入手（このWeb環境ではJSA・IEC関連サイトへのアクセスがブロックされている）。k値を1つの定数として決め打ちすることは絶対に行わない。本番運用前に原本でk値表・適用条件（材料・絶縁・初期/最終温度）を直接確認すること。",
};

export const JIS_C4620_CUBICLE_EARTH_BUS_SOURCE: TechnicalSource = {
  standard: "JIS C 4620",
  edition: "不明（要確認）",
  reference: "キュービクル式高圧受電設備の接地母線に関する解説表4（500Aまで）",
  applicability:
    "高圧受電設備（キュービクル）の接地母線。母線銅帯>630A高電流モードの調査で発見したが、低圧分電盤内アースバーへの適用可否は未確認（設備区分が異なる）。",
  sourceType: "secondary_reference",
  verified: false,
  verificationNote:
    "母線銅帯の高電流選定調査時に発見した別規格（キュービクル式高圧受電設備が対象）。低圧分電盤内アースバーの短絡耐量検証への適用可否は未確認のため、本モジュールでは判定には使用していない（参考情報としてのみ記録）。",
};

/** 盤種別・設備種別 — recorded for traceability (spec #26: must determine 盤種別/設備種別/適用規格 before choosing a rule) but does not itself select a formula, since no verified rule differentiates them yet. */
export type EquipmentType = "cabinet" | "cubicle" | "other";
