import ExcelJS from "exceljs";
import type { ImportTargetCategory } from "@/lib/types";

export interface ParsedRow {
  [header: string]: string;
}

/** Minimal RFC4180-ish CSV parser: handles quoted fields, escaped quotes, and CRLF/LF. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((c) => c !== "")) rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    if (row.some((c) => c !== "")) rows.push(row);
  }
  return rows;
}

function rowsToRecords(rows: string[][]): ParsedRow[] {
  if (rows.length === 0) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).map((r) => {
    const record: ParsedRow = {};
    headers.forEach((h, i) => {
      record[h] = (r[i] ?? "").trim();
    });
    return record;
  });
}

export async function parseTabularFile(file: File): Promise<ParsedRow[]> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv")) {
    const text = await file.text();
    return rowsToRecords(parseCsv(text));
  }

  const buffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];

  const rows: string[][] = [];
  sheet.eachRow((row) => {
    const values = (row.values as ExcelJS.CellValue[]).slice(1); // index 0 is unused by ExcelJS
    rows.push(values.map((v) => (v === null || v === undefined ? "" : String(v)).trim()));
  });
  return rowsToRecords(rows);
}

/** Recognized header spellings (case-insensitive) per logical field — never guesses cell coordinates, only matches literal header text. */
const HEADER_ALIASES: Record<string, string[]> = {
  symbol: ["記号", "symbol"],
  category: ["品名", "種類", "category", "name", "名称"],
  manufacturer: ["メーカー", "manufacturer"],
  model: ["型式", "型番", "model"],
  specification: ["定格・仕様", "仕様", "走り・仕様", "specification", "spec"],
  weight: ["重量", "weight"],
  quantity: ["数量", "quantity"],
  heatW: ["発熱量", "発熱量(W)", "発熱量w", "heat", "heatw", "heat generation"],
  remarks: ["備考", "remarks", "note"],
  fileName: ["ファイル名", "filename", "file"],
};

function findField(record: ParsedRow, field: keyof typeof HEADER_ALIASES): string | undefined {
  const aliases = HEADER_ALIASES[field];
  for (const key of Object.keys(record)) {
    if (aliases.some((a) => a.toLowerCase() === key.trim().toLowerCase())) {
      const value = record[key];
      return value === "" ? undefined : value;
    }
  }
  return undefined;
}

export interface MappedImportRecord {
  symbol?: string;
  category?: string;
  manufacturer?: string;
  model?: string;
  specification?: string;
  weight?: number;
  quantity?: number;
  heatW?: number;
  remarks?: string;
  fileName?: string;
}

/**
 * Parses a 重量 cell into kg. Real catalog exports write this as "0.18kg",
 * not a bare number — `Number("0.18kg")` is NaN, so a plain Number() cast
 * would silently corrupt every weight on import. A "g" suffix is converted
 * to kg; a bare number is assumed already kg. Anything that doesn't parse
 * returns undefined rather than NaN, so an unrecognized cell just leaves
 * 重量 blank instead of poisoning it with garbage.
 */
function parseWeightKg(raw: string): number | undefined {
  const match = /^([\d.]+)\s*(kg|g)?$/i.exec(raw.trim());
  if (!match) return undefined;
  const value = Number(match[1]);
  if (!Number.isFinite(value)) return undefined;
  return match[2]?.toLowerCase() === "g" ? value / 1000 : value;
}

/**
 * 発熱量(W)セルをパースする — カタログ値は素の数値のことが多いが、
 * 「150W」「1,200W」「1.5kW」のように単位・桁区切りカンマ付きで書かれる
 * ケースも許容する(重量のkg/g変換と同じ方針)。負荷率などからの逆算は
 * しない(捏造しない — 換気計算のHeatSourceItem.heatWと同じ方針で常に直値)。
 */
function parseHeatW(raw: string): number | undefined {
  const match = /^([\d,.]+)\s*(kw|w)?$/i.exec(raw.trim());
  if (!match) return undefined;
  const value = Number(match[1].replace(/,/g, ""));
  if (!Number.isFinite(value)) return undefined;
  return match[2]?.toLowerCase() === "kw" ? value * 1000 : value;
}

/** Maps one parsed spreadsheet row to normalized fields for the given target category, based only on recognized header text. */
export function mapRowToRecord(record: ParsedRow, target: ImportTargetCategory): MappedImportRecord {
  const weightRaw = findField(record, "weight");
  const quantityRaw = findField(record, "quantity");
  const heatWRaw = findField(record, "heatW");
  return {
    symbol: findField(record, "symbol"),
    category: findField(record, "category"),
    manufacturer: findField(record, "manufacturer"),
    model: findField(record, "model"),
    specification: findField(record, "specification"),
    weight: weightRaw ? parseWeightKg(weightRaw) : undefined,
    quantity: quantityRaw ? Number(quantityRaw) : undefined,
    heatW: heatWRaw ? parseHeatW(heatWRaw) : undefined,
    remarks: findField(record, "remarks"),
    fileName: target === "catalog" ? findField(record, "fileName") : undefined,
  };
}
