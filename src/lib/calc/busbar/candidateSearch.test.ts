import { describe, expect, it } from "vitest";
import {
  evaluateBusbarCandidate,
  findBusbarCandidates,
  type BusbarSizeOption,
} from "./candidateSearch";

describe("evaluateBusbarCandidate — manual what-if judgment (spec #12)", () => {
  const size6x50: BusbarSizeOption = { id: "s1", thicknessMm: 6, widthMm: 50 };

  it("OK when the candidate meets the requirement without being excessive", () => {
    // area = 6*50*2 = 600mm², required for 1000A at worked density would be less than 600 → OK
    const c = evaluateBusbarCandidate(size6x50, 2, 500, 1000);
    expect(c.totalAreaMm2).toBe(600);
    expect(c.judgment).toBe("ok");
  });

  it("NG when the candidate's area is below the required area", () => {
    const c = evaluateBusbarCandidate(size6x50, 1, 500, 1000);
    expect(c.totalAreaMm2).toBe(300);
    expect(c.judgment).toBe("ng");
  });

  it("caution when the candidate is far larger than required (oversized)", () => {
    const c = evaluateBusbarCandidate(size6x50, 3, 100, 300);
    expect(c.totalAreaMm2).toBe(900);
    expect(c.judgment).toBe("caution");
  });

  it("computes actual current density only when a rated current is supplied", () => {
    const withCurrent = evaluateBusbarCandidate(size6x50, 1, null, 180);
    expect(withCurrent.actualDensityAPerMm2).toBeCloseTo(0.6, 10);

    const withoutCurrent = evaluateBusbarCandidate(size6x50, 1, null, null);
    expect(withoutCurrent.actualDensityAPerMm2).toBeNull();
  });

  it("computes margin only when a required area is supplied", () => {
    const withRequired = evaluateBusbarCandidate(size6x50, 1, 200, null);
    expect(withRequired.marginPercent).toBeCloseTo(50, 10); // (300-200)/200*100

    const withoutRequired = evaluateBusbarCandidate(size6x50, 1, null, null);
    expect(withoutRequired.marginPercent).toBeNull();
    expect(withoutRequired.judgment).toBe("ok"); // no requirement to fail against
  });

  it("never assumes n bars gives exactly n× the checked current density — it only multiplies the raw area (spec #9 caveat)", () => {
    const oneBar = evaluateBusbarCandidate(size6x50, 1, null, 300);
    const twoBars = evaluateBusbarCandidate(size6x50, 2, null, 300);
    // Density halves because area doubles — this is pure arithmetic on the
    // simplified total-area rule, not a thermal/arrangement claim. The
    // caveat that real multi-bar capacity isn't simply proportional lives
    // in the cited source's applicability text, not in this function.
    expect(twoBars.actualDensityAPerMm2).toBeCloseTo(
      (oneBar.actualDensityAPerMm2 ?? 0) / 2,
      10,
    );
  });
});

describe("findBusbarCandidates — tries multiple parallel-bar counts, not just one big bar (spec #9)", () => {
  const sizes: BusbarSizeOption[] = [
    { id: "small", thicknessMm: 4, widthMm: 20 }, // 80mm² per bar
    { id: "large", thicknessMm: 6, widthMm: 50 }, // 300mm² per bar
  ];

  it("excludes every NG candidate", () => {
    const candidates = findBusbarCandidates(sizes, 1000, 1000);
    expect(candidates.every((c) => c.judgment !== "ng")).toBe(true);
  });

  it("includes a small bar at higher parallel counts when a single small bar isn't enough", () => {
    // requiredArea 240mm²: one 4x20 bar (80mm²) is NG alone, but 3 in parallel (240mm²) meets it exactly.
    const candidates = findBusbarCandidates(sizes, 240, 300, 4);
    const smallTriple = candidates.find(
      (c) => c.sizeId === "small" && c.barsPerPhase === 3,
    );
    expect(smallTriple).toBeDefined();
    expect(smallTriple?.totalAreaMm2).toBe(240);
  });

  it("sorts by bar count first (every adequate 1本 ahead of every 2本, etc.), then by area within the same bar count", () => {
    const candidates = findBusbarCandidates(sizes, 200, 300, 4);
    const barCounts = candidates.map((c) => c.barsPerPhase);
    expect(barCounts).toEqual([...barCounts].sort((a, b) => a - b));

    const byBarCount = new Map<number, number[]>();
    for (const c of candidates) {
      const list = byBarCount.get(c.barsPerPhase) ?? [];
      list.push(c.totalAreaMm2);
      byBarCount.set(c.barsPerPhase, list);
    }
    for (const areas of byBarCount.values()) {
      expect(areas).toEqual([...areas].sort((a, b) => a - b));
    }
  });

  it("never searches beyond the configured max parallel-bar count", () => {
    const candidates = findBusbarCandidates(sizes, 10, 300, 2);
    expect(candidates.every((c) => c.barsPerPhase <= 2)).toBe(true);
  });
});
