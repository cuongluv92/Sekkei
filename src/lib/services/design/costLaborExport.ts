import { loadActiveTemplate, downloadWorkbook } from "./excelWorkbook";
import { PdfCanvas, downloadPdf } from "./pdfCanvas";
import type { DesignCaseWithPanels, CasePanel } from "@/lib/types/design";

/**
 * ⑥仕入原価・工数一覧表 (工数データ sheet only — 仕入原価データ/原価一覧/ナラサキ価格比較
 * are pricing sheets, confirmed out of scope). Real template columns:
 * A=図面番号, B=管理番号, C=工事番号, D=件名／盤名称, F=設計工数(H), I=製造工数(H),
 * K=備考. E/H (単価) and G/J (合計) are pricing — intentionally left blank,
 * same "no pricing in this app" decision as everywhere else. The sheet has
 * one 工数(H) value per category, not separate 見積/実動 like this app tracks
 * per panel — exported as 実動 (actual) hours, since 仕入原価・工数一覧表 reads as
 * an actual-cost/labor record rather than an estimate; flagged for
 * confirmation, not silently assumed to be final.
 */

function sumHours(panels: CasePanel[], key: keyof CasePanel): number {
  return panels.reduce((total, p) => total + (typeof p[key] === "number" ? (p[key] as number) : 0), 0);
}

export async function exportCostLaborExcel(
  year: number,
  cases: DesignCaseWithPanels[],
): Promise<{ fileName: string }> {
  const workbook = await loadActiveTemplate("costLaborSheet");
  const ws = workbook.worksheets[0];

  const sorted = cases.slice().sort((a, b) => a.case.sequenceNo - b.case.sequenceNo);
  sorted.forEach(({ case: c, panels }, i) => {
    const row = 3 + i;
    ws.getCell(`A${row}`).value = c.drawingNumber;
    ws.getCell(`B${row}`).value = c.managementNumber;
    ws.getCell(`C${row}`).value = c.constructionNumber;
    ws.getCell(`D${row}`).value = [
      c.projectName,
      panels
        .map((p) => p.panelName)
        .filter(Boolean)
        .join("・"),
    ]
      .filter(Boolean)
      .join("／");
    ws.getCell(`F${row}`).value = sumHours(panels, "designActualHours");
    ws.getCell(`I${row}`).value = sumHours(panels, "productionActualHours");
  });

  const fileName = `仕入原価・工数一覧表_${year}.xlsx`;
  await downloadWorkbook(workbook, fileName);
  return { fileName };
}

export async function exportCostLaborPdf(
  year: number,
  cases: DesignCaseWithPanels[],
): Promise<{ fileName: string }> {
  const canvas = await PdfCanvas.create();
  canvas.title(`仕入原価・工数一覧表　${year}年`);

  const sorted = cases.slice().sort((a, b) => a.case.sequenceNo - b.case.sequenceNo);
  canvas.table(
    ["図面番号", "管理番号", "工事番号", "件名／盤名称", "設計工数(H)", "製造工数(H)"],
    [55, 65, 65, 160, 65, 65],
    sorted.map(({ case: c, panels }) => [
      c.drawingNumber,
      c.managementNumber,
      c.constructionNumber,
      [
        c.projectName,
        panels
          .map((p) => p.panelName)
          .filter(Boolean)
          .join("・"),
      ]
        .filter(Boolean)
        .join("／"),
      String(sumHours(panels, "designActualHours")),
      String(sumHours(panels, "productionActualHours")),
    ]),
  );

  const bytes = await canvas.save();
  const fileName = `仕入原価・工数一覧表_${year}.pdf`;
  downloadPdf(bytes, fileName);
  return { fileName };
}
