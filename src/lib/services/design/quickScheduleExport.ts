import ExcelJS from "exceljs";
import { downloadWorkbook } from "./excelWorkbook";
import { printWorksheet } from "./excelPrintView";
import { computeMilestones, SCREEN_PROCESS_ROWS } from "@/lib/utils/scheduleColoring";
import { buildProjectPanelLines } from "@/lib/utils/designNumbering";
import type { CaseSchedule, DesignCaseWithPanels, ScheduleCategoryKey } from "@/lib/types/design";

/**
 * 工程表(簡易カレンダー) — 画面(ScheduleQuickOverview.tsx)に今表示されている
 * 実日カレンダー(通常は今日起点で約1.5ヶ月分)をそのままExcel/印刷にする。
 * 既存の納入工程(scheduleExport.ts)は表示月数固定(SCREEN_MONTHS_BEFORE〜
 * AFTER=5ヶ月)・色分けGantt形式の別帳票のため流用せず、画面と全く同じ
 * 「日付ごとにカテゴリ名を文字で書く」軽量表示をそのまま出力する専用の
 * ワークブックを組む。呼び出し側(画面)が計算した表示日リスト(days)を
 * そのまま受け取るため、画面と印刷/Excelで表示期間がずれることはない。
 */
export const QUICK_CATEGORY_LABEL: Partial<Record<ScheduleCategoryKey, string>> = {
  sheetMetal: "板入",
  box: "BOX入",
  production: "完成",
  witness: "立会",
  shipping: "出荷",
};

export interface QuickDayInfo {
  year: number;
  month: number;
  day: number;
  weekday: number;
}

const WEEKDAY_KANJI = ["日", "月", "火", "水", "木", "金", "土"];

// 表示日数が約45日(画面のDAYS_SPAN)と、既存の納入工程(150列超)に比べて
// 少ないため、1日あたりの列幅はその分広めに取れる — A3印刷幅に収める
// オートフィット計算(excelPrintView.ts)は列数に応じて自動調整されるので、
// ここは画面での見やすさを優先した値にする。
const LABEL_COL_A_WIDTH = 15;
const LABEL_COL_B_WIDTH = 30;
const DAY_COL_WIDTH = 4;
const HEADER_ROW_HEIGHT = 10;
const TITLE_ROW_HEIGHT = 20;
const ROW_HEIGHT = 24;
const TITLE_ROW = 1;
const MONTH_HEADER_ROW = 2;
const WEEKDAY_ROW = 3;
const DAY_HEADER_ROW = 4;
const DATA_START_ROW = 5;
const ROW_SPAN = SCREEN_PROCESS_ROWS.length;

const THIN: Partial<ExcelJS.Border> = { style: "thin", color: { argb: "FFD1D5DB" } };
const THICK: Partial<ExcelJS.Border> = { style: "thin", color: { argb: "FF000000" } };

function dayKey(year: number, month: number, day: number, rowIndex: number) {
  return `${year}-${month}-${day}-${rowIndex}`;
}

interface MonthSpan {
  year: number;
  month: number;
  colStart: number;
  span: number;
}

function computeMonthSpans(days: QuickDayInfo[]): MonthSpan[] {
  const spans: MonthSpan[] = [];
  days.forEach((d, i) => {
    const last = spans[spans.length - 1];
    if (last && last.year === d.year && last.month === d.month) last.span++;
    else spans.push({ year: d.year, month: d.month, colStart: 3 + i, span: 1 });
  });
  return spans;
}

