/**
 * 工程 timeline groundwork (Phase 3 — no UI consumes this yet). The mapping
 * and segment-enumeration logic is locked in now, against the exact rules
 * and test cases from the spec, so Phase 3 only needs to build the
 * rendering on top of it.
 */

import type { CaseSchedule } from "@/lib/types/design";

export type ScheduleSegment = "初1" | "初2" | "中1" | "中2" | "下1" | "下2";

export const SCHEDULE_SEGMENTS: ScheduleSegment[] = ["初1", "初2", "中1", "中2", "下1", "下2"];

/**
 * 1〜5日→初1, 6〜10日→初2, 11〜15日→中1, 16〜20日→中2, 21〜25日→下1, 26日〜月末→下2
 */
export function getSegmentForDay(day: number): ScheduleSegment {
  if (day <= 5) return "初1";
  if (day <= 10) return "初2";
  if (day <= 15) return "中1";
  if (day <= 20) return "中2";
  if (day <= 25) return "下1";
  return "下2";
}

export type JunBucket = "初" | "中" | "下";
export const JUN_BUCKETS: JunBucket[] = ["初", "中", "下"];

/** 初1/初2→初、中1/中2→中、下1/下2→下 — 実際のExcel工程表テンプレートは月ごとに初/中/下の3列しか持たないため、画面表示・Excel出力の両方でこの粒度に折りたたむ。 */
export function bucketFromSegment(segment: ScheduleSegment): JunBucket {
  return segment.startsWith("初") ? "初" : segment.startsWith("中") ? "中" : "下";
}

/** 旬の代表的な日付範囲 (初=1〜10日、中=11〜20日、下=21日〜月末) — 「9月中」のような旬単位のかんたん入力から、実際のstart/end日付を逆算するために使う。 */
export function junDateRange(year: number, month: number, bucket: JunBucket): { start: string; end: string } {
  const pad = (n: number) => String(n).padStart(2, "0");
  const ym = `${year}-${pad(month)}`;
  if (bucket === "初") return { start: `${ym}-01`, end: `${ym}-10` };
  if (bucket === "中") return { start: `${ym}-11`, end: `${ym}-20` };
  const lastDay = new Date(year, month, 0).getDate();
  return { start: `${ym}-21`, end: `${ym}-${pad(lastDay)}` };
}

/** "YYYY-MM-DD" 形式の実日付かどうか — 旬指定などの自由記入テキスト（例:「9月中旬」）は除外する。 */
export function isIsoDate(value: string | null | undefined): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/** ISO日付を日本式 "YYYY/MM/DD" に整形する。実日付でなければ (自由記入テキストならそのまま) 元の値を返す。 */
export function formatJaDate(value: string | null | undefined): string {
  if (!value) return "";
  if (!isIsoDate(value)) return value;
  const [y, m, d] = value.split("-");
  return `${y}/${m}/${d}`;
}

export function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d + days);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * 板金・BOX納入 → 製作 → 検査 → 立会 → 出荷 → 納入 という実際の工程の流れに
 * 沿って、前工程の完了日から次工程の開始日の初期値を自動計算する。
 * `offsetDays` が指定されたリンクは、前工程の完了日の翌日を開始日にする
 * (製作・検査・立会・出荷は全て「前工程が終わってから」始まる — 前工程の
 * 完了日と同日にしてしまうとタイムライン上で色が重なって見えるため、
 * 必ず+1日する)。
 * 立会が実施されない場合、出荷開始日は検査完了日+1にフォールバックする
 * (fromKeysのうち埋まっている最も遅い日付を採用する仕組みが、自然にこの
 * フォールバックを兼ねる — 立会完了日があればそちらが検査完了日より後に
 * なるため優先され、無ければ検査完了日が使われる)。
 */
export const CASCADE_LINKS: {
  fromKeys: (keyof CaseSchedule)[];
  toKey: keyof CaseSchedule;
  offsetDays?: number;
}[] = [
  { fromKeys: ["sheetMetalDeliveryDate", "boxDeliveryDate"], toKey: "productionStartDate", offsetDays: 1 },
  { fromKeys: ["productionEndDate"], toKey: "inspectionStartDate", offsetDays: 1 },
  { fromKeys: ["inspectionEndDate"], toKey: "witnessStartDate", offsetDays: 1 },
  { fromKeys: ["witnessEndDate", "inspectionEndDate"], toKey: "shippingStartDate", offsetDays: 1 },
  { fromKeys: ["shippingEndDate"], toKey: "deliveryDate" },
];

/**
 * 完了日欄(*EndDate)が「9月下旬」のような自由記入テキストで実日付として
 * 解釈できない場合に、カスケード計算で代わりに参照する色分け専用の実日付
 * 欄(*EndRefDate)。scheduleColoring.ts の RANGE_FIELDS と同じ対応。
 */
const CASCADE_REF_FALLBACK: Partial<Record<keyof CaseSchedule, keyof CaseSchedule>> = {
  productionEndDate: "productionEndRefDate",
  inspectionEndDate: "inspectionEndRefDate",
  witnessEndDate: "witnessEndRefDate",
  shippingEndDate: "shippingEndRefDate",
};

