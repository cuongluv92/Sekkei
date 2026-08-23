import type { SolveMissing } from "./types";

/**
 * Shared input-validation helpers for every 電気技術計算 engine. A calculator
 * must never silently coerce or clamp an out-of-range value into something
 * that "looks like" a valid result (e.g. `Math.max(x, 0)` swallowing a
 * genuinely negative radicand) — invalid physical input is always reported
 * as `reasonKey: "invalidInput"` with a concrete Japanese message, before
 * `solveByRules` ever runs.
 *
 * Each `require*` helper only checks a value that is actually present
 * (`undefined` always passes — "not yet entered" is `solveByRules`'s
 * "missingVariables" territory, not a validation error) and returns either
 * an error message string or `null`.
 */

export function invalidInput(message: string): SolveMissing {
  return { ok: false, reasonKey: "invalidInput", message };
}

/** First non-null message among `checks` becomes an `invalidInput` result; `null` if every check passed. */
export function firstValidationError(
  ...checks: (string | null)[]
): SolveMissing | null {
  const message = checks.find((c): c is string => c !== null);
  return message ? invalidInput(message) : null;
}

export function requirePositive(
  value: number | undefined,
  labelJa: string,
): string | null {
  if (value === undefined) return null;
  if (!Number.isFinite(value) || value <= 0) {
    return `${labelJa}は0より大きい値を入力してください（入力値: ${value}）`;
  }
  return null;
}

export function requireNonNegative(
  value: number | undefined,
  labelJa: string,
): string | null {
  if (value === undefined) return null;
  if (!Number.isFinite(value) || value < 0) {
    return `${labelJa}は0以上の値を入力してください（入力値: ${value}）`;
  }
  return null;
}

/** (0, 1] — for cosφ (力率) and η (効率), both ratios that are meaningless at 0 and cannot physically exceed 1. */
export function requireRatio01(
  value: number | undefined,
  labelJa: string,
): string | null {
  if (value === undefined) return null;
  if (!Number.isFinite(value) || value <= 0 || value > 1) {
    return `${labelJa}は0より大きく1以下の値を入力してください（例: 0.85、入力値: ${value}）`;
  }
  return null;
}

/** [0, 1] — for すべり率, where the boundary s=1（locked rotor）is itself a valid physical state. */
export function requireRatio01Inclusive(
  value: number | undefined,
  labelJa: string,
): string | null {
  if (value === undefined) return null;
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    return `${labelJa}は0以上1以下の値を入力してください（入力値: ${value}）`;
  }
  return null;
}

/** Motor pole count: always a positive even integer. */
export function requirePositiveEvenInteger(
  value: number | undefined,
  labelJa: string,
): string | null {
  if (value === undefined) return null;
  if (
    !Number.isFinite(value) ||
    value <= 0 ||
    !Number.isInteger(value) ||
    value % 2 !== 0
  ) {
    return `${labelJa}は正の偶数を入力してください（例: 2, 4, 6、入力値: ${value}）`;
  }
  return null;
}

/**
 * `a` must not exceed `b` (small relative tolerance for rounding). Use for
 * physical impossibilities like 有効電力 P > 皮相電力 S, or 出力 > 入力.
 */
export function requireLessOrEqual(
  a: number | undefined,
  b: number | undefined,
  labelA: string,
  labelB: string,
): string | null {
  if (a === undefined || b === undefined) return null;
  const tolerance = Math.max(Math.abs(b), 1e-9) * 0.005;
  if (a > b + tolerance) {
    return `${labelA}は${labelB}を超えることはできません（${labelA}: ${a}、${labelB}: ${b}）`;
  }
  return null;
}
