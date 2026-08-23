import { partDrawingService } from "@/lib/services";
import { matchesSpecificationQuery } from "@/lib/utils/partSearch";
import { rankBySearch } from "@/lib/utils/searchRanking";
import type { SearchHit, SearchOptions, SearchProvider } from "@/lib/search/types";

/**
 * 部品図 — `query` matches 型式/メーカー/分類/定格・仕様/備考. `options.specQuery`,
 * when set, AND-filters on top of that using the same strict 定格・仕様-only
 * technical-token matcher (`matchesSpecificationQuery`) as 部品データ's spec
 * search — see partDataSearchProvider.ts. Opens `/part-drawing` prefiltered
 * by both.
 */
export const partDrawingSearchProvider: SearchProvider = {
  kind: "part-drawing",
  async search(query: string, options?: SearchOptions): Promise<SearchHit[]> {
    const q = query.trim();
    const specQuery = options?.specQuery?.trim() ?? "";

    let hits;
    if (specQuery) {
      const specMatched = (await partDrawingService.list()).filter((p) =>
        matchesSpecificationQuery(p.specification, specQuery),
      );
      hits = q
        ? rankBySearch(specMatched, q, (p) => [
            p.model,
            p.category,
            p.specification,
            p.remarks,
          ])
        : specMatched;
    } else {
      hits = q ? await partDrawingService.search(q) : [];
    }

    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (specQuery) params.set("spec", specQuery);
    const qs = params.toString();
    return hits.map((p) => ({
      kind: "part-drawing",
      id: p.id,
      title: p.model,
      subtitle: [p.category, p.specification].filter(Boolean).join(" / "),
      href: `/part-drawing${qs ? `?${qs}` : ""}`,
    }));
  },
};
