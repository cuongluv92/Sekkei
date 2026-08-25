import { bucketFromSegment, enumerateSegmentsBetween, JUN_BUCKETS, type JunBucket, type MonthSegment } from "./schedule";
import type { CaseSchedule, ScheduleCategoryKey, ScheduleColorConfig } from "@/lib/types/design";

export { bucketFromSegment, JUN_BUCKETS, type JunBucket };

const RANGE_FIELDS: {
  category: ScheduleCategoryKey;
  startKey: keyof CaseSchedule;
  endKey: keyof CaseSchedule;
}[] = [
  { category: "sheetMetal", startKey: "sheetMetalOrderDate", endKey: "sheetMetalDeliveryDate" },
  { category: "box", startKey: "boxOrderDate", endKey: "boxDeliveryDate" },
  { category: "accessory", startKey: "accessoryOrderDate", endKey: "accessoryDeliveryDate" },
  { category: "production", startKey: "productionStartDate", endKey: "productionEndDate" },
  { category: "inspection", startKey: "inspectionStartDate", endKey: "inspectionEndDate" },
  { category: "witness", startKey: "witnessStartDate", endKey: "witnessEndDate" },
  { category: "shipping", startKey: "shippingStartDate", endKey: "shippingEndDate" },
];

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export interface ColoredSegment extends MonthSegment {
  category: ScheduleCategoryKey;
}

/**
 * Dates -> segments. Always recomputed from the raw milestone dates on
 * `CaseSchedule` — never reads or writes a stored "cell color", so the
 * timeline is guaranteed fresh on every render (re-uploading a template and
 * changing `scheduleColorService` config changes the colors without ever
 * touching this function or the underlying dates).
 */
export function computeColoredSegments(schedule: CaseSchedule): ColoredSegment[] {
  const out: ColoredSegment[] = [];
  for (const { category, startKey, endKey } of RANGE_FIELDS) {
    const start = parseDate(schedule[startKey] as string | null);
    const end = parseDate(schedule[endKey] as string | null) ?? start;
    if (!start || !end) continue;
    const [s, e] = start <= end ? [start, end] : [end, start];
    for (const seg of enumerateSegmentsBetween(s, e)) {
      out.push({ ...seg, category });
    }
  }
  const delivery = parseDate(schedule.deliveryDate);
  if (delivery) {
    for (const seg of enumerateSegmentsBetween(delivery, delivery)) {
      out.push({ ...seg, category: "shipping" });
    }
  }
  return out;
}

export function segmentCellKey(year: number, month: number, segment: string) {
  return `${year}-${month}-${segment}`;
}

export function buildColorLookup(
  segments: ColoredSegment[],
  colors: ScheduleColorConfig[],
): Map<string, string> {
  const colorByCategory = new Map(colors.map((c) => [c.category, c.color]));
  const map = new Map<string, string>();
  for (const seg of segments) {
    const color = colorByCategory.get(seg.category);
    if (color) map.set(segmentCellKey(seg.year, seg.month, seg.segment), color);
  }
  return map;
}

export function junCellKey(year: number, month: number, bucket: JunBucket) {
  return `${year}-${month}-${bucket}`;
}

/**
 * 実テンプレートの凡例には「板金・BOX納入」という1つの色見本しかない
 * (鈑金/BOXは日付項目としては別だが、表示色は共通)。画面・Excelどちらも
 * この対応表を通してから色を引くことで、常に見た目が一致するようにする。
 */
const DISPLAY_CATEGORY_COLOR: Partial<Record<ScheduleCategoryKey, ScheduleCategoryKey>> = {
  box: "sheetMetal",
};

/** 初/中/下 (旬) 単位に折りたたんだ色ルックアップ — 既に埋まっているセルは上書きしない (先勝ち)。 */
export function buildJunColorLookup(
  segments: ColoredSegment[],
  colors: ScheduleColorConfig[],
): Map<string, string> {
  const colorByCategory = new Map(colors.map((c) => [c.category, c.color]));
  const map = new Map<string, string>();
  for (const seg of segments) {
    const category = DISPLAY_CATEGORY_COLOR[seg.category] ?? seg.category;
    const color = colorByCategory.get(category);
    if (!color) continue;
    const key = junCellKey(seg.year, seg.month, bucketFromSegment(seg.segment));
    if (!map.has(key)) map.set(key, color);
  }
  return map;
}

/**
 * 実テンプレートの1案件ブロックは4行 (罫線で確認済み: 1ブロック=4行、行間に
 * 太罫線なし) — 板金・BOX・部材が製作の"前工程"として同時期に走ることが多く、
 * 1行しかないと後勝ちで色が消えてしまう問題を、工程の流れ(板金・BOX・部材→
 * 製作→検査→立会・出荷)に沿って4行に分けることで解消する。画面表示・Excel
 * 出力どちらもこの行グループ分けを共通で使う。
 */
export const PROCESS_ROWS: ScheduleCategoryKey[][] = [
  ["sheetMetal", "box", "accessory"],
  ["production"],
  ["inspection"],
  ["witness", "shipping"],
];

function rowIndexForCategory(category: ScheduleCategoryKey): number {
  return PROCESS_ROWS.findIndex((categories) => categories.includes(category));
}

export function junCellKeyRow(year: number, month: number, bucket: JunBucket, rowIndex: number) {
  return `${year}-${month}-${bucket}-${rowIndex}`;
}

/**
 * PROCESS_ROWS の行ごとに折りたたんだ色ルックアップ — 工程表の画面表示・
 * Excel出力の唯一の実装。同じ行内で既に埋まっているセルは上書きしない
 * (先勝ち)。
 */
export function buildJunColorLookupByRow(
  segments: ColoredSegment[],
  colors: ScheduleColorConfig[],
): Map<string, string> {
  const colorByCategory = new Map(colors.map((c) => [c.category, c.color]));
  const map = new Map<string, string>();
  for (const seg of segments) {
    const rowIndex = rowIndexForCategory(seg.category);
    if (rowIndex < 0) continue;
    const displayCategory = DISPLAY_CATEGORY_COLOR[seg.category] ?? seg.category;
    const color = colorByCategory.get(displayCategory);
    if (!color) continue;
    const key = junCellKeyRow(seg.year, seg.month, bucketFromSegment(seg.segment), rowIndex);
    if (!map.has(key)) map.set(key, color);
  }
  return map;
}

/** Normalizes month arithmetic (1-12) across year boundaries in either direction. */
export function addMonths(year: number, month: number, delta: number): { year: number; month: number } {
  const zeroBased = month - 1 + delta;
  const y = year + Math.floor(zeroBased / 12);
  const m = ((zeroBased % 12) + 12) % 12;
  return { year: y, month: m + 1 };
}
