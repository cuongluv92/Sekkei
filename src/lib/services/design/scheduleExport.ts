import type { Cell, Worksheet } from "exceljs";
import { loadActiveTemplate, downloadWorkbook } from "./excelWorkbook";
import { scheduleColorService } from "./scheduleColorService";
import { printWorksheet } from "./excelPrintView";
import { computeColoredSegments } from "@/lib/utils/scheduleColoring";
import { buildCaseDisplayLabel } from "@/lib/utils/designNumbering";
import type { CaseSchedule, DesignCaseWithPanels, ScheduleCategoryKey } from "@/lib/types/design";

/**
 * ⑤工程表 — confirmed with the user: the uploaded template's own format is
 * authoritative (never regenerated/reshaped by the app), and its month
 * range always starts 3 months before the month it was created in (e.g.
 * created in 2026/8 → first column-group is 2026/5). Rather than hardcode
 * that "minus 3" rule, the export reads the *actual* header row (4) of
 * whatever template is currently active to find each month's starting
 * column — so it always matches the real file, even if the user's own
 * convention ever changes.
 *
 * Each month occupies 6 columns as 3 merged 初/中/下 pairs (confirmed from
 * the real file). This is coarser than the app's own 6-segment timeline
 * model (初1/初2/中1/中2/下1/下2, 5-day resolution) — computeColoredSegments()
 * is reused as-is (same source as ScheduleTimeline.tsx) and each half-
 * segment is folded onto its 旬 bucket, so the export can never show a
 * different date range than the app's own timeline.
 *
 * The real legend has one swatch "板金・BOX納入" covering both categories
 * (confirmed: 鈑金/BOX share a color by default) — both are painted using
 * the "sheetMetal" category's color for that reason.
 */

const HEADER_ROW = 4;
const FIRST_MONTH_COL = 3; // C
const MONTH_COL_SPAN = 6;
const SEGMENT_COL_OFFSET: Record<"初" | "中" | "下", number> = { 初: 0, 中: 2, 下: 4 };
const DATA_START_ROW = 6;

interface MonthColumn {
  year: number;
  month: number;
  colStart: number;
}

function readMonthColumns(ws: { getRow(r: number): { getCell(c: number): Cell } }): MonthColumn[] {
  const months: MonthColumn[] = [];
  let col = FIRST_MONTH_COL;
  for (;;) {
    const value = ws.getRow(HEADER_ROW).getCell(col).value;
    if (!(value instanceof Date)) break;
    months.push({ year: value.getFullYear(), month: value.getMonth() + 1, colStart: col });
    col += MONTH_COL_SPAN;
  }
  return months;
}

function bucketFromSegment(segment: string): "初" | "中" | "下" {
  return segment.startsWith("初") ? "初" : segment.startsWith("中") ? "中" : "下";
}

function toArgb(hex: string): string {
  return `FF${hex.replace("#", "").toUpperCase()}`;
}

const EXPORT_CATEGORY_COLOR: Partial<Record<ScheduleCategoryKey, ScheduleCategoryKey>> = {
  box: "sheetMetal", // real template's legend has one combined "板金・BOX納入" swatch
};

async function buildScheduleWorkbook(
  cases: DesignCaseWithPanels[],
  schedules: Record<string, CaseSchedule>,
): Promise<Worksheet> {
  const [workbook, colorConfigs] = await Promise.all([
    loadActiveTemplate("scheduleSheet"),
    scheduleColorService.list(),
  ]);
  const ws = workbook.worksheets[0];
  const colorByCategory = new Map(colorConfigs.map((c) => [c.category, c.color]));
  const months = readMonthColumns(ws);
  if (months.length === 0) throw new Error("schedule-template-missing-month-headers");

  cases.forEach(({ case: c, panels }, i) => {
    const row = DATA_START_ROW + i;
    ws.getCell(`A${row}`).value = `${c.drawingNumber}\n${c.managementNumber}`;
    ws.getCell(`B${row}`).value = buildCaseDisplayLabel(c, panels);

    const schedule = schedules[c.id];
    if (!schedule) return;
    for (const seg of computeColoredSegments(schedule)) {
      const monthEntry = months.find((m) => m.year === seg.year && m.month === seg.month);
      if (!monthEntry) continue; // outside the template's own printed range — nothing to color
      const colorCategory = EXPORT_CATEGORY_COLOR[seg.category] ?? seg.category;
      const hex = colorByCategory.get(colorCategory);
      if (!hex) continue;
      const col = monthEntry.colStart + SEGMENT_COL_OFFSET[bucketFromSegment(seg.segment)];
      ws.getRow(row).getCell(col).fill = { type: "pattern", pattern: "solid", fgColor: { argb: toArgb(hex) } };
    }
  });

  return ws;
}

export async function exportScheduleExcel(
  cases: DesignCaseWithPanels[],
  schedules: Record<string, CaseSchedule>,
): Promise<{ fileName: string }> {
  const ws = await buildScheduleWorkbook(cases, schedules);
  const fileName = "工程表.xlsx";
  await downloadWorkbook(ws.workbook, fileName);
  return { fileName };
}

/** Prints ⑤工程表 in the exact layout of the currently active template (same colored Gantt as the Excel download). */
export async function printSchedule(
  cases: DesignCaseWithPanels[],
  schedules: Record<string, CaseSchedule>,
): Promise<void> {
  const ws = await buildScheduleWorkbook(cases, schedules);
  printWorksheet(ws);
}
