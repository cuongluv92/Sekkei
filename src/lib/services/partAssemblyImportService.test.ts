import { describe, expect, it } from "vitest";
import { parsePartAssemblyImportFile, specificationLooselyMatches, stripSymbolInstanceNumber } from "./partAssemblyImportService";

/**
 * Real-world DXF files exported by Japanese-locale AutoCAD (and a lot of
 * JW-CAD-family tooling) write ASCII group-code text as Shift_JIS (CP932),
 * not UTF-8 — decoding with a fixed UTF-8 assumption turns every Japanese
 * label into mojibake and `findHeaderFields` silently matches nothing. This
 * builds a minimal grid-mode DXF with the header labels and one row's text
 * encoded as raw Shift_JIS bytes (precomputed via Python's `str.encode`),
 * everything else plain ASCII, to prove `parsePartAssemblyImportFile` still
 * recovers the real values instead of just failing to find the grid.
 */
const SJIS = {
  "記　号": [139, 76, 129, 64, 141, 134],
  "品　名": [149, 105, 129, 64, 150, 188],
  "メーカー": [131, 129, 129, 91, 131, 74, 129, 91],
  "型　式": [140, 94, 129, 64, 142, 174],
  "定　格　・　仕　様": [146, 232, 129, 64, 138, 105, 129, 64, 129, 69, 129, 64, 142, 100, 129, 64, 151, 108],
  "数　量": [144, 148, 129, 64, 151, 202],
  "備　考": [148, 245, 129, 64, 141, 108],
  配線用遮断器: [148, 122, 144, 252, 151, 112, 142, 213, 146, 102, 138, 237],
  予備: [151, 92, 148, 245],
} as const;

function sjisBytes(text: string): number[] {
  const known = SJIS[text as keyof typeof SJIS];
  if (known) return [...known];
  // ASCII-only fragments (symbol/model/spec/quantity/"-") round-trip identically in UTF-8 and Shift_JIS.
  return [...text].map((c) => c.charCodeAt(0));
}

function ascii(text: string): number[] {
  return [...text].map((c) => c.charCodeAt(0));
}

function buildShiftJisGridDxf(): Uint8Array<ArrayBuffer> {
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

  const bytes: number[] = [];
  const push = (...parts: number[][]) => parts.forEach((p) => bytes.push(...p));
  const line = (text: string) => push(ascii(text), [0x0a]);

  line("0");
  line("SECTION");
  line("2");
  line("ENTITIES");
  for (const [text, x, y] of header) {
    line("0");
    line("TEXT");
    line("8");
    line("0");
    line("10");
    line(String(x));
    line("20");
    line(String(y));
    line("1");
    push(sjisBytes(text), [0x0a]);
  }
  // one filled row: 記号/品名/メーカー/数量/備考 real values, 型式/仕様 left as "-" (unfilled cell)
  const rowVals = ["MCCB1", "配線用遮断器", "BBW", "-", "-", "1", "予備"];
  for (let i = 0; i < rowXs.length; i++) {
    line("0");
    line("TEXT");
    line("8");
    line("0");
    line("10");
    line(String(rowXs[i]));
    line("20");
    line("259.75");
    line("1");
    push(sjisBytes(rowVals[i]), [0x0a]);
  }
  line("0");
  line("ENDSEC");
  line("0");
  line("EOF");
  return new Uint8Array(new ArrayBuffer(bytes.length)).map((_, i) => bytes[i]);
}

describe("parsePartAssemblyImportFile (DXF, Shift_JIS encoded)", () => {
  it("recovers real values from a DXF whose Japanese text is Shift_JIS, not UTF-8", async () => {
    const file = new File([buildShiftJisGridDxf()], "見積.dxf", { type: "application/dxf" });
    const result = await parsePartAssemblyImportFile(file);

    expect(result.found).toBe(true);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      symbol: "MCCB1",
      name: "配線用遮断器",
      model: "",
      specification: "",
      quantity: 1,
      remarks: "予備",
    });
  });
});

