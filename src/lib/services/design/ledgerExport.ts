import type ExcelJS from "exceljs";
import { scheduleService } from "./scheduleService";
import { loadActiveTemplate, downloadWorkbook } from "./excelWorkbook";
import { printWorksheet } from "./excelPrintView";
import type { DesignCaseWithPanels } from "@/lib/types/design";

/**
 * ②図面管理台帳 — cell coordinates confirmed by inspecting the real template
 * (one sheet per year; A1="２０２６年" title, header row 2, data from row 3):
 * A=年(2桁), B=連番, C=管理番号, D=工事番号, E=客先名, F=客先担当, G=件名,
 * H=盤名称, I=面数, J=製造完了, K=出荷日. 決定金額(L)/施主名(M) are intentionally
 * skipped (confirmed out of scope), as is column N (confirmed not real). The
 * template itself is fetched from Supabase Storage (設定 > テンプレート管理),
 * never bundled in the app.
 */

async function loadDeliveryDates(): Promise<Map<string, string | null>> {
  const schedules = await scheduleService.listAll();
  return new Map(schedules.map((s) => [s.caseId, s.deliveryDate]));
}

async function buildLedgerWorkbook(year: number, cases: DesignCaseWithPanels[]): Promise<ExcelJS.Workbook> {
  const deliveryByCase = await loadDeliveryDates();

  const workbook = await loadActiveTemplate("drawingLedger");
  const ws = workbook.worksheets[0];
  ws.getCell("A1").value = `${year}年`;

  // 図面番号 (drawingNumber) で並べる — sequenceNo ではない。設計依頼以外の
  // 経路で作成された案件は図面番号を手入力するため、内部の連番(sequenceNo)
  // と表示上の図面番号が一致しない場合がある (画面側の CaseLedgerTable と
  // 同じ並び順にするため揃える)。
  const sorted = cases.slice().sort((a, b) => a.case.drawingNumber.localeCompare(b.case.drawingNumber, "ja"));
  sorted.forEach(({ case: c, panels }, i) => {
    const row = 3 + i;
    ws.getCell(`A${row}`).value = c.year % 100;
    ws.getCell(`B${row}`).value = c.sequenceNo;
    ws.getCell(`C${row}`).value = c.managementNumber;
    ws.getCell(`D${row}`).value = c.constructionNumber;
    ws.getCell(`E${row}`).value = c.orderer;
    ws.getCell(`F${row}`).value = c.customerContact;
    ws.getCell(`G${row}`).value = c.projectName;
    ws.getCell(`H${row}`).value = panels
      .map((p) => p.panelName)
      .filter(Boolean)
      .join("・");
    const faceCount = panels[0]?.faceCount;
    ws.getCell(`I${row}`).value = faceCount != null ? `${faceCount}面` : "";
    ws.getCell(`J${row}`).value = c.manufacturingComplete ? "完" : "";
    const delivery = deliveryByCase.get(c.id);
    ws.getCell(`K${row}`).value = delivery ? new Date(delivery) : "";
  });

  return workbook;
}

export async function exportDrawingLedgerExcel(
  year: number,
  cases: DesignCaseWithPanels[],
): Promise<{ fileName: string }> {
  const workbook = await buildLedgerWorkbook(year, cases);
  const fileName = `図面管理台帳_${year}.xlsx`;
  await downloadWorkbook(workbook, fileName);
  return { fileName };
}

/** Prints ②図面管理台帳 in the exact layout of the currently active template. */
export async function printDrawingLedger(year: number, cases: DesignCaseWithPanels[]): Promise<void> {
  const workbook = await buildLedgerWorkbook(year, cases);
  printWorksheet(workbook.worksheets[0]);
}
