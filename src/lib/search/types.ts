/**
 * Global Search architecture — one `SearchProvider` per data source
 * (案件/部品データ/部品図/カタログ/部品製作/計算, and later 盤/回路), each independently
 * responsible for querying its own repository and mapping hits to a
 * navigable target. `globalSearchService` only aggregates provider results —
 * it never contains source-specific query logic itself, so adding a new
 * source later (盤寸法/回路番号/負荷名/breaker/電線/端子/busbar/earth) means adding
 * one new provider, not growing one giant search function.
 */

export type SearchSourceKind =
  | "case"
  | "part-data"
  | "part-drawing"
  | "catalog"
  | "part-assembly"
  | "calculation";

export interface SearchHit {
  kind: SearchSourceKind;
  /** Unique within this hit's `kind` — not necessarily globally unique across kinds. */
  id: string;
  /** Primary label (e.g. the 案件 format label, or 品名/型式). */
  title: string;
  /** Secondary context line (e.g. which 案件 a 部品製作 row belongs to). */
  subtitle?: string;
  /** Where clicking this hit navigates to. */
  href: string;
}

export interface SearchOptions {
  /**
   * A separate, dedicated 定格・仕様 query — always AND-ed with `query`
   * rather than replacing it, so typing a partial 型番 in the main box and
   * an exact spec here narrows results precisely instead of the broad
   * keyword match alone returning too many hits. Uses the same strict
   * technical-token matcher 部品データ/部品図's own search bars use
   * (`matchesSpecificationQuery` — exact match for number+unit tokens like
   * "125AT", suffix match for bare unit tokens like "AT"). Providers with no
   * 定格・仕様 field (案件, カタログ, 計算) ignore this and search normally.
   */
  specQuery?: string;
}

export interface SearchProvider {
  kind: SearchSourceKind;
  search(query: string, options?: SearchOptions): Promise<SearchHit[]>;
}
