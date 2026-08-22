/**
 * 接地線 (grounding/earth wire) required cross-section = 0.052 × In, scoped
 * strictly to C種/D種接地工事 per EARTH_WIRE_0052_SOURCE (see
 * technicalSource.ts — verified: false, pending direct 内線規程 confirmation).
 * A種/B種接地工事 have no implemented rule here; this function returns
 * `applicable: false` for them rather than silently reusing the formula.
 */
import type { TechnicalSource } from "@/lib/calc/technicalSource";
import {
  EARTH_WIRE_0052_SOURCE,
  isSupportedGroundingType,
  type GroundingType,
} from "./technicalSource";

export const EARTH_WIRE_COEFFICIENT_PER_A = 0.052;

export type RequiredEarthWireCrossSectionResult =
  | {
      applicable: true;
      groundingType: "C" | "D";
      ratedCurrentA: number;
      coefficientPerA: number;
      requiredAreaMm2: number;
      source: TechnicalSource;
    }
  | {
      applicable: false;
      groundingType: GroundingType;
      ratedCurrentA: number;
      /** "invalidInput" — not a positive finite number. "unsupportedGroundingType" — A種/B種, no implemented rule. */
      reasonKey: "invalidInput" | "unsupportedGroundingType";
    };

/**
 * 必要断面積 = 0.052 × 定格電流, only for C種/D種接地工事. Never applies the
 * coefficient to A種/B種 — those return `applicable: false` so callers must
 * show 要確認/未対応 instead of a fabricated result.
 */
export function requiredEarthWireCrossSection(
  ratedCurrentA: number,
  groundingType: GroundingType,
): RequiredEarthWireCrossSectionResult {
  if (!Number.isFinite(ratedCurrentA) || ratedCurrentA <= 0) {
    return {
      applicable: false,
      groundingType,
      ratedCurrentA,
      reasonKey: "invalidInput",
    };
  }
  if (!isSupportedGroundingType(groundingType)) {
    return {
      applicable: false,
      groundingType,
      ratedCurrentA,
      reasonKey: "unsupportedGroundingType",
    };
  }
  return {
    applicable: true,
    groundingType,
    ratedCurrentA,
    coefficientPerA: EARTH_WIRE_COEFFICIENT_PER_A,
    requiredAreaMm2: ratedCurrentA * EARTH_WIRE_COEFFICIENT_PER_A,
    source: EARTH_WIRE_0052_SOURCE,
  };
}
