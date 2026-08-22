import ExcelJS from "exceljs";
import { scheduleService } from "./scheduleService";
import { PdfCanvas, downloadPdf } from "./pdfCanvas";
import type { DesignCaseWithPanels } from "@/lib/types/design";

/**
 * ②図面管理台帳 — cell coordinates confirmed by inspecting the real template
 * (one sheet per year; A1="２０２６年" title, header row 2, data from row 3):
 * A=年(2桁), B=連番, C=管理番号, D=工事番号, E=客先名, F=客先担当, G=件名,
 * H=盤名称, I=面数, J=製造完了, K=出荷日. 決定金額(L)/施主名(M) are intentionally
 * skipped (confirmed out of scope), as is column N (confirmed not real).
 */

async function loadTemplate(path: string): Promise<ExcelJS.Workbook> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`template-fetch-failed:${path}`);
  const buffer = await res.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  return workbook;
}

async function downloadWorkbook(workbook: ExcelJS.Workbook, fileName: string): Promise<void> {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

async function loadDeliveryDates(): Promise<Map<string, string | null>> {
  const schedules = await scheduleService.listAll();
  return new Map(schedules.map((s) => [s.caseId, s.deliveryDate]));
}

export async function exportDrawingLedgerExcel(
  year: number,
  cases: DesignCaseWithPanels[],
): Promise<{ fileName: string }> {
  const deliveryByCase = await loadDeliveryDates();

  const workbook = await loadTemplate("/templates/drawingLedger.xlsx");
  const ws = workbook.worksheets[0];
  ws.getCell("A1").value = `${year}年`;

  const sorted = cases.slice().sort((a, b) => a.case.sequenceNo - b.case.sequenceNo);
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

  const fileName = `図面管理台帳_${year}.xlsx`;
  await downloadWorkbook(workbook, fileName);
  return { fileName };
}

export async function exportDrawingLedgerPdf(
  year: number,
  cases: DesignCaseWithPanels[],
): Promise<{ fileName: string }> {
  const deliveryByCase = await loadDeliveryDates();
  const canvas = await PdfCanvas.create();
  canvas.title(`図面管理台帳　${year}年`);

  const sorted = cases.slice().sort((a, b) => a.case.sequenceNo - b.case.sequenceNo);
  canvas.table(
    ["図面番号", "管理番号", "工事番号", "客先名", "客先担当", "件名", "盤名称", "製造完了", "出荷日"],
    [45, 55, 55, 70, 45, 70, 70, 40, 55],
    sorted.map(({ case: c, panels }) => {
      const delivery = deliveryByCase.get(c.id);
      return [
        c.drawingNumber,
        c.managementNumber,
        c.constructionNumber,
        c.orderer,
        c.customerContact,
        c.projectName,
        panels
          .map((p) => p.panelName)
          .filter(Boolean)
          .join("・"),
        c.manufacturingComplete ? "完" : "",
        delivery ?? "",
      ];
    }),
  );

  const bytes = await canvas.save();
  const fileName = `図面管理台帳_${year}.pdf`;
  downloadPdf(bytes, fileName);
  return { fileName };
}
