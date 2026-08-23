"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import type { CalcVariableDef, SolveResult } from "@/lib/calc/electrical/types";
import { formatNum } from "@/lib/calc/electrical/types";

interface VariableSolverCardProps<K extends string> {
  variables: readonly CalcVariableDef<K>[];
  solve: (known: Partial<Record<K, number>>, target: K) => SolveResult;
  /** Reported on every recompute so a sibling panel (計算根拠) can render the same result. */
  onResult?: (result: SolveResult, target: K) => void;
  /** Reported on every recompute with the raw known values (excluding the target) — for a parent that needs to show supplementary info derived from specific entered fields (e.g. transformer's 電圧比 reference). */
  onValuesChange?: (known: Partial<Record<K, number>>) => void;
  /** Extra controls rendered above the variable list (e.g. 相/結線/用途 mode toggles). */
  extra?: React.ReactNode;
  /** Default 求める値 — defaults to the last variable in `variables` when omitted. */
  defaultTarget?: K;
  /** Bump this to reset all entered values (e.g. when the parent switches calculator mode). */
  resetKey?: string | number;
  /**
   * Keys that must remain visible as input fields but are never offered as
   * 求める値 — for a variable the engine genuinely cannot solve for (e.g.
   * voltageDrop's `pf`, which would require a nonlinear/ambiguous inverse
   * this system does not implement), so the picker never offers an option
   * that can only ever return "missing variables" with nothing to fill in.
   */
  nonTargetKeys?: readonly K[];
}

/**
 * Generic bidirectional variable-solver form shared by every 電気技術計算
 * calculator: the user picks which variable is the 求める値 (a row of small
 * toggle pills, not a separate ↔ swap button — keeps the UI from getting
 * cluttered per spec), fills in the others, and the target's field turns
 * into a large, prominently-styled result the moment enough is known. This
 * component owns only the input UX; the actual math always comes from the
 * `solve` function (one of `src/lib/calc/electrical/*`), and the resulting
 * 計算式/代入式/根拠 gets rendered by `ElectricalBasisPanel` alongside this
 * card — reported upward via `onResult` rather than duplicated here.
 */
export function VariableSolverCard<K extends string>({
  variables,
  solve,
  onResult,
  extra,
  defaultTarget,
  resetKey,
  onValuesChange,
  nonTargetKeys,
}: VariableSolverCardProps<K>) {
  const { locale } = useTranslation();
  const [target, setTarget] = useState<K>(
    defaultTarget ?? variables[variables.length - 1].key,
  );
  const [rawValues, setRawValues] = useState<Partial<Record<K, string>>>({});

  useEffect(() => {
    setRawValues({});
  }, [resetKey]);

  const known = useMemo(() => {
    const out: Partial<Record<K, number>> = {};
    for (const v of variables) {
      if (v.key === target) continue;
      const raw = rawValues[v.key];
      if (raw === undefined || raw.trim() === "") continue;
      const n = Number(raw);
      if (Number.isFinite(n)) out[v.key] = n;
    }
    return out;
  }, [rawValues, target, variables]);

  const result = useMemo(() => solve(known, target), [solve, known, target]);

  useEffect(() => {
    onResult?.(result, target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, target]);

  useEffect(() => {
    onValuesChange?.(known);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [known]);

  const missingLabels =
    !result.ok && result.reasonKey === "missingVariables"
      ? (result.missing ?? [])
          .map((k) => variables.find((v) => v.key === (k as K)))
          .filter((v): v is CalcVariableDef<K> => !!v)
          .map((v) => (locale === "vi" ? v.labelVi : v.labelJa))
      : [];

  return (
    <div className="flex flex-col gap-4">
      {extra}

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="field-label !mb-0">
          {locale === "vi" ? "Giá trị cần tìm" : "求める値"}
        </span>
        {variables
          .filter((v) => !nonTargetKeys?.includes(v.key))
          .map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => setTarget(v.key)}
              className={
                v.key === target
                  ? "rounded-full border border-accent bg-accent/15 px-3 py-1 text-[12.5px] font-bold text-accent"
                  : "rounded-full border border-border-strong bg-surface-2 px-3 py-1 text-[12.5px] font-semibold text-muted hover:text-foreground"
              }
            >
              {v.symbol}
            </button>
          ))}
      </div>

      <div
        className={
          result.ok
            ? "rounded-lg border border-accent/40 bg-accent/10 px-4 py-3.5"
            : "rounded-lg border border-border-strong bg-surface-2 px-4 py-3.5"
        }
      >
        <div className="text-[11px] font-semibold tracking-wide text-muted uppercase">
          {(locale === "vi"
            ? variables.find((v) => v.key === target)?.labelVi
            : variables.find((v) => v.key === target)?.labelJa) ?? target}{" "}
          ({variables.find((v) => v.key === target)?.symbol})
        </div>
        {result.ok ? (
          <div className="mt-1 text-[30px] font-extrabold tracking-tight text-foreground">
            {formatNum(result.value)}
            <span className="ml-1.5 text-[16px] font-semibold text-muted">
              {variables.find((v) => v.key === target)?.unit}
            </span>
          </div>
        ) : (
          <div className="mt-1 text-[13px] text-muted-2">
            {missingLabels.length > 0
              ? (locale === "vi"
                  ? `Còn thiếu: ${missingLabels.join(", ")}`
                  : `不足している値: ${missingLabels.join("、")}`)
              : locale === "vi"
                ? "Nhập đủ giá trị bên dưới để tính"
                : "下の値を入力してください"}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {variables
          .filter((v) => v.key !== target)
          .map((v) => (
            <div key={v.key} className="min-w-0">
              <label className="field-label">
                {locale === "vi" ? v.labelVi : v.labelJa}
                <span className="ml-1 font-mono text-muted-2">
                  ({v.symbol})
                </span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  inputMode="decimal"
                  value={rawValues[v.key] ?? ""}
                  onChange={(e) =>
                    setRawValues((prev) => ({ ...prev, [v.key]: e.target.value }))
                  }
                  placeholder="0"
                  className={v.unit ? "field-input pr-12" : "field-input"}
                />
                {v.unit && (
                  <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[12.5px] font-semibold text-muted-2">
                    {v.unit}
                  </span>
                )}
              </div>
              {(locale === "vi" ? v.hintVi : v.hintJa) && (
                <p className="mt-1 text-[11px] text-muted-2">
                  {locale === "vi" ? v.hintVi : v.hintJa}
                </p>
              )}
            </div>
          ))}
      </div>
    </div>
  );
}
