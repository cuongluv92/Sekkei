"use client";

import { useTranslation } from "@/lib/i18n";
import type { TechnicalSource } from "@/lib/calc/technicalSource";

interface BusbarBasisPanelProps {
  /** In-range (≤630A) case: the actual computed values, shown with real numbers substituted into the formula. */
  ratedCurrentA?: number;
  densityAPerMm2?: number;
  requiredAreaMm2?: number;
  currentDensitySource?: TechnicalSource;
  materialSource?: TechnicalSource;
  /** Out-of-range (>630A) case: only the high-current source is shown (no formula — none is implemented yet). */
  highCurrentSource?: TechnicalSource;
  /** Suppresses the 計算式 card even when the in-range props are supplied — used when the caller renders that formula itself, right beside the 定格電流 input it belongs to, instead of duplicating it here. */
  hideFormula?: boolean;
}

function roundTo(n: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(n * factor) / factor;
}

/**
 * 計算式 + 計算根拠 — every busbar result must show its actual formula with
 * real substituted numbers (not just the symbolic form) and exactly which
 * standard/edition/clause it's based on, including whether that source has
 * actually been verified against the standard's own text (spec #17, #18).
 * Always rendered inside a panel already titled 計算根拠
 * (BusbarCalculationView's `.calc-layout-basis` block), so this component
 * itself doesn't repeat that heading — only 計算式 (a genuinely distinct
 * sub-section) gets its own label.
 */
export function BusbarBasisPanel({
  ratedCurrentA,
  densityAPerMm2,
  requiredAreaMm2,
  currentDensitySource,
  materialSource,
  highCurrentSource,
  hideFormula,
}: BusbarBasisPanelProps) {
  const { t } = useTranslation();
  const sources = [
    currentDensitySource,
    materialSource,
    highCurrentSource,
  ].filter((s): s is TechnicalSource => !!s);

  return (
    <div className="flex flex-col gap-3">
      {!hideFormula &&
        currentDensitySource &&
        ratedCurrentA !== undefined &&
        densityAPerMm2 !== undefined &&
        requiredAreaMm2 !== undefined && (
          <div className="rounded-lg border border-border bg-surface-2 px-3 py-2.5">
            <span className="field-label">
              {t("busbarCalc.formulaSectionTitle")}
            </span>
            <div className="flex flex-col gap-1 font-mono text-[12px] text-muted">
              <span>{t("busbarCalc.requiredAreaFormula")}</span>
              <span className="text-foreground">
                {ratedCurrentA} / {densityAPerMm2} ={" "}
                {roundTo(requiredAreaMm2, 3)} mm²
              </span>
            </div>
          </div>
        )}

      <div className="flex flex-col gap-2">
        {sources.map((source, i) => (
          <div
            key={i}
            className="rounded-lg border border-border-strong bg-surface px-3 py-2.5 text-[11.5px]"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-foreground">
                {source.standard}:{source.edition}
              </span>
              <span
                className={source.verified ? "badge-success" : "badge-warning"}
              >
                {source.verified
                  ? t("busbarCalc.verifiedBadge")
                  : t("busbarCalc.unverifiedBadge")}
              </span>
            </div>
            <div className="mt-1.5 grid grid-cols-1 gap-1 text-muted sm:grid-cols-[100px_1fr]">
              <span className="text-muted-2">
                {t("busbarCalc.referenceLabel")}
              </span>
              <span>{source.reference}</span>
              <span className="text-muted-2">
                {t("busbarCalc.applicabilityLabel")}
              </span>
              <span>{source.applicability}</span>
            </div>
            {!source.verified && source.verificationNote && (
              <p className="mt-1.5 border-t border-border pt-1.5 text-[11px] text-warning">
                {source.verificationNote}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
