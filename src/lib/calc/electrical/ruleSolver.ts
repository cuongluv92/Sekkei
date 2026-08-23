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
 *
 * When an engine lists more than one rule that can derive the same
 * `output` (e.g. a "direct" 3-variable formula alongside a pairwise
 * decomposition that reaches the same variable in two hops), list the
 * preferred/more-direct one first — `shortestDerivation` below breaks ties
 * between equal-hop-count rules by array order.
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

/** Relative tolerance for treating two independently-derived values of the same variable as "the same" — loose enough to absorb ordinary rounding from a user typing a few significant digits, tight enough to still catch genuinely contradictory input. */
const CONSISTENCY_RELATIVE_TOLERANCE = 0.005;

function valuesAgree(a: number, b: number): boolean {
  const scale = Math.max(Math.abs(a), Math.abs(b), 1e-9);
  return Math.abs(a - b) <= scale * CONSISTENCY_RELATIVE_TOLERANCE;
}

/**
 * Phase 1 — forward-chains `rules` from `values` (mutated in place) to a
 * fixed point, establishing the real value of every reachable variable.
 * Never guesses: a rule only fires once every one of its `inputs` is an
 * actual finite number, and a result that comes out non-finite (e.g.
 * division by zero) is treated as "not derivable" via that rule rather
 * than surfaced as NaN/Infinity.
 *
 * Also never silently prefers one redundant input over another: whenever a
 * rule's inputs are all known and its output is *also* already known
 * (whether the user typed that value directly, or another rule already
 * derived it), the two are compared — a mismatch beyond ordinary rounding
 * stops the solve with `reasonKey: "inconsistentInput"` instead of quietly
 * keeping whichever value happened to be computed/entered first. This pass
 * intentionally still evaluates every rule reachable from `values`, not
 * just the ones on the shortest path to any particular target, because
 * consistency-checking must catch a contradiction anywhere in the graph.
 */
function forwardChain<K extends string>(
  rules: readonly Rule<K>[],
  values: Partial<Record<K, number>>,
): { ok: true } | { ok: false; reasonKey: "inconsistentInput"; message: string } {
  const checked = new Set<number>();
  let progress = true;
  while (progress) {
    progress = false;
    for (let i = 0; i < rules.length; i++) {
      if (checked.has(i)) continue;
      const rule = rules[i];
      if (!rule.inputs.every((k) => values[k] !== undefined)) continue;
      const inputValues = {} as Record<K, number>;
      for (const k of rule.inputs) inputValues[k] = values[k]!;
      const result = rule.compute(inputValues);
      if (!Number.isFinite(result)) {
        checked.add(i);
        continue;
      }

      const existing = values[rule.output];
      if (existing !== undefined) {
        checked.add(i);
        if (!valuesAgree(existing, result)) {
          return {
            ok: false,
            reasonKey: "inconsistentInput",
            message: `${String(rule.output)}: ${formatNum(existing)} ≠ ${formatNum(result)}`,
          };
        }
        continue;
      }

      values[rule.output] = result;
      checked.add(i);
      progress = true;
    }
  }
  return { ok: true };
}

/**
 * Phase 2 — BFS over the same rule graph, counting each rule firing as one
 * hop from the user-supplied values (`givenKeys`), to find the MINIMUM
 * number of derivation steps that reach `target`. Ties (two rules that
 * become derivable in the same round) are broken by array order, so an
 * engine expresses "prefer this direct formula" simply by listing it
 * before an equivalent multi-hop decomposition.
 *
 * Only the variables actually on this minimal path are ever turned into a
 * displayed `FormulaStep` — anything `forwardChain` incidentally derived
 * along the way for cross-checking (e.g. deriving Q while the user only
 * asked for I) never appears, so the UI never shows an unnecessary detour.
 */
function shortestDerivation<K extends string>(
  rules: readonly Rule<K>[],
  givenKeys: ReadonlySet<K>,
  target: K,
  finalValues: Partial<Record<K, number>>,
): { steps: FormulaStep[]; sources: TechnicalSource[] } {
  const level = new Map<K, number>();
  for (const k of givenKeys) level.set(k, 0);
  const chosenRule = new Map<K, number>();

  let round = 0;
  while (!level.has(target)) {
    round++;
    const knownSoFar = new Set(level.keys());
    let progress = false;
    for (let i = 0; i < rules.length; i++) {
      const rule = rules[i];
      if (level.has(rule.output)) continue;
      if (!rule.inputs.every((k) => knownSoFar.has(k))) continue;
      const inputValues = {} as Record<K, number>;
      for (const k of rule.inputs) inputValues[k] = finalValues[k]!;
      const result = rule.compute(inputValues);
      if (!Number.isFinite(result)) continue;
      level.set(rule.output, round);
      chosenRule.set(rule.output, i);
      progress = true;
    }
    // Defensive only: forwardChain having already resolved `target` guarantees
    // this BFS reaches it too (same rule graph, same reachability closure).
    if (!progress) break;
  }

  if (!level.has(target)) return { steps: [], sources: [] };

  const ancestors = new Set<K>();
  const stack: K[] = [target];
  while (stack.length > 0) {
    const v = stack.pop()!;
    if (ancestors.has(v) || !chosenRule.has(v)) continue;
    ancestors.add(v);
    for (const inp of rules[chosenRule.get(v)!].inputs) stack.push(inp);
  }

  const ordered = [...ancestors].sort((a, b) => level.get(a)! - level.get(b)!);
  const steps: FormulaStep[] = [];
  const sources: TechnicalSource[] = [];
  for (const outVar of ordered) {
    const rule = rules[chosenRule.get(outVar)!];
    const inputValues = {} as Record<K, number>;
    for (const k of rule.inputs) inputValues[k] = finalValues[k]!;
    steps.push(rule.describe(inputValues, finalValues[outVar]!));
    sources.push(rule.source);
  }
  return { steps, sources };
}

export function solveByRules<K extends string>(
  rules: readonly Rule<K>[],
  known: KnownValues<K>,
  target: K,
): SolveResult {
  const values: Partial<Record<K, number>> = {};
  const givenKeys = new Set<K>();
  for (const key of Object.keys(known) as K[]) {
    const v = known[key];
    if (isFiniteNumber(v)) {
      values[key] = v;
      givenKeys.add(key);
    }
  }

  const chainResult = forwardChain(rules, values);
  if (!chainResult.ok) return chainResult;

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

  const { steps, sources } = shortestDerivation(rules, givenKeys, target, values);

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
