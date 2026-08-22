/**
 * Metadata every technical calculation rule in `src/lib/calc/**` must carry,
 * so a design engineer can see exactly what a computed value is based on —
 * and so this system never silently claims standard compliance it hasn't
 * verified. See `src/lib/calc/busbar/*` for the first real usage.
 *
 * `verified: false` is not a bug or a placeholder to "finish later and
 * forget" — it is a first-class, permanently displayable state (rendered as
 * 要確認/参考値 in the UI) for any rule whose source text has not been
 * directly confirmed. Only flip it to `true` once the actual standard
 * document (not a secondary blog/calculator) has been checked against the
 * exact clause/table cited in `reference`.
 */

/** What kind of document a rule is actually sourced from — determines how much trust the UI should imply. */
export type SourceType =
  /** A published national/international standard (JIS, IEC, ...). */
  | "standard"
  /** An industry association's technical manual/publication (e.g. JSIA-T1006) — often not freely published, so frequently `verified: false` until purchased/read. */
  | "association_technical_document"
  /** A secondary source (catalog, engineering blog, web calculator) used only to locate/cross-check a rule — never the final source of truth for a production value. */
  | "secondary_reference"
  /** User-editable company preference data (e.g. "which busbar sizes we stock") — not a technical/safety rule at all. */
  | "company_master";

export interface TechnicalSource {
  /** e.g. "JIS C 8480" */
  standard: string;
  /** e.g. "2016" — the specific edition this rule is actually sourced from, not necessarily the current edition. */
  edition: string;
  /** Clause/table/section this rule corresponds to. */
  reference: string;
  /** Scope this rule is valid for — never apply it outside this without re-verifying. */
  applicability: string;
  sourceType: SourceType;
  /** True only once the standard's own text (not a secondary source) has been checked against `reference`. */
  verified: boolean;
  /** Required when `verified` is false — what's missing and what to check before production use. */
  verificationNote?: string;
}
