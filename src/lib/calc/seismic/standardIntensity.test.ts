import { describe, expect, it } from "vitest";
import { getStandardSeismicIntensity } from "./standardIntensity";

/** JSIA-T1018:2012 表1 (p.3) の数値そのまま。 */
describe("getStandardSeismicIntensity (JSIA-T1018:2012 表1)", () => {
  it("一般の施設・一般機器 (Excel の元テンプレートが唯一持っていた列)", () => {
    expect(getStandardSeismicIntensity("general", "general", "upper")).toBe(1.0);
    expect(getStandardSeismicIntensity("general", "general", "middle")).toBe(0.6);
    expect(getStandardSeismicIntensity("general", "general", "groundOrFirst")).toBe(0.4);
  });

  it("特定の施設・重要機器 (最も厳しい組み合わせ、上層階でKS=2.0)", () => {
    expect(getStandardSeismicIntensity("specific", "important", "upper")).toBe(2.0);
    expect(getStandardSeismicIntensity("specific", "important", "middle")).toBe(1.5);
    expect(getStandardSeismicIntensity("specific", "important", "groundOrFirst")).toBe(1.0);
  });

  it("特定の施設・一般機器 と 一般の施設・重要機器 は同じ数値列 (表1の構造どおり)", () => {
    for (const floor of ["upper", "middle", "groundOrFirst"] as const) {
      expect(getStandardSeismicIntensity("specific", "general", floor)).toBe(
        getStandardSeismicIntensity("general", "important", floor),
      );
    }
    expect(getStandardSeismicIntensity("specific", "general", "upper")).toBe(1.5);
  });
});
