import type { TechnicalSource } from "@/lib/calc/technicalSource";

/**
 * Shared shape every 電気技術計算 engine (`src/lib/calc/electrical/*`)
 * returns, so the UI layer (`VariableSolverCard`/`ElectricalBasisPanel`)
 * can render any of them the same way. An engine never guesses a missing
 * input — `solve()` either returns a real value with its full derivation
 * (`SolveSuccess`) or says exactly what is still needed (`SolveMissing`).
 */

/** One line of a formula's derivation: symbolic form → substituted numbers → result. */
export interface FormulaStep {
  /** Symbolic form, e.g. "I = P / (√3 × V × cosφ × η)". */
  formula: string;
  /** Same formula with the actual known numbers substituted in. */
  substituted: string;
  /** The evaluated result line, e.g. "= 226.8 A". */
  resultLine: string;
}

export interface SolveSuccess {
  ok: true;
  /** Variable key this result is for. */
  target: string;
  value: number;
  steps: FormulaStep[];
  sources: TechnicalSource[];
  /** Non-blocking notices — e.g. "簡易計算（上位系統・ケーブルインピーダンス等未考慮）". */
  warnings?: string[];
}

export interface SolveMissing {
  ok: false;
  reasonKey:
    | "missingVariables"
    | "invalidInput"
    /** Two or more supplied values disagree beyond rounding tolerance — see `message` for which ones. Never silently picks one and discards the other. */
    | "inconsistentInput"
    | "notApplicable";
  /** Which variable keys, if supplied, would let this resolve. */
  missing?: string[];
  /** Free-text detail (e.g. why "notApplicable", which values conflicted, or exactly what about the input is invalid). */
  message?: string;
}

export type SolveResult = SolveSuccess | SolveMissing;

/** A number the user may or may not have entered yet — engines always accept `Partial`. */
export type KnownValues<K extends string> = Partial<Record<K, number>>;

/** Describes one input/output field for the generic `VariableSolverCard`. */
export interface CalcVariableDef<K extends string = string> {
  key: K;
  labelJa: string;
  labelVi: string;
  /** Symbolic letter shown in formulas, e.g. "V", "cosφ". */
  symbol: string;
  /** Unit shown beside the input, e.g. "V", "A", "kW". Empty string for dimensionless (PF, ratio). */
  unit: string;
  /** Optional hint shown under the field (e.g. valid range). */
  hintJa?: string;
  hintVi?: string;
}

/** True if `v` is a finite, usable number (not NaN, not ±Infinity). */
export function isFiniteNumber(v: number | undefined): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/** Formats a number for display in a substituted formula / result line — trims float noise without over-rounding real precision. */
export function formatNum(n: number, decimals = 4): string {
  if (!Number.isFinite(n)) return "—";
  const rounded = Math.round(n * 10 ** decimals) / 10 ** decimals;
  return rounded.toLocaleString("en-US", { maximumFractionDigits: decimals });
}
