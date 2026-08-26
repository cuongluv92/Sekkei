import ExcelJS from "exceljs";
import { downloadWorkbook } from "./excelWorkbook";
import { scheduleColorService } from "./scheduleColorService";
import { printWorksheet } from "./excelPrintView";
import {
  addMonths,
  buildJunColorLookupByScreenRow,
  buildMilestoneLabelsByJunRow,
  computeColoredSegments,
  computeMilestones,
  JUN_BUCKETS,
  junCellKeyRow,
  SCREEN_MONTHS_AFTER,
  SCREEN_MONTHS_BEFORE,
  SCREEN_PROCESS_ROWS,
} from "@/lib/utils/scheduleColoring";
import { buildCaseDisplayLabel, buildProjectPanelLines } from "@/lib/utils/designNumbering";
import type { CaseSchedule, DesignCaseWithPanels, ScheduleCategoryKey } from "@/lib/types/design";

/**
 * ⑤工程表 — 自前生成のA3横1枚レイアウト。以前は取込済みの実テンプレート
 * ファイル(旬3列/月・板金/BOX/部材が同じ行の4行構成)をそのまま使っていた
 * が、画面のタイムライン(ScheduleTimeline.tsx)が実日単位の色分けや行構成
 * (鈑金・BOX納入/アクセサリー納入/製作・検査/立会・出荷の4行)へ進化した
 * ため、Excel側もテンプレートファイルに縛られず画面と同じ構成・同じ表示
 * 月数(SCREEN_MONTHS_BEFORE/AFTER)で出力するように作り直した。
 *
 * 実際の日単位の精度(画面は1日ごとに正確に色が変わる)はExcelの印刷幅の
 * 都合上そのまま持ち込めない — 列数が多すぎて1日あたりが読めない幅に
 * なってしまうため、Excel側は旬(初/中/下・3列/月)単位に丸めている
 * (buildJunColorLookupByScreenRow — 行構成だけ画面と共通のSCREEN_PROCESS_
 * ROWSを使う)。日付ラベルは旬セルの中に小さく表示する。
 */

const LABEL_COL_A_WIDTH = 16;
const LABEL_COL_B_WIDTH = 38;
const JUN_COL_WIDTH = 10;
const TITLE_ROW = 1;
const LEGEND_ROW = 2;
const MONTH_HEADER_ROW = 4;
const JUN_HEADER_ROW = 5;
const DATA_START_ROW = 6;
const ROW_SPAN = SCREEN_PROCESS_ROWS.length; // 1案件あたりの行数(画面と共通)

// 実テンプレートの凡例と同じ並び(box は sheetMetal の色見本に統合されるため単独では出さない)。
const LEGEND_CATEGORIES: { key: ScheduleCategoryKey; label: string }[] = [
  { key: "sheetMetal", label: "鈑金・BOX納入" },
  { key: "accessory", label: "アクセサリー納入" },
  { key: "production", label: "製作" },
  { key: "inspection", label: "検査" },
  { key: "witness", label: "立会" },
  { key: "shipping", label: "出荷" },
];

const THIN: Partial<ExcelJS.Border> = { style: "thin", color: { argb: "FFB6BEC9" } };
const THICK: Partial<ExcelJS.Border> = { style: "medium", color: { argb: "FF4B5563" } };

function toArgb(hex: string): string {
  return `FF${hex.replace("#", "").toUpperCase()}`;
}

interface LegendEntry {
  key: ScheduleCategoryKey;
  label: string;
  swatchCol: number;
  labelColStart: number;
  labelColEnd: number;
}

/**
 * 凡例(色見本+ラベル)の列配置を1箇所で計算する — 実際に描画する buildHeader
 * と、必要な最終列数を知りたい buildScheduleWorkbook (印刷範囲・列幅設定)
 * の両方がこれを使うことで、2箇所に同じ配置ロジックを重複させない。
 */
function layoutLegend(): LegendEntry[] {
  let col = 1;
  return LEGEND_CATEGORIES.map(({ key, label }) => {
    const labelSpan = label.length > 4 ? 2 : 1;
    const swatchCol = col;
    const labelColStart = swatchCol + 1;
    const labelColEnd = labelColStart + labelSpan - 1;
    col = labelColEnd + 2; // 次のエントリの色見本(1列の間隔を空ける)
    return { key, label, swatchCol, labelColStart, labelColEnd };
  });
}

interface MonthColumn {
  year: number;
  month: number;
  colStart: number; // 初列の絶対列番号
}

