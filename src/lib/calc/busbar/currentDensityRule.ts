/**
 * JIS C 8480 simplified current-density selection for 裸銅帯 (bare copper
 * strip busbar) in cabinet-type distribution boards.
 *
 * IMPORTANT — edition honesty (see technicalSource.ts):
 * This exact table (3.0 / 2.5 / 2.0 / 1.7 A/mm² at the 125/250/400/630A
 * breakpoints) is what several secondary engineering references
 * consistently attribute to JIS C 8480:**2016**. This system has not
 * independently confirmed the table against the JIS C 8480:2023 text
 * itself, so `JIS_C_8480_STRIP_CURRENT_DENSITY_SOURCE.verified` is `false`
 * and the applicable-scope info separately confirmed for 2023 (AC 600V
 * or less, reference rated current 630A or less, 35kA short-time
 * withstand, 50/60Hz — via JSA's public catalog listing) is recorded
 * distinctly from the table's own edition. Do not present this table as
 * "JIS C 8480:2023準拠" until the 2023 text itself has been checked.
 */
import type { TechnicalSource } from "@/lib/calc/technicalSource";

export const JIS_C_8480_STRIP_CURRENT_DENSITY_SOURCE: TechnicalSource = {
  standard: "JIS C 8480",
  edition: "2016",
  reference:
    "帯状導体（銅帯）電流密度規定値表（母線・分岐母線・分岐導体、導電率96% IACS以上の裸銅帯）",
  applicability:
    "AC600V以下、基準定格電流630A以下のキャビネット形分電盤における裸銅帯（導電率96% IACS以上）の母線・分岐母線・分岐導体。630Aを超える場合は本表の対象外（延長適用不可）。",
  sourceType: "secondary_reference",
  verified: false,
  verificationNote:
    "この電流密度表は複数の二次資料（銅ブスバー販売会社の技術資料等）でJIS C 8480:2016の規定値として一致して引用されているが、当システムはJIS原本を直接参照していない。現行版のJIS C 8480:2023において本表が同一のまま踏襲されているかは未確認（要確認）。" +
    "JIS C 8480:2023のキャビネット形分電盤としての適用範囲（AC600V以下・基準定格電流630A以下・短時間耐電流35kA以下・50/60Hz、直流回路は基準定格電流200A以下）はJSA Webdeskの公開カタログ情報で別途確認済み。本番運用前に必ずJIS C 8480:2023原本で該当条項・表番号・数値を確認すること。",
};

export const JIS_C_8480_SIMPLE_SELECTION_MAX_CURRENT_A = 630;

/** One current-density band; `maxCurrentA` is the inclusive upper bound of its range. */
export interface CurrentDensityBand {
  maxCurrentA: number;
  densityAPerMm2: number;
}

/** Ordered ascending by `maxCurrentA` — ≤125A→3.0, 125<A≤250→2.5, 250<A≤400→2.0, 400<A≤630→1.7. */
export const JIS_C_8480_2016_STRIP_BANDS: readonly CurrentDensityBand[] = [
  { maxCurrentA: 125, densityAPerMm2: 3.0 },
  { maxCurrentA: 250, densityAPerMm2: 2.5 },
  { maxCurrentA: 400, densityAPerMm2: 2.0 },
  { maxCurrentA: 630, densityAPerMm2: 1.7 },
];

export type RequiredCrossSectionResult =
  | {
      inRange: true;
      ratedCurrentA: number;
      densityAPerMm2: number;
      requiredAreaMm2: number;
      source: TechnicalSource;
    }
  | {
      inRange: false;
      ratedCurrentA: number;
      /** "invalidInput" — not a positive finite number. "outOfRange" — I > 630A, JIS C 8480 simplified table does not apply; never extrapolated. */
      reasonKey: "invalidInput" | "outOfRange";
    };

/**
 * 必要断面積 = 定格電流 / 電流密度, per the JIS C 8480 band the current falls
 * in. Returns `inRange: false` (never an extrapolated guess) for I > 630A —
 * callers must switch to the (separately architected, not-yet-implemented)
 * high-current path instead of continuing this table past its range.
 */
