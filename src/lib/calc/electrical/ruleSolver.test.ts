import { describe, expect, it } from "vitest";
import { solveByRules, type Rule } from "./ruleSolver";
import { engineeringFundamentalSource } from "@/lib/calc/technicalSource";

type Var = "V" | "I" | "R";

const ohmSource = engineeringFundamentalSource("V = IR", "test");

const rules: Rule<Var>[] = [
  {
    output: "V",
    inputs: ["I", "R"],
    compute: ({ I, R }) => I * R,
    describe: (v, result) => ({
      formula: "V = I × R",
      substituted: `V = ${v.I} × ${v.R}`,
      resultLine: `= ${result}`,
    }),
    source: ohmSource,
  },
  {
    output: "I",
    inputs: ["V", "R"],
    compute: ({ V, R }) => V / R,
    describe: (v, result) => ({
      formula: "I = V / R",
      substituted: `I = ${v.V} / ${v.R}`,
      resultLine: `= ${result}`,
    }),
    source: ohmSource,
  },
  {
    output: "R",
    inputs: ["V", "I"],
    compute: ({ V, I }) => V / I,
    describe: (v, result) => ({
      formula: "R = V / I",
      substituted: `R = ${v.V} / ${v.I}`,
      resultLine: `= ${result}`,
    }),
    source: ohmSource,
  },
];

describe("solveByRules", () => {
  it("solves directly when exactly the needed inputs are known", () => {
    const r = solveByRules(rules, { I: 10, R: 5 }, "V");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(50);
  });

  it("solves the reverse direction from the same rule set", () => {
    const r = solveByRules(rules, { V: 50, R: 5 }, "I");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(10);
  });

  it("reports missing variables when not enough is known", () => {
    const r = solveByRules(rules, { I: 10 }, "V");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.missing).toContain("R");
  });

  it("never produces NaN/Infinity — division by zero is treated as unresolved", () => {
    const r = solveByRules(rules, { V: 50, I: 0 }, "R");
    expect(r.ok).toBe(false);
  });

  it("ignores extra known values that are not finite numbers", () => {
    const r = solveByRules(rules, { I: 10, R: 5, V: NaN }, "V");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(50);
  });

  it("dedupes identical sources across multiple applied rules", () => {
    const r = solveByRules(rules, { I: 10, R: 5 }, "V");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.sources.length).toBe(1);
  });
});

describe("solveByRules — consistency checking (入力値が一致していません)", () => {
  it("flags a directly-given value that contradicts what the other inputs imply", () => {
    // I=10, R=5 implies V=50, but the user also typed V=999 directly.
    const r = solveByRules(rules, { I: 10, R: 5, V: 999 }, "V");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reasonKey).toBe("inconsistentInput");
      expect(r.message).toContain("V");
    }
  });

  it("flags two derived paths that disagree even when neither is the target", () => {
    // R is over-determined: given V,I it should be 5, but the caller also supplies R=7 directly.
    const r = solveByRules(rules, { V: 50, I: 10, R: 7 }, "I");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reasonKey).toBe("inconsistentInput");
  });

  it("tolerates ordinary rounding noise instead of false-flagging every redundant input", () => {
    // 50/5=10 exactly, but a value the user rounded when typing (10.001) should still pass.
    const r = solveByRules(rules, { I: 10.001, R: 5, V: 50 }, "V");
    expect(r.ok).toBe(true);
  });

  it("redundant but perfectly consistent inputs solve normally, no false positive", () => {
    const r = solveByRules(rules, { I: 10, R: 5, V: 50 }, "V");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(50);
  });
});
