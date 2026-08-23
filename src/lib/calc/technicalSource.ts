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
 *
 * 計算 → 選定 architecture (every module under `src/lib/calc/**` follows this
 * same chain, never mixes the two stages):
 *   1. 計算 (this file's consumers, e.g. `currentDensityRule.ts`,
 *      `geometry.ts`): pure functions turning a design input (定格電流, ...)
 *      into a 必要条件 (必要断面積, ...) — always cites a `TechnicalSource`,
 *      never reads company/master data.
 *   2. 選定 (e.g. `candidateSearch.ts`): takes that 必要条件 plus real
 *      company master data (社内選定マスタ — busbar/wire/earth sizes actually
 *      stocked/preferred) and searches for concrete candidates. This layer
 *      may apply company preference (fewer bars, stock size, ease of
 *      fabrication, ...) but only ever *after* a candidate has already
 *      passed the 計算 layer's technical requirement — company preference
 *      never overrides or substitutes for a technical pass/fail.
 *   3. 採用: the designer picks one candidate (or a manual what-if the 選定
 *      layer evaluates on demand); the UI persists exactly which one via
 *      `calculationRecordService`, keyed by the active 案件.
 * A rule that cannot honestly complete step 1 (no verified source reaches
 * that current/size range) must say so — `要確認`/`要技術確認` — rather than
 * let step 2 quietly invent a technical requirement to search against.
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
  | "company_master"
  /**
   * A basic electrical-engineering identity (Ohm's law, power triangle,
   * √3 three-phase relations, Z=√(R²+X²), ...) — true by circuit-theory
   * derivation, not because any standards body declared it. Always
   * `verified: true` and rendered as 根拠: 電気工学基本式, never alongside a
   * 関連規格 standard/edition/clause line (there isn't one) — keeps this
   * class of rule visually distinct from a standard-sourced one so neither
   * is ever mistaken for the other.
   */
  | "engineering_fundamental";

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

/**
 * Builds a `TechnicalSource` for a basic electrical-engineering identity —
 * `standard`/`edition` are left as "—" (there is no standards document to
 * cite), `sourceType` is fixed to `"engineering_fundamental"`, and
 * `verified` is always `true` since these formulas are true by derivation,
 * not by anyone's confirmation. `reference` should name the identity itself
 * (e.g. "オームの法則 V = IR"), `applicability` the scope it holds in
 * (e.g. "線形・定常状態の回路").
 */
export function engineeringFundamentalSource(
  reference: string,
  applicability: string,
): TechnicalSource {
  return {
    standard: "—",
    edition: "—",
    reference,
    applicability,
    sourceType: "engineering_fundamental",
    verified: true,
  };
}
