import type { TechnicalSource } from "@/lib/calc/technicalSource";
import type { EarthBarSize } from "@/lib/types";

/**
 * Reference k-values used only for a clearly-labelled 参考自動計算.
 * JIS C 60364-5-54:2023 is IDT with IEC 60364-5-54:2011+A1:2021 (JSA).
 * Schneider Electric's Electrical Installation Guide reproduces the IEC
 * 60364-5-54 Annex A common LV PE-conductor k values. We still keep the
 * source as `secondary_reference` because the paid JIS table itself has not
 * been read directly in this project.
 */
export type EarthBarKKey = "cu_pvc_external" | "cu_xlpe_external";

export interface EarthBarKOption {
  key: EarthBarKKey;
  k: number;
  labelJa: string;
  conditionJa: string;
}

export const EARTH_BAR_K_OPTIONS: EarthBarKOption[] = [
  {
    key: "cu_pvc_external",
    k: 143,
    labelJa: "銅・PVC系 k=143",
    conditionJa:
      "ケーブルに組み込まれていない絶縁導体、またはケーブルシースに接する裸導体。初期30℃・最終160℃の参考条件。",
  },
  {
    key: "cu_xlpe_external",
    k: 176,
    labelJa: "銅・XLPE/EPR系 k=176",
    conditionJa:
      "ケーブルに組み込まれていない絶縁導体、またはケーブルシースに接する裸導体。初期30℃・最終250℃の参考条件。",
  },
];

export const EARTH_BAR_ADIABATIC_REFERENCE_SOURCE: TechnicalSource = {
  standard: "JIS C 60364-5-54 / IEC 60364-5-54",
  edition: "JIS 2023 / IEC 2011+A1:2021",
  reference: "543.1 最小断面積・附属書A（k係数）／Schneider Electrical Installation Guide Fig. G59-G60",
  applicability:
    "保護導体の断熱法 S = I√t / k の参考計算。kは導体材料、絶縁/裸の状態、初期・最終温度などの条件に一致する値を選ぶ必要がある。",
  sourceType: "secondary_reference",
  verified: false,
  verificationNote:
    "JSA公開情報でJIS C 60364-5-54:2023がIEC 60364-5-54:2011+A1:2021とIDTであること、附属書Aがk係数の算出法であることは確認済み。k=143/176はSchneider Electric Electrical Installation GuideがIEC 60364-5-54 Annex A準拠値として公開している。JIS原本の該当k値表自体は未確認のため、本機能は『参考自動計算』として表示する。",
};

export const EARTH_BAR_JSA_URL =
  "https://webdesk.jsa.or.jp/books/W11M0090/index/?bunsyo_id=JIS+C+60364-5-54%3A2023";
export const EARTH_BAR_SCHNEIDER_URL =
  "https://www.electrical-installation.org/enwiki/Sizing_of_protective_earthing_conductor";

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

/** S = I√t/k. I is converted from kA to A; t is seconds; result is mm². */
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

/**
 * Selects registered single-bar company sizes whose real section t×W meets
 * the reference required area. The smallest adequate section is first.
 */
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
