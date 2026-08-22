import { designCaseService } from "@/lib/services/design";
import { buildCaseDisplayLabel } from "@/lib/utils/designNumbering";
import type { SearchHit, SearchProvider } from "@/lib/search/types";

/** 案件 — searched by 図面番号/管理番号/工事番号/件名/担当/盤名称 (spec #12-#13). */
export const caseSearchProvider: SearchProvider = {
  kind: "case",
  async search(query: string): Promise<SearchHit[]> {
    const matches = await designCaseService.quickSearch(query);
    return matches.map(({ case: c, panels }) => ({
      kind: "case",
      id: c.id,
      title: buildCaseDisplayLabel(c, panels),
      href: `/design?tab=designRequest&case=${c.id}`,
    }));
  },
};
