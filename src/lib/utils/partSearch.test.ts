import { describe, expect, it } from "vitest";
import {
  distinctCategories,
  distinctManufacturerIds,
  hasUncategorizedItem,
  hasUnsetManufacturer,
  matchesPartFilters,
  matchesSpecificationQuery,
  UNSET_FILTER_VALUE,
} from "./partSearch";

describe("matchesSpecificationQuery — technical token matching", () => {
  // 1-3: a number+unit query must never match a longer token that merely contains it.
  it("'5AT' does not match '125AT'", () => {
    expect(matchesSpecificationQuery("3P 125AT 25kA", "5AT")).toBe(false);
  });

  it("'5AT' does not match '225AT'", () => {
    expect(matchesSpecificationQuery("3P 225AT 25kA", "5AT")).toBe(false);
  });

  it("'10AT' does not match '110AT'", () => {
    expect(matchesSpecificationQuery("3P 110AT 25kA", "10AT")).toBe(false);
  });

  // 4-5: exact number+unit tokens match themselves.
  it("'125AT' matches '125AT'", () => {
    expect(matchesSpecificationQuery("3P 250AF／125AT 25kA", "125AT")).toBe(
      true,
    );
  });

  it("'250AF' matches '250AF'", () => {
    expect(matchesSpecificationQuery("3P 250AF／125AT 25kA", "250AF")).toBe(
      true,
    );
  });

  // 6: exact match must not be fooled by a longer token sharing the suffix.
  it("'250AF' does not match '1250AF'", () => {
    expect(matchesSpecificationQuery("3P 1250AF／125AT 25kA", "250AF")).toBe(
      false,
    );
  });

  // 7-8: a bare unit (no leading digits) searches broadly for that parameter type.
  it("'AF' matches many AF values (30AF, 63AF, 125AF, 250AF)", () => {
    expect(matchesSpecificationQuery("30AF", "AF")).toBe(true);
    expect(matchesSpecificationQuery("63AF", "AF")).toBe(true);
    expect(matchesSpecificationQuery("125AF", "AF")).toBe(true);
    expect(matchesSpecificationQuery("250AF", "AF")).toBe(true);
  });

  it("'AT' matches many AT values", () => {
    expect(matchesSpecificationQuery("3P 250AF／30AT 25kA", "AT")).toBe(true);
    expect(matchesSpecificationQuery("3P 250AF／225AT 25kA", "AT")).toBe(true);
  });

  it("'kA' matches breaking-capacity values", () => {
    expect(matchesSpecificationQuery("3P 250AF／125AT 25kA", "kA")).toBe(true);
    expect(matchesSpecificationQuery("3P 250AF／125AT 10kA", "kA")).toBe(true);
  });

  it("'3P' only matches the exact '3P' token, not any token containing 'P'", () => {
    expect(matchesSpecificationQuery("3P 250AF／125AT 25kA", "3P")).toBe(true);
    expect(matchesSpecificationQuery("4P 250AF／125AT 25kA", "3P")).toBe(false);
  });

  // 9: multi-keyword AND across tokens.
  it("'3P 250AF 125AT' only matches a record carrying all three tokens", () => {
    expect(
      matchesSpecificationQuery("3P 250AF／125AT 25kA", "3P 250AF 125AT"),
    ).toBe(true);
    expect(
      matchesSpecificationQuery("3P 250AF／175AT 25kA", "3P 250AF 125AT"),
    ).toBe(false);
  });

  it("'3P 250AF 125AT 25kA' matches only when every token is present", () => {
    expect(
      matchesSpecificationQuery("3P 250AF／125AT 25kA", "3P 250AF 125AT 25kA"),
    ).toBe(true);
    expect(
      matchesSpecificationQuery("3P 250AF／175AT 25kA", "3P 250AF 125AT 25kA"),
    ).toBe(false);
  });

  // 10: full-width／and half-width / are equivalent.
  it("'/' and '／' normalize to the same result", () => {
    expect(matchesSpecificationQuery("3P 250AF/125AT 25kA", "125AT")).toBe(
      true,
    );
    expect(matchesSpecificationQuery("3P 250AF／125AT 25kA", "125AT")).toBe(
      true,
    );
  });

  // 11: case-insensitive.
  it("uppercase/lowercase does not affect matching", () => {
    expect(
      matchesSpecificationQuery("3P 250AF／125AT 25kA", "3p 250af 125at 25ka"),
    ).toBe(true);
    expect(
      matchesSpecificationQuery("3p 250af／125at 25ka", "3P 250AF 125AT 25KA"),
    ).toBe(true);
  });

  it("full-width digits/letters normalize via NFKC (３Ｐ ≡ 3P)", () => {
    expect(
      matchesSpecificationQuery(
        "３Ｐ　２５０ＡＦ／１２５ＡＴ　２５ｋＡ",
        "3P 250AF 125AT",
      ),
    ).toBe(true);
  });

  it("a blank query matches everything", () => {
    expect(matchesSpecificationQuery("3P 250AF／125AT 25kA", "")).toBe(true);
    expect(matchesSpecificationQuery("3P 250AF／125AT 25kA", "   ")).toBe(true);
  });
});

