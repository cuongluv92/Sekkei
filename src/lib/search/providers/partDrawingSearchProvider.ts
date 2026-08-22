import { partDrawingService } from "@/lib/services";
import type { SearchHit, SearchProvider } from "@/lib/search/types";

/** 部品図 — searched by 型式/メーカー/分類/定格・仕様/備考. Opens `/part-drawing` prefiltered by the same query. */
export const partDrawingSearchProvider: SearchProvider = {
  kind: "part-drawing",
  async search(query: string): Promise<SearchHit[]> {
    const hits = await partDrawingService.search(query);
    return hits.map((p) => ({
      kind: "part-drawing",
      id: p.id,
      title: p.model,
      subtitle: [p.category, p.specification].filter(Boolean).join(" / "),
      href: `/part-drawing?q=${encodeURIComponent(query)}`,
    }));
  },
};