describe("stripSymbolInstanceNumber", () => {
  it("strips a single trailing instance number", () => {
    expect(stripSymbolInstanceNumber("MCCB1")).toBe("MCCB");
    expect(stripSymbolInstanceNumber("MCCB12")).toBe("MCCB");
  });

  it("strips a comma-separated instance list", () => {
    expect(stripSymbolInstanceNumber("MCCB1,2")).toBe("MCCB");
    expect(stripSymbolInstanceNumber("MCCB1,2,3")).toBe("MCCB");
  });

  it("strips a tilde/dash range", () => {
    expect(stripSymbolInstanceNumber("MCCB1～3")).toBe("MCCB");
    expect(stripSymbolInstanceNumber("MCCB1~3")).toBe("MCCB");
    expect(stripSymbolInstanceNumber("MCCB1-3")).toBe("MCCB");
  });

  it("strips a spaced/full-width-comma list", () => {
    expect(stripSymbolInstanceNumber("MCCB 1、2、3")).toBe("MCCB");
  });

  it("leaves a symbol with no trailing digits unchanged", () => {
    expect(stripSymbolInstanceNumber("NF32-CVF")).toBe("NF32-CVF");
    expect(stripSymbolInstanceNumber("MC")).toBe("MC");
  });

  it("keeps the original when stripping would leave nothing", () => {
    expect(stripSymbolInstanceNumber("123")).toBe("123");
  });

  it("trims surrounding whitespace", () => {
    expect(stripSymbolInstanceNumber("  MCCB1  ")).toBe("MCCB");
  });
});

describe("specificationLooselyMatches", () => {
  it("matches when the leading 2-3 tokens agree, ignoring a trailing free-text note on either side", () => {
    expect(specificationLooselyMatches("3P 50AF 30AT 盤内専用品", "3P 50AF/30AT")).toBe(true);
    expect(specificationLooselyMatches("3P 50AF 30AT", "3P 50AF/30AT 屋外仕様 IP65")).toBe(true);
  });

  it("applies to non-breaker parts too, not just AF/AT/pole ratings", () => {
    expect(specificationLooselyMatches("8P 95A", "8P 95A")).toBe(true);
    expect(specificationLooselyMatches("φ30 AC200V 電子音 90dB", "φ30 AC200V 電子音 85dB")).toBe(true);
  });

  it("does not match when a leading token differs", () => {
    expect(specificationLooselyMatches("3P 50AF 30AT", "3P 50AF/40AT")).toBe(false);
    expect(specificationLooselyMatches("3P 50AF 30AT", "2P 50AF/30AT")).toBe(false);
  });

  it("does not match when the candidate has fewer leading tokens than the row needs", () => {
    expect(specificationLooselyMatches("3P 50AF 30AT", "3P")).toBe(false);
  });

  it("never matches when the row's specification is blank", () => {
    expect(specificationLooselyMatches("", "3P 50AF/30AT")).toBe(false);
  });
});

describe("parsePartAssemblyImportFile (in-batch duplicate detection)", () => {
  it("flags the second of two rows resolving to the same 記号・型式・仕様・メーカー as an exact duplicate, leaving the first unflagged", async () => {
    const csv = ["記号,品名,メーカー,型式,仕様", "MCCB1,配線用遮断器,BBW,NF32,AC200V 5A", "MCCB2,配線用遮断器,BBW,NF32,AC200V 5A"].join(
      "\n",
    );
    const file = new File([csv], "list.csv", { type: "text/csv" });
    const result = await parsePartAssemblyImportFile(file);

    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].masterDuplicate).toBeUndefined();
    expect(result.rows[1].masterDuplicate).toMatchObject({ model: "NF32", exact: true });
  });

  it("does not flag two rows with different 記号 that both happen to have blank 型式・仕様", async () => {
    const csv = ["記号,品名,メーカー,型式,仕様", "T1,端子台,,,", "MC1,電磁接触器,,,"].join("\n");
    const file = new File([csv], "list.csv", { type: "text/csv" });
    const result = await parsePartAssemblyImportFile(file);

    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].masterDuplicate).toBeUndefined();
    expect(result.rows[1].masterDuplicate).toBeUndefined();
  });

  it("blocks a second row sharing the same 型番 as an earlier row in the batch, even when 記号・仕様・メーカー all differ", async () => {
    // part_data.model has a table-wide unique constraint regardless of any
    // other field, so two rows resolving to the same 型番 can never both be
    // registered — this must be caught unconditionally, not only when the
    // rest of the row also matches (that's the separate, softer "exact"
    // semantic-duplicate check above).
    const csv = ["記号,品名,メーカー,型式,仕様", "T1,端子台,BBW,NF32,AC100V", "MC1,電磁接触器,DBK,NF32,DC24V"].join("\n");
    const file = new File([csv], "list.csv", { type: "text/csv" });
    const result = await parsePartAssemblyImportFile(file);

    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].masterDuplicate).toBeUndefined();
    expect(result.rows[1].masterDuplicate).toMatchObject({ model: "NF32", exact: true, blocked: true });
  });
});
