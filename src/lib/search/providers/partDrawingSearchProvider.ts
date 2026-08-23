import { partDrawingService } from "@/lib/services";
import { matchesSpecificationQuery } from "@/lib/utils/partSearch";
import type { SearchHit, SearchOptions, SearchProvider } from "@/lib/search/types";

/**
 * 部品図 — normally searched by 型式/メーカー/分類/定格・仕様/備考. With `specOnly`,
 * lists everything and filters with the same strict 定格・仕様-only
 * technical-token matcher (`matchesSpecificationQuery`) as 部品データ's spec
 * mode — see partDataSearchProvider.ts. Opens `/part-drawing` prefiltered by
 * the same query (and spec mode).
 */
export const partDrawingSearchProvider: SearchProvider = {
  kind: "part-drawing",
  async search(query: string, options?: SearchOptions): Promise<SearchHit[]> {
    const hits = options?.specOnly
      ? (await partDrawingService.list()).filter((p) =>
          matchesSpecificationQuery(p.specification, query),
        )
      : await partDrawingService.search(query);
    const specParam = options?.specOnly ? "&spec=1" : "";
    return hits.map((p) => ({
      kind: "part-drawing",
      id: p.id,
      title: p.model,
      subtitle: [p.category, p.specification].filter(Boolean).join(" / "),
      href: `/part-drawing?q=${encodeURIComponent(query)}${specParam}`,
    }));
  },
};
