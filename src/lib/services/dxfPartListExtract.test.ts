import { describe, expect, it } from "vitest";
import { extractDxfPartList } from "./dxfPartListExtract";
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

/** Same real-AutoCAD-shaped fixture `dxfPartListPatch.test.ts` uses for grid mode — jittered header baselines + a wide off-center 定格・仕様 label + a stray unrelated "(備考)" note. */
function buildGridFixtureDxf(rowCount = 2): string {
  const header: [string, number, number][] = [
    ["記　号", 22.0, 270.838],
    ["品　名", 59.5, 270.734],
    ["メーカー", 94.3, 270.752],
    ["型　式", 142.0, 270.688],
    ["定　格　・　仕　様", 243.5, 270.73],
    ["数　量", 357.0, 270.748],
    ["備　考", 382.0, 270.724],
  ];
  const rowXs = [28.668, 66.168, 103.668, 148.668, 182.0, 363.668, 388.668];
  const rowYs = Array.from({ length: rowCount }, (_, i) => 259.75 - i * 7.5);

  const lines: string[] = ["0", "SECTION", "2", "ENTITIES"];
  for (const [text, x, y] of header) {
    lines.push("0", "TEXT", "8", "0", "10", String(x), "20", String(y), "1", text);
  }
  lines.push("0", "TEXT", "8", "0", "10", "217.5", "20", "24.25", "1", "(備考)");
  for (const y of rowYs) {
    for (const x of rowXs) {
      lines.push("0", "TEXT", "8", "0", "10", String(x), "20", String(y), "1", "-");
    }
  }
  lines.push("0", "ENDSEC", "0", "EOF");
  return lines.join("\n") + "\n";
}

describe("extractDxfPartList", () => {
  it("reads back exactly what patchDxfPartList wrote into the same grid template", () => {
    const template = buildGridFixtureDxf(3);
    const rows = [
      row({ symbol: "MCCB1", name: "配線用遮断器", model: "BBW", specification: "AC200V 10A", quantity: 1, remarks: "予備" }),
      row({ symbol: "MC1", name: "電磁接触器", model: "SC-N1", specification: "AC200V 5A", quantity: 3, remarks: "" }),
    ];
    const filled = patchDxfPartList(template, rows, "ja");
    expect(filled.rowsWritten).toBe(2);

    const extracted = extractDxfPartList(filled.text);
    expect(extracted.found).toBe(true);
    expect(extracted.rows).toHaveLength(2);
    expect(extracted.rows[0]).toMatchObject({
      symbol: "MCCB1",
      name: "配線用遮断器",
      model: "BBW",
      specification: "AC200V 10A",
      quantity: 1,
      remarks: "予備",
    });
    expect(extracted.rows[1]).toMatchObject({
      symbol: "MC1",
      name: "電磁接触器",
      model: "SC-N1",
      specification: "AC200V 5A",
      quantity: 3,
      remarks: "",
    });
  });

  it("stops at the first still-blank template row rather than returning empty trailing rows", () => {
    const template = buildGridFixtureDxf(5); // 5 pre-drawn rows, only 1 gets filled
    const filled = patchDxfPartList(template, [row({ symbol: "ONLY1" })], "ja");
    const extracted = extractDxfPartList(filled.text);
    expect(extracted.rows).toHaveLength(1);
    expect(extracted.rows[0].symbol).toBe("ONLY1");
  });

  it("returns found: false when no 部品リスト header is present", () => {
    const dxf = ["0", "SECTION", "2", "ENTITIES", "0", "ENDSEC", "0", "EOF"].join("\n") + "\n";
    const extracted = extractDxfPartList(dxf);
    expect(extracted.found).toBe(false);
    expect(extracted.rows).toEqual([]);
  });

  it("ignores a row-number (連番) column outside the 7-field grid — real BricsCAD/AutoCAD title blocks often draw one just left of 記号", () => {
    // Reproduces a real bug found against an actual customer DXF: an 8th
    // TEXT cell (a row-number label like "1") sits well left of the 記号
    // column on some rows, which used to break the "exactly one cell per
    // column" cardinality check on literally every row, so nothing was ever
    // extracted (rows: 0) even though the file had real data.
    const template = buildGridFixtureDxf(2);
    const lines = template.trimEnd().split("\n");
    const endsecIdx = lines.lastIndexOf("ENDSEC");
    const rowNumberLines = ["0", "TEXT", "8", "0", "10", "6.5", "20", "259.78", "1", "1"];
    lines.splice(endsecIdx - 1, 0, ...rowNumberLines);
    const dxf = lines.join("\n") + "\n";

    const filled = patchDxfPartList(dxf, [row({ symbol: "MCCB1" })], "ja");
    const extracted = extractDxfPartList(filled.text);
    expect(extracted.rows).toHaveLength(1);
    expect(extracted.rows[0].symbol).toBe("MCCB1");
  });
});
