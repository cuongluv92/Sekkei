import { calculationRecordService } from "@/lib/services";
import { designCaseService } from "@/lib/services/design";
import { buildCaseDisplayLabel } from "@/lib/utils/designNumbering";
import type { SearchHit, SearchProvider } from "@/lib/search/types";

/** Maps a saved `calculation_type` to its module's display label and route — extend this when a new calculation module is added. */
const CALCULATION_TYPE_ROUTES: {
  match: (type: string) => boolean;
  label: string;
  href: (caseId: string) => string;
}[] = [
  { match: (t) => t === "busbar", label: "母線銅帯", href: (id) => `/calculations/busbar?case=${id}` },
  { match: (t) => t === "earth-wire", label: "接地線", href: (id) => `/calculations/earth-wire?case=${id}` },
  { match: (t) => t === "earth-bar", label: "アースバー", href: (id) => `/calculations/earth-bar?case=${id}` },
  {
    match: (t) => t.startsWith("weight-basic-"),
    label: "基本重量計算",
    href: (id) => `/calculations/weight?tab=basic&case=${id}`,
  },
  {
    match: (t) => t === "weight-panel",
    label: "盤重量計算",
    href: (id) => `/calculations/weight?tab=panel&case=${id}`,
  },
  { match: (t) => t === "ventilation", label: "換気計算", href: (id) => `/calculations/ventilation?case=${id}` },
  { match: (t) => t === "seismic", label: "耐震計算", href: (id) => `/calculations/seismic?case=${id}` },
  { match: () => true, label: "計算", href: (id) => `/calculations/other?case=${id}` },
];

function routeFor(calculationType: string) {
  return CALCULATION_TYPE_ROUTES.find((r) => r.match(calculationType))!;
}

/**
 * 計算 — for every 案件 matching the query (spec #12: "業別 loại calculation / 案件
 * / kết quả chính"), lists which calculation modules that 案件 has saved data
 * for. Reuses `designCaseService.quickSearch` (same matching as the 案件
 * provider) rather than a separate query, since a 計算 hit is always
 * anchored to a matching 案件.
 */
export const calculationSearchProvider: SearchProvider = {
  kind: "calculation",
  async search(query: string): Promise<SearchHit[]> {
    const matches = await designCaseService.quickSearch(query);
    const capped = matches.slice(0, 20);

    const hitsPerCase = await Promise.all(
      capped.map(async ({ case: c, panels }) => {
        const records = await calculationRecordService.listByCase(c.id);
        const label = buildCaseDisplayLabel(c, panels);
        return records.map((r) => {
          const route = routeFor(r.calculationType);
          return {
            kind: "calculation" as const,
            id: `${c.id}-${r.calculationType}`,
            title: route.label,
            subtitle: label,
            href: route.href(c.id),
          };
        });
      }),
    );

    return hitsPerCase.flat();
  },
};
