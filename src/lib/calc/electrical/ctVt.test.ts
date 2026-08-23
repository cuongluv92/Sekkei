import { describe, expect, it } from "vitest";
import {
  CT_ACCURACY_CLASS_NOTE,
  CT_MEASUREMENT_SOURCE,
  CT_PROTECTION_SOURCE,
  CT_PURPOSE_NOTE,
  solveInstrumentTransformerRatio,
  VT_MEASUREMENT_SOURCE,
  VT_PROTECTION_SOURCE,
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

describe("solveInstrumentTransformerRatio — validation", () => {
  it("rejects zero or negative primary/secondary/ratio", () => {
    expect(solveInstrumentTransformerRatio({ secondary: 0, ratio: 200 }, "primary").ok).toBe(false);
    expect(solveInstrumentTransformerRatio({ secondary: 5, ratio: -200 }, "primary").ok).toBe(false);
  });

  it("flags a directly-given primary that contradicts secondary×ratio", () => {
    const r = solveInstrumentTransformerRatio({ secondary: 5, ratio: 200, primary: 1 }, "primary");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reasonKey).toBe("inconsistentInput");
  });
});

describe("CT_PURPOSE_NOTE — measurement vs protection are kept distinct, never merged", () => {
  it("has separate, non-identical notes for each purpose", () => {
    expect(CT_PURPOSE_NOTE.measurement).not.toBe(CT_PURPOSE_NOTE.protection);
    expect(CT_PURPOSE_NOTE.measurement).toContain("計測用");
    expect(CT_PURPOSE_NOTE.protection).toContain("保護用");
  });
});

describe("solveInstrumentTransformerRatio — kind/purpose-specific standard sourcing", () => {
  it("defaults to CT + measurement → JIS C 1732-2:2025", () => {
    const r = solveInstrumentTransformerRatio({ secondary: 5, ratio: 200 }, "primary");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.sources).toContainEqual(CT_MEASUREMENT_SOURCE);
      expect(r.sources).not.toContainEqual(CT_PROTECTION_SOURCE);
    }
  });

  it("CT + measurement explicitly → JIS C 1732-2:2025", () => {
    const r = solveInstrumentTransformerRatio(
      { secondary: 5, ratio: 200 },
      "primary",
      "CT",
      "measurement",
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.sources).toContainEqual(CT_MEASUREMENT_SOURCE);
  });

  it("VT + measurement → JIS C 1732-3:2025, never the CT number", () => {
    const r = solveInstrumentTransformerRatio(
      { primary: 6600, secondary: 110 },
      "ratio",
      "VT",
      "measurement",
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.sources).toContainEqual(VT_MEASUREMENT_SOURCE);
      expect(r.sources).not.toContainEqual(CT_MEASUREMENT_SOURCE);
    }
  });

  it("CT + protection never reuses the measurement JIS C 1732-2 table", () => {
    const r = solveInstrumentTransformerRatio(
      { secondary: 5, ratio: 200 },
      "primary",
      "CT",
      "protection",
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.sources).toContainEqual(CT_PROTECTION_SOURCE);
      expect(r.sources).not.toContainEqual(CT_MEASUREMENT_SOURCE);
      expect(r.sources.find((s) => s === CT_PROTECTION_SOURCE)?.verified).toBe(false);
      expect(r.sources.find((s) => s === CT_PROTECTION_SOURCE)?.standard).toBe("—");
    }
  });

  it("VT + protection never reuses the measurement JIS C 1732-3 table", () => {
    const r = solveInstrumentTransformerRatio(
      { primary: 6600, secondary: 110 },
      "ratio",
      "VT",
      "protection",
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.sources).toContainEqual(VT_PROTECTION_SOURCE);
      expect(r.sources).not.toContainEqual(VT_MEASUREMENT_SOURCE);
    }
  });
});

describe("CT_ACCURACY_CLASS_NOTE — free-text reference only, no curated/authoritative-looking option list", () => {
  it("measurement and protection notes are distinct and both point to the nameplate/test report, not a selectable list", () => {
    expect(CT_ACCURACY_CLASS_NOTE.measurement).not.toBe(CT_ACCURACY_CLASS_NOTE.protection);
    expect(CT_ACCURACY_CLASS_NOTE.measurement).toContain("銘板");
    expect(CT_ACCURACY_CLASS_NOTE.protection).toContain("銘板");
  });

  it("protection note explicitly flags the standard as unconfirmed, distinct from measurement", () => {
    expect(CT_ACCURACY_CLASS_NOTE.protection).not.toBe(CT_ACCURACY_CLASS_NOTE.measurement);
    expect(CT_ACCURACY_CLASS_NOTE.protection).toContain("未特定");
  });
});
