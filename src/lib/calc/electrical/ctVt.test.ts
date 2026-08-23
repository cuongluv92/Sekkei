import { describe, expect, it } from "vitest";
import {
  CT_PURPOSE_NOTE,
  solveInstrumentTransformerRatio,
} from "./ctVt";

describe("solveInstrumentTransformerRatio — CT 一次⇔二次", () => {
  it("primary from secondary,ratio (e.g. CT 1000/5A → ratio 200)", () => {
    const r = solveInstrumentTransformerRatio({ secondary: 5, ratio: 200 }, "primary");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeCloseTo(1000);
  });

  it("reverse: secondary from primary,ratio", () => {
    const r = solveInstrumentTransformerRatio({ primary: 1000, ratio: 200 }, "secondary");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeCloseTo(5);
  });

  it("ratio from primary,secondary", () => {
    const r = solveInstrumentTransformerRatio({ primary: 1000, secondary: 5 }, "ratio");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeCloseTo(200);
  });
});

describe("solveInstrumentTransformerRatio — VT (same math, e.g. 6600/110V)", () => {
  it("ratio from primary,secondary", () => {
    const r = solveInstrumentTransformerRatio({ primary: 6600, secondary: 110 }, "ratio");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeCloseTo(60);
  });

  it("reverse: primary from secondary,ratio", () => {
    const r = solveInstrumentTransformerRatio({ secondary: 110, ratio: 60 }, "primary");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeCloseTo(6600);
  });
});

describe("solveInstrumentTransformerRatio — meter reading ↔ actual primary is the same relation", () => {
  it("actual primary value from a meter reading and known ratio", () => {
    const r = solveInstrumentTransformerRatio({ secondary: 4.2, ratio: 200 }, "primary");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeCloseTo(840);
  });

  it("reports missing when only one value is known", () => {
    const r = solveInstrumentTransformerRatio({ secondary: 5 }, "primary");
    expect(r.ok).toBe(false);
  });
});

describe("CT_PURPOSE_NOTE — measurement vs protection are kept distinct, never merged", () => {
  it("has separate, non-identical notes for each purpose", () => {
    expect(CT_PURPOSE_NOTE.measurement).not.toBe(CT_PURPOSE_NOTE.protection);
    expect(CT_PURPOSE_NOTE.measurement).toContain("計測用");
    expect(CT_PURPOSE_NOTE.protection).toContain("保護用");
  });
});
