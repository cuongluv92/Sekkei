"use client";

import { AlertTriangle } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import type { TechnicalSource } from "@/lib/calc/technicalSource";
import type { SolveResult } from "@/lib/calc/electrical/types";

interface ElectricalBasisPanelProps {
  result: SolveResult | null;
}

/**
 * 計算根拠 for every 電気技術計算 calculator — 計算式・代入式・結果・根拠・
 * 適用条件を一貫した形で表示する（EarthWireBasisPanel/EarthBarBasisPanel
 * と同じ視覚パターンを踏襲、汎用化したもの）。
 *
 * `engineering_fundamental`（電気工学基本式）と標準規格ソースを明確に
 * 区別する — 前者は「根拠: 電気工学基本式」、後者は「関連規格:
 * JIS Cxxxx:yyyy」として別々に表示し、後者のみ検証済み/要確認バッジを
 * 持つ。この区別を曖昧にすると、規格が定めていない式まで「JIS準拠」と
 * 誤解される危険があるため。
 */
export function ElectricalBasisPanel({ result }: ElectricalBasisPanelProps) {
  const { t, locale } = useTranslation();

  if (!result || !result.ok) {
    return (
      <p className="text-[12.5px] text-muted-2">
        {t("electricalTools.basis.emptyMessage")}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {result.warnings && result.warnings.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2.5">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <div className="flex flex-col gap-1">
            {result.warnings.map((w, i) => (
              <p key={i} className="text-[12px] text-warning">
                {w}
              </p>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-lg border border-border bg-surface-2 px-3 py-2.5">
        <span className="field-label">{t("electricalTools.basis.formulaLabel")}</span>
        <div className="flex flex-col gap-2.5">
          {result.steps.map((step, i) => (
            <div key={i} className="flex flex-col gap-0.5 font-mono text-[12px]">
              <span className="text-muted">{step.formula}</span>
              <span className="text-muted">{step.substituted}</span>
              <span className="font-bold text-foreground">{step.resultLine}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {result.sources.map((source, i) => (
          <SourceBlock key={i} source={source} locale={locale} t={t} />
        ))}
      </div>
    </div>
  );
}

function SourceBlock({
  source,
  t,
}: {
  source: TechnicalSource;
  locale: string;
  t: (path: string, vars?: Record<string, string | number>) => string;
}) {
  const isFundamental = source.sourceType === "engineering_fundamental";

  return (
    <div className="rounded-lg border border-border-strong bg-surface px-3 py-2.5 text-[11.5px]">
      <div className="flex flex-wrap items-center gap-2">
        {isFundamental ? (
          <>
            <span className="badge-info">
              {t("electricalTools.basis.fundamentalBadge")}
            </span>
            <span className="font-bold text-foreground">{source.reference}</span>
          </>
        ) : (
          <>
            <span className="text-[10.5px] font-semibold tracking-wide text-muted-2 uppercase">
              {t("electricalTools.basis.relatedStandardLabel")}
            </span>
            <span className="font-bold text-foreground">
              {source.standard}:{source.edition}
            </span>
            <span className={source.verified ? "badge-success" : "badge-warning"}>
              {source.verified
                ? t("electricalTools.basis.verifiedBadge")
                : t("electricalTools.basis.unverifiedBadge")}
            </span>
          </>
        )}
      </div>
      <div className="mt-1.5 grid grid-cols-1 gap-1 text-muted sm:grid-cols-[100px_1fr]">
        {!isFundamental && (
          <>
            <span className="text-muted-2">
              {t("electricalTools.basis.referenceLabel")}
            </span>
            <span>{source.reference}</span>
          </>
        )}
        <span className="text-muted-2">
          {t("electricalTools.basis.applicabilityLabel")}
        </span>
        <span>{source.applicability}</span>
      </div>
      {!source.verified && source.verificationNote && (
        <p className="mt-1.5 border-t border-border pt-1.5 text-[11px] text-warning">
          {source.verificationNote}
        </p>
      )}
    </div>
  );
}
