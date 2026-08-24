/**
 * Shared low-level DXF parsing and 部品リスト (BOM) grid-detection logic,
 * used by both `dxfPartListPatch.ts` (writes real data into a template) and
 * `dxfPartListExtract.ts` (reads real data back out of an already-filled
 * copy of the same template) — kept in one place so the two directions can
 * never drift apart on what counts as "the part-list grid".
 */

export const DXF_PART_LIST_FIELDS = [
  "symbol",
  "name",
  "manufacturer",
  "model",
  "specification",
  "quantity",
  "remarks",
] as const;
export type DxfField = (typeof DXF_PART_LIST_FIELDS)[number];

/** Upper bound on pre-drawn table rows either direction will scan for. */
export const DXF_PART_LIST_MAX_ROWS = 30;

export interface DxfPair {
  code: number;
  value: string;
}

export interface DxfRecord {
  type: string;
  pairs: DxfPair[];
}

export function splitLines(text: string): { lines: string[]; eol: string } {
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  const lines = text.split(/\r\n|\r|\n/);
  if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  return { lines, eol };
}

export function parsePairs(lines: string[]): DxfPair[] {
  const pairs: DxfPair[] = [];
  for (let i = 0; i + 1 < lines.length; i += 2) {
    const code = parseInt(lines[i].trim(), 10);
    if (Number.isNaN(code)) continue;
    pairs.push({ code, value: lines[i + 1] });
  }
  return pairs;
}

export function splitRecords(pairs: DxfPair[]): DxfRecord[] {
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

export function getPair(rec: DxfRecord, code: number): DxfPair | undefined {
  return rec.pairs.find((p) => p.code === code);
}

export const FIELD_LABEL_MATCHERS: { field: DxfField; test: (normalized: string) => boolean }[] = [
  { field: "symbol", test: (s) => s.includes("記号") },
  { field: "name", test: (s) => s.includes("品名") },
  { field: "manufacturer", test: (s) => s.includes("メーカー") },
  { field: "model", test: (s) => s.includes("型式") },
  { field: "specification", test: (s) => s.includes("仕様") },
  { field: "quantity", test: (s) => s.includes("数量") },
  { field: "remarks", test: (s) => s.includes("備考") },
];

export const BLANK_MARKERS = new Set(["-", "－", "‐", "―", "–"]);

/** Max Y difference (drawing units) for two text baselines to count as "the same row". Must stay well under real row-to-row spacing (7.5 on the real template this was built against). */
export const Y_CLUSTER_TOLERANCE = 2;

export function normalizeLabel(s: string): string {
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
export function clusterByY<T extends { y: number }>(items: T[], tolerance: number): T[][] {
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

export interface GridCell {
  pair: DxfPair;
  x: number;
  y: number;
}

export interface HeaderField {
  field: DxfField;
  x: number;
  y: number;
}

/**
 * Finds the 記号/品名/メーカー/型式/定格・仕様/数量/備考 header row among a
 * DXF's TEXT records — the real header row is whichever Y-cluster groups
 * the most *distinct* fields, which protects against a stray label match
 * elsewhere in a full drawing (e.g. a "(備考)" note far away on the same
 * sheet).
 */
export function findHeaderFields(textRecords: DxfRecord[]): HeaderField[] {
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
