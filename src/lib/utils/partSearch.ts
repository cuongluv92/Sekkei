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
export function matchesAllTokens(
  fields: (string | undefined)[],
  query: string,
): boolean {
  const tokens = tokenize(query);
  if (tokens.length === 0) return true;
  const haystack = fields
    .filter((f): f is string => !!f)
    .map((f) => normalizeSearchText(f))
    .join(" ");
  return tokens.every((t) => haystack.includes(t));
}

/** Splits a normalized specification string into technical tokens on `/` and whitespace — e.g. "3p 250af/125at 25ka" → ["3p","250af","125at","25ka"]. */
function tokenizeSpecification(raw: string): string[] {
  return normalizeSearchText(raw)
    .split(/[\s/]+/)
    .filter(Boolean);
}

/** A query token shaped like a number followed by a unit (e.g. "125at", "250af") — these must match a spec token EXACTLY. */
const NUMBER_UNIT_TOKEN_RE = /^\d+[a-z]+$/;
/** A query token that is only letters (e.g. "af", "at", "ka") — a bare parameter type, so it matches loosely (any spec token ending with it). */
const UNIT_ONLY_TOKEN_RE = /^[a-z]+$/;

/**
 * True if every whitespace-separated token in `query` matches `specification`
 * as a technical spec — never as a plain substring (see spec #5-#10):
 *  - A number+unit token ("125at", "250af", "3p") must equal a spec token
 *    exactly, so "5at" never matches "125at"/"225at" and "250af" never
 *    matches "1250af".
 *  - A unit-only token ("af", "at", "ka") matches any spec token ending
 *    with it, so "af" finds "30af"/"125af"/"250af".
 *  - Anything else (bare numbers, symbols) falls back to an exact-token
 *    match too, since specs never partial-match on those either.
 * Multiple tokens in `query` combine with AND (all must match), letting
 * "3P 250AF 125AT" narrow to only records carrying every one of those
 * tokens.
 */
export function matchesSpecificationQuery(
  specification: string,
  query: string,
): boolean {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return true;
  const specTokens = tokenizeSpecification(specification);
  return queryTokens.every((qt) => {
    if (NUMBER_UNIT_TOKEN_RE.test(qt)) return specTokens.includes(qt);
    if (UNIT_ONLY_TOKEN_RE.test(qt))
      return specTokens.some((st) => st.endsWith(qt));
    return specTokens.includes(qt);
  });
}

/** Distinct non-blank manufacturer ids actually present across `items`, e.g. to limit the メーカー dropdown to manufacturers that really have data (see spec #1). */
export function distinctManufacturerIds(
  items: { manufacturerId: string }[],
): string[] {
  return Array.from(
    new Set(
      items.map((i) => i.manufacturerId).filter((id) => id.trim() !== ""),
    ),
  );
}

/** True if at least one item has a blank manufacturerId — gates whether "メーカー未設定" should appear at all (see spec #1). */
export function hasUnsetManufacturer(
  items: { manufacturerId: string }[],
): boolean {
  return items.some((i) => i.manufacturerId.trim() === "");
}

/** True if at least one item has a blank category — gates whether "未分類" should appear at all. */
export function hasUncategorizedItem(items: { category: string }[]): boolean {
  return items.some((i) => i.category.trim() === "");
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
  return Array.from(
    new Set(items.map((i) => i.category).filter((c) => c.trim() !== "")),
  ).sort((a, b) => a.localeCompare(b, "ja"));
}

export function matchesPartFilters(
  item: PartFilterableFields,
  filters: PartFilters,
): boolean {
  if (filters.manufacturerId) {
    const wantsUnset = filters.manufacturerId === UNSET_FILTER_VALUE;
    if (
      wantsUnset
        ? item.manufacturerId !== ""
        : item.manufacturerId !== filters.manufacturerId
    )
      return false;
  }
  if (filters.category) {
    const wantsUnset = filters.category === UNSET_FILTER_VALUE;
    if (wantsUnset ? item.category !== "" : item.category !== filters.category)
      return false;
  }
  if (
    filters.keyword &&
    !matchesAllTokens([item.symbol, item.category, item.model], filters.keyword)
  ) {
    return false;
  }
  if (
    filters.specification &&
    !matchesSpecificationQuery(item.specification, filters.specification)
  )
    return false;
  return true;
}
