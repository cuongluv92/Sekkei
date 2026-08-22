"use client";

import { Check } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import type { HighCurrentBusbarCandidate } from "@/lib/calc/busbar/highCurrentCandidateSearch";

interface HighCurrentBusbarCandidateListProps {
  candidates: HighCurrentBusbarCandidate[];
  adopted: (HighCurrentBusbarCandidate & { adoptedAt: string }) | null;
  onAdopt: (candidate: HighCurrentBusbarCandidate) => void;
  saving: boolean;
}

function roundTo(n: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(n * factor) / factor;
}

function isSameConfig(
  a: HighCurrentBusbarCandidate,
  b: (HighCurrentBusbarCandidate & { adoptedAt: string }) | null,
): boolean {
  if (!b) return false;
  return (
    a.thicknessMm === b.thicknessMm &&
    a.widthMm === b.widthMm &&
    a.barsPerPhase === b.barsPerPhase
  );
}

/**
 * >630A candidate table — deliberately different columns from
 * `BusbarCandidateList`: no 許容電流/余裕率 (nothing verified to compute
 * them from), no ranked 推奨 (technical validity isn't established for any
 * row, so none is presented as more valid than another — see
 * `highCurrentCandidateSearch.ts`). Shows only the real, always-true
 * geometry (総断面積/実電流密度) plus an honest 要確認 judgment on every row.
 */
export function HighCurrentBusbarCandidateList({
  candidates,
  adopted,
  onAdopt,
  saving,
}: HighCurrentBusbarCandidateListProps) {
  const { t } = useTranslation();

  if (candidates.length === 0) {
    return <p className="text-[12px] text-muted-2">{t("busbarCalc.noCandidates")}</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-[11.5px] text-warning">
        {t("busbarCalc.highCurrentCandidateDisclaimer")}
      </p>
      <div className="data-table-wrap">
        <table className="data-table" style={{ minWidth: 680 }}>
          <thead>
            <tr>
              <th style={{ width: "140px" }}>{t("busbarCalc.recommendedLabel")}</th>
              <th style={{ width: "110px" }} className="text-right">
                {t("busbarCalc.actualAreaLabel")}
              </th>
              <th style={{ width: "120px" }} className="text-right">
                {t("busbarCalc.actualDensityLabel")}
              </th>
              <th style={{ width: "150px" }}>{t("busbarCalc.arrangementLabel")}</th>
              <th style={{ width: "110px" }}>{t("busbarCalc.judgmentLabel")}</th>
              <th style={{ width: "140px" }} />
            </tr>
          </thead>
          <tbody>
            {candidates.map((c, i) => {
              const isAdopted = isSameConfig(c, adopted);
              return (
                <tr
                  key={`${c.sizeId}-${c.barsPerPhase}-${i}`}
                  className={isAdopted ? "bg-accent/5" : ""}
                >
                  <td className="font-mono text-[12px]">
                    {c.thicknessMm}×{c.widthMm} × {c.barsPerPhase}
                    {t("busbarCalc.barsUnit")}
                  </td>
                  <td className="text-right">{roundTo(c.totalAreaMm2, 2)} mm²</td>
                  <td className="text-right">
                    {roundTo(c.actualDensityAPerMm2, 3)} A/mm²
                  </td>
                  <td className="text-[11.5px] text-muted">{c.arrangement}</td>
                  <td>
                    <span
                      className="badge-warning"
                      title={t("busbarCalc.highCurrentNotAvailable")}
                    >
                      {t("busbarCalc.unverifiedBadge")}
                    </span>
                  </td>
                  <td>
                    {isAdopted ? (
                      <span className="flex items-center gap-1 text-[11.5px] font-semibold text-accent">
                        <Check className="h-3.5 w-3.5" />
                        {t("busbarCalc.adoptedLabel")}
                      </span>
                    ) : (
                      <button
                        onClick={() => onAdopt(c)}
                        disabled={saving}
                        className="btn-secondary !py-1 !text-[11.5px]"
                      >
                        {t("busbarCalc.adoptButton")}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
