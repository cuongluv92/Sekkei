import { getManufacturerName } from "@/lib/mock/manufacturers";
import type { PartAssemblyRow } from "@/lib/types";
import {
  BLANK_MARKERS,
  DXF_PART_LIST_FIELDS,
  DXF_PART_LIST_MAX_ROWS,
  type DxfField,
  type DxfPair,
  type DxfRecord,
  type GridCell,
  clusterByY,
  findHeaderFields,
  getPair,
  parsePairs,
  splitLines,
  splitRecords,
  Y_CLUSTER_TOLERANCE,
} from "./dxfPartListGrid";

export { DXF_PART_LIST_FIELDS, DXF_PART_LIST_MAX_ROWS };

function placeholderTag(field: DxfField, row: number): string {
  return `{${field}_${row}}`;
}

const PLACEHOLDER_PATTERN = /^\{[a-z]+_\d+\}$/;

function fieldValue(row: PartAssemblyRow, field: DxfField, locale: "ja" | "vi"): string {
  switch (field) {
    case "symbol":
      return row.symbol;
    case "name":
      return row.name;
    case "manufacturer":
      return row.manufacturerId ? getManufacturerName(row.manufacturerId, locale) : "";
    case "model":
      return row.model;
    case "specification":
      return row.specification;
    case "quantity":
      return String(row.quantity);
    case "remarks":
      return row.remarks ?? "";
  }
}

export interface DxfPatchResult {
  text: string;
  /** Whether a fillable part-list area was found in the template (grid or explicit tags). */
  placeholdersFound: boolean;
  rowsWritten: number;
  rowsSkipped: number;
}

// --- Grid mode: auto-detects a real 部品リスト table (記号/品名/メーカー/型式/
// 定格・仕様/数量/備考 header + a "-" blank-cell grid below it) with zero setup
// on the user's part — this matches real AutoCAD title-block templates
// directly, no placeholder tags required. Header/grid detection itself lives
// in `dxfPartListGrid.ts`, shared with `dxfPartListExtract.ts`'s read path. ---

function patchViaGrid(
  textRecords: DxfRecord[],
  rows: PartAssemblyRow[],
  locale: "ja" | "vi",
): { rowsWritten: number; rowsSkipped: number; found: boolean } | null {
  const header = findHeaderFields(textRecords);
  if (header.length === 0) return null;

  const blankCells: GridCell[] = [];
  for (const rec of textRecords) {
    const textPair = getPair(rec, 1);
    const xPair = getPair(rec, 10);
    const yPair = getPair(rec, 20);
    if (!textPair || !xPair || !yPair) continue;
    if (!BLANK_MARKERS.has(textPair.value.trim())) continue;
    const x = parseFloat(xPair.value);
    const y = parseFloat(yPair.value);
    if (Number.isNaN(x) || Number.isNaN(y)) continue;
    blankCells.push({ pair: textPair, x, y });
  }
  if (blankCells.length === 0) return { rowsWritten: 0, rowsSkipped: rows.length, found: true };

  // Column assignment is positional (left-to-right rank), not nearest-X:
  // a wide "定格・仕様" column can have its header label centered far from
  // where the row data is left-aligned, so matching by raw X distance
  // misassigns it to a neighboring column. Rank-matching against the
  // header's own left-to-right order is robust to that regardless of
  // column width or label alignment.
  const orderedFields = [...header].sort((a, b) => a.x - b.x).map((h) => h.field);

  const gridRows: { y: number; cells: Map<DxfField, GridCell> }[] = [];
  for (const cluster of clusterByY(blankCells, Y_CLUSTER_TOLERANCE)) {
    if (cluster.length !== orderedFields.length) continue; // partial/mis-clustered row — skip rather than guess
    const sortedCells = [...cluster].sort((a, b) => a.x - b.x);
    const cellsByField = new Map<DxfField, GridCell>();
    sortedCells.forEach((cell, i) => cellsByField.set(orderedFields[i], cell));
    const avgY = cluster.reduce((sum, c) => sum + c.y, 0) / cluster.length;
    gridRows.push({ y: avgY, cells: cellsByField });
  }
  if (gridRows.length === 0) return { rowsWritten: 0, rowsSkipped: rows.length, found: true };

  gridRows.sort((a, b) => b.y - a.y); // top of the drawing first

  let rowsWritten = 0;
  let rowsSkipped = 0;
  for (let i = 0; i < rows.length; i++) {
    const gridRow = gridRows[i];
    if (!gridRow) {
      rowsSkipped++;
      continue;
    }
    for (const [field, cell] of gridRow.cells) {
      cell.pair.value = fieldValue(rows[i], field, locale);
    }
    rowsWritten++;
  }

  return { rowsWritten, rowsSkipped, found: true };
}

