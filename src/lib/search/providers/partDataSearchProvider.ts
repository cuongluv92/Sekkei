import { partDataService } from "@/lib/services";
import type { SearchHit, SearchProvider } from "@/lib/search/types";

/** 部品データ — searched by 記号/品名/型式/メーカー/分類/定格・仕様/備考 via the master's own search. Opens `/part-data` prefiltered by the same query. */
export const partDataSearchProvider: SearchProvider = {
  kind: "part-data",
  async search(query: string): Promise<SearchHit[]> {
    const hits = await partDataService.search(query);
    return hits.map((p) => ({
      kind: "part-data",
      id: p.id,
      title: p.model,
      subtitle: [p.category, p.specification].filter(Boolean).join(" / "),
      href: `/part-data?q=${encodeURIComponent(query)}`,
    }));
  },
};
