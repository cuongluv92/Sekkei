import ExcelJS from "exceljs";
import { designTemplateService } from "./designTemplateService";
import { getPublicUrl } from "@/lib/supabase/storage";
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

/** ExcelJS only embeds these 3 raster formats — png/jpg/jpeg/gif from OutlineDrawingUpload's accept list map onto them; webp has no ExcelJS embed path, so it's intentionally excluded (returns null) rather than silently mis-embedded. */
export function excelImageExtensionFor(fileName: string): "png" | "jpeg" | "gif" | null {
  const ext = /\.([A-Za-z0-9]+)$/.exec(fileName)?.[1]?.toLowerCase() ?? "";
  if (ext === "png") return "png";
  if (ext === "jpg" || ext === "jpeg") return "jpeg";
  if (ext === "gif") return "gif";
  return null;
}

export interface OutlineImageAnchor {
  fromCol: number;
  fromRow: number;
  toCol: number;
  toRow: number;
}

/**
 * Embeds the case's uploaded 外形図 (OutlineDrawingUpload) into the exported
 * worksheet at `anchor` — the same cell span the real vendor templates use
 * for their own outline diagram (confirmed by unzipping the actual .xlsx
 * files and reading each sheet's drawing anchor XML directly, not guessed).
 * No-op if there's no uploaded drawing, the fetch fails, or the file's
 * format isn't one ExcelJS can embed (webp) — the rest of the export still
 * succeeds either way, this is a best-effort addition, not a hard
 * dependency of the calculation output.
 */
export async function embedOutlineImage(
  workbook: ExcelJS.Workbook,
  ws: ExcelJS.Worksheet,
  outlineDrawing: { storagePath: string; fileName: string } | null | undefined,
  anchor: OutlineImageAnchor,
): Promise<void> {
  if (!outlineDrawing) return;
  const extension = excelImageExtensionFor(outlineDrawing.fileName);
  if (!extension) return;
  try {
    const res = await fetch(getPublicUrl(outlineDrawing.storagePath));
    if (!res.ok) return;
    const buffer = await res.arrayBuffer();
    const imageId = workbook.addImage({ buffer, extension });
    ws.addImage(imageId, {
      tl: { col: anchor.fromCol, row: anchor.fromRow } as ExcelJS.Anchor,
      br: { col: anchor.toCol, row: anchor.toRow } as ExcelJS.Anchor,
      editAs: "oneCell",
    });
  } catch {
    // best-effort — never block the rest of the export over the image
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
