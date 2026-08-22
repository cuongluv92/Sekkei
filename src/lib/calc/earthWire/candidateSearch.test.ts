import { describe, expect, it } from "vitest";
import type { EarthWireSize } from "@/lib/types";
import {
  evaluateEarthWireCandidate,
  findEarthWireCandidates,
} from "./candidateSearch";

const sizes: EarthWireSize[] = [
  { id: "a", areaMm2: 5.5, order: 0 },
  { id: "b", areaMm2: 8, order: 1 },
  { id: "c", areaMm2: 14, order: 2 },
  { id: "d", areaMm2: 22, order: 3 },
  { id: "e", areaMm2: 38, order: 4 },
];

describe("evaluateEarthWireCandidate", () => {
  it("marks a size smaller than required as ng", () => {
    const c = evaluateEarthWireCandidate(sizes[0], 20.8);
    expect(c.judgment).toBe("ng");
  });

  it("marks an adequately sized candidate as ok", () => {
    const c = evaluateEarthWireCandidate(sizes[3], 20.8); // 22mm² vs 20.8 required
    expect(c.judgment).toBe("ok");
    expect(c.marginPercent).toBeGreaterThan(0);
  });

  it("marks a hugely oversized candidate as caution", () => {
    const c = evaluateEarthWireCandidate(sizes[4], 5.2); // 38mm² vs 5.2 required
    expect(c.judgment).toBe("caution");
  });

  it("returns null margin/ok judgment when no requiredAreaMm2 is supplied", () => {
    const c = evaluateEarthWireCandidate(sizes[0], null);
    expect(c.marginPercent).toBeNull();
    expect(c.judgment).toBe("ok");
  });
});

describe("findEarthWireCandidates", () => {
  it("excludes undersized sizes and sorts ascending by area", () => {
    const result = findEarthWireCandidates(sizes, 20.8);
    expect(result.every((c) => c.areaMm2 >= 20.8)).toBe(true);
    const areas = result.map((c) => c.areaMm2);
    expect(areas).toEqual([...areas].sort((a, b) => a - b));
  });

  it("returns an empty list when no master size is large enough", () => {
    const result = findEarthWireCandidates(sizes, 1000);
    expect(result).toEqual([]);
  });

  it("returns an empty list for an empty master", () => {
    const result = findEarthWireCandidates([], 20.8);
    expect(result).toEqual([]);
  });
});
