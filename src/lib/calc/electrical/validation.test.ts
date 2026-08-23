import { describe, expect, it } from "vitest";
import {
  firstValidationError,
  requireLessOrEqual,
  requireNonNegative,
  requirePositive,
  requirePositiveEvenInteger,
  requireRatio01,
  requireRatio01Inclusive,
} from "./validation";

describe("requirePositive", () => {
  it("passes for a positive value", () => {
    expect(requirePositive(5, "V")).toBeNull();
  });
  it("rejects zero", () => {
    expect(requirePositive(0, "V")).not.toBeNull();
  });
  it("rejects negative", () => {
    expect(requirePositive(-1, "V")).not.toBeNull();
  });
  it("passes through undefined (not yet entered)", () => {
    expect(requirePositive(undefined, "V")).toBeNull();
  });
});

describe("requireNonNegative", () => {
  it("passes for zero", () => {
    expect(requireNonNegative(0, "R")).toBeNull();
  });
  it("rejects negative", () => {
    expect(requireNonNegative(-0.1, "R")).not.toBeNull();
  });
});

describe("requireRatio01 — (0,1]", () => {
  it("passes for 1 (pf=1, unity power factor)", () => {
    expect(requireRatio01(1, "cosφ")).toBeNull();
  });
  it("passes for 0.85", () => {
    expect(requireRatio01(0.85, "cosφ")).toBeNull();
  });
  it("rejects 0", () => {
    expect(requireRatio01(0, "cosφ")).not.toBeNull();
  });
  it("rejects values above 1", () => {
    expect(requireRatio01(1.2, "cosφ")).not.toBeNull();
  });
  it("rejects negative", () => {
    expect(requireRatio01(-0.5, "cosφ")).not.toBeNull();
  });
});

describe("requireRatio01Inclusive — [0,1]", () => {
  it("passes for 0 (no slip) and 1 (locked rotor)", () => {
    expect(requireRatio01Inclusive(0, "s")).toBeNull();
    expect(requireRatio01Inclusive(1, "s")).toBeNull();
  });
  it("rejects negative and >1", () => {
    expect(requireRatio01Inclusive(-0.1, "s")).not.toBeNull();
    expect(requireRatio01Inclusive(1.1, "s")).not.toBeNull();
  });
});

describe("requirePositiveEvenInteger", () => {
  it("passes for 2, 4, 6", () => {
    expect(requirePositiveEvenInteger(2, "極数")).toBeNull();
    expect(requirePositiveEvenInteger(4, "極数")).toBeNull();
    expect(requirePositiveEvenInteger(6, "極数")).toBeNull();
  });
  it("rejects odd integers", () => {
    expect(requirePositiveEvenInteger(3, "極数")).not.toBeNull();
  });
  it("rejects non-integers", () => {
    expect(requirePositiveEvenInteger(2.5, "極数")).not.toBeNull();
  });
  it("rejects zero and negative", () => {
    expect(requirePositiveEvenInteger(0, "極数")).not.toBeNull();
    expect(requirePositiveEvenInteger(-2, "極数")).not.toBeNull();
  });
});

describe("requireLessOrEqual", () => {
  it("passes when a <= b", () => {
    expect(requireLessOrEqual(5, 10, "P", "S")).toBeNull();
    expect(requireLessOrEqual(10, 10, "P", "S")).toBeNull();
  });
  it("rejects a > b", () => {
    expect(requireLessOrEqual(11, 10, "P", "S")).not.toBeNull();
  });
  it("tolerates tiny rounding overshoot", () => {
    expect(requireLessOrEqual(10.0001, 10, "P", "S")).toBeNull();
  });
  it("skips the check when either side is undefined", () => {
    expect(requireLessOrEqual(undefined, 10, "P", "S")).toBeNull();
    expect(requireLessOrEqual(5, undefined, "P", "S")).toBeNull();
  });
});

describe("firstValidationError", () => {
  it("returns null when every check passes", () => {
    expect(firstValidationError(null, null, null)).toBeNull();
  });
  it("returns an invalidInput result for the first failing check", () => {
    const result = firstValidationError(null, "エラーA", "エラーB");
    expect(result).not.toBeNull();
    expect(result?.ok).toBe(false);
    if (result && !result.ok) {
      expect(result.reasonKey).toBe("invalidInput");
      expect(result.message).toBe("エラーA");
    }
  });
});
