import { getManufacturerName } from "@/lib/mock/manufacturers";
import type { PartAssemblyRow } from "@/lib/types";

export const DXF_PART_LIST_FIELDS = [
  "symbol",
  "name",
  "manufacturer",
  "model",
  "specification",
  "quantity",
  "remarks",
] as const;
type DxfField = (typeof DXF_PART_LIST_FIELDS)[number];

/** Upper bound on pre-drawn table rows the explicit-tag fallback (`{field_N}`) will scan for. */
export const DXF_PART_LIST_MAX_ROWS = 30;

interface DxfPair {
  code: number;
  value: string;
}

interface DxfRecord {
  type: string;
  pairs: DxfPair[];
}

function splitLines(text: string): { lines: string[]; eol: string } {
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  const lines = text.split(/\r\n|\r|\n/);
  if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  return { lines, eol };
}

function parsePairs(lines: string[]): DxfPair[] {
  const pairs: DxfPair[] = [];
  for (let i = 0; i + 1 < lines.length; i += 2) {
    const code = parseInt(lines[i].trim(), 10);
    if (Number.isNaN(code)) continue;
    pairs.push({ code, value: lines[i + 1] });
  }
  return pairs;
}

function splitRecords(pairs: DxfPair[]): DxfRecord[] {
  const records: DxfRecord[] = [];
  let current: DxfPair[] | null = null;
  for (const p of pairs) {
    if (p.code === 0) {
      if (current) records.push({ type: current[0].value, pairs: current });
      current = [p];
    } else if (current) {
      current.push(p);
    }
  }
  if (current) records.push({ type: current[0].value, pairs: current });
  return records;
}

function getPair(rec: DxfRecord, code: number): DxfPair | undefined {
  return rec.pairs.find((p) => p.code === code);
}

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
// directly, no placeholder tags required. ---

const FIELD_LABEL_MATCHERS: { field: DxfField; test: (normalized: string) => boolean }[] = [
  { field: "symbol", test: (s) => s.includes("記号") },
  { field: "name", test: (s) => s.includes("品名") },
  { field: "manufacturer", test: (s) => s.includes("メーカー") },
  { field: "model", test: (s) => s.includes("型式") },
  { field: "specification", test: (s) => s.includes("仕様") },
  { field: "quantity", test: (s) => s.includes("数量") },
  { field: "remarks", test: (s) => s.includes("備考") },
];

const BLANK_MARKERS = new Set(["-", "－", "‐", "―", "–"]);

/** Max Y difference (drawing units) for two text baselines to count as "the same row". Must stay well under real row-to-row spacing (7.5 on the real template this was built against). */
const Y_CLUSTER_TOLERANCE = 2;

function normalizeLabel(s: string): string {
  return s.replace(/[\s　]/g, "");
}

/**
 * Groups items with a numeric `y` into rows by proximity rather than fixed
 * rounding buckets — a naive `toFixed(1)` bucket splits a single real header
 * row in half whenever label baselines vary by a few hundredths across a
 * rounding boundary (observed on a real AutoCAD template: 270.688–270.838,
 * ~0.15 apart, straddling the 270.7/270.8 boundary). `tolerance` must stay
 * well under the vertical spacing between actual table rows.
 */
function clusterByY<T extends { y: number }>(items: T[], tolerance: number): T[][] {
  const sorted = [...items].sort((a, b) => a.y - b.y);
  const clusters: T[][] = [];
  for (const item of sorted) {
    const last = clusters[clusters.length - 1];
    if (last && item.y - last[last.length - 1].y <= tolerance) {
      last.push(item);
    } else {
      clusters.push([item]);
    }
  }
  return clusters;
}

interface GridCell {
  pair: DxfPair;
  x: number;
  y: number;
}

interface HeaderField {
  field: DxfField;
  x: number;
  y: number;
}

function findHeaderFields(textRecords: DxfRecord[]): HeaderField[] {
  const candidates: HeaderField[] = [];
  for (const rec of textRecords) {
    const textPair = getPair(rec, 1);
    const xPair = getPair(rec, 10);
    const yPair = getPair(rec, 20);
    if (!textPair || !xPair || !yPair) continue;
    const normalized = normalizeLabel(textPair.value);
    const match = FIELD_LABEL_MATCHERS.find((m) => m.test(normalized));
    if (!match) continue;
    const x = parseFloat(xPair.value);
    const y = parseFloat(yPair.value);
    if (Number.isNaN(x) || Number.isNaN(y)) continue;
    candidates.push({ field: match.field, x, y });
  }
  if (candidates.length === 0) return [];

  // The real header row is whichever Y-cluster groups the most *distinct*
  // fields — protects against a stray label match elsewhere in a full
  // drawing (e.g. a "(備考)" note far away on the same sheet).
  const clusters = clusterByY(candidates, Y_CLUSTER_TOLERANCE);
  let best: HeaderField[] = [];
  let bestDistinctCount = 0;
  for (const cluster of clusters) {
    const distinct = new Set(cluster.map((c) => c.field)).size;
    if (distinct > bestDistinctCount) {
      bestDistinctCount = distinct;
      best = cluster;
    }
  }
  const byField = new Map<DxfField, HeaderField>();
  for (const c of best) {
    if (!byField.has(c.field)) byField.set(c.field, c);
  }
  return [...byField.values()];
}

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
