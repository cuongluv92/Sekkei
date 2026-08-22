/**
 * Turns a required cross-section into real candidate busbar configurations
 * — never just a bare number. Tries each company master size at 1..N
 * parallel bars per phase (never assumes a single "big enough" bar is the
 * only option, and never assumes n bars gives exactly n× the capacity of
 * one — see the caveat in JIS_C_8480_STRIP_CURRENT_DENSITY_SOURCE:
 * multiple-bar thermal/arrangement effects are outside what the simple
 * total-cross-section rule can verify; a real >1-bar verification needs
 * the JSIA high-current method once available).
 */
import { crossSectionArea, currentDensity } from "./geometry";

export interface BusbarSizeOption {
  id: string;
  thicknessMm: number;
  widthMm: number;
}

export type Judgment = "ok" | "caution" | "ng";

export interface BusbarCandidate {
  sizeId: string;
  thicknessMm: number;
  widthMm: number;
  barsPerPhase: number;
  totalAreaMm2: number;
  /** null when no rated current was supplied to check against. */
  actualDensityAPerMm2: number | null;
  /** (actual - required) / required × 100. null when no requiredAreaMm2 was supplied. */
  marginPercent: number | null;
  judgment: Judgment;
}

/** Above this margin the candidate is technically fine but considered needlessly oversized (UI heuristic, not a standard threshold). */
const OVERSIZED_MARGIN_PERCENT = 100;

/** Never try more than this many parallel bars per phase — a sane search bound, not a standard limit. */
export const DEFAULT_MAX_PARALLEL_BARS = 4;

export function evaluateBusbarCandidate(
  size: BusbarSizeOption,
  barsPerPhase: number,
  requiredAreaMm2: number | null,
  ratedCurrentA: number | null,
): BusbarCandidate {
  const totalAreaMm2 = crossSectionArea(
    size.thicknessMm,
    size.widthMm,
    barsPerPhase,
  );
  const actualDensityAPerMm2 =
    ratedCurrentA !== null ? currentDensity(ratedCurrentA, totalAreaMm2) : null;

  let marginPercent: number | null = null;
  let judgment: Judgment = "ok";
  if (requiredAreaMm2 !== null) {
    marginPercent = ((totalAreaMm2 - requiredAreaMm2) / requiredAreaMm2) * 100;
    if (totalAreaMm2 < requiredAreaMm2) judgment = "ng";
    else if (marginPercent > OVERSIZED_MARGIN_PERCENT) judgment = "caution";
    else judgment = "ok";
  }

  return {
    sizeId: size.id,
    thicknessMm: size.thicknessMm,
    widthMm: size.widthMm,
    barsPerPhase,
    totalAreaMm2,
    actualDensityAPerMm2,
    marginPercent,
    judgment,
  };
}

/**
 * Every (master size × 1..maxParallel bars) combination that meets
 * `requiredAreaMm2`, sorted smallest-total-area first so the most
 * economical adequate candidate leads — but every candidate that qualifies
 * is returned, not just the top pick, per spec (propose a few, let the
 * designer choose).
 */
export function findBusbarCandidates(
  sizes: BusbarSizeOption[],
  requiredAreaMm2: number,
  ratedCurrentA: number,
  maxParallel: number = DEFAULT_MAX_PARALLEL_BARS,
): BusbarCandidate[] {
  const candidates: BusbarCandidate[] = [];
  for (const size of sizes) {
    for (let n = 1; n <= maxParallel; n++) {
      const candidate = evaluateBusbarCandidate(
        size,
        n,
        requiredAreaMm2,
        ratedCurrentA,
      );
      if (candidate.judgment !== "ng") candidates.push(candidate);
    }
  }
  return candidates.sort((a, b) => a.totalAreaMm2 - b.totalAreaMm2);
}
