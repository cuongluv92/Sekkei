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
 * A real-world DXF's ASCII text (group codes' string values, including the
 * 記号/品名/... header labels) is not reliably UTF-8 — AutoCAD's Japanese
 * locale, and a lot of older/JW-CAD-family tooling, write it as Shift_JIS
 * (CP932) instead. `file.text()` always assumes UTF-8, which silently turns
 * every Japanese label into mojibake and makes `findHeaderFields` match
 * nothing (a DXF this app exported itself is unaffected — that text is
 * always produced as UTF-8 JS strings — this only bites a DXF authored
 * elsewhere). Try UTF-8 first (the common/fast case), and only re-decode as
 * Shift_JIS if that didn't find a recognizable 部品リスト header.
 */
async function decodeDxfText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const utf8Text = new TextDecoder("utf-8").decode(buffer);
  if (extractDxfPartList(utf8Text).found) return utf8Text;
  try {
    return new TextDecoder("shift_jis").decode(buffer);
  } catch {
    return utf8Text; // Shift_JIS decoder unavailable in this runtime — fall back to the UTF-8 read
  }
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
    const text = await decodeDxfText(file);
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
