import { findManufacturerByName } from "@/lib/mock/manufacturers";
import { mapRowToRecord, parseTabularFile } from "@/lib/utils/importParsing";
import { extractDxfPartList } from "./dxfPartListExtract";
import type { PartAssemblyRow } from "@/lib/types";

export type PartAssemblyImportRow = Omit<PartAssemblyRow, "id">;

export interface PartAssemblyImportResult {
  rows: PartAssemblyImportRow[];
  /** False only for a DXF with no recognizable 部品リスト grid — an Excel/CSV with zero data rows still returns found: true, rows: []. */
  found: boolean;
}

/**
 * Reads an already-filled 部品リスト (BOM) — either a DXF using the same
 * grid layout `部品製作` exports, or an Excel/CSV using the same 記号/品名/
 * メーカー/型式/仕様/重量/数量/備考 headers the インポート page already
 * recognizes — into ready-to-insert 部品製作 rows. Never writes anything
 * itself; the caller reviews/confirms before calling `addRow`/`insertRowAt`.
 */
export async function parsePartAssemblyImportFile(file: File): Promise<PartAssemblyImportResult> {
  if (file.name.toLowerCase().endsWith(".dxf")) {
    const text = await file.text();
    const { rows, found } = extractDxfPartList(text);
    return {
      found,
      rows: rows.map((r) => ({
        symbol: r.symbol,
        name: r.name,
        manufacturerId: r.manufacturerId,
        model: r.model,
        specification: r.specification,
        quantity: r.quantity,
        remarks: r.remarks,
      })),
    };
  }

  const parsed = await parseTabularFile(file);
  const rows = parsed
    .map((record) => mapRowToRecord(record, "part-data"))
    .filter((r) => r.symbol || r.category || r.model)
    .map(
      (r): PartAssemblyImportRow => ({
        symbol: r.symbol ?? "",
        name: r.category ?? "",
        manufacturerId: r.manufacturer ? (findManufacturerByName(r.manufacturer)?.id ?? "") : "",
        model: r.model ?? "",
        specification: r.specification ?? "",
        weight: r.weight,
        quantity: r.quantity ?? 1,
        remarks: r.remarks ?? "",
      }),
    );
  return { found: true, rows };
}
