/**
 * >630A candidate search — the honest counterpart to `candidateSearch.ts`
 * for the range JIS C 8480's simplified table does not cover (see
 * `highCurrentRule.ts` for why no verified allowable-current source is
 * available in this environment). Computes real geometry for every master
 * size × 1..maxParallel bar-count combination — A = t×W×n and J = I/A are
 * plain arithmetic, not a standard claim — but every candidate's judgment
 * is `"requiresVerification"`, never ok/caution/ng, since there is nothing
 * verified to compare the actual current density against. Never assumes n
 * bars gives n× the (unknown) allowable current either — this only ever
 * multiplies geometric area, same caveat as the ≤630A path.
 *
 * Deliberately does not pick a "推奨" candidate: per spec, technical
 * validity must gate any company-preference ranking, and this path has no
 * verified technical validity to gate on. Every candidate is presented
 * evenly so the designer makes the actual technical call, matching this
 * app's principle of supporting the engineer's decision rather than
 * replacing it with a black box.
 */
import { crossSectionArea, currentDensity } from "./geometry";
import type { BusbarSizeOption } from "./candidateSearch";
import { DEFAULT_MAX_PARALLEL_BARS } from "./candidateSearch";
import { JSIA_T1006_SOURCE } from "./highCurrentRule";
import type { TechnicalSource } from "@/lib/calc/technicalSource";

export interface HighCurrentBusbarCandidate {
  sizeId: string;
  thicknessMm: number;
  widthMm: number;
  barsPerPhase: number;
  /** Only the arrangement this search assumes (vertical, evenly spaced) — not itself verified against any spacing/thermal-interaction table. */
  arrangement: string;
  /** Real geometry — A = t × W × n. */
  totalAreaMm2: number;
  requiredCurrentA: number;
  /** Real physics — J = I / A. */
  actualDensityAPerMm2: number;
  /** Never computable without a verified allowable-current source for this range. */
  allowableCurrentA: null;
  marginPercent: null;
  temperatureRiseVerified: false;
  judgment: "requiresVerification";
  source: TechnicalSource;
}

/** Single-candidate variant of `findHighCurrentCandidates`, for 手動検証 (manual what-if) — same honest "requiresVerification" judgment, no fabricated pass/fail. Returns `null` for invalid input. */
export function evaluateHighCurrentCandidate(
  size: BusbarSizeOption,
  barsPerPhase: number,
  ratedCurrentA: number,
): HighCurrentBusbarCandidate | null {
  if (!Number.isFinite(ratedCurrentA) || ratedCurrentA <= 0) return null;
  const totalAreaMm2 = crossSectionArea(size.thicknessMm, size.widthMm, barsPerPhase);
  return {
    sizeId: size.id,
    thicknessMm: size.thicknessMm,
    widthMm: size.widthMm,
    barsPerPhase,
    arrangement: "縦置き並列（等間隔と仮定）",
    totalAreaMm2,
    requiredCurrentA: ratedCurrentA,
    actualDensityAPerMm2: currentDensity(ratedCurrentA, totalAreaMm2),
    allowableCurrentA: null,
    marginPercent: null,
    temperatureRiseVerified: false,
    judgment: "requiresVerification",
    source: JSIA_T1006_SOURCE,
  };
}

/**
 * Every (master size × 1..maxParallel bars) combination for a rated current
 * above the JIS C 8480 simplified table's 630A ceiling — sorted by total
 * area ascending purely for browsability (never implies suitability, since
 * nothing here has been judged pass/fail). Returns `[]` if `ratedCurrentA`
 * isn't a positive finite number or no master sizes are configured.
 */
export function findHighCurrentCandidates(
  sizes: BusbarSizeOption[],
  ratedCurrentA: number,
  maxParallel: number = DEFAULT_MAX_PARALLEL_BARS,
): HighCurrentBusbarCandidate[] {
  if (!Number.isFinite(ratedCurrentA) || ratedCurrentA <= 0) return [];

  const candidates: HighCurrentBusbarCandidate[] = [];
  for (const size of sizes) {
    for (let n = 1; n <= maxParallel; n++) {
      const totalAreaMm2 = crossSectionArea(size.thicknessMm, size.widthMm, n);
      candidates.push({
        sizeId: size.id,
        thicknessMm: size.thicknessMm,
        widthMm: size.widthMm,
        barsPerPhase: n,
        arrangement: "縦置き並列（等間隔と仮定）",
        totalAreaMm2,
        requiredCurrentA: ratedCurrentA,
        actualDensityAPerMm2: currentDensity(ratedCurrentA, totalAreaMm2),
        allowableCurrentA: null,
        marginPercent: null,
        temperatureRiseVerified: false,
        judgment: "requiresVerification",
        source: JSIA_T1006_SOURCE,
      });
    }
  }
  return candidates.sort(
    (a, b) => a.barsPerPhase - b.barsPerPhase || a.totalAreaMm2 - b.totalAreaMm2,
  );
}
