import { bucketFromSegment, enumerateSegmentsBetween, JUN_BUCKETS, type JunBucket, type MonthSegment } from "./schedule";
import type { CaseSchedule, ScheduleCategoryKey, ScheduleColorConfig } from "@/lib/types/design";

export { bucketFromSegment, JUN_BUCKETS, type JunBucket };

const RANGE_FIELDS: {
  category: ScheduleCategoryKey;
  startKey: keyof CaseSchedule;
  endKey: keyof CaseSchedule;
  /** 完了日欄(endKey)が自由記入テキストで実日付として解釈できない場合の
   * 色分け専用フォールバック — 常に実日付のみを持つ補助欄。 */
  endRefKey?: keyof CaseSchedule;
}[] = [
  { category: "sheetMetal", startKey: "sheetMetalOrderDate", endKey: "sheetMetalDeliveryDate" },
  { category: "box", startKey: "boxOrderDate", endKey: "boxDeliveryDate" },
  { category: "accessory", startKey: "accessoryOrderDate", endKey: "accessoryDeliveryDate" },
  { category: "production", startKey: "productionStartDate", endKey: "productionEndDate", endRefKey: "productionEndRefDate" },
  { category: "inspection", startKey: "inspectionStartDate", endKey: "inspectionEndDate", endRefKey: "inspectionEndRefDate" },
  { category: "witness", startKey: "witnessStartDate", endKey: "witnessEndDate", endRefKey: "witnessEndRefDate" },
  { category: "shipping", startKey: "shippingStartDate", endKey: "shippingEndDate", endRefKey: "shippingEndRefDate" },
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
  for (const { category, startKey, endKey, endRefKey } of RANGE_FIELDS) {
    const start = parseDate(schedule[startKey] as string | null);
    const end =
      parseDate(schedule[endKey] as string | null) ??
      (endRefKey ? parseDate(schedule[endRefKey] as string | null) : null) ??
      start;
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

export interface ColoredDay {
  year: number;
  month: number; // 1-12
  day: number;
  category: ScheduleCategoryKey;
}

/**
 * Dates -> 実日単位のカラー化情報。`computeColoredSegments` (初/中/下の5日
 * 単位) より1段細かく、日付範囲の境界を正確な日で持つ。旬単位への丸めで
 * 起きていた「同じ旬内で工程が重なって片方の色が消える」問題を、タイム
 * ライン側で実際の日数に応じた列幅にして解消するために使う。
 */
export function computeColoredDays(schedule: CaseSchedule): ColoredDay[] {
  const out: ColoredDay[] = [];
  for (const { category, startKey, endKey, endRefKey } of RANGE_FIELDS) {
    const start = parseDate(schedule[startKey] as string | null);
    const end =
      parseDate(schedule[endKey] as string | null) ??
      (endRefKey ? parseDate(schedule[endRefKey] as string | null) : null) ??
      start;
    if (!start || !end) continue;
    const [s, e] = start <= end ? [start, end] : [end, start];
    const cursor = new Date(s.getFullYear(), s.getMonth(), s.getDate());
    const last = new Date(e.getFullYear(), e.getMonth(), e.getDate());
    while (cursor <= last) {
      out.push({ year: cursor.getFullYear(), month: cursor.getMonth() + 1, day: cursor.getDate(), category });
      cursor.setDate(cursor.getDate() + 1);
    }
  }
  const delivery = parseDate(schedule.deliveryDate);
  if (delivery) {
    out.push({ year: delivery.getFullYear(), month: delivery.getMonth() + 1, day: delivery.getDate(), category: "shipping" });
  }
  return out;
}

export function dayCellKeyRow(year: number, month: number, day: number, rowIndex: number) {
  return `${year}-${month}-${day}-${rowIndex}`;
}

/**
 * PROCESS_ROWS の行ごとに折りたたんだ、実日単位のカラールックアップ —
 * `buildJunColorLookupByRow` の日単位版。画面のタイムラインはこちらを使い、
 * 各セルの色は実際のその日の日付から決まるため、旬の途中で工程が切り替
 * わっても正確な日で色が切り替わる (先勝ちは同じ行・同じ日に複数カテゴリ
 * が重なる場合のみ発生する、本当の意味での重複)。
 */
export function buildDayColorLookupByRow(
  days: ColoredDay[],
  colors: ScheduleColorConfig[],
): Map<string, string> {
  const colorByCategory = new Map(colors.map((c) => [c.category, c.color]));
  const map = new Map<string, string>();
  for (const d of days) {
    const rowIndex = rowIndexForCategory(d.category);
    if (rowIndex < 0) continue;
    const displayCategory = DISPLAY_CATEGORY_COLOR[d.category] ?? d.category;
    const color = colorByCategory.get(displayCategory);
    if (!color) continue;
    const key = dayCellKeyRow(d.year, d.month, d.day, rowIndex);
    if (!map.has(key)) map.set(key, color);
  }
  return map;
}

/** その年月の実際の日数 (28〜31)。 */
export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** Normalizes month arithmetic (1-12) across year boundaries in either direction. */
export function addMonths(year: number, month: number, delta: number): { year: number; month: number } {
  const zeroBased = month - 1 + delta;
  const y = year + Math.floor(zeroBased / 12);
  const m = ((zeroBased % 12) + 12) % 12;
  return { year: y, month: m + 1 };
}
