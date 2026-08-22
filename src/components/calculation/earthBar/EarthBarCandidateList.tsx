"use client";

import { Check, Loader2 } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import type { EarthBarCandidate } from "@/lib/calc/earthBar/candidateSearch";
import type { AdoptedEarthBar } from "./EarthBarCalculationView";

interface EarthBarCandidateListProps {
  candidates: EarthBarCandidate[];
  adopted: AdoptedEarthBar | null;
  onAdopt: (candidate: EarthBarCandidate) => void;
  saving: boolean;
}

function roundTo(n: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(n * factor) / factor;
}

function isSameConfig(a: EarthBarCandidate, b: AdoptedEarthBar | null): boolean {
  if (!b) return false;
  return (
    a.thicknessMm === b.thicknessMm &&
    a.widthMm === b.widthMm &&
    a.barsPerPhase === b.barsPerPhase
  );
}

/** Every candidate's judgment is always 要確認 (`requiresVerification`) — short-circuit withstand has no verified k-value source in this environment (spec #19, #26-28, #37). Shows real geometry only, never a fabricated OK/NG. */
export function EarthBarCandidateList({
  candidates,
  adopted,
  onAdopt,
  saving,
}: EarthBarCandidateListProps) {
  const { t } = useTranslation();

  if (candidates.length === 0) {
    return (
      <p className="text-[12px] text-muted-2">
        {t("earthBarCalc.noCandidates")}
      </p>
    );
  }

  return (
    <div className="data-table-wrap">
      <table className="data-table" style={{ minWidth: 640 }}>
        <thead>
          <tr>
            <th style={{ width: "140px" }}>{t("earthBarCalc.sizeLabel")}</th>
            <th style={{ width: "110px" }} className="text-right">
              {t("earthBarCalc.actualAreaLabel")}
            </th>
            <th style={{ width: "130px" }}>
              {t("earthBarCalc.judgmentLabel")}
            </th>
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
                  {t("earthBarCalc.barsUnit")}
                </td>
                <td className="text-right">{roundTo(c.totalAreaMm2, 2)} mm²</td>
                <td>
                  <span
                    className="badge-warning"
                    title={t("earthBarCalc.requiresVerificationMessage")}
                  >
                    {t("earthBarCalc.judgmentRequiresVerification")}
                  </span>
                </td>
                <td>
                  {isAdopted ? (
                    <span className="flex items-center gap-1 text-[11.5px] font-semibold text-accent">
                      <Check className="h-3.5 w-3.5" />
                      {t("earthBarCalc.adoptedLabel")}
                    </span>
                  ) : (
                    <button
                      onClick={() => onAdopt(c)}
                      disabled={saving}
                      className="btn-secondary !py-1 !text-[11.5px]"
                    >
                      {saving && <Loader2 className="h-3 w-3 animate-spin" />}
                      {t("earthBarCalc.adoptButton")}
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