/** 今日を中心に、画面のタイムラインと同じ月数(SCREEN_MONTHS_BEFORE〜AFTER)分の月を並べる。 */
function computeMonths(): MonthColumn[] {
  const now = new Date();
  const months: MonthColumn[] = [];
  let col = 3; // A/Bの次から
  for (let i = -SCREEN_MONTHS_BEFORE; i <= SCREEN_MONTHS_AFTER; i++) {
    const m = addMonths(now.getFullYear(), now.getMonth() + 1, i);
    months.push({ year: m.year, month: m.month, colStart: col });
    col += JUN_BUCKETS.length;
  }
  return months;
}

function buildHeader(
  ws: ExcelJS.Worksheet,
  months: MonthColumn[],
  colorByCategory: Map<ScheduleCategoryKey, string>,
  printLastCol: number,
) {
  ws.mergeCells(TITLE_ROW, 1, TITLE_ROW, printLastCol);
  const titleCell = ws.getCell(TITLE_ROW, 1);
  titleCell.value = "工程表";
  titleCell.font = { size: 16, bold: true };
  titleCell.alignment = { horizontal: "left", vertical: "middle" };
  ws.getRow(TITLE_ROW).height = 22;

  // 凡例 — 色見本(1列)+ラベル(文字数に応じて複数列を結合)を左詰めで並べる。
  // 単一の狭い列にラベルを置くと、データ列(旬=約10幅)の境目でラベルが
  // 隣の色見本に重なって見えてしまうため、必ずラベル分の幅を結合で確保する。
  for (const { key, label, swatchCol, labelColStart, labelColEnd } of layoutLegend()) {
    const swatch = ws.getCell(LEGEND_ROW, swatchCol);
    const color = colorByCategory.get(key);
    if (color) swatch.fill = { type: "pattern", pattern: "solid", fgColor: { argb: toArgb(color) } };
    swatch.border = { top: THIN, left: THIN, right: THIN, bottom: THIN };
    if (labelColEnd > labelColStart) ws.mergeCells(LEGEND_ROW, labelColStart, LEGEND_ROW, labelColEnd);
    const labelCell = ws.getCell(LEGEND_ROW, labelColStart);
    labelCell.value = label;
    labelCell.font = { size: 10 };
    labelCell.alignment = { horizontal: "left", vertical: "middle" };
  }
  ws.getRow(LEGEND_ROW).height = 16;

  ws.mergeCells(MONTH_HEADER_ROW, 1, JUN_HEADER_ROW, 1);
  const colACaption = ws.getCell(MONTH_HEADER_ROW, 1);
  colACaption.value = "図面番号\n管理番号";
  ws.mergeCells(MONTH_HEADER_ROW, 2, JUN_HEADER_ROW, 2);
  const colBCaption = ws.getCell(MONTH_HEADER_ROW, 2);
  colBCaption.value = "件名／盤名称";
  for (const cell of [colACaption, colBCaption]) {
    cell.font = { size: 10, bold: true };
    cell.alignment = { horizontal: "left", vertical: "middle", wrapText: true };
    cell.border = { top: THIN, left: THIN, right: THIN, bottom: THIN };
  }

  for (const m of months) {
    ws.mergeCells(MONTH_HEADER_ROW, m.colStart, MONTH_HEADER_ROW, m.colStart + JUN_BUCKETS.length - 1);
    const monthCell = ws.getCell(MONTH_HEADER_ROW, m.colStart);
    monthCell.value = `${m.year}/${String(m.month).padStart(2, "0")}`;
    monthCell.font = { size: 10, bold: true };
    monthCell.alignment = { horizontal: "center", vertical: "middle" };
    monthCell.border = { top: THIN, left: THICK, right: THIN, bottom: THIN };

    JUN_BUCKETS.forEach((bucket, i) => {
      const cell = ws.getCell(JUN_HEADER_ROW, m.colStart + i);
      cell.value = bucket;
      cell.font = { size: 10 };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = { top: THIN, left: i === 0 ? THICK : THIN, right: THIN, bottom: THIN };
    });
  }
  ws.getRow(MONTH_HEADER_ROW).height = 16;
  ws.getRow(JUN_HEADER_ROW).height = 14;
}

