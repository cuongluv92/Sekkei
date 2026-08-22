import { describe, expect, it } from "vitest";
import { crossSectionArea, currentDensity } from "./geometry";

describe("crossSectionArea — A = t × W × n", () => {
  it("computes total area for a single bar", () => {
    expect(crossSectionArea(6, 50, 1)).toBe(300);
  });

  it("computes total area for multiple parallel bars as a plain multiplier", () => {
    expect(crossSectionArea(6, 50, 2)).toBe(600);
    expect(crossSectionArea(6, 50, 3)).toBe(900);
  });

  it("matches the spec's worked example (4×20×1本 = 80mm²)", () => {
    expect(crossSectionArea(4, 20, 1)).toBe(80);
  });
});

describe("currentDensity — J = I / A", () => {
  it("computes actual current density", () => {
    expect(currentDensity(180, 80)).toBe(2.25);
  });

  it("matches the spec's worked example (180A / 72mm²)", () => {
    expect(currentDensity(180, 72)).toBeCloseTo(2.5, 10);
  });
});