function buildQuickScheduleWorkbook(
  cases: DesignCaseWithPanels[],
  schedules: Record<string, CaseSchedule>,
  days: QuickDayInfo[],
): ExcelJS.Worksheet {
  const lastCol = 2 + days.length;
  const monthSpans = computeMonthSpans(days);

  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet("工程表(簡易カレンダー)", {
    pageSetup: {
      // exceljs's typed PaperSize enum omits A3 (OOXML code 8) even though the
      // file format itself supports it — cast past the incomplete enum.
      paperSize: 8 as ExcelJS.PaperSize, // A3
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { top: 0.3, bottom: 0.3, left: 0.3, right: 0.3, header: 0, footer: 0 },
    },
    views: [{ state: "frozen", xSplit: 2, ySplit: DAY_HEADER_ROW }],
  });

  ws.columns = [
    { width: LABEL_COL_A_WIDTH },
    { width: LABEL_COL_B_WIDTH },
    ...Array.from({ length: days.length }, () => ({ width: DAY_COL_WIDTH })),
  ];

  ws.mergeCells(TITLE_ROW, 1, TITLE_ROW, lastCol);
  const title = ws.getCell(TITLE_ROW, 1);
  title.value = "工程表(簡易カレンダー)";
  title.font = { size: 16, bold: true };
  title.alignment = { horizontal: "left", vertical: "middle" };
  ws.getRow(TITLE_ROW).height = TITLE_ROW_HEIGHT;

  ws.mergeCells(MONTH_HEADER_ROW, 1, DAY_HEADER_ROW, 1);
  const colACaption = ws.getCell(MONTH_HEADER_ROW, 1);
  colACaption.value = "図面番号\n管理番号";
  ws.mergeCells(MONTH_HEADER_ROW, 2, DAY_HEADER_ROW, 2);
  const colBCaption = ws.getCell(MONTH_HEADER_ROW, 2);
  colBCaption.value = "件名／盤名称";
  for (const cell of [colACaption, colBCaption]) {
    cell.font = { size: 10, bold: true };
    cell.alignment = { horizontal: "left", vertical: "middle", wrapText: true };
    cell.border = { top: THICK, left: THICK, right: THICK, bottom: THICK };
  }

  for (const m of monthSpans) {
    const colEnd = m.colStart + m.span - 1;
    ws.mergeCells(MONTH_HEADER_ROW, m.colStart, MONTH_HEADER_ROW, colEnd);
    const cell = ws.getCell(MONTH_HEADER_ROW, m.colStart);
    cell.value = `${m.year}/${String(m.month).padStart(2, "0")}`;
    cell.font = { size: 10, bold: true };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = { top: THICK, left: THICK, right: THIN, bottom: THIN };
  }
  ws.getRow(MONTH_HEADER_ROW).height = HEADER_ROW_HEIGHT;

  days.forEach((d, i) => {
    const col = 3 + i;
    // 月の変わり目に加えて、表示期間の最初/最後の列(月の途中から始まる/
    // 終わることが多い)も表全体の外枠として太くする — でないと表示期間が
    // たまたま月初/月末で始まらない時、左右の外枠だけ薄いまま浮いて見える。
    const isLeftEdge = d.day === 1 || i === 0;
    const isRightEdge = col === lastCol;
    const isWeekend = d.weekday === 0 || d.weekday === 6;

    const wdCell = ws.getCell(WEEKDAY_ROW, col);
    wdCell.value = WEEKDAY_KANJI[d.weekday];
    wdCell.font = { size: 8, color: { argb: d.weekday === 0 ? "FFDC2626" : d.weekday === 6 ? "FF2563EB" : "FF6B7280" } };
    wdCell.alignment = { horizontal: "center", vertical: "middle" };
    wdCell.border = { top: THIN, left: isLeftEdge ? THICK : THIN, right: isRightEdge ? THICK : THIN, bottom: THIN };

    const dayCell = ws.getCell(DAY_HEADER_ROW, col);
    dayCell.value = d.day;
    dayCell.font = { size: 8, bold: true, color: isWeekend ? { argb: d.weekday === 0 ? "FFDC2626" : "FF2563EB" } : undefined };
    dayCell.alignment = { horizontal: "center", vertical: "middle" };
    dayCell.border = { top: THIN, left: isLeftEdge ? THICK : THIN, right: isRightEdge ? THICK : THIN, bottom: THICK };
  });
  ws.getRow(WEEKDAY_ROW).height = HEADER_ROW_HEIGHT;
  ws.getRow(DAY_HEADER_ROW).height = HEADER_ROW_HEIGHT;

  cases.forEach(({ case: c, panels }, i) => {
    const blockStart = DATA_START_ROW + i * ROW_SPAN;
    const { projectName, panelNames } = buildProjectPanelLines(c, panels);
    const faceCount = panels[0]?.faceCount;

    ws.mergeCells(blockStart, 1, blockStart + ROW_SPAN - 1, 1);
    const colACell = ws.getCell(blockStart, 1);
    colACell.value = [c.drawingNumber, c.managementNumber].filter(Boolean).join("\n");
    ws.mergeCells(blockStart, 2, blockStart + ROW_SPAN - 1, 2);
    const colBCell = ws.getCell(blockStart, 2);
    colBCell.value = [projectName, panelNames, faceCount != null ? `${faceCount}面` : ""].filter(Boolean).join("\n");
    for (const cell of [colACell, colBCell]) {
      cell.font = { size: 10 };
      cell.alignment = { horizontal: "left", vertical: "top", wrapText: true };
      cell.border = { top: THICK, left: THICK, right: THICK, bottom: THICK };
    }

    const schedule = schedules[c.id];
    const labels = schedule
      ? new Map(
          computeMilestones(schedule).flatMap(({ year, month, day, category }) => {
            const label = QUICK_CATEGORY_LABEL[category];
            if (!label) return [];
            const rowIndex = SCREEN_PROCESS_ROWS.findIndex((cats) => cats.includes(category));
            if (rowIndex < 0) return [];
            return [[dayKey(year, month, day, rowIndex), label] as const];
          }),
        )
      : new Map<string, string>();

    for (let rowIndex = 0; rowIndex < ROW_SPAN; rowIndex++) {
      const row = ws.getRow(blockStart + rowIndex);
      row.height = ROW_HEIGHT;
      days.forEach((d, i) => {
        const col = 3 + i;
        const isLeftEdge = d.day === 1 || i === 0;
        const cell = row.getCell(col);
        cell.border = {
          top: rowIndex === 0 ? THICK : undefined,
          bottom: rowIndex === ROW_SPAN - 1 ? THICK : THIN,
          left: isLeftEdge ? THICK : THIN,
          right: col === lastCol ? THICK : undefined,
        };
        const label = labels.get(dayKey(d.year, d.month, d.day, rowIndex));
        if (label) {
          cell.value = label;
          cell.font = { size: 8, bold: true };
          cell.alignment = { horizontal: "center", vertical: "middle" };
        }
      });
    }
  });

  const lastRow = DATA_START_ROW + cases.length * ROW_SPAN - 1;
  ws.pageSetup.printArea = `A1:${ws.getColumn(lastCol).letter}${Math.max(lastRow, DAY_HEADER_ROW)}`;
  ws.pageSetup.printTitlesRow = `${TITLE_ROW}:${DAY_HEADER_ROW}`;

  return ws;
}

export async function exportQuickScheduleExcel(
  cases: DesignCaseWithPanels[],
  schedules: Record<string, CaseSchedule>,
  days: QuickDayInfo[],
): Promise<{ fileName: string }> {
  const ws = buildQuickScheduleWorkbook(cases, schedules, days);
  const fileName = "工程表(簡易カレンダー).xlsx";
  await downloadWorkbook(ws.workbook, fileName);
  return { fileName };
}

// 画面と同じ日数分しかない(既存の納入工程より列が少ない)ため、A3幅に
// 対して余裕があり、印刷時はオートフィット後にさらに1.2倍拡大する。
const PRINT_EXTRA_SCALE = 1.2;

export async function printQuickSchedule(
  cases: DesignCaseWithPanels[],
  schedules: Record<string, CaseSchedule>,
  days: QuickDayInfo[],
): Promise<void> {
  const ws = buildQuickScheduleWorkbook(cases, schedules, days);
  printWorksheet(ws, PRINT_EXTRA_SCALE);
}
