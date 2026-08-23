import { caseSearchProvider } from "@/lib/search/providers/caseSearchProvider";
import { partDataSearchProvider } from "@/lib/search/providers/partDataSearchProvider";
import { partDrawingSearchProvider } from "@/lib/search/providers/partDrawingSearchProvider";
import { catalogSearchProvider } from "@/lib/search/providers/catalogSearchProvider";
import { partAssemblySearchProvider } from "@/lib/search/providers/partAssemblySearchProvider";
import { calculationSearchProvider } from "@/lib/search/providers/calculationSearchProvider";
import type {
  SearchHit,
  SearchOptions,
  SearchSourceKind,
} from "@/lib/search/types";

/** Registration order also controls display order in the grouped results. */
const PROVIDERS = [
  caseSearchProvider,
  partAssemblySearchProvider,
  partDataSearchProvider,
  partDrawingSearchProvider,
  catalogSearchProvider,
  calculationSearchProvider,
];

export type GroupedSearchResults = { kind: SearchSourceKind; hits: SearchHit[] }[];

/**
 * Global Search's one entry point — spans 案件/部品製作/部品データ/部品図/カタログ/計算
 * (spec #12-#14) by fanning the same query string out to every provider in
 * parallel and grouping the results by source. Contains no source-specific
 * query logic itself — that all lives in the individual providers — so
 * adding a future source (盤/回路/...) means registering one more provider
 * here, never growing this function. `options.specQuery` AND-filters 部品データ/
 * 部品図 with the same strict 定格・仕様-only technical-token matching their own
 * dedicated search bars use (see `SearchOptions`) — other providers ignore it.
 * A search can run on `specQuery` alone with `query` left blank.
 */
export async function searchGlobal(
  query: string,
  options: SearchOptions = {},
): Promise<GroupedSearchResults> {
  const q = query.trim();
  const specQuery = options.specQuery?.trim() ?? "";
  if (!q && !specQuery) return [];

  const results = await Promise.all(PROVIDERS.map((p) => p.search(q, options)));
  return PROVIDERS.map((p, i) => ({ kind: p.kind, hits: results[i] })).filter(
    (group) => group.hits.length > 0,
  );
}
