"use client";

import { useTranslation } from "@/lib/i18n";
import type { TechnicalSource } from "@/lib/calc/technicalSource";

interface EarthBarBasisPanelProps {
  sources: TechnicalSource[];
}

/**
 * 計算根拠 for アースバー — always shows every candidate source considered
 * (JIS C 60364-5-54 adiabatic method, JIS C 4620 for reference) with its
 * real verified/unverified state, never presenting either as "JIS準拠"
 * (spec #20, #21, #30, #31, #33).
 */
export function EarthBarBasisPanel({ sources }: EarthBarBasisPanelProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-2">
      <span className="field-label">{t("earthBarCalc.basisSectionTitle")}</span>
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
                ? t("earthBarCalc.verifiedBadge")
                : t("earthBarCalc.unverifiedBadge")}
            </span>
          </div>
          <div className="mt-1.5 grid grid-cols-1 gap-1 text-muted sm:grid-cols-[100px_1fr]">
            <span className="text-muted-2">
              {t("earthBarCalc.referenceLabel")}
            </span>
            <span>{source.reference}</span>
            <span className="text-muted-2">
              {t("earthBarCalc.applicabilityLabel")}
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
  );
}
