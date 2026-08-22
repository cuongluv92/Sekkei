/**
 * Turns a required 接地線 cross-section into real candidate sizes from the
 * company's 接地線サイズ選定マスタ (earthWireSizeService) — never just a bare
 * mm² number. Same judgment/margin shape as busbar's candidateSearch.ts for
 * UI consistency, but a single dimension (no thickness/width/bars — 接地線
 * is a round/stranded conductor sized purely by cross-section).
 */
import type { EarthWireSize } from "@/lib/types";

export type Judgment = "ok" | "caution" | "ng";

export interface EarthWireCandidate {
  sizeId: string;
  areaMm2: number;
  /** (actual - required) / required × 100. null when no requiredAreaMm2 was supplied. */
  marginPercent: number | null;
  judgment: Judgment;
}

/** Above this margin the candidate is technically fine but considered needlessly oversized (UI heuristic, not a standard threshold). */
const OVERSIZED_MARGIN_PERCENT = 100;

export function evaluateEarthWireCandidate(
  size: EarthWireSize,
  requiredAreaMm2: number | null,
): EarthWireCandidate {
  let marginPercent: number | null = null;
  let judgment: Judgment = "ok";
  if (requiredAreaMm2 !== null) {
    marginPercent =
      ((size.areaMm2 - requiredAreaMm2) / requiredAreaMm2) * 100;
    if (size.areaMm2 < requiredAreaMm2) judgment = "ng";
    else if (marginPercent > OVERSIZED_MARGIN_PERCENT) judgment = "caution";
    else judgment = "ok";
  }

  return {
    sizeId: size.id,
    areaMm2: size.areaMm2,
    marginPercent,
    judgment,
  };
}

/**
 * Every master size that meets `requiredAreaMm2`, sorted smallest-area
 * first so the most economical adequate candidate leads — but every
 * qualifying candidate is returned, not just the top pick, so the designer
 * can choose.
 */
export function findEarthWireCandidates(
  sizes: EarthWireSize[],
  requiredAreaMm2: number,
): EarthWireCandidate[] {
  return sizes
    .map((size) => evaluateEarthWireCandidate(size, requiredAreaMm2))
    .filter((c) => c.judgment !== "ng")
    .sort((a, b) => a.areaMm2 - b.areaMm2);
}
