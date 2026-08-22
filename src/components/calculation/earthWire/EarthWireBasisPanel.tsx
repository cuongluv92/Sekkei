"use client";

import { useTranslation } from "@/lib/i18n";
import type { TechnicalSource } from "@/lib/calc/technicalSource";

interface EarthWireBasisPanelProps {
  ratedCurrentA: number;
  coefficientPerA: number;
  requiredAreaMm2: number;
  source: TechnicalSource;
}

function roundTo(n: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(n * factor) / factor;
}

/**
 * 計算式 + 計算根拠 for 接地線 — shows the actual substituted-number
 * calculation (0.052 × In) and exactly which standard/edition/clause it is
 * based on, including whether that source has actually been verified
 * against the standard's own text (spec #20, #30, #31).
 */
export function EarthWireBasisPanel({
  ratedCurrentA,
  coefficientPerA,
  requiredAreaMm2,
  source,
}: EarthWireBasisPanelProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-lg border border-border bg-surface-2 px-3 py-2.5">
        <span className="field-label">
          {t("earthWireCalc.formulaSectionTitle")}
        </span>
        <div className="flex flex-col gap-1 font-mono text-[12px] text-muted">
          <span>{t("earthWireCalc.requiredAreaFormula")}</span>
          <span className="text-foreground">
            {coefficientPerA} × {ratedCurrentA} = {roundTo(requiredAreaMm2, 3)}{" "}
            mm²
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="field-label">
          {t("earthWireCalc.basisSectionTitle")}
        </span>
        <div className="rounded-lg border border-border-strong bg-surface px-3 py-2.5 text-[11.5px]">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-foreground">
              {source.standard}:{source.edition}
            </span>
            <span
              className={source.verified ? "badge-success" : "badge-warning"}
            >
              {source.verified
                ? t("earthWireCalc.verifiedBadge")
                : t("earthWireCalc.unverifiedBadge")}
            </span>
          </div>
          <div className="mt-1.5 grid grid-cols-1 gap-1 text-muted sm:grid-cols-[100px_1fr]">
            <span className="text-muted-2">
              {t("earthWireCalc.referenceLabel")}
            </span>
            <span>{source.reference}</span>
            <span className="text-muted-2">
              {t("earthWireCalc.applicabilityLabel")}
            </span>
            <span>{source.applicability}</span>
          </div>
          {!source.verified && source.verificationNote && (
            <p className="mt-1.5 border-t border-border pt-1.5 text-[11px] text-warning">
              {source.verificationNote}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
