import { describe, expect, it } from "vitest";
import { findAllowablePulloutKn } from "./anchorAllowableLookup";
import type { SeismicAnchorAllowable } from "@/lib/types";

function row(overrides: Partial<SeismicAnchorAllowable> = {}): SeismicAnchorAllowable {
  return {
    id: `r-${overrides.concreteThicknessMm}`,
    manufacturerId: "maker-a",
    method: "埋込式LA形アンカーボルト",
    boltDiameter: "M12",
    concreteThicknessMm: 120,
    allowablePulloutKn: 4.5,
    order: 0,
    ...overrides,
  };
}

describe("findAllowablePulloutKn", () => {
  it("picks the largest registered thickness that does not exceed the actual thickness (never over-credits a thinner slab)", () => {
    const rows = [
      row({ concreteThicknessMm: 120, allowablePulloutKn: 4.5 }),
      row({ concreteThicknessMm: 150, allowablePulloutKn: 4.5 }),
      row({ concreteThicknessMm: 200, allowablePulloutKn: 6.0 }),
    ];
    expect(findAllowablePulloutKn(rows, { manufacturerId: "maker-a", method: "埋込式LA形アンカーボルト", boltDiameter: "M12", concreteThicknessMm: 180 })).toBe(4.5);
  });

  it("matches exactly when the actual thickness is registered", () => {
    const rows = [row({ concreteThicknessMm: 150, allowablePulloutKn: 4.5 })];
    expect(findAllowablePulloutKn(rows, { manufacturerId: "maker-a", method: "埋込式LA形アンカーボルト", boltDiameter: "M12", concreteThicknessMm: 150 })).toBe(4.5);
  });

  it("returns null when the actual thickness is thinner than every registered row (no safe match)", () => {
    const rows = [row({ concreteThicknessMm: 120 })];
    expect(findAllowablePulloutKn(rows, { manufacturerId: "maker-a", method: "埋込式LA形アンカーボルト", boltDiameter: "M12", concreteThicknessMm: 100 })).toBeNull();
  });

  it("never matches across a different manufacturer, method, or bolt diameter", () => {
    const rows = [
      row({ manufacturerId: "maker-b" }),
      row({ method: "あと施工金属拡張アンカーボルト" }),
      row({ boltDiameter: "M16" }),
    ];
    expect(findAllowablePulloutKn(rows, { manufacturerId: "maker-a", method: "埋込式LA形アンカーボルト", boltDiameter: "M12", concreteThicknessMm: 120 })).toBeNull();
  });
});
