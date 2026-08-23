/**
 * 高圧・低圧 基本計算 — 単純なkV表示の単位換算ではなく、電圧区分の判定
 * ＋ 実際のkVA/A/V計算（`ohmsLaw.solveAcPower`を再利用、結線に応じ
 * √3を掛ける／掛けないを正しく切り替える）を行う。
 *
 * 電圧区分（低圧・高圧・特別高圧）の閾値は、経済産業省令「電気設備に関する
 * 技術基準を定める省令」第2条（電圧の種別等）によるもの — 電気事業法
 * そのものや、その施行規則ではなく、同法に基づき定められた別の省令である
 * 点に注意（sourceType: "law" — JIS/JEACのような産業標準ではなく法令）。
 * 複数の実務資料・経済産業省の解説PDF（dengikaisetsu.pdf）のタイトル・
 * 索引から同条番号・区分名を確認できたが、当システムは同省令原文の条文
 * そのものを直接読んで確認してはいないため `verified: false` とする。
 */
import type { TechnicalSource } from "@/lib/calc/technicalSource";

export type VoltageClass = "low" | "high" | "extraHigh";
export type CurrentType = "AC" | "DC";

export const VOLTAGE_CLASS_SOURCE: TechnicalSource = {
  standard: "電気設備に関する技術基準を定める省令",
  edition: "—",
  reference: "第2条（電圧の種別等：低圧・高圧・特別高圧の定義）",
  applicability: "日本国内の電気工作物における電圧区分全般",
  sourceType: "law",
  verified: false,
  verificationNote:
    "低圧（交流600V以下・直流750V以下）・高圧（交流600V超7000V以下・直流750V超7000V以下）・特別高圧（7000V超）" +
    "という区分は、経済産業省令「電気設備に関する技術基準を定める省令」第2条（電圧の種別等）によるもので、" +
    "同省の解説資料（電気設備に関する技術基準を定める省令の解説）の目次・索引でも同条番号を確認できた。" +
    "ただし当システムは同省令原文の条文そのものは直接確認していないため、本番運用前に原本（e-Gov法令検索等）を確認すること。" +
    "旧版では「電気事業法施行規則」を誤って引用していたが、電圧区分を定めるのは同施行規則ではなくこの省令である。",
};

/** 電圧区分を判定する — 数値の丸めや推測は行わず、既知の閾値と単純比較するのみ。 */
export function classifyVoltage(
  voltageV: number,
  currentType: CurrentType = "AC",
): VoltageClass | null {
  if (!Number.isFinite(voltageV) || voltageV < 0) return null;
  const lowMax = currentType === "AC" ? 600 : 750;
  if (voltageV <= lowMax) return "low";
  if (voltageV <= 7000) return "high";
  return "extraHigh";
}

export const VOLTAGE_CLASS_LABEL_JA: Record<VoltageClass, string> = {
  low: "低圧",
  high: "高圧",
  extraHigh: "特別高圧",
};

/**
 * 高圧受電設備（6.6kV級キュービクル等）の適用規格に関する参考情報 —
 * 数値（推奨継電器整定値・機器仕様等）は含まず、適用範囲を示す情報のみ。
 * 本番利用前に原本で該当条項を確認すること。
 */
export const JEAC8011_HIGH_VOLTAGE_RECEIVING_SOURCE: TechnicalSource = {
  standard: "JEAC 8011",
  edition: "2025",
  reference: "高圧受電設備規程（適用範囲：高圧で受電する需要設備）",
  applicability: "6.6kV級を含む高圧受電設備・キュービクル式受電設備",
  sourceType: "association_technical_document",
  verified: false,
  verificationNote:
    "規程名・対象（高圧受電設備）までは把握しているが、2025年版原文の該当条項・数値要件の詳細は未確認。" +
    "本番運用前にJEAC 8011-2025原本で確認すること。",
};
export const JIS_C4620_CUBICLE_SOURCE: TechnicalSource = {
  standard: "JIS C 4620",
  edition: "2023",
  reference: "キュービクル式高圧受電設備の適用範囲",
  applicability: "6.6kV級キュービクル式高圧受電設備",
  sourceType: "standard",
  verified: false,
  verificationNote:
    "規格番号・対象（キュービクル式高圧受電設備）までは把握しているが、2023年版原文の適用範囲・仕様詳細は未確認。" +
    "本番運用前にJIS C 4620:2023原本で確認すること。",
};

/** 6.6kV級など高圧受電設備の文脈かどうかの簡易判定（キュービクル関連の参考情報を出すかどうかの目安）。 */
export function isHighVoltageReceivingContext(voltageV: number): boolean {
  return classifyVoltage(voltageV) === "high" && voltageV >= 6000 && voltageV <= 7000;
}
