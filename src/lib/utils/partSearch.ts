/**
 * Shared search/filter logic for 部品データ and 部品製作 — both browse the same
 * kind of records (記号・品名/分類・メーカー・型式・定格・仕様), so they share one
 * matching function instead of two ad-hoc filters that could quietly drift
 * apart.
 */

/** Trims, collapses whitespace, lowercases, and folds full-width→half-width (NFKC) so "３Ｐ" and "3P" match; ／ and / are treated as equivalent. */
export function normalizeSearchText(raw: string): string {
  return raw
    .normalize("NFKC")
    .replace(/／/g, "/")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function tokenize(query: string): string[] {
  return normalizeSearchText(query).split(" ").filter(Boolean);
}

/**
 * True if every whitespace-separated token in `query` appears as a
 * substring somewhere across `fields` (AND across tokens, OR across
 * fields) — e.g. "3P 63AF 40AT" matches "3P 63AF／40AT 5kA" without
 * requiring an exact/contiguous match.
 */
export function matchesAllTokens(fields: (string | undefined)[], query: string): boolean {
  const tokens = tokenize(query);
  if (tokens.length === 0) return true;
  const haystack = fields
    .filter((f): f is string => !!f)
    .map((f) => normalizeSearchText(f))
    .join(" ");
  return tokens.every((t) => haystack.includes(t));
}

export interface PartFilterableFields {
  symbol?: string;
  category: string;
  manufacturerId: string;
  model: string;
  specification: string;
}

/** Sentinel filter value meaning "records with this field blank" (メーカー未設定 / 未分類), as opposed to "" which means "all". */
export const UNSET_FILTER_VALUE = "__unset__";

export interface PartFilters {
  /** "" or undefined = all manufacturers; UNSET_FILTER_VALUE = メーカー未設定 only. */
  manufacturerId?: string;
  /** "" or undefined = all categories; UNSET_FILTER_VALUE = 未分類 only. */
  category?: string;
  /** Matched against 記号・品名/分類・型式. */
  keyword?: string;
  /** Matched against 定格・仕様 only. */
  specification?: string;
}

/**
 * Combines every set filter with AND; a blank/unset filter is skipped
 * entirely rather than treated as "must be blank" — no field is required
 * to search.
 */
/** Distinct non-blank category values across items, sorted — the 分類 dropdown's option list always comes from real data, never a hard-coded set (see spec #9). */
export function distinctCategories(items: { category: string }[]): string[] {
  return Array.from(new Set(items.map((i) => i.category).filter((c) => c.trim() !== ""))).sort((a, b) =>
    a.localeCompare(b, "ja"),
  );
}

export function matchesPartFilters(item: PartFilterableFields, filters: PartFilters): boolean {
  if (filters.manufacturerId) {
    const wantsUnset = filters.manufacturerId === UNSET_FILTER_VALUE;
    if (wantsUnset ? item.manufacturerId !== "" : item.manufacturerId !== filters.manufacturerId) return false;
  }
  if (filters.category) {
    const wantsUnset = filters.category === UNSET_FILTER_VALUE;
    if (wantsUnset ? item.category !== "" : item.category !== filters.category) return false;
  }
  if (filters.keyword && !matchesAllTokens([item.symbol, item.category, item.model], filters.keyword)) {
    return false;
  }
  if (filters.specification && !matchesAllTokens([item.specification], filters.specification)) return false;
  return true;
}
