"use client";

import { Check, Loader2 } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import type { BusbarCandidate } from "@/lib/calc/busbar/candidateSearch";
import type { AdoptedBusbar } from "./BusbarCalculationView";

interface BusbarCandidateListProps {
  candidates: BusbarCandidate[];
  adopted: AdoptedBusbar | null;
  onAdopt: (candidate: BusbarCandidate) => void;
  saving: boolean;
  /** For the NG message ("必要電流{current}Aに対して..."). */
  ratedCurrentA: number | null;
  /** True when this candidate is being checked against a rated current outside the JIS C 8480 simplified range (>630A) — the judgment shown must not claim OK/注意/NG since no verified high-current method has been applied (spec #12, #18). */
  highCurrentUnverified?: boolean;
}

function roundTo(n: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(n * factor) / factor;
}

function isSameConfig(a: BusbarCandidate, b: AdoptedBusbar | null): boolean {
  if (!b) return false;
  return (
    a.thicknessMm === b.thicknessMm &&
    a.widthMm === b.widthMm &&
    a.barsPerPhase === b.barsPerPhase
  );
}

/** Shared candidate table for both Auto mode's proposals and Manual mode's single what-if — one candidate per row, always showing 総断面積/実電流密度/余裕率/判定 with a 採用 action, never just a bare recommended size (spec #8, #12). */
export function BusbarCandidateList({
  candidates,
  adopted,
  onAdopt,
  saving,
  ratedCurrentA,
  highCurrentUnverified,
}: BusbarCandidateListProps) {
  const { t } = useTranslation();

  if (candidates.length === 0) {
    return (
      <p className="text-[12px] text-muted-2">{t("busbarCalc.noCandidates")}</p>
    );
  }

  return (
    <div className="data-table-wrap">
      <table className="data-table" style={{ minWidth: 720 }}>
        <thead>
          <tr>
            <th style={{ width: "140px" }}>
              {t("busbarCalc.recommendedLabel")}
            </th>
            <th style={{ width: "110px" }} className="text-right">
              {t("busbarCalc.actualAreaLabel")}
            </th>
            <th style={{ width: "120px" }} className="text-right">
              {t("busbarCalc.actualDensityLabel")}
            </th>
            <th style={{ width: "100px" }} className="text-right">
              {t("busbarCalc.marginLabel")}
            </th>
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
                  {c.actualDensityAPerMm2 !== null
                    ? `${roundTo(c.actualDensityAPerMm2, 3)} A/mm²`
                    : "—"}
                </td>
                <td className="text-right">
                  {c.marginPercent !== null
                    ? `${c.marginPercent >= 0 ? "+" : ""}${roundTo(c.marginPercent, 1)}%`
                    : "—"}
                </td>
                <td>
                  {highCurrentUnverified ? (
                    <span
                      className="badge-warning"
                      title={t("busbarCalc.highCurrentNotAvailable")}
                    >
                      {t("busbarCalc.unverifiedBadge")}
                    </span>
                  ) : c.judgment === "ok" ? (
                    <span className="badge-success">
                      {t("busbarCalc.judgmentOk")}
                    </span>
                  ) : c.judgment === "caution" ? (
                    <span
                      className="badge-warning"
                      title={t("busbarCalc.cautionMessage")}
                    >
                      {t("busbarCalc.judgmentCaution")}
                    </span>
                  ) : (
                    <span
                      className="badge-danger"
                      title={t("busbarCalc.ngMessage", {
                        current: String(ratedCurrentA ?? ""),
                      })}
                    >
                      {t("busbarCalc.judgmentNg")}
                    </span>
                  )}
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
                      disabled={saving || c.judgment === "ng"}
                      className="btn-secondary !py-1 !text-[11.5px]"
                    >
                      {saving && <Loader2 className="h-3 w-3 animate-spin" />}
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
  );
}
