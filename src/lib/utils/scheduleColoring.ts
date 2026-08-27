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
  /** 「済」チェック欄 — オンの間はマイルストーンラベルを実日付の日番号
   * ではなく「済」の文字にする(色分け・バーの範囲自体は実日付のまま)。 */
  doneKey: keyof CaseSchedule;
}[] = [
  { category: "sheetMetal", startKey: "sheetMetalOrderDate", endKey: "sheetMetalDeliveryDate", doneKey: "sheetMetalDeliveryDone" },
  { category: "box", startKey: "boxOrderDate", endKey: "boxDeliveryDate", doneKey: "boxDeliveryDone" },
  { category: "accessory", startKey: "accessoryOrderDate", endKey: "accessoryDeliveryDate", doneKey: "accessoryDeliveryDone" },
  { category: "production", startKey: "productionStartDate", endKey: "productionEndDate", endRefKey: "productionEndRefDate", doneKey: "productionEndDone" },
  { category: "inspection", startKey: "inspectionStartDate", endKey: "inspectionEndDate", endRefKey: "inspectionEndRefDate", doneKey: "inspectionEndDone" },
  { category: "witness", startKey: "witnessStartDate", endKey: "witnessEndDate", endRefKey: "witnessEndRefDate", doneKey: "witnessEndDone" },
  { category: "shipping", startKey: "shippingStartDate", endKey: "shippingEndDate", endRefKey: "shippingEndRefDate", doneKey: "shippingEndDone" },
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

/**
 * 画面のライブタイムライン専用の行分け — 実テンプレート(Excel)側は罫線で
 * 確認済みの固定4行構造(PROCESS_ROWS)を必ず守る必要があるが、画面表示
 * はそれに縛られる必要がないため、見やすさ優先で行のまとめ方を変えて
 * いる: 鈑金・BOX納入/アクセサリー納入をそれぞれ独立行にし(部材が板金・
 * BOXと同じ行にいると重なって消えやすいため)、代わりに製作と検査は
 * カスケードで必ず日付がずれる(開始日=前工程完了日+1)ため同じ行に
 * まとめても重ならない。
 */
export const SCREEN_PROCESS_ROWS: ScheduleCategoryKey[][] = [
  ["sheetMetal", "box"],
  ["accessory"],
  ["production", "inspection"],
  ["witness", "shipping"],
];

function rowIndexForCategoryScreen(category: ScheduleCategoryKey): number {
  return SCREEN_PROCESS_ROWS.findIndex((categories) => categories.includes(category));
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
 * SCREEN_PROCESS_ROWS の行ごとに折りたたんだ、実日単位のカラールックアップ
 * — `buildJunColorLookupByRow` の日単位版。画面のタイムラインはこちらを
 * 使い、各セルの色は実際のその日の日付から決まるため、旬の途中で工程が
 * 切り替わっても正確な日で色が切り替わる (先勝ちは同じ行・同じ日に複数
 * カテゴリが重なる場合のみ発生する、本当の意味での重複)。
 */
export function buildDayColorLookupByRow(
  days: ColoredDay[],
  colors: ScheduleColorConfig[],
): Map<string, string> {
  const colorByCategory = new Map(colors.map((c) => [c.category, c.color]));
  const map = new Map<string, string>();
  for (const d of days) {
    const rowIndex = rowIndexForCategoryScreen(d.category);
    if (rowIndex < 0) continue;
    const displayCategory = DISPLAY_CATEGORY_COLOR[d.category] ?? d.category;
    const color = colorByCategory.get(displayCategory);
    if (!color) continue;
    const key = dayCellKeyRow(d.year, d.month, d.day, rowIndex);
    if (!map.has(key)) map.set(key, color);
  }
  return map;
}

export interface ScheduleMilestone {
  year: number;
  month: number; // 1-12
  day: number;
  category: ScheduleCategoryKey;
  /** 「済」チェック欄がオンかどうか — オンならラベルは日番号でなく「済」。 */
  done: boolean;
}

/**
 * 各カテゴリの「代表日」(納入日/完了日 = RANGE_FIELDS の endKey、自由記入
 * テキストの場合は endRefKey) だけを取り出す — タイムライン上にその日の
 * 日付を数字ラベルとして表示するために使う。バーの範囲(色分け)は常に
 * 実日付のまま — 「済」チェックは表示するラベル文字だけを差し替える。
 */
export function computeMilestones(schedule: CaseSchedule): ScheduleMilestone[] {
  const out: ScheduleMilestone[] = [];
  for (const { category, endKey, endRefKey, doneKey } of RANGE_FIELDS) {
    const end =
      parseDate(schedule[endKey] as string | null) ??
      (endRefKey ? parseDate(schedule[endRefKey] as string | null) : null);
    if (!end) continue;
    out.push({
      year: end.getFullYear(),
      month: end.getMonth() + 1,
      day: end.getDate(),
      category,
      done: !!schedule[doneKey],
    });
  }
  const delivery = parseDate(schedule.deliveryDate);
  if (delivery) {
    out.push({
      year: delivery.getFullYear(),
      month: delivery.getMonth() + 1,
      day: delivery.getDate(),
      category: "shipping",
      done: !!schedule.deliveryDone,
    });
  }
  return out;
}

/**
 * SCREEN_PROCESS_ROWS の行ごとに折りたたんだ日付ラベル (日のみの文字列、
 * 「済」チェックがオンなら「済」) — 同じ行・同じ日に複数カテゴリの代表日
 * が重なる場合は1つだけ表示する (例: 鈑金納入日とBOX納入日が同日なら
 * 「10」を1つだけ出す)。
 */
export function buildMilestoneLabelsByRow(milestones: ScheduleMilestone[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const m of milestones) {
    const rowIndex = rowIndexForCategoryScreen(m.category);
    if (rowIndex < 0) continue;
    const key = dayCellKeyRow(m.year, m.month, m.day, rowIndex);
    if (!map.has(key)) map.set(key, m.done ? "済" : String(m.day));
  }
  return map;
}

function bucketFromDay(day: number): JunBucket {
  return day <= 10 ? "初" : day <= 20 ? "中" : "下";
}

/**
 * SCREEN_PROCESS_ROWS の行ごとに折りたたんだ、旬単位の色ルックアップ —
 * `buildJunColorLookupByRow` と同じ旬粒度だが、行分けは画面と同じ
 * SCREEN_PROCESS_ROWS を使う。Excel出力(⑤工程表)が画面のタイムラインと
 * 同じ行構成で出力するために使う(実テンプレート由来のPROCESS_ROWSとは
 * 別物 — こちらはアプリ側で自由にレイアウトできる出力専用)。
 */
export function buildJunColorLookupByScreenRow(
  segments: ColoredSegment[],
  colors: ScheduleColorConfig[],
): Map<string, string> {
  const colorByCategory = new Map(colors.map((c) => [c.category, c.color]));
  const map = new Map<string, string>();
  for (const seg of segments) {
    const rowIndex = rowIndexForCategoryScreen(seg.category);
    if (rowIndex < 0) continue;
    const displayCategory = DISPLAY_CATEGORY_COLOR[seg.category] ?? seg.category;
    const color = colorByCategory.get(displayCategory);
    if (!color) continue;
    const key = junCellKeyRow(seg.year, seg.month, bucketFromSegment(seg.segment), rowIndex);
    if (!map.has(key)) map.set(key, color);
  }
  return map;
}

/**
 * buildMilestoneLabelsByRow の旬単位版 — 実日ではなく、その日が属する旬の
 * セルにラベルを置く(Excel出力は旬単位の3列/月構成のため)。
 */
export function buildMilestoneLabelsByJunRow(milestones: ScheduleMilestone[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const m of milestones) {
    const rowIndex = rowIndexForCategoryScreen(m.category);
    if (rowIndex < 0) continue;
    const key = junCellKeyRow(m.year, m.month, bucketFromDay(m.day), rowIndex);
    if (!map.has(key)) map.set(key, m.done ? "済" : String(m.day));
  }
  return map;
}

/**
 * 画面のタイムライン・Excel出力(⑤工程表)共通の表示月数 — 「作成月の
 * 1ヶ月前〜3ヶ月後」(計5ヶ月)。Excel出力も画面と同じ範囲にすることで、
 * 見た目が常に一致するようにする。
 */
export const SCREEN_MONTHS_BEFORE = 1;
export const SCREEN_MONTHS_AFTER = 3;

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
