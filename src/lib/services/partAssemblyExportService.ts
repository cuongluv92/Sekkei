import ExcelJS from "exceljs";
import { downloadWorkbook } from "./design/excelWorkbook";
import { partTemplateService } from "./partTemplateService";
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

/**
 * 部品製作 DWG出力 — this app has no CAD engine to synthesize a real DWG
 * from a parts list, so the only honest "DWG出力" is downloading the DWG
 * output template configured in 設定 > 出力テンプレート as-is. Returns null
 * (never a fake success) when no template has been uploaded yet — the
 * caller must show that honestly rather than pretending the export worked.
 */
export async function exportPartAssemblyDwg(): Promise<{ fileName: string } | null> {
  const template = await partTemplateService.getByKind("dwg");
  if (!template) return null;
  window.open(getPublicUrl(template.storagePath), "_blank", "noopener,noreferrer");
  return { fileName: template.fileName };
}
