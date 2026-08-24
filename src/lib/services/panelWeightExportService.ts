import ExcelJS from "exceljs";
import { downloadWorkbook } from "./design/excelWorkbook";
import { printWorksheet } from "./design/excelPrintView";

/** One contributing line — a 箱体/屋根 face, or one row of a repeatable group (扉/銅帯/部品...). */
export interface PanelWeightExportRow {
  group: string;
  item: string;
  /** Short dims/formula string, e.g. "W×H = 600×1000" — kept terse, not a full sentence. */
  detail: string;
  quantity: string;
  weightKg: number;
}

export interface PanelWeightExportData {
  title: string;
  caseInfo?: {
    drawingNumber: string;
    managementNumber: string;
    constructionNumber: string;
    projectName: string;
    panelName: string;
  };
  layerLabel: string;
  rows: PanelWeightExportRow[];
  groupSubtotals: { group: string; weightKg: number }[];
  wiringFactorLabel: string;
  rawTotal: number;
  correctedTotal: number;
  generatedAt: string;
}

const HEADER_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F2937" } };
const GROUP_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFF3F8" } };
const TOTAL_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDCE7F5" } };
const THIN: Partial<ExcelJS.Border> = { style: "thin", color: { argb: "FFB6BEC9" } };
const BORDER: Partial<ExcelJS.Borders> = { top: THIN, left: THIN, right: THIN, bottom: THIN };
const COLS = 5;

function buildWorksheet(data: PanelWeightExportData): { workbook: ExcelJS.Workbook; ws: ExcelJS.Worksheet } {
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet("盤本体重量", {
    pageSetup: {
      paperSize: 9, // A4
      orientation: "portrait",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { top: 0.4, bottom: 0.4, left: 0.4, right: 0.4, header: 0, footer: 0 },
    },
  });
  ws.columns = [
    { key: "group", width: 14 },
    { key: "item", width: 16 },
    { key: "detail", width: 30 },
    { key: "quantity", width: 8 },
    { key: "weight", width: 13 },
  ];

  let r = 1;
  ws.mergeCells(r, 1, r, COLS);
  const titleCell = ws.getCell(r, 1);
  titleCell.value = data.title;
  titleCell.font = { size: 16, bold: true };
  titleCell.alignment = { horizontal: "center" };
  ws.getRow(r).height = 26;
  r += 1;

  if (data.caseInfo) {
    const { drawingNumber, managementNumber, constructionNumber, projectName, panelName } = data.caseInfo;
    const infoParts = [drawingNumber, managementNumber, constructionNumber].filter(Boolean).join(" / ");
    const nameParts = [projectName, panelName].filter(Boolean).join("　");
    for (const line of [infoParts, nameParts].filter(Boolean)) {
      ws.mergeCells(r, 1, r, COLS);
      const cell = ws.getCell(r, 1);
      cell.value = line;
      cell.font = { size: 10.5, color: { argb: "FF555555" } };
      cell.alignment = { horizontal: "center" };
      r += 1;
    }
  }
  ws.mergeCells(r, 1, r, COLS);
  const metaCell = ws.getCell(r, 1);
  metaCell.value = `盤タイプ: ${data.layerLabel}　　作成日: ${data.generatedAt}`;
  metaCell.font = { size: 10, color: { argb: "FF666666" } };
  metaCell.alignment = { horizontal: "center" };
  r += 2;

  const headerRow = ws.getRow(r);
  const headers = ["区分", "項目", "内訳", "数量", "重量(kg)"];
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = HEADER_FILL;
    cell.alignment = { horizontal: i >= 3 ? "right" : "left", vertical: "middle" };
    cell.border = BORDER;
  });
  headerRow.height = 20;
  r += 1;

  let currentGroup: string | null = null;
  for (const row of data.rows) {
    if (row.group !== currentGroup) {
      currentGroup = row.group;
      const subtotal = data.groupSubtotals.find((g) => g.group === row.group);
      const groupRow = ws.getRow(r);
      groupRow.getCell(1).value = row.group;
      groupRow.getCell(1).font = { bold: true };
      if (subtotal) {
        ws.mergeCells(r, 2, r, 4);
        const sub = groupRow.getCell(5);
        sub.value = subtotal.weightKg;
        sub.numFmt = "#,##0.000";
        sub.font = { bold: true };
        sub.alignment = { horizontal: "right" };
      }
      for (let c = 1; c <= COLS; c++) {
        groupRow.getCell(c).fill = GROUP_FILL;
        groupRow.getCell(c).border = BORDER;
      }
      r += 1;
    }
    const dataRow = ws.getRow(r);
    dataRow.getCell(1).value = "";
    dataRow.getCell(2).value = row.item;
    dataRow.getCell(3).value = row.detail;
    dataRow.getCell(4).value = row.quantity;
    dataRow.getCell(4).alignment = { horizontal: "right" };
    dataRow.getCell(5).value = row.weightKg;
    dataRow.getCell(5).numFmt = "#,##0.000";
    dataRow.getCell(5).alignment = { horizontal: "right" };
    for (let c = 1; c <= COLS; c++) {
      dataRow.getCell(c).border = BORDER;
      dataRow.getCell(c).font = { size: 10 };
    }
    r += 1;
  }

  r += 1;
  ws.mergeCells(r, 1, r, 3);
  const factorCell = ws.getCell(r, 1);
  factorCell.value = `配線補正: ${data.wiringFactorLabel}`;
  factorCell.font = { size: 10.5 };
  r += 1;

  const rawRow = ws.getRow(r);
  ws.mergeCells(r, 1, r, 3);
  rawRow.getCell(1).value = "盤本体重量（補正前）";
  rawRow.getCell(1).font = { bold: true };
  ws.mergeCells(r, 4, r, 4);
  rawRow.getCell(5).value = data.rawTotal;
  rawRow.getCell(5).numFmt = "#,##0.000";
  rawRow.getCell(5).font = { bold: true };
  rawRow.getCell(5).alignment = { horizontal: "right" };
  for (let c = 1; c <= COLS; c++) rawRow.getCell(c).border = BORDER;
  r += 1;

  const totalRow = ws.getRow(r);
  ws.mergeCells(r, 1, r, 3);
  totalRow.getCell(1).value = "盤本体重量（配線補正後）";
  totalRow.getCell(1).font = { bold: true, size: 12 };
  ws.mergeCells(r, 4, r, 4);
  totalRow.getCell(5).value = data.correctedTotal;
  totalRow.getCell(5).numFmt = "#,##0.000";
  totalRow.getCell(5).font = { bold: true, size: 12, color: { argb: "FF1D4ED8" } };
  totalRow.getCell(5).alignment = { horizontal: "right" };
  totalRow.height = 22;
  for (let c = 1; c <= COLS; c++) {
    totalRow.getCell(c).fill = TOTAL_FILL;
    totalRow.getCell(c).border = BORDER;
  }

  ws.pageSetup.printArea = `A1:E${r}`;
  return { workbook, ws };
}

export async function exportPanelWeightExcel(data: PanelWeightExportData): Promise<{ fileName: string }> {
  const { workbook } = buildWorksheet(data);
  const fileName = `盤本体重量計算書_${new Date().toISOString().slice(0, 10)}.xlsx`;
  await downloadWorkbook(workbook, fileName);
  return { fileName };
}

/** Opens the browser print dialog on the same styled sheet the Excel button downloads — same "PDF出力" convention used across 設計管理 (印刷 = ブラウザのPDF保存). */
export function printPanelWeight(data: PanelWeightExportData): void {
  const { ws } = buildWorksheet(data);
  printWorksheet(ws);
}
