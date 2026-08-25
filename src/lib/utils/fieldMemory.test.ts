import { beforeEach, describe, expect, it } from "vitest";
import { getFieldSuggestions, rememberFieldValue } from "./fieldMemory";

describe("fieldMemory", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("returns an empty list for a field never remembered", () => {
    expect(getFieldSuggestions("partModel")).toEqual([]);
  });

  it("remembers a value and returns it as a suggestion", () => {
    rememberFieldValue("partModel", "MCCB-100");
    expect(getFieldSuggestions("partModel")).toEqual(["MCCB-100"]);
  });

  it("moves a re-entered value to the front instead of duplicating it", () => {
    rememberFieldValue("partModel", "A");
    rememberFieldValue("partModel", "B");
    rememberFieldValue("partModel", "A");
    expect(getFieldSuggestions("partModel")).toEqual(["A", "B"]);
  });

  it("ignores blank/whitespace-only values", () => {
    rememberFieldValue("partModel", "   ");
    expect(getFieldSuggestions("partModel")).toEqual([]);
  });

  it("keeps fields isolated from each other", () => {
    rememberFieldValue("partModel", "MCCB-100");
    rememberFieldValue("partName", "ブレーカー");
    expect(getFieldSuggestions("partModel")).toEqual(["MCCB-100"]);
    expect(getFieldSuggestions("partName")).toEqual(["ブレーカー"]);
  });

  it("caps the remembered list at 60 entries, keeping the most recent", () => {
    for (let i = 0; i < 65; i++) rememberFieldValue("partModel", `V${i}`);
    const list = getFieldSuggestions("partModel");
    expect(list.length).toBe(60);
    expect(list[0]).toBe("V64");
    expect(list).not.toContain("V0");
  });
});
