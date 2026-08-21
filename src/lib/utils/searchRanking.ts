/**
 * Exact match on any of the given fields ranks first, then partial
 * (substring) matches, in original order within each group. Used by every
 * 部品データ/部品図/カタログ/検索 search so "NF63-CV" surfaces the exact part
 * before anything that merely contains it.
 */
export function rankBySearch<T>(
  items: T[],
  query: string,
  fields: (item: T) => (string | undefined)[],
): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const exact: T[] = [];
  const partial: T[] = [];
  for (const item of items) {
    const values = fields(item)
      .filter((v): v is string => !!v)
      .map((v) => v.toLowerCase());
    if (values.some((v) => v === q)) {
      exact.push(item);
    } else if (values.some((v) => v.includes(q))) {
      partial.push(item);
    }
  }
  return [...exact, ...partial];
}