/** fromKey の実日付を解決する — 本人が自由記入テキストなら CASCADE_REF_FALLBACK の実日付欄で代用する。 */
function resolveCascadeSource(schedule: CaseSchedule, key: keyof CaseSchedule): string | null {
  const raw = schedule[key] as string | null;
  if (isIsoDate(raw)) return raw;
  const refKey = CASCADE_REF_FALLBACK[key];
  if (!refKey) return null;
  const ref = schedule[refKey] as string | null;
  return isIsoDate(ref) ? ref : null;
}

/**
 * CASCADE_LINKS を1つ実行し、対象の次工程開始日を再計算する。`lockedKeys`
 * に含まれる toKey は上書きしない(=ユーザーが手動編集欄を開いて自分で
 * 入力した欄) — それ以外は前工程の日付が変わるたびに常に最新の値で
 * 上書きする(過去に自動計算された古い値がいつまでも残ってしまうのを
 * 防ぐため)。
 */
function runCascadeLinks(
  schedule: CaseSchedule,
  lockedKeys: ReadonlySet<keyof CaseSchedule>,
  shouldRun: (link: (typeof CASCADE_LINKS)[number]) => boolean,
): CaseSchedule {
  let next = schedule;
  for (const link of CASCADE_LINKS) {
    if (!shouldRun(link)) continue;
    if (lockedKeys.has(link.toKey)) continue;
    const values = link.fromKeys
      .map((k) => resolveCascadeSource(next, k))
      .filter(isIsoDate)
      .sort();
    const latest = values.at(-1);
    if (latest) {
      const value = link.offsetDays ? addDaysIso(latest, link.offsetDays) : latest;
      if (next[link.toKey] !== value) next = { ...next, [link.toKey]: value };
    }
  }
  return next;
}

/**
 * `changedKey` (またはその参考日欄 CASCADE_REF_FALLBACK) の変更が
 * CASCADE_LINKS のいずれかの起点なら、次工程の開始日を自動で再計算する。
 * `lockedKeys` に含まれる開始日欄は上書きしない (画面側で手動編集欄を
 * 開いている = ユーザーが自分で管理すると決めた欄)。
 */
export function applyCascade(
  schedule: CaseSchedule,
  changedKey: keyof CaseSchedule,
  lockedKeys: ReadonlySet<keyof CaseSchedule> = new Set(),
): CaseSchedule {
  return runCascadeLinks(
    schedule,
    lockedKeys,
    (link) => link.fromKeys.includes(changedKey) || link.fromKeys.some((fk) => CASCADE_REF_FALLBACK[fk] === changedKey),
  );
}

/**
 * 案件を開いた時など、個々のフィールド変更イベントを経ずに現在の全欄の
 * 値からカスケードを一括で再計算する。DBから読み込んだ直後は編集操作が
 * 発生していないため `applyCascade` は一切発火せず、過去に保存された
 * 古い自動計算値がそのまま残ってしまう — それを防ぐために画面を開いた
 * 直後に1回通す。
 */
export function applyAllCascades(
  schedule: CaseSchedule,
  lockedKeys: ReadonlySet<keyof CaseSchedule> = new Set(),
): CaseSchedule {
  return runCascadeLinks(schedule, lockedKeys, () => true);
}

/**
 * 発注日系 (前工程を持たない起点) が未入力のときは、今日の日付を初期値
 * として表示する (フォームを開いた=発注しに来た日、という想定)。あくまで
 * 編集可能な初期値であり、保存ボタンを押すまでは確定しない。
 */
export const TODAY_DEFAULT_KEYS: (keyof CaseSchedule)[] = [
  "sheetMetalOrderDate",
  "boxOrderDate",
  "accessoryOrderDate",
];

export function applyTodayDefaults(schedule: CaseSchedule): CaseSchedule {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  let next = schedule;
  for (const key of TODAY_DEFAULT_KEYS) {
    if (!next[key]) next = { ...next, [key]: today };
  }
  return next;
}

export interface MonthSegment {
  year: number;
  month: number; // 1-12
  segment: ScheduleSegment;
}

function segmentKey(s: MonthSegment) {
  return `${s.year}-${s.month}-${s.segment}`;
}

/**
 * Enumerates every 初/中/下 segment touched by [start, end] inclusive,
 * across month and year boundaries. A date range that starts and ends in
 * the same segment still yields that one segment.
 */
export function enumerateSegmentsBetween(start: Date, end: Date): MonthSegment[] {
  if (start > end) return [];
  const results: MonthSegment[] = [];
  const seen = new Set<string>();
  const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());

  while (cursor <= last) {
    const entry: MonthSegment = {
      year: cursor.getFullYear(),
      month: cursor.getMonth() + 1,
      segment: getSegmentForDay(cursor.getDate()),
    };
    const key = segmentKey(entry);
    if (!seen.has(key)) {
      seen.add(key);
      results.push(entry);
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return results;
}