// --- Explicit-tag fallback: for templates without the standard Japanese
// header labels — place `{symbol_1}`, `{quantity_1}`, `{symbol_2}`... text
// entities by hand, one set per pre-drawn row. ---

function patchViaTags(
  pairs: DxfPair[],
  rows: PartAssemblyRow[],
  locale: "ja" | "vi",
): { rowsWritten: number; rowsSkipped: number; found: boolean } {
  const tagToPair = new Map<string, DxfPair>();
  for (const pair of pairs) {
    if (pair.code !== 1 && pair.code !== 3) continue;
    const trimmed = pair.value.trim();
    if (PLACEHOLDER_PATTERN.test(trimmed)) {
      tagToPair.set(trimmed, pair);
    }
  }

  const found = DXF_PART_LIST_FIELDS.some((field) => tagToPair.has(placeholderTag(field, 1)));

  let rowsWritten = 0;
  let rowsSkipped = 0;
  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 1;
    if (rowNum > DXF_PART_LIST_MAX_ROWS) {
      rowsSkipped++;
      continue;
    }
    let matchedAny = false;
    for (const field of DXF_PART_LIST_FIELDS) {
      const tag = placeholderTag(field, rowNum);
      const pair = tagToPair.get(tag);
      if (!pair) continue;
      matchedAny = true;
      pair.value = fieldValue(rows[i], field, locale);
      tagToPair.delete(tag);
    }
    if (matchedAny) rowsWritten++;
    else rowsSkipped++;
  }

  for (const pair of tagToPair.values()) {
    pair.value = "";
  }

  return { rowsWritten, rowsSkipped, found };
}

/**
 * Fills a DXF 部品リスト (BOM) template with real part-assembly data.
 *
 * Two strategies, tried in order:
 * 1. Grid mode: auto-detects a standard header row (記号/品名/メーカー/型式/
 *    定格・仕様/数量/備考) and the "-" blank-cell grid below it — the exact
 *    layout AutoCAD title-block templates already use — and fills matched
 *    cells directly. No template prep needed from the user.
 * 2. Tag mode (fallback): explicit `{field_N}` placeholder text entities,
 *    for templates that don't use the standard header labels.
 *
 * Either way, only matched text VALUES are rewritten — every other byte of
 * the drawing (frame, title block, geometry) is untouched. Rows beyond the
 * template's row count are reported as skipped rather than silently dropped;
 * unused template rows in grid mode are left as-is (already read as blank).
 */
export function patchDxfPartList(
  dxfText: string,
  rows: PartAssemblyRow[],
  locale: "ja" | "vi",
): DxfPatchResult {
  const { lines, eol } = splitLines(dxfText);
  const pairs = parsePairs(lines);
  const records = splitRecords(pairs);
  const textRecords = records.filter((r) => r.type === "TEXT");

  const gridResult = patchViaGrid(textRecords, rows, locale);
  const result =
    gridResult && gridResult.rowsWritten > 0
      ? gridResult
      : patchViaTags(pairs, rows, locale);

  const outLines: string[] = [];
  for (const pair of pairs) {
    outLines.push(String(pair.code));
    outLines.push(pair.value);
  }

  return {
    text: outLines.join(eol) + eol,
    placeholdersFound: result.found,
    rowsWritten: result.rowsWritten,
    rowsSkipped: result.rowsSkipped,
  };
}
