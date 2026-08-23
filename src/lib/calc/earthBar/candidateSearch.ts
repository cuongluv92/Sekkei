/**
 * アースバー candidate search — computes real geometry (A = t × W × n,
 * reusing 母線銅帯's pure-math functions since the arithmetic itself is
 * generic, not standard-specific) for every master `EarthBarSize` ×
 * 1..maxParallel bar-count combination. Never sums load current like the
 * main busbar module and never applies 接地線's 0.052×In formula (see
 * technicalSource.ts) — the relevant question here is short-circuit
 * withstand, for which no k-value table has been verified in this
 * environment, so `requiredAreaMm2` is always `null` and `judgment` is
 * always `"requiresVerification"`, never a fabricated OK/NG. Mirrors
 * 母線銅帯's >630A honest-fallback shape (`highCurrentCandidateSearch.ts`).
 */
import { crossSectionArea } from "@/lib/calc/busbar/geometry";
import type { TechnicalSource } from "@/lib/calc/technicalSource";
import { JIS_C60364_5_54_ADIABATIC_SOURCE } from "./technicalSource";

export interface EarthBarSizeOption {
  id: string;
  thicknessMm: number;
  widthMm: number;
}

/** Never try more than this many parallel bars — a sane search bound, not a standard limit (same rationale as 母線銅帯's DEFAULT_MAX_PARALLEL_BARS). */
export const DEFAULT_MAX_PARALLEL_BARS = 4;

export interface EarthBarCandidate {
  sizeId: string;
  thicknessMm: number;
  widthMm: number;
  barsPerPhase: number;
  /** Real geometry — A = t × W × n. */
  totalAreaMm2: number;
  /** Fault current (kA), if supplied — recorded for traceability only, never used to compute a fabricated required area. */
  faultCurrentKA: number | null;
  /** Clearing time (s), if supplied — same caveat as faultCurrentKA. */
  clearingTimeS: number | null;
  /** Never computable without a verified k-value table for the adiabatic method. */
  requiredAreaMm2: null;
  marginPercent: null;
  judgment: "requiresVerification";
  method: string;
  source: TechnicalSource;
}

const ADIABATIC_METHOD_LABEL = "断熱法 S = I√t / k（JIS C 60364-5-54, k値未確認）";

function buildCandidate(
  size: EarthBarSizeOption,
  barsPerPhase: number,
  faultCurrentKA: number | null,
  clearingTimeS: number | null,
): EarthBarCandidate {
  return {
    sizeId: size.id,
    thicknessMm: size.thicknessMm,
    widthMm: size.widthMm,
    barsPerPhase,
    totalAreaMm2: crossSectionArea(size.thicknessMm, size.widthMm, barsPerPhase),
    faultCurrentKA,
    clearingTimeS,
    requiredAreaMm2: null,
    marginPercent: null,
    judgment: "requiresVerification",
    method: ADIABATIC_METHOD_LABEL,
    source: JIS_C60364_5_54_ADIABATIC_SOURCE,
  };
}

/** Single-candidate variant, for 手動検証 (manual what-if — e.g. "3×25", "3×30", "3×40"). Returns `null` for invalid geometry input. */
export function evaluateEarthBarCandidate(
  size: EarthBarSizeOption,
  barsPerPhase: number,
  faultCurrentKA: number | null,
  clearingTimeS: number | null,
): EarthBarCandidate | null {
  if (
    !Number.isFinite(size.thicknessMm) ||
    size.thicknessMm <= 0 ||
    !Number.isFinite(size.widthMm) ||
    size.widthMm <= 0 ||
    !Number.isInteger(barsPerPhase) ||
    barsPerPhase <= 0
  )
    return null;
  return buildCandidate(size, barsPerPhase, faultCurrentKA, clearingTimeS);
}

/**
 * Every (master size × 1..maxParallel bars) combination, sorted by total
 * area ascending purely for browsability — never implies suitability,
 * since nothing here has been judged pass/fail (spec #27, #28, #37 —
 * mirrors 母線銅帯's honest >630A fallback).
 */
export function findEarthBarCandidates(
  sizes: EarthBarSizeOption[],
  faultCurrentKA: number | null,
  clearingTimeS: number | null,
  maxParallel: number = DEFAULT_MAX_PARALLEL_BARS,
): EarthBarCandidate[] {
  const candidates: EarthBarCandidate[] = [];
  for (const size of sizes) {
    for (let n = 1; n <= maxParallel; n++) {
      candidates.push(buildCandidate(size, n, faultCurrentKA, clearingTimeS));
    }
  }
  return candidates.sort(
    (a, b) => a.barsPerPhase - b.barsPerPhase || a.totalAreaMm2 - b.totalAreaMm2,
  );
}
