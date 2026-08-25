import type { Cell, Worksheet } from "exceljs";
import { loadActiveTemplate, downloadWorkbook } from "./excelWorkbook";
import { scheduleColorService } from "./scheduleColorService";
import { printWorksheet } from "./excelPrintView";
import {
  buildJunColorLookupByRow,
  computeColoredSegments,
  JUN_BUCKETS,
  junCellKeyRow,
  PROCESS_ROWS,
  type JunBucket,
} from "@/lib/utils/scheduleColoring";
import { buildProjectPanelLines } from "@/lib/utils/designNumbering";
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
 * model (初1/初2/中1/中2/下1/下2, 5-day resolution) — buildJunColorLookupByRow()
 * (shared with ScheduleTimeline.tsx's on-screen rendering) folds each half-
 * segment onto its 旬 bucket, so the export can never show a different
 * date range — or a different color, since the 鈑金/BOX legend merge lives
 * in that same shared helper — than the app's own timeline.
 *
 * Each 案件 occupies 4 physical rows in the real file (confirmed via cell
 * borders: a thin top border on row+0, a thin bottom border on row+3, only
 * hairline borders in between — no merge). This isn't decorative: 板金・BOX・
 * 部材 often run in parallel with each other just before 製作 starts, so a
 * single row would lose one color to "last write wins". PROCESS_ROWS splits
 * the 7 categories across those 4 rows along the real workflow order
 * (板金・BOX・部材 → 製作 → 検査 → 立会・出荷) so overlapping phases each get
 * their own line. Column A/B mirror the real template's own row captions:
 * 図面番号／管理番号／(blank)／工事番号 and 件名／盤名称／(blank)／面数（合計）.
 */

const HEADER_ROW = 4;
const FIRST_MONTH_COL = 3; // C
const MONTH_COL_SPAN = 6;
const JUN_COL_OFFSET: Record<JunBucket, number> = { 初: 0, 中: 2, 下: 4 };
const DATA_START_ROW = 6;
const ROW_SPAN = 4; // 1案件あたりの物理行数 (罫線で確認済み)

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
    const blockStart = DATA_START_ROW + i * ROW_SPAN;
    const { projectName, panelNames } = buildProjectPanelLines(c, panels);
    ws.getCell(`A${blockStart}`).value = c.drawingNumber;
    ws.getCell(`A${blockStart + 1}`).value = c.managementNumber;
    ws.getCell(`A${blockStart + 3}`).value = c.constructionNumber;
    ws.getCell(`B${blockStart}`).value = projectName;
    ws.getCell(`B${blockStart + 1}`).value = panelNames;
    const faceCount = panels[0]?.faceCount;
    ws.getCell(`B${blockStart + 3}`).value = faceCount != null ? `${faceCount}面` : "";

    const schedule = schedules[c.id];
    if (!schedule) return;
    const lookup = buildJunColorLookupByRow(computeColoredSegments(schedule), colorConfigs);
    for (const monthEntry of months) {
      for (const bucket of JUN_BUCKETS) {
        for (let rowIndex = 0; rowIndex < PROCESS_ROWS.length; rowIndex++) {
          const hex = lookup.get(junCellKeyRow(monthEntry.year, monthEntry.month, bucket, rowIndex));
          if (!hex) continue;
          const col = monthEntry.colStart + JUN_COL_OFFSET[bucket];
          ws.getRow(blockStart + rowIndex).getCell(col).fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: toArgb(hex) },
          };
        }
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
