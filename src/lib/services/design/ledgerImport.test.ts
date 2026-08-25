import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { annotateDuplicateRows, parseDrawingLedgerFile } from "./ledgerImport";
import type { DesignCaseWithPanels } from "@/lib/types/design";

async function buildTestFile(rows: { A1: string; data: (string | number | Date)[][] }[]): Promise<File> {
  const workbook = new ExcelJS.Workbook();
  for (const sheet of rows) {
    const ws = workbook.addWorksheet(sheet.A1);
    ws.getCell("A1").value = sheet.A1;
    ws.getCell("A2").value = "年";
    ws.getCell("B2").value = "連番";
    sheet.data.forEach((row, i) => {
      const r = 3 + i;
      ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K"].forEach((col, ci) => {
        if (row[ci] !== undefined) ws.getCell(`${col}${r}`).value = row[ci];
      });
    });
  }
  const buffer = await workbook.xlsx.writeBuffer();
  return new File([buffer], "test.xlsx");
}

describe("parseDrawingLedgerFile", () => {
  it("parses a normal row with all fields", async () => {
    const file = await buildTestFile([
      {
        A1: "2026年",
        data: [
          [
            26,
            4,
            "A260101",
            "R123456",
            "テスト客先",
            "山田",
            "本社ビル改修",
            "動力盤・制御盤",
            "3面",
            "完",
            new Date("2026-03-15"),
          ],
        ],
      },
    ]);

    const rows = await parseDrawingLedgerFile(file);
    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row.year).toBe(2026);
    expect(row.sequenceNo).toBe(4);
    expect(row.drawingNumber).toBe("26-004");
    expect(row.managementNumber).toBe("A260101");
    expect(row.constructionNumber).toBe("R123456");
    expect(row.orderer).toBe("テスト客先");
    expect(row.customerContact).toBe("山田");
    expect(row.projectName).toBe("本社ビル改修");
    expect(row.panelNames).toEqual(["動力盤", "制御盤"]);
    expect(row.faceCount).toBe(3);
    expect(row.manufacturingComplete).toBe(true);
    expect(row.deliveryDate).toBe("2026-03-15");
  });

  it("treats a blank J/K cell as not-manufactured / no delivery date", async () => {
    const file = await buildTestFile([
      { A1: "2026年", data: [[26, 1, "A260001", "", "客先", "", "件名A", "盤A", "", "", ""]] },
    ]);
    const [row] = await parseDrawingLedgerFile(file);
    expect(row.manufacturingComplete).toBe(false);
    expect(row.deliveryDate).toBeNull();
    expect(row.faceCount).toBeNull();
  });

  it("stops at the first fully blank row and ignores trailing template rows", async () => {
    const file = await buildTestFile([
      {
        A1: "2026年",
        data: [
          [26, 1, "A260001", "", "客先1", "", "件名1", "盤1", "", "", ""],
          [26, 2, "A260002", "", "客先2", "", "件名2", "盤2", "", "", ""],
          [], // blank separator
          [], // second blank row -> definitely stop
          [26, 99, "SHOULD-NOT-PARSE", "", "", "", "", "", "", "", ""],
        ],
      },
    ]);
    const rows = await parseDrawingLedgerFile(file);
    expect(rows.map((r) => r.sequenceNo)).toEqual([1, 2]);
  });

  it("handles full-width digits in the year title and 連番 column", async () => {
    const file = await buildTestFile([{ A1: "２０２６年", data: [["２６", "５", "A260005", "", "", "", "件名", "", "", "", ""]] }]);
    const [row] = await parseDrawingLedgerFile(file);
    expect(row.year).toBe(2026);
    expect(row.sequenceNo).toBe(5);
    expect(row.drawingNumber).toBe("26-005");
  });

  it("skips sheets without a recognizable year title instead of throwing", async () => {
    const file = await buildTestFile([{ A1: "メモ", data: [[26, 1, "", "", "", "", "件名", "", "", "", ""]] }]);
    const rows = await parseDrawingLedgerFile(file);
    expect(rows).toHaveLength(0);
  });

  it("reads every year-sheet in a multi-sheet workbook", async () => {
    const file = await buildTestFile([
      { A1: "2025年", data: [[25, 1, "", "", "", "", "件名2025", "", "", "", ""]] },
      { A1: "2026年", data: [[26, 1, "", "", "", "", "件名2026", "", "", "", ""]] },
    ]);
    const rows = await parseDrawingLedgerFile(file);
    expect(rows.map((r) => r.year).sort()).toEqual([2025, 2026]);
  });
});

describe("annotateDuplicateRows", () => {
  it("flags rows whose computed 図面番号 already exists, leaves the rest unflagged", async () => {
    const file = await buildTestFile([
      {
        A1: "2026年",
        data: [
          [26, 1, "", "", "", "", "既存案件", "", "", "", ""],
          [26, 2, "", "", "", "", "新規案件", "", "", "", ""],
        ],
      },
    ]);
    const parsed = await parseDrawingLedgerFile(file);
    const existing = [
      { case: { drawingNumber: "26-001" } } as unknown as DesignCaseWithPanels,
    ];
    const annotated = annotateDuplicateRows(parsed, existing);
    expect(annotated.find((r) => r.sequenceNo === 1)?.isDuplicate).toBe(true);
    expect(annotated.find((r) => r.sequenceNo === 2)?.isDuplicate).toBe(false);
  });
});
