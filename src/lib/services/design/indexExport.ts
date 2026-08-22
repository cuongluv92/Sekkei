import type ExcelJS from "exceljs";
import { loadActiveTemplate, downloadWorkbook } from "./excelWorkbook";
import { printWorksheet } from "./excelPrintView";
import type { DesignCaseWithPanels, DesignTemplateKind } from "@/lib/types/design";

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
 * The template itself is fetched from Supabase Storage (設定 > テンプレート管理),
 * never bundled in the app.
 */

const TEMPLATE_KIND: Record<"keio" | "other", DesignTemplateKind> = {
  keio: "designRequestIndexKeio",
  other: "designRequestIndexOther",
};

async function buildIndexWorkbook(
  kind: "keio" | "other",
  year: number,
  cases: DesignCaseWithPanels[],
): Promise<ExcelJS.Workbook> {
  const workbook = await loadActiveTemplate(TEMPLATE_KIND[kind]);
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

  return workbook;
}

export async function exportDesignRequestIndexExcel(
  kind: "keio" | "other",
  year: number,
  cases: DesignCaseWithPanels[],
): Promise<{ fileName: string }> {
  const workbook = await buildIndexWorkbook(kind, year, cases);
  const kindLabel = kind === "keio" ? "京王" : "その他";
  const fileName = `設計依頼書目次_${kindLabel}_${year}.xlsx`;
  await downloadWorkbook(workbook, fileName);
  return { fileName };
}

/** Prints ③④設計依頼書目次 in the exact layout of the currently active template. */
export async function printDesignRequestIndex(
  kind: "keio" | "other",
  year: number,
  cases: DesignCaseWithPanels[],
): Promise<void> {
  const workbook = await buildIndexWorkbook(kind, year, cases);
  printWorksheet(workbook.worksheets[0]);
}
