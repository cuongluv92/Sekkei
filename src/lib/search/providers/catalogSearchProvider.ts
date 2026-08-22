import { catalogService } from "@/lib/services";
import type { SearchHit, SearchProvider } from "@/lib/search/types";

/** カタログ — searched by 型式/メーカー/分類/ファイル名. Opens `/catalog` prefiltered by the same query. */
export const catalogSearchProvider: SearchProvider = {
  kind: "catalog",
  async search(query: string): Promise<SearchHit[]> {
    const hits = await catalogService.search(query);
    return hits.map((c) => ({
      kind: "catalog",
      id: c.id,
      title: c.model || c.fileName,
      subtitle: [c.category, c.fileName].filter(Boolean).join(" / "),
      href: `/catalog?q=${encodeURIComponent(query)}`,
    }));
  },
};
