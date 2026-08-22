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

export interface SearchProvider {
  kind: SearchSourceKind;
  search(query: string): Promise<SearchHit[]>;
}