function buildScheduleWorkbook(
  cases: DesignCaseWithPanels[],
  schedules: Record<string, CaseSchedule>,
  colorConfigs: { category: ScheduleCategoryKey; color: string }[],
): ExcelJS.Worksheet {
  const months = computeMonths();
  const lastCol = 2 + months.length * JUN_BUCKETS.length; // データ(月/旬)グリッドの最終列
  const legendLastCol = Math.max(...layoutLegend().map((e) => e.labelColEnd));
  const printLastCol = Math.max(lastCol, legendLastCol); // 凡例の方が広い場合はそちらに合わせる
  const colorByCategory = new Map(colorConfigs.map((c) => [c.category, c.color]));

  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet("工程表", {
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
    views: [{ state: "frozen", xSplit: 2, ySplit: JUN_HEADER_ROW }],
  });

  ws.columns = [
    { width: LABEL_COL_A_WIDTH },
    { width: LABEL_COL_B_WIDTH },
    ...Array.from({ length: printLastCol - 2 }, () => ({ width: JUN_COL_WIDTH })),
  ];

  buildHeader(ws, months, colorByCategory, printLastCol);

  cases.forEach(({ case: c, panels }, i) => {
    const blockStart = DATA_START_ROW + i * ROW_SPAN;
    const { projectName, panelNames } = buildProjectPanelLines(c, panels);
    const faceCount = panels[0]?.faceCount;

    ws.mergeCells(blockStart, 1, blockStart + ROW_SPAN - 1, 1);
    const colA = ws.getCell(blockStart, 1);
    colA.value = [c.drawingNumber, c.managementNumber, c.constructionNumber].filter(Boolean).join("\n");
    ws.mergeCells(blockStart, 2, blockStart + ROW_SPAN - 1, 2);
    const colB = ws.getCell(blockStart, 2);
    colB.value = [projectName, panelNames, faceCount != null ? `${faceCount}面` : ""].filter(Boolean).join("\n");
    for (const cell of [colA, colB]) {
      cell.font = { size: 10 };
      cell.alignment = { horizontal: "left", vertical: "top", wrapText: true };
      cell.border = { top: THICK, left: THIN, right: THIN, bottom: THICK };
    }
    colA.note = buildCaseDisplayLabel(c, panels);

    for (let r = 0; r < ROW_SPAN; r++) {
      const row = ws.getRow(blockStart + r);
      for (let col = 3; col <= lastCol; col++) {
        row.getCell(col).border = {
          top: r === 0 ? THICK : undefined,
          bottom: r === ROW_SPAN - 1 ? THICK : undefined,
          left: (col - 3) % JUN_BUCKETS.length === 0 ? THICK : THIN,
          right: THIN,
        };
      }
      row.height = 15;
    }

    const schedule = schedules[c.id];
    if (!schedule) return;
    const lookup = buildJunColorLookupByScreenRow(computeColoredSegments(schedule), colorConfigs);
    const labels = buildMilestoneLabelsByJunRow(computeMilestones(schedule));
    for (const monthEntry of months) {
      for (const bucket of JUN_BUCKETS) {
        for (let rowIndex = 0; rowIndex < ROW_SPAN; rowIndex++) {
          const key = junCellKeyRow(monthEntry.year, monthEntry.month, bucket, rowIndex);
          const hex = lookup.get(key);
          if (!hex) continue;
          const col = monthEntry.colStart + JUN_BUCKETS.indexOf(bucket);
          const cell = ws.getRow(blockStart + rowIndex).getCell(col);
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: toArgb(hex) } };
          const label = labels.get(key);
          if (label) {
            cell.value = label;
            cell.font = { size: 8, bold: true, color: { argb: "FFFFFFFF" } };
            cell.alignment = { horizontal: "right", vertical: "bottom" };
          }
        }
      }
    }
  });

  const lastRow = DATA_START_ROW + cases.length * ROW_SPAN - 1;
  ws.pageSetup.printArea = `A1:${ws.getColumn(printLastCol).letter}${Math.max(lastRow, JUN_HEADER_ROW)}`;

  return ws;
}

export async function exportScheduleExcel(
  cases: DesignCaseWithPanels[],
  schedules: Record<string, CaseSchedule>,
): Promise<{ fileName: string }> {
  const colorConfigs = await scheduleColorService.list();
  const ws = buildScheduleWorkbook(cases, schedules, colorConfigs);
  const fileName = "工程表.xlsx";
  await downloadWorkbook(ws.workbook, fileName);
  return { fileName };
}

/** Prints ⑤工程表 in the exact layout the Excel download produces (same colored Gantt). */
export async function printSchedule(
  cases: DesignCaseWithPanels[],
  schedules: Record<string, CaseSchedule>,
): Promise<void> {
  const colorConfigs = await scheduleColorService.list();
  const ws = buildScheduleWorkbook(cases, schedules, colorConfigs);
  printWorksheet(ws);
}
