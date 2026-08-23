import { partDataService } from "@/lib/services";
import { matchesSpecificationQuery } from "@/lib/utils/partSearch";
import { rankBySearch } from "@/lib/utils/searchRanking";
import type { SearchHit, SearchOptions, SearchProvider } from "@/lib/search/types";

/**
 * 部品データ — `query` matches 記号/品名/型式/メーカー/分類/定格・仕様/備考 via the
 * master's own broad search. `options.specQuery`, when set, AND-filters on
 * top of that using the strict 定格・仕様-only technical-token matcher
 * (`matchesSpecificationQuery`) 部品データ's own search bar uses, so
 * multi-token queries like "3P 250AF 125AT" match correctly instead of
 * needing to appear as one literal substring — and combining it with `query`
 * narrows an otherwise-too-broad 型番 match down precisely. Opens
 * `/part-data` prefiltered by both.
 */
export const partDataSearchProvider: SearchProvider = {
  kind: "part-data",
  async search(query: string, options?: SearchOptions): Promise<SearchHit[]> {
    const q = query.trim();
    const specQuery = options?.specQuery?.trim() ?? "";

    let hits;
    if (specQuery) {
      const specMatched = (await partDataService.list()).filter((p) =>
        matchesSpecificationQuery(p.specification, specQuery),
      );
      hits = q
        ? rankBySearch(specMatched, q, (p) => [
            p.model,
            p.symbol,
            p.category,
            p.specification,
            p.remarks,
          ])
        : specMatched;
    } else {
      hits = q ? await partDataService.search(q) : [];
    }

    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (specQuery) params.set("spec", specQuery);
    const qs = params.toString();
    return hits.map((p) => ({
      kind: "part-data",
      id: p.id,
      title: p.model,
      subtitle: [p.category, p.specification].filter(Boolean).join(" / "),
      href: `/part-data${qs ? `?${qs}` : ""}`,
    }));
  },
};
