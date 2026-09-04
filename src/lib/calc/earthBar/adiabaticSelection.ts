import type { TechnicalSource } from "@/lib/calc/technicalSource";
import type { EarthBarSize } from "@/lib/types";

/**
 * アースバー断熱法の補助ロジック。
 * 出典ポリシーにより、公開されている国内一次情報だけを表示根拠にする。
 * JSA公開ページでは JIS C 60364-5-54:2023 の規格概要・有効性は確認できるが、
 * k値の数表そのものは公開プレビューから直接確認できないため、k値をここに
 * ハードコードしない。JIS原本で条件と数値を確認した後にのみ設定して使う。
 */
export type EarthBarKKey = string;

export interface EarthBarKOption {
  key: EarthBarKKey;
  k: number;
  labelJa: string;
  conditionJa: string;
}

/** JIS原本確認済みのk値がまだないため空。推測・海外二次資料からの転記は禁止。 */
export const EARTH_BAR_K_OPTIONS: EarthBarKOption[] = [];

export const EARTH_BAR_ADIABATIC_REFERENCE_SOURCE: TechnicalSource = {
  standard: "JIS C 60364-5-54",
  edition: "2023",
  reference: "保護導体の最小断面積・附属書A（k係数）",
  applicability:
    "低圧電気設備の接地設備及び保護導体。断熱法を使う場合は、事故電流・遮断時間に加え、導体材料・絶縁状態・初期/最終温度等に対応したk値をJIS原本で確認する必要がある。",
  sourceType: "standard",
  verified: false,
  verificationNote:
    "日本規格協会の公開情報でJIS C 60364-5-54:2023が有効な規格であることは確認済み。ただし公開プレビューではk値数表を直接確認できないため、数値は未登録。原本確認前に自動選定値として使用しない。",
};

export const EARTH_BAR_JSA_URL =
  "https://webdesk.jsa.or.jp/books/W11M0090/index/?bunsyo_id=JIS+C+60364-5-54%3A2023";

/** 後方互換用。海外資料は使用せず、国内JSAページへ統一する。 */
export const EARTH_BAR_SCHNEIDER_URL = EARTH_BAR_JSA_URL;

export interface EarthBarAdiabaticResult {
  faultCurrentKA: number;
  clearingTimeS: number;
  k: number;
  requiredAreaMm2: number;
}

export interface EarthBarAutoCandidate {
  size: EarthBarSize;
  totalAreaMm2: number;
  marginPercent: number;
}

/** S = I√t/k。kはJIS原本確認済み値を呼出側から与えた場合のみ計算する。 */
export function calculateEarthBarAdiabaticArea(
  faultCurrentKA: number,
  clearingTimeS: number,
  k: number,
): EarthBarAdiabaticResult | null {
  if (
    !Number.isFinite(faultCurrentKA) ||
    faultCurrentKA <= 0 ||
    !Number.isFinite(clearingTimeS) ||
    clearingTimeS <= 0 ||
    !Number.isFinite(k) ||
    k <= 0
  ) {
    return null;
  }
  const requiredAreaMm2 = (faultCurrentKA * 1000 * Math.sqrt(clearingTimeS)) / k;
  return { faultCurrentKA, clearingTimeS, k, requiredAreaMm2 };
}

export function findEarthBarAutoCandidates(
  sizes: EarthBarSize[],
  requiredAreaMm2: number,
): EarthBarAutoCandidate[] {
  if (!Number.isFinite(requiredAreaMm2) || requiredAreaMm2 <= 0) return [];
  return sizes
    .map((size) => {
      const totalAreaMm2 = size.thicknessMm * size.widthMm;
      return {
        size,
        totalAreaMm2,
        marginPercent: ((totalAreaMm2 - requiredAreaMm2) / requiredAreaMm2) * 100,
      };
    })
    .filter((candidate) => candidate.totalAreaMm2 >= requiredAreaMm2)
    .sort((a, b) => a.totalAreaMm2 - b.totalAreaMm2);
}
