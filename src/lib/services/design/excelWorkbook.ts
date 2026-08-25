import ExcelJS from "exceljs";
import { designTemplateService } from "./designTemplateService";
import type { DesignTemplateKind } from "@/lib/types/design";

/** Loads the currently active Excel template for `kind` from Supabase Storage — never a bundled file, per 設定 > テンプレート管理. Throws `no-active-template:<kind>` if nothing has been uploaded yet. */
export async function loadActiveTemplate(kind: DesignTemplateKind): Promise<ExcelJS.Workbook> {
  const buffer = await designTemplateService.fetchActiveBytes(kind);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  return workbook;
}

/**
 * Loads the active template for `kind` and returns one worksheet from it by
 * name. Some templates (耐震計算書/換気計算書) are naturally distributed as
 * one multi-sheet vendor workbook (e.g. 自立形/壁掛形/キュービクル in one
 * file) — a user may upload that whole file as-is for more than one `kind`,
 * so this searches `preferredNames` in order and falls back to the first
 * worksheet only if none match (covers a single-sheet extract upload too).
 */
export async function loadActiveTemplateSheet(
  kind: DesignTemplateKind,
  preferredNames: string[],
): Promise<{ workbook: ExcelJS.Workbook; ws: ExcelJS.Worksheet }> {
  const workbook = await loadActiveTemplate(kind);
  for (const name of preferredNames) {
    const ws = workbook.getWorksheet(name);
    if (ws) return { workbook, ws };
  }
  const ws = workbook.worksheets[0];
  if (!ws) throw new Error(`template-empty:${kind}`);
  return { workbook, ws };
}

/**
 * Removes every worksheet except `keep` from `workbook`. Used after
 * `loadActiveTemplateSheet` when the uploaded template is a multi-sheet
 * vendor workbook (e.g. 自立形/壁掛形/キュービクル in one file) — without
 * this, downloading would ship the other, untouched example sheets
 * alongside the one actually filled in, which reads as unfinished/wrong.
 */
export function keepOnlyWorksheet(workbook: ExcelJS.Workbook, keep: ExcelJS.Worksheet): void {
  for (const ws of [...workbook.worksheets]) {
    if (ws.id !== keep.id) workbook.removeWorksheet(ws.id);
  }
}

export async function downloadWorkbook(workbook: ExcelJS.Workbook, fileName: string): Promise<void> {
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
