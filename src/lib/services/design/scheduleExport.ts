import type { Cell, Worksheet } from "exceljs";
import { loadActiveTemplate, downloadWorkbook } from "./excelWorkbook";
import { scheduleColorService } from "./scheduleColorService";
import { printWorksheet } from "./excelPrintView";
import { buildJunColorLookup, computeColoredSegments, JUN_BUCKETS, junCellKey, type JunBucket } from "@/lib/utils/scheduleColoring";
import { buildProjectPanelLabel } from "@/lib/utils/designNumbering";
import type { CaseSchedule, DesignCaseWithPanels } from "@/lib/types/design";

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
 * model (初1/初2/中1/中2/下1/下2, 5-day resolution) — buildJunColorLookup()
 * (shared with ScheduleTimeline.tsx's on-screen rendering) folds each half-
 * segment onto its 旬 bucket, so the export can never show a different
 * date range — or a different color, since the 鈑金/BOX legend merge lives
 * in that same shared helper — than the app's own timeline.
 */

const HEADER_ROW = 4;
const FIRST_MONTH_COL = 3; // C
const MONTH_COL_SPAN = 6;
const JUN_COL_OFFSET: Record<JunBucket, number> = { 初: 0, 中: 2, 下: 4 };
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

function toArgb(hex: string): string {
  return `FF${hex.replace("#", "").toUpperCase()}`;
}

async function buildScheduleWorkbook(
  cases: DesignCaseWithPanels[],
  schedules: Record<string, CaseSchedule>,
): Promise<Worksheet> {
  const [workbook, colorConfigs] = await Promise.all([
    loadActiveTemplate("scheduleSheet"),
    scheduleColorService.list(),
  ]);
  const ws = workbook.worksheets[0];
  const months = readMonthColumns(ws);
  if (months.length === 0) throw new Error("schedule-template-missing-month-headers");

  cases.forEach(({ case: c, panels }, i) => {
    const row = DATA_START_ROW + i;
    ws.getCell(`A${row}`).value = `${c.drawingNumber}\n${c.managementNumber}`;
    ws.getCell(`B${row}`).value = buildProjectPanelLabel(c, panels);

    const schedule = schedules[c.id];
    if (!schedule) return;
    const lookup = buildJunColorLookup(computeColoredSegments(schedule), colorConfigs);
    for (const monthEntry of months) {
      for (const bucket of JUN_BUCKETS) {
        const hex = lookup.get(junCellKey(monthEntry.year, monthEntry.month, bucket));
        if (!hex) continue;
        const col = monthEntry.colStart + JUN_COL_OFFSET[bucket];
        ws.getRow(row).getCell(col).fill = { type: "pattern", pattern: "solid", fgColor: { argb: toArgb(hex) } };
      }
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
