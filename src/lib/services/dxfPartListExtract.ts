import { findManufacturerByName } from "@/lib/mock/manufacturers";
import {
  BLANK_MARKERS,
  DXF_PART_LIST_MAX_ROWS,
  type DxfField,
  type GridCell,
  clusterByY,
  findHeaderFields,
  getPair,
  parsePairs,
  splitLines,
  splitRecords,
  Y_CLUSTER_TOLERANCE,
} from "./dxfPartListGrid";

export interface DxfExtractedRow {
  symbol: string;
  name: string;
  manufacturerId: string;
  model: string;
  specification: string;
  quantity: number;
  remarks: string;
}

export interface DxfExtractResult {
  rows: DxfExtractedRow[];
  /** Whether a 部品リスト grid header (記号/品名/メーカー/型式/定格・仕様/数量/備考) was found at all. */
  found: boolean;
}

function cellText(field: DxfField, cell: GridCell | undefined): string {
  if (!cell) return "";
  const trimmed = cell.pair.value.trim();
  return BLANK_MARKERS.has(trimmed) ? "" : trimmed;
}

/**
 * Reads a 部品リスト (BOM) already filled into a copy of the same DXF grid
 * `patchDxfPartList` writes — the reverse direction of that function, reusing
 * its exact header/column detection (`dxfPartListGrid.ts`) so both directions
 * agree on what "the grid" is. Lets a vendor/customer-filled DXF (already
 * carrying real 記号/品名/型式/数量... text) be read straight into 部品製作
 * instead of retyped by hand.
 *
 * Rows are read top-to-bottom starting right below the header, stopping at
 * the first row that either (a) doesn't have exactly one text cell per
 * column — the table has ended — or (b) is entirely blank markers — an
 * unfilled template row, meaning nothing further down was actually used.
 * Either stop condition also protects against picking up unrelated text
 * elsewhere in the drawing (dimensions, title block, other notes).
 */
export function extractDxfPartList(dxfText: string): DxfExtractResult {
  const { lines } = splitLines(dxfText);
  const pairs = parsePairs(lines);
  const records = splitRecords(pairs);
  const textRecords = records.filter((r) => r.type === "TEXT");

  const header = findHeaderFields(textRecords);
  if (header.length === 0) return { rows: [], found: false };

  const sortedHeader = [...header].sort((a, b) => a.x - b.x);
  const orderedFields = sortedHeader.map((h) => h.field);
  const avgHeaderY = header.reduce((sum, h) => sum + h.y, 0) / header.length;

  const bodyCells: GridCell[] = [];
  for (const rec of textRecords) {
    const textPair = getPair(rec, 1);
    const xPair = getPair(rec, 10);
    const yPair = getPair(rec, 20);
    if (!textPair || !xPair || !yPair) continue;
    const x = parseFloat(xPair.value);
    const y = parseFloat(yPair.value);
    if (Number.isNaN(x) || Number.isNaN(y)) continue;
    if (y >= avgHeaderY - Y_CLUSTER_TOLERANCE) continue; // header row itself, or anything at/above it
    bodyCells.push({ pair: textPair, x, y });
  }

  const clusters = clusterByY(bodyCells, Y_CLUSTER_TOLERANCE).sort((a, b) => {
    const avgA = a.reduce((s, c) => s + c.y, 0) / a.length;
    const avgB = b.reduce((s, c) => s + c.y, 0) / b.length;
    return avgB - avgA; // top of the drawing first
  });

  const rows: DxfExtractedRow[] = [];
  for (const cluster of clusters) {
    if (rows.length >= DXF_PART_LIST_MAX_ROWS) break;
    if (cluster.length !== orderedFields.length) break; // table ended (or mis-clustered) — stop rather than guess

    const sortedCells = [...cluster].sort((a, b) => a.x - b.x);
    const byField = new Map<DxfField, GridCell>();
    sortedCells.forEach((cell, i) => byField.set(orderedFields[i], cell));

    const allBlank = sortedCells.every((c) => BLANK_MARKERS.has(c.pair.value.trim()));
    if (allBlank) break; // first unfilled template row — nothing further down was used

    const manufacturerText = cellText("manufacturer", byField.get("manufacturer"));
    const quantityText = cellText("quantity", byField.get("quantity"));
    rows.push({
      symbol: cellText("symbol", byField.get("symbol")),
      name: cellText("name", byField.get("name")),
      manufacturerId: manufacturerText ? (findManufacturerByName(manufacturerText)?.id ?? "") : "",
      model: cellText("model", byField.get("model")),
      specification: cellText("specification", byField.get("specification")),
      quantity: quantityText ? Number(quantityText) || 1 : 1,
      remarks: cellText("remarks", byField.get("remarks")),
    });
  }

  return { rows, found: true };
}
