import { describe, expect, it } from "vitest";
import {
  isWithinSimpleSelectionRange,
  JSIA_T1006_SOURCE,
} from "./highCurrentRule";

describe("isWithinSimpleSelectionRange — the 630A switch (spec #10, #25)", () => {
  it("630A is still within the simplified JIS C 8480 range", () => {
    expect(isWithinSimpleSelectionRange(630)).toBe(true);
  });

  it("631A switches to high-current mode", () => {
    expect(isWithinSimpleSelectionRange(631)).toBe(false);
  });
});

describe("JSIA_T1006_SOURCE — must never claim to be verified until the document is obtained", () => {
  it("is explicitly unverified", () => {
    expect(JSIA_T1006_SOURCE.verified).toBe(false);
  });

  it("carries a verification note explaining what's missing", () => {
    expect(JSIA_T1006_SOURCE.verificationNote).toBeTruthy();
  });
});
