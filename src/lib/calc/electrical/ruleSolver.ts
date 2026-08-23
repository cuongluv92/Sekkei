import type { TechnicalSource } from "@/lib/calc/technicalSource";
import {
  formatNum,
  isFiniteNumber,
  type FormulaStep,
  type KnownValues,
  type SolveResult,
} from "./types";

/**
 * One derivable relationship in a calculator's variable graph — e.g. "S =
 * V × I / 1000" derives `S` from `V` and `I`. `solveByRules` chains many of
 * these together (forward-chaining / fixed-point) so a calculator never
 * needs to hand-write a branch per possible combination of known variables
 * — every 電気技術計算 engine (母線銅帯/接地線/アースバー's own bespoke rule
 * files are untouched; this is new, `src/lib/calc/electrical/*` only)
 * shares this one solving loop instead of duplicating it ten times.
 */
export interface Rule<K extends string> {
  /** Variable this rule computes. */
  output: K;
  /** Variables required as inputs — all must already be known. */
  inputs: readonly K[];
  compute: (values: Record<K, number>) => number;
  /** Builds the human-readable derivation line for this rule once applied. */
  describe: (values: Record<K, number>, result: number) => FormulaStep;
  source: TechnicalSource;
}

function dedupeSources(sources: TechnicalSource[]): TechnicalSource[] {
  const seen = new Set<string>();
  const out: TechnicalSource[] = [];
  for (const s of sources) {
    const key = `${s.sourceType}|${s.standard}|${s.reference}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

/**
 * Forward-chains `rules` from `known` until `target` is derived or no rule
 * can make further progress. Never guesses: a rule only fires once every
 * one of its `inputs` is an actual finite number, and a result that comes
 * out non-finite (e.g. division by zero) is treated as "not derivable"
 * rather than surfaced as NaN/Infinity.
 */
export function solveByRules<K extends string>(
  rules: readonly Rule<K>[],
  known: KnownValues<K>,
  target: K,
): SolveResult {
  const values: Partial<Record<K, number>> = {};
  for (const key of Object.keys(known) as K[]) {
    const v = known[key];
    if (isFiniteNumber(v)) values[key] = v;
  }

  const steps: FormulaStep[] = [];
  const sources: TechnicalSource[] = [];

  let progress = true;
  while (progress && values[target] === undefined) {
    progress = false;
    for (const rule of rules) {
      if (values[rule.output] !== undefined) continue;
      if (!rule.inputs.every((k) => values[k] !== undefined)) continue;
      const inputValues = {} as Record<K, number>;
      for (const k of rule.inputs) inputValues[k] = values[k]!;
      const result = rule.compute(inputValues);
      if (!Number.isFinite(result)) continue;
      values[rule.output] = result;
      steps.push(rule.describe(inputValues, result));
      sources.push(rule.source);
      progress = true;
    }
  }

  const resolved = values[target];
  if (resolved === undefined) {
    const candidateRules = rules.filter((r) => r.output === target);
    let missing: string[] = [];
    if (candidateRules.length > 0) {
      missing = candidateRules
        .map((r) => r.inputs.filter((k) => values[k] === undefined))
        .sort((a, b) => a.length - b.length)[0];
    }
    return { ok: false, reasonKey: "missingVariables", missing };
  }

  return {
    ok: true,
    target,
    value: resolved,
    steps,
    sources: dedupeSources(sources),
  };
}

/** Small formatting helper shared by every engine's `describe()` callback. */
export { formatNum };