export function requiredCrossSectionArea(
  ratedCurrentA: number,
): RequiredCrossSectionResult {
  if (!Number.isFinite(ratedCurrentA) || ratedCurrentA <= 0) {
    return { inRange: false, ratedCurrentA, reasonKey: "invalidInput" };
  }
  if (ratedCurrentA > JIS_C_8480_SIMPLE_SELECTION_MAX_CURRENT_A) {
    return { inRange: false, ratedCurrentA, reasonKey: "outOfRange" };
  }
  const band = JIS_C_8480_2016_STRIP_BANDS.find(
    (b) => ratedCurrentA <= b.maxCurrentA,
  );
  if (!band) {
    // Unreachable given the two guards above, but keeps this function total.
    return { inRange: false, ratedCurrentA, reasonKey: "outOfRange" };
  }
  return {
    inRange: true,
    ratedCurrentA,
    densityAPerMm2: band.densityAPerMm2,
    requiredAreaMm2: ratedCurrentA / band.densityAPerMm2,
    source: JIS_C_8480_STRIP_CURRENT_DENSITY_SOURCE,
  };
}

export type MaxCurrentForAreaResult =
  | {
      inRange: true;
      areaMm2: number;
      maxCurrentA: number;
      densityAPerMm2: number;
      /** True when `maxCurrentA` is capped at the table's 630A ceiling rather than a value the area itself limits — the area may support more than 630A, but that is outside this simplified method's verified range (never extrapolated; see highCurrentRule.ts). */
      cappedAtCeiling: boolean;
      source: TechnicalSource;
    }
  | {
      inRange: false;
      areaMm2: number;
      reasonKey: "invalidInput";
    };

/**
 * The reverse direction of `requiredCrossSectionArea` — given a real
 * cross-section (e.g. from an actual t×W×n busbar configuration), what is
 * the largest current the JIS C 8480 simplified table considers this area
 * good for. Since `requiredCrossSectionArea` is a monotonically
 * non-decreasing step function of I (area jumps up whenever I crosses a
 * band boundary, and rises linearly with I inside a band), for a given area
 * there is always exactly one largest I with `requiredCrossSectionArea(I)
 * <= areaMm2` — found here by taking, for each band in turn, the highest
 * current inside that band whose own required area still fits, and keeping
 * the last (highest) band that qualifies.
 *
 * Never extrapolates past 630A: an area that would support more than 630A
 * under this table's slope still reports 630A, with `cappedAtCeiling: true`
 * so the caller can show this is the simplified method's own ceiling, not a
 * property of the area — real capacity above 630A is unverified in this
 * environment (see highCurrentRule.ts).
 */
export function maxCurrentForArea(areaMm2: number): MaxCurrentForAreaResult {
  if (!Number.isFinite(areaMm2) || areaMm2 <= 0) {
    return { inRange: false, areaMm2, reasonKey: "invalidInput" };
  }

  let bestCurrentA = 0;
  let bestBand: CurrentDensityBand | null = null;
  let bandLowerBoundA = 0;
  for (const band of JIS_C_8480_2016_STRIP_BANDS) {
    const candidateCurrentA = Math.min(
      band.maxCurrentA,
      areaMm2 * band.densityAPerMm2,
    );
    if (candidateCurrentA > bandLowerBoundA && candidateCurrentA > bestCurrentA) {
      bestCurrentA = candidateCurrentA;
      bestBand = band;
    }
    bandLowerBoundA = band.maxCurrentA;
  }

  if (!bestBand) {
    // Unreachable for any positive finite area given band 1 starts at 0A,
    // but keeps this function total.
    return { inRange: false, areaMm2, reasonKey: "invalidInput" };
  }

  // Epsilon guard: at the exact 630A boundary area (630 / 1.7), floating-
  // point rounding of `areaMm2 * densityAPerMm2` can land a hair above 630
  // even though the area was computed as exactly the 630A requirement —
  // that must read as "exactly the ceiling", not "capped below what the
  // area could support".
  const rawCurrentAtBestBandA = areaMm2 * bestBand.densityAPerMm2;
  const cappedAtCeiling =
    bestCurrentA === JIS_C_8480_SIMPLE_SELECTION_MAX_CURRENT_A &&
    rawCurrentAtBestBandA - JIS_C_8480_SIMPLE_SELECTION_MAX_CURRENT_A > 1e-9;

  return {
    inRange: true,
    areaMm2,
    maxCurrentA: bestCurrentA,
    densityAPerMm2: bestBand.densityAPerMm2,
    cappedAtCeiling,
    source: JIS_C_8480_STRIP_CURRENT_DENSITY_SOURCE,
  };
}