describe("matchesPartFilters — メーカー/分類 exact match, keyword substring, specification token match combine via AND", () => {
  const item = {
    symbol: "MCCB-1",
    category: "配線用遮断器",
    manufacturerId: "mfr-mitsubishi",
    model: "NF250-CV",
    specification: "3P 250AF／125AT 25kA",
  };

  it("matches when every filter is satisfied", () => {
    expect(
      matchesPartFilters(item, {
        manufacturerId: "mfr-mitsubishi",
        category: "配線用遮断器",
        keyword: "NF250",
        specification: "3P 250AF 125AT",
      }),
    ).toBe(true);
  });

  it("fails when the specification token doesn't match even if everything else does", () => {
    expect(
      matchesPartFilters(item, {
        manufacturerId: "mfr-mitsubishi",
        category: "配線用遮断器",
        keyword: "NF250",
        specification: "175AT",
      }),
    ).toBe(false);
  });

  it("keyword field matches 記号/品名(分類)/型式 by substring (not exact-token)", () => {
    expect(matchesPartFilters(item, { keyword: "NF250" })).toBe(true);
    expect(matchesPartFilters(item, { keyword: "MCCB" })).toBe(true);
    expect(matchesPartFilters(item, { keyword: "配線用遮断器" })).toBe(true);
  });

  it("メーカー未設定 sentinel only matches blank manufacturerId", () => {
    expect(
      matchesPartFilters(
        { ...item, manufacturerId: "" },
        { manufacturerId: UNSET_FILTER_VALUE },
      ),
    ).toBe(true);
    expect(
      matchesPartFilters(item, { manufacturerId: UNSET_FILTER_VALUE }),
    ).toBe(false);
  });
});

describe("manufacturer/category dropdown data sources reflect only active data (spec #1, #2)", () => {
  const items = [
    { manufacturerId: "mfr-a", category: "配線用遮断器" },
    { manufacturerId: "mfr-a", category: "端子台" },
    { manufacturerId: "mfr-b", category: "配線用遮断器" },
    { manufacturerId: "", category: "端子台" },
  ];

  it("distinctManufacturerIds only returns manufacturers that actually appear (never the full master list)", () => {
    expect(distinctManufacturerIds(items).sort()).toEqual(["mfr-a", "mfr-b"]);
  });

  it("distinctCategories only returns categories present in the given items", () => {
    expect(distinctCategories(items).sort()).toEqual([
      "端子台",
      "配線用遮断器",
    ]);
  });

  it("categories narrow to the selected manufacturer's own categories", () => {
    const scoped = items.filter((i) =>
      matchesPartFilters(i as never, { manufacturerId: "mfr-a" }),
    );
    expect(distinctCategories(scoped)).toEqual(["端子台", "配線用遮断器"]);

    const scopedB = items.filter((i) =>
      matchesPartFilters(i as never, { manufacturerId: "mfr-b" }),
    );
    expect(distinctCategories(scopedB)).toEqual(["配線用遮断器"]);
  });

  it("hasUnsetManufacturer is true only when a record actually has a blank manufacturer", () => {
    expect(hasUnsetManufacturer(items)).toBe(true);
    expect(
      hasUnsetManufacturer(items.filter((i) => i.manufacturerId !== "")),
    ).toBe(false);
  });

  it("hasUncategorizedItem is true only when a record actually has a blank category", () => {
    expect(hasUncategorizedItem(items)).toBe(false);
    expect(
      hasUncategorizedItem([
        ...items,
        { manufacturerId: "mfr-c", category: "" },
      ]),
    ).toBe(true);
  });
});
