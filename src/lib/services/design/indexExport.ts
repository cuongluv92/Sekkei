import ExcelJS from "exceljs";
import { PdfCanvas, downloadPdf } from "./pdfCanvas";
import type { DesignCaseWithPanels } from "@/lib/types/design";

/**
 * 設計依頼書目次・京王(③)/その他(④) — real templates lay multiple years out as
 * separate column-blocks side by side on one sheet (e.g. 2023年度 at A:E,
 * 2024年度 at F:H, 2026年度 at I:M), and older blocks don't even share the
 * same columns as the newest one (2023/2026 have 担当/備考, 2024 doesn't).
 * That static layout can't grow with new years, so exports reuse the
 * newest/most complete block's columns (I=図番, J=管理番号, K=件名, L=担当,
 * M=備考, confirmed from the real template) for whichever year is being
 * exported, one workbook per year — same principle as ②図面管理台帳's
 * one-sheet-per-year export. 盤名称 (column N) is an addition beyond the
 * real template, reasonable for search/management per the agreed policy of
 * allowing extra app columns as long as no real template field is dropped.
 */

const TEMPLATE_PATH: Record<"keio" | "other", string> = {
  keio: "/templates/designRequestIndexKeio.xlsx",
  other: "/templates/designRequestIndexOther.xlsx",
};

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

export async function exportDesignRequestIndexExcel(
  kind: "keio" | "other",
  year: number,
  cases: DesignCaseWithPanels[],
): Promise<{ fileName: string }> {
  const workbook = await loadTemplate(TEMPLATE_PATH[kind]);
  const ws = workbook.worksheets[0];
  ws.getCell("I1").value = `設計依頼書　目次　${year}年度`;

  const sorted = cases.slice().sort((a, b) => a.case.sequenceNo - b.case.sequenceNo);
  sorted.forEach(({ case: c, panels }, i) => {
    const row = 3 + i;
    ws.getCell(`I${row}`).value = c.drawingNumber;
    ws.getCell(`J${row}`).value = c.managementNumber;
    ws.getCell(`K${row}`).value = c.projectName;
    ws.getCell(`L${row}`).value = c.assignee;
    ws.getCell(`M${row}`).value = c.designRemarks;
    ws.getCell(`N${row}`).value = panels
      .map((p) => p.panelName)
      .filter(Boolean)
      .join("・");
  });

  const kindLabel = kind === "keio" ? "京王" : "その他";
  const fileName = `設計依頼書目次_${kindLabel}_${year}.xlsx`;
  await downloadWorkbook(workbook, fileName);
  return { fileName };
}

export async function exportDesignRequestIndexPdf(
  kind: "keio" | "other",
  year: number,
  cases: DesignCaseWithPanels[],
): Promise<{ fileName: string }> {
  const kindLabel = kind === "keio" ? "京王" : "その他";
  const canvas = await PdfCanvas.create();
  canvas.title(`設計依頼書　目次　${kindLabel}　${year}年度`);

  const sorted = cases.slice().sort((a, b) => a.case.sequenceNo - b.case.sequenceNo);
  canvas.table(
    ["図番", "管理番号", "件名", "盤名称", "担当", "備考"],
    [55, 70, 110, 90, 50, 100],
    sorted.map(({ case: c, panels }) => [
      c.drawingNumber,
      c.managementNumber,
      c.projectName,
      panels
        .map((p) => p.panelName)
        .filter(Boolean)
        .join("・"),
      c.assignee,
      c.designRemarks,
    ]),
  );

  const bytes = await canvas.save();
  const fileName = `設計依頼書目次_${kindLabel}_${year}.pdf`;
  downloadPdf(bytes, fileName);
  return { fileName };
}
