/**
 * 工程 timeline groundwork (Phase 3 — no UI consumes this yet). The mapping
 * and segment-enumeration logic is locked in now, against the exact rules
 * and test cases from the spec, so Phase 3 only needs to build the
 * rendering on top of it.
 */

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
