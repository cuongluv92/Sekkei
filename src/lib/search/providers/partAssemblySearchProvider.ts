import { partAssemblyService } from "@/lib/services";
import { designCaseService } from "@/lib/services/design";
import { buildCaseDisplayLabel } from "@/lib/utils/designNumbering";
import type { SearchHit, SearchProvider } from "@/lib/search/types";

/** 部品製作 — which 案件 a matching 部品製作 row belongs to (spec #12: "部品 thuộc案件 nào"). Opens `/part-assembly?case=<id>`, which resolves that 案件 as the active one. */
export const partAssemblySearchProvider: SearchProvider = {
  kind: "part-assembly",
  async search(query: string): Promise<SearchHit[]> {
    const matches = await partAssemblyService.searchAll(query);
    if (matches.length === 0) return [];

    const caseIds = Array.from(new Set(matches.map((m) => m.caseId)));
    const labelByCaseId = new Map<string, string>();
    await Promise.all(
      caseIds.map(async (caseId) => {
        const detail = await designCaseService.getDetail(caseId);
        if (detail) labelByCaseId.set(caseId, buildCaseDisplayLabel(detail.case, detail.panels));
      }),
    );

    return matches
      .filter((m) => labelByCaseId.has(m.caseId))
      .map((m) => ({
        kind: "part-assembly",
        id: m.row.id,
        title: [m.row.symbol, m.row.name, m.row.model].filter(Boolean).join(" / "),
        subtitle: labelByCaseId.get(m.caseId),
        href: `/part-assembly?case=${m.caseId}`,
      }));
  },
};
