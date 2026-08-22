import { describe, expect, it } from "vitest";
import { findHighCurrentCandidates } from "./highCurrentCandidateSearch";
import type { BusbarSizeOption } from "./candidateSearch";

const sizes: BusbarSizeOption[] = [
  { id: "s1", thicknessMm: 6, widthMm: 50 },
  { id: "s2", thicknessMm: 10, widthMm: 100 },
];

describe("findHighCurrentCandidates — honest >630A fallback (spec #10, #12, #33, #37)", () => {
  it("computes real geometry (A = t×W×n) for every size × bar-count combination", () => {
    const candidates = findHighCurrentCandidates(sizes, 1000, 3);
    // 2 sizes × 3 bar counts = 6 rows.
    expect(candidates).toHaveLength(6);
    const oneBarS1 = candidates.find((c) => c.sizeId === "s1" && c.barsPerPhase === 1)!;
    expect(oneBarS1.totalAreaMm2).toBe(6 * 50 * 1);
    const twoBarS2 = candidates.find((c) => c.sizeId === "s2" && c.barsPerPhase === 2)!;
    expect(twoBarS2.totalAreaMm2).toBe(10 * 100 * 2);
  });

  it("never assumes n bars gives n× the (unknown) allowable current — allowableCurrentA is always null", () => {
    const candidates = findHighCurrentCandidates(sizes, 1000, 3);
    expect(candidates.every((c) => c.allowableCurrentA === null)).toBe(true);
    expect(candidates.every((c) => c.marginPercent === null)).toBe(true);
  });

  it("computes real current density (J = I/A) even though it can't judge sufficiency", () => {
    const candidates = findHighCurrentCandidates(sizes, 1000, 1);
    const s1 = candidates.find((c) => c.sizeId === "s1")!;
    expect(s1.actualDensityAPerMm2).toBeCloseTo(1000 / (6 * 50), 5);
  });

  it("never returns ok/caution/ng — always requiresVerification, never a fabricated pass", () => {
    const candidates = findHighCurrentCandidates(sizes, 1000, 3);
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.every((c) => c.judgment === "requiresVerification")).toBe(true);
  });

  it("carries the unverified JSIA-T1006 source on every candidate, not a fabricated verified one", () => {
    const candidates = findHighCurrentCandidates(sizes, 1000, 1);
    expect(candidates.every((c) => c.source.verified === false)).toBe(true);
  });

  it("sorts by total area ascending (browsability only, never implies suitability)", () => {
    const candidates = findHighCurrentCandidates(sizes, 1000, 3);
    for (let i = 1; i < candidates.length; i++) {
      expect(candidates[i].totalAreaMm2).toBeGreaterThanOrEqual(candidates[i - 1].totalAreaMm2);
    }
  });

  it("works for currents far beyond any hard-coded ceiling (e.g. 2500A) — never caps at an invented max", () => {
    const candidates = findHighCurrentCandidates(sizes, 2500, 2);
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.every((c) => c.requiredCurrentA === 2500)).toBe(true);
  });

  it("returns no candidates for invalid input", () => {
    expect(findHighCurrentCandidates(sizes, 0)).toEqual([]);
    expect(findHighCurrentCandidates(sizes, -5)).toEqual([]);
    expect(findHighCurrentCandidates(sizes, NaN)).toEqual([]);
  });

  it("returns no candidates when no master sizes are configured", () => {
    expect(findHighCurrentCandidates([], 1000)).toEqual([]);
  });
});
