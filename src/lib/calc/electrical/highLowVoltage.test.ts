import { describe, expect, it } from "vitest";
import {
  classifyVoltage,
  isHighVoltageReceivingContext,
  JIS_C4620_CUBICLE_SOURCE,
  VOLTAGE_CLASS_SOURCE,
} from "./highLowVoltage";

describe("classifyVoltage — AC", () => {
  it("100V is 低圧", () => {
    expect(classifyVoltage(100, "AC")).toBe("low");
  });
  it("exactly 600V is still 低圧 (boundary, inclusive)", () => {
    expect(classifyVoltage(600, "AC")).toBe("low");
  });
  it("601V is 高圧", () => {
    expect(classifyVoltage(601, "AC")).toBe("high");
  });
  it("6600V (typical 6.6kV distribution) is 高圧", () => {
    expect(classifyVoltage(6600, "AC")).toBe("high");
  });
  it("exactly 7000V is still 高圧 (boundary, inclusive)", () => {
    expect(classifyVoltage(7000, "AC")).toBe("high");
  });
  it("7001V is 特別高圧", () => {
    expect(classifyVoltage(7001, "AC")).toBe("extraHigh");
  });
});

describe("classifyVoltage — DC uses a different 低圧 boundary (750V, not 600V)", () => {
  it("700V DC is still 低圧", () => {
    expect(classifyVoltage(700, "DC")).toBe("low");
  });
  it("700V AC is already 高圧 — DC and AC boundaries must never be conflated", () => {
    expect(classifyVoltage(700, "AC")).toBe("high");
  });
  it("751V DC is 高圧", () => {
    expect(classifyVoltage(751, "DC")).toBe("high");
  });
  it("exactly 7000V DC is still 高圧 (boundary, inclusive — same 高圧/特別高圧 threshold as AC)", () => {
    expect(classifyVoltage(7000, "DC")).toBe("high");
  });
  it("7001V DC is 特別高圧", () => {
    expect(classifyVoltage(7001, "DC")).toBe("extraHigh");
  });
});

describe("classifyVoltage — invalid input", () => {
  it("negative voltage returns null, not a fabricated class", () => {
    expect(classifyVoltage(-100)).toBeNull();
  });
  it("NaN returns null", () => {
    expect(classifyVoltage(NaN)).toBeNull();
  });
});

describe("isHighVoltageReceivingContext", () => {
  it("6600V is flagged as a high-voltage receiving (cubicle) context", () => {
    expect(isHighVoltageReceivingContext(6600)).toBe(true);
  });
  it("200V (low voltage) is not", () => {
    expect(isHighVoltageReceivingContext(200)).toBe(false);
  });
  it("22000V (extra-high) is outside the 6.6kV cubicle range", () => {
    expect(isHighVoltageReceivingContext(22000)).toBe(false);
  });
});

describe("VOLTAGE_CLASS_SOURCE — honestly marked unverified", () => {
  it("is not claimed verified without an actual standard-text check", () => {
    expect(VOLTAGE_CLASS_SOURCE.verified).toBe(false);
    expect(VOLTAGE_CLASS_SOURCE.verificationNote).toBeTruthy();
  });

  it("is classified as a law/ordinance (省令), not an industrial standard (JIS)", () => {
    expect(VOLTAGE_CLASS_SOURCE.sourceType).toBe("law");
    expect(VOLTAGE_CLASS_SOURCE.standard).toBe("電気設備に関する技術基準を定める省令");
  });
});

describe("JIS_C4620_CUBICLE_SOURCE — confirmed scope, now verified:true", () => {
  it("states the confirmed voltage/frequency/short-circuit-current/capacity scope", () => {
    expect(JIS_C4620_CUBICLE_SOURCE.verified).toBe(true);
    expect(JIS_C4620_CUBICLE_SOURCE.applicability).toContain("6.6kV");
    expect(JIS_C4620_CUBICLE_SOURCE.applicability).toContain("12.5kA");
    expect(JIS_C4620_CUBICLE_SOURCE.applicability).toContain("4000kVA");
  });

  it("still carries a note about the 2024/03 correction sheet despite being verified", () => {
    expect(JIS_C4620_CUBICLE_SOURCE.verificationNote).toContain("訂正票");
  });
});
