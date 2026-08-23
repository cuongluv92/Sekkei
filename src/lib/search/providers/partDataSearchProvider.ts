import { partDataService } from "@/lib/services";
import { matchesSpecificationQuery } from "@/lib/utils/partSearch";
import type { SearchHit, SearchOptions, SearchProvider } from "@/lib/search/types";

/**
 * 部品データ — normally searched by 記号/品名/型式/メーカー/分類/定格・仕様/備考 via the
 * master's own broad search. With `specOnly`, instead lists everything and
 * filters with the same strict 定格・仕様-only technical-token matcher
 * (`matchesSpecificationQuery`) 部品データ's own search bar uses, so
 * multi-token queries like "3P 250AF 125AT" AND-match correctly instead of
 * needing to appear as one literal substring. Opens `/part-data` prefiltered
 * by the same query (and spec mode, so the destination page matches).
 */
export const partDataSearchProvider: SearchProvider = {
  kind: "part-data",
  async search(query: string, options?: SearchOptions): Promise<SearchHit[]> {
    const hits = options?.specOnly
      ? (await partDataService.list()).filter((p) =>
          matchesSpecificationQuery(p.specification, query),
        )
      : await partDataService.search(query);
    const specParam = options?.specOnly ? "&spec=1" : "";
    return hits.map((p) => ({
      kind: "part-data",
      id: p.id,
      title: p.model,
      subtitle: [p.category, p.specification].filter(Boolean).join(" / "),
      href: `/part-data?q=${encodeURIComponent(query)}${specParam}`,
    }));
  },
};
