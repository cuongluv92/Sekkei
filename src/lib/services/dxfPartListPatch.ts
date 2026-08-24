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

/** Upper bound on pre-drawn table rows a DXF template can expose placeholders for. */
export const DXF_PART_LIST_MAX_ROWS = 30;

interface DxfPair {
  code: number;
  value: string;
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
  /** Whether the template contained at least one recognized `{field_1}` placeholder. */
  placeholdersFound: boolean;
  rowsWritten: number;
  rowsSkipped: number;
}

/**
 * Fills a DXF part-list template's placeholder TEXT/ATTDEF entities (tagged
 * `{symbol_1}`, `{quantity_1}`, `{symbol_2}`, ... — one placeholder set per
 * pre-drawn table row, up to DXF_PART_LIST_MAX_ROWS) with real 部品リスト
 * data, in place. No entity cloning or coordinate math: every other byte of
 * the drawing (frame, title block, geometry) is untouched, so this can't
 * corrupt anything outside the matched text values. Part rows beyond the
 * template's pre-drawn placeholder rows are reported as skipped rather than
 * silently dropped; template rows left over (more placeholders than part
 * rows) are cleared to blank.
 */
export function patchDxfPartList(
  dxfText: string,
  rows: PartAssemblyRow[],
  locale: "ja" | "vi",
): DxfPatchResult {
  const { lines, eol } = splitLines(dxfText);
  const pairs = parsePairs(lines);

  const tagToPair = new Map<string, DxfPair>();
  for (const pair of pairs) {
    if (pair.code !== 1 && pair.code !== 3) continue;
    const trimmed = pair.value.trim();
    if (PLACEHOLDER_PATTERN.test(trimmed)) {
      tagToPair.set(trimmed, pair);
    }
  }

  const placeholdersFound = DXF_PART_LIST_FIELDS.some((field) =>
    tagToPair.has(placeholderTag(field, 1)),
  );

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

  // Leftover template rows (placeholders beyond the current part list) are
  // cleared so no literal "{symbol_7}" text survives into the output.
  for (const pair of tagToPair.values()) {
    pair.value = "";
  }

  const outLines: string[] = [];
  for (const pair of pairs) {
    outLines.push(String(pair.code));
    outLines.push(pair.value);
  }

  return {
    text: outLines.join(eol) + eol,
    placeholdersFound,
    rowsWritten,
    rowsSkipped,
  };
}
