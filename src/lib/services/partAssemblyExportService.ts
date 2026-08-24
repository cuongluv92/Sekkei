import ExcelJS from "exceljs";
import { downloadWorkbook } from "./design/excelWorkbook";
import { partTemplateService } from "./partTemplateService";
import { patchDxfPartList } from "./dxfPartListPatch";
import { getPublicUrl } from "@/lib/supabase/storage";
import { getManufacturerName } from "@/lib/mock/manufacturers";
import type { PartAssemblyRow } from "@/lib/types";

/**
 * 部品製作リスト Excel出力 — builds a real workbook from the current table
 * rows and triggers a real browser download. Deliberately NOT template-based
 * (unlike ⑦設計依頼書/⑧製作依頼書 — see design/excelExport.ts): filling exact
 * cell coordinates on a 部品製作 Excel template would require inspecting a
 * real uploaded template cell-by-cell first, exactly like that file's own
 * comment explains, and no such template has been confirmed yet. This always
 * works regardless of whether a template has been uploaded in 設定.
 */
export async function exportPartAssemblyExcel(
  rows: PartAssemblyRow[],
  locale: "ja" | "vi",
): Promise<{ fileName: string }> {
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet("部品リスト");
  ws.columns = [
    { header: "記号", key: "symbol", width: 10 },
    { header: "品名", key: "name", width: 22 },
    { header: "メーカー", key: "manufacturer", width: 18 },
    { header: "型式", key: "model", width: 18 },
    { header: "仕様", key: "specification", width: 26 },
    { header: "数量", key: "quantity", width: 8 },
    { header: "備考", key: "remarks", width: 18 },
  ];
  ws.getRow(1).font = { bold: true };
  for (const row of rows) {
    ws.addRow({
      symbol: row.symbol,
      name: row.name,
      manufacturer: row.manufacturerId
        ? getManufacturerName(row.manufacturerId, locale)
        : "",
      model: row.model,
      specification: row.specification,
      quantity: row.quantity,
      remarks: row.remarks ?? "",
    });
  }
  const fileName = `部品製作リスト_${new Date().toISOString().slice(0, 10)}.xlsx`;
  await downloadWorkbook(workbook, fileName);
  return { fileName };
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export type PartAssemblyDxfResult =
  | { status: "filled"; fileName: string; rowsWritten: number; rowsSkipped: number }
  | { status: "noPlaceholders"; fileName: string }
  | { status: "noTemplate" };

/**
 * 部品製作 図面出力 (DXF).
 *
 * DWG is AutoCAD's proprietary binary format — there is no open way to
 * write real 部品リスト data into a .dwg file without a commercial CAD SDK
 * (ODA/Teigha, Autodesk RealDWG...), which this app doesn't have, so DWG
 * isn't offered as an export template kind at all (see PartTemplateSettings).
 * DXF is AutoCAD's plain-text interchange format (AutoCAD's own File > Save
 * As > DXF produces an equivalent drawing any CAD tool can open) and CAN be
 * patched safely — see dxfPartListPatch.ts for the detection scheme: it
 * auto-recognizes a standard 記号/品名/メーカー/型式/定格・仕様/数量/備考
 * header + blank-cell grid (real AutoCAD title-block templates already look
 * like this, no template prep needed), falling back to explicit `{field_N}`
 * placeholder tags for templates that don't use the standard header labels.
 *
 * Never fakes success — returns { status: "noTemplate" } when no DXF
 * template has been uploaded in 設定 > 出力テンプレート.
 */
export async function exportPartAssemblyDxf(
  rows: PartAssemblyRow[],
  locale: "ja" | "vi",
): Promise<PartAssemblyDxfResult> {
  const dxfTemplate = await partTemplateService.getByKind("dxf");
  if (!dxfTemplate) return { status: "noTemplate" };

  const res = await fetch(getPublicUrl(dxfTemplate.storagePath));
  if (!res.ok) throw new Error("dxf-template-fetch-failed");
  const dxfText = await res.text();
  const patched = patchDxfPartList(dxfText, rows, locale);
  if (!patched.placeholdersFound) {
    return { status: "noPlaceholders", fileName: dxfTemplate.fileName };
  }
  const fileName = `部品製作図_${new Date().toISOString().slice(0, 10)}.dxf`;
  downloadBlob(new Blob([patched.text], { type: "application/dxf" }), fileName);
  return {
    status: "filled",
    fileName,
    rowsWritten: patched.rowsWritten,
    rowsSkipped: patched.rowsSkipped,
  };
}
