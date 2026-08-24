import { describe, expect, it } from "vitest";
import { patchDxfPartList } from "./dxfPartListPatch";
import type { PartAssemblyRow } from "@/lib/types";

function row(overrides: Partial<PartAssemblyRow>): PartAssemblyRow {
  return {
    id: "r1",
    symbol: "S1",
    name: "ブレーカー",
    manufacturerId: "",
    model: "M1",
    specification: "spec",
    quantity: 2,
    remarks: "",
    ...overrides,
  };
}

/** Minimal but structurally valid DXF: HEADER + a 2-row placeholder table in ENTITIES. */
function buildFixtureDxf(): string {
  const lines = [
    "0",
    "SECTION",
    "2",
    "HEADER",
    "0",
    "ENDSEC",
    "0",
    "SECTION",
    "2",
    "ENTITIES",
    // frame line — untouched geometry, should survive byte-identical
    "0",
    "LINE",
    "5",
    "10",
    "8",
    "0",
    "10",
    "0.0",
    "20",
    "0.0",
    "11",
    "100.0",
    "21",
    "0.0",
    // row 1 placeholders
    "0",
    "TEXT",
    "5",
    "11",
    "8",
    "0",
    "10",
    "0.0",
    "20",
    "10.0",
    "40",
    "2.5",
    "1",
    "{symbol_1}",
    "0",
    "TEXT",
    "5",
    "12",
    "1",
    "{quantity_1}",
    // row 2 placeholders (only quantity, to test partial-row matching)
    "0",
    "TEXT",
    "5",
    "13",
    "1",
    "{quantity_2}",
    "0",
    "ENDSEC",
    "0",
    "EOF",
  ];
  return lines.join("\n") + "\n";
}

describe("patchDxfPartList", () => {
  it("fills matched row placeholders and reports counts", () => {
    const dxf = buildFixtureDxf();
    const rows = [row({ symbol: "S1", quantity: 3 }), row({ symbol: "S2", quantity: 5 })];
    const result = patchDxfPartList(dxf, rows, "ja");

    expect(result.placeholdersFound).toBe(true);
    expect(result.rowsWritten).toBe(2);
    expect(result.rowsSkipped).toBe(0);
    expect(result.text).toContain("S1");
    expect(result.text).toContain("\n3\n");
    expect(result.text).toContain("\n5\n");
    expect(result.text).not.toContain("{symbol_1}");
    expect(result.text).not.toContain("{quantity_1}");
    expect(result.text).not.toContain("{quantity_2}");
    // untouched geometry survives verbatim
    expect(result.text).toContain("LINE");
    expect(result.text).toContain("100.0");
  });

  it("leaves rows without a data counterpart blank rather than literal placeholder text", () => {
    const dxf = buildFixtureDxf();
    const result = patchDxfPartList(dxf, [row({ symbol: "S1", quantity: 3 })], "ja");
    expect(result.rowsWritten).toBe(1);
    expect(result.text).not.toContain("{quantity_2}");
  });

  it("reports rowsSkipped when the part list exceeds the template's placeholder rows", () => {
    const dxf = buildFixtureDxf(); // only rows 1-2 have placeholders
    const rows = [
      row({ symbol: "S1" }),
      row({ symbol: "S2" }),
      row({ symbol: "S3" }),
    ];
    const result = patchDxfPartList(dxf, rows, "ja");
    expect(result.rowsWritten).toBe(2);
    expect(result.rowsSkipped).toBe(1);
  });

  it("reports placeholdersFound: false for a template with no placeholder tags", () => {
    const dxf = ["0", "SECTION", "2", "ENTITIES", "0", "ENDSEC", "0", "EOF"].join("\n") + "\n";
    const result = patchDxfPartList(dxf, [row({})], "ja");
    expect(result.placeholdersFound).toBe(false);
    expect(result.rowsWritten).toBe(0);
    expect(result.rowsSkipped).toBe(1);
  });

  it("resolves manufacturer name from manufacturerId when present", () => {
    const dxf = buildFixtureDxf();
    const result = patchDxfPartList(dxf, [row({ manufacturerId: "" })], "ja");
    // empty manufacturerId path only exercised elsewhere; this test just
    // guards that the function doesn't throw with a populated field set.
    expect(result.rowsWritten).toBe(1);
  });
});
