import { describe, expect, it } from "vitest";
import {
  evaluateEarthBarCandidate,
  findEarthBarCandidates,
  type EarthBarSizeOption,
} from "./candidateSearch";

const sizes: EarthBarSizeOption[] = [
  { id: "b1", thicknessMm: 3, widthMm: 25 },
  { id: "b2", thicknessMm: 3, widthMm: 30 },
  { id: "b3", thicknessMm: 3, widthMm: 40 },
];

describe("findEarthBarCandidates — honest fallback (spec #26, #27, #28, #37)", () => {
  it("computes real geometry (A = t × W × n) for every size × bar-count combination", () => {
    const result = findEarthBarCandidates(sizes, 25, 1, 2);
    const single = result.find(
      (c) => c.sizeId === "b1" && c.barsPerPhase === 1,
    );
    expect(single?.totalAreaMm2).toBe(75); // 3×25×1
    const double = result.find(
      (c) => c.sizeId === "b1" && c.barsPerPhase === 2,
    );
    expect(double?.totalAreaMm2).toBe(150); // 3×25×2
  });

  it("never computes a required area — no k-value has been verified", () => {
    const result = findEarthBarCandidates(sizes, 25, 1);
    expect(result.every((c) => c.requiredAreaMm2 === null)).toBe(true);
    expect(result.every((c) => c.marginPercent === null)).toBe(true);
  });

  it("every candidate's judgment is always requiresVerification — never a fabricated ok/caution/ng", () => {
    const result = findEarthBarCandidates(sizes, 25, 1);
    expect(
      result.every((c) => c.judgment === "requiresVerification"),
    ).toBe(true);
  });

  it("every candidate carries the unverified adiabatic-method source", () => {
    const result = findEarthBarCandidates(sizes, 25, 1);
    expect(result.every((c) => c.source.verified === false)).toBe(true);
  });

  it("records the supplied fault current / clearing time for traceability without using them to compute anything", () => {
    const result = findEarthBarCandidates(sizes, 31.5, 0.5);
    expect(result.every((c) => c.faultCurrentKA === 31.5)).toBe(true);
    expect(result.every((c) => c.clearingTimeS === 0.5)).toBe(true);
  });

  it("works with no fault current / clearing time supplied", () => {
    const result = findEarthBarCandidates(sizes, null, null);
    expect(result.every((c) => c.faultCurrentKA === null)).toBe(true);
  });

  it("sorts by bar count first, then by total area ascending within the same bar count", () => {
    const result = findEarthBarCandidates(sizes, 25, 1, 2);
    const barCounts = result.map((c) => c.barsPerPhase);
    expect(barCounts).toEqual([...barCounts].sort((a, b) => a - b));

    const byBarCount = new Map<number, number[]>();
    for (const c of result) {
      const list = byBarCount.get(c.barsPerPhase) ?? [];
      list.push(c.totalAreaMm2);
      byBarCount.set(c.barsPerPhase, list);
    }
    for (const areas of byBarCount.values()) {
      expect(areas).toEqual([...areas].sort((a, b) => a - b));
    }
  });

  it("returns an empty list for an empty master", () => {
    expect(findEarthBarCandidates([], 25, 1)).toEqual([]);
  });
});

describe("evaluateEarthBarCandidate — manual what-if (e.g. 3×25, 3×30, 3×40)", () => {
  it("computes real geometry for a single configuration", () => {
    const c = evaluateEarthBarCandidate(sizes[2], 1, 25, 1);
    expect(c?.totalAreaMm2).toBe(120); // 3×40×1
    expect(c?.judgment).toBe("requiresVerification");
  });

  it("rejects invalid geometry", () => {
    expect(evaluateEarthBarCandidate({ id: "x", thicknessMm: 0, widthMm: 25 }, 1, null, null)).toBeNull();
    expect(evaluateEarthBarCandidate(sizes[0], 0, null, null)).toBeNull();
  });
});
