"use client";

import { Check, Loader2 } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import type { EarthWireCandidate } from "@/lib/calc/earthWire/candidateSearch";
import type { AdoptedEarthWire } from "./EarthWireCalculationView";

interface EarthWireCandidateListProps {
  candidates: EarthWireCandidate[];
  adopted: AdoptedEarthWire | null;
  onAdopt: (candidate: EarthWireCandidate) => void;
  saving: boolean;
  /** For the NG message ("必要断面積{required}mm²に対して..."). */
  requiredAreaMm2: number | null;
}

function roundTo(n: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(n * factor) / factor;
}

function isSameConfig(
  a: EarthWireCandidate,
  b: AdoptedEarthWire | null,
): boolean {
  if (!b) return false;
  return a.areaMm2 === b.areaMm2;
}

/** Shared candidate table for both Auto mode's proposals and Manual mode's single what-if — always showing 断面積/余裕率/判定 with a 採用 action (spec #17, #30). */
export function EarthWireCandidateList({
  candidates,
  adopted,
  onAdopt,
  saving,
  requiredAreaMm2,
}: EarthWireCandidateListProps) {
  const { t } = useTranslation();

  if (candidates.length === 0) {
    return (
      <p className="text-[12px] text-muted-2">
        {t("earthWireCalc.noCandidates")}
      </p>
    );
  }

  return (
    <div className="data-table-wrap">
      <table className="data-table" style={{ minWidth: 560 }}>
        <thead>
          <tr>
            <th style={{ width: "140px" }}>{t("earthWireCalc.sizeLabel")}</th>
            <th style={{ width: "100px" }} className="text-right">
              {t("earthWireCalc.marginLabel")}
            </th>
            <th style={{ width: "110px" }}>
              {t("earthWireCalc.judgmentLabel")}
            </th>
            <th style={{ width: "140px" }} />
          </tr>
        </thead>
        <tbody>
          {candidates.map((c) => {
            const isAdopted = isSameConfig(c, adopted);
            return (
              <tr
                key={c.sizeId}
                className={isAdopted ? "bg-accent/5" : ""}
              >
                <td className="font-mono text-[12px]">{c.areaMm2} mm²</td>
                <td className="text-right">
                  {c.marginPercent !== null
                    ? `${c.marginPercent >= 0 ? "+" : ""}${roundTo(c.marginPercent, 1)}%`
                    : "—"}
                </td>
                <td>
                  {c.judgment === "ok" ? (
                    <span className="badge-success">
                      {t("earthWireCalc.judgmentOk")}
                    </span>
                  ) : c.judgment === "caution" ? (
                    <span
                      className="badge-warning"
                      title={t("earthWireCalc.cautionMessage")}
                    >
                      {t("earthWireCalc.judgmentCaution")}
                    </span>
                  ) : (
                    <span
                      className="badge-danger"
                      title={t("earthWireCalc.ngMessage", {
                        required: String(
                          requiredAreaMm2 !== null
                            ? roundTo(requiredAreaMm2, 2)
                            : "",
                        ),
                      })}
                    >
                      {t("earthWireCalc.judgmentNg")}
                    </span>
                  )}
                </td>
                <td>
                  {isAdopted ? (
                    <span className="flex items-center gap-1 text-[11.5px] font-semibold text-accent">
                      <Check className="h-3.5 w-3.5" />
                      {t("earthWireCalc.adoptedLabel")}
                    </span>
                  ) : (
                    <button
                      onClick={() => onAdopt(c)}
                      disabled={saving || c.judgment === "ng"}
                      className="btn-secondary !py-1 !text-[11.5px]"
                    >
                      {saving && <Loader2 className="h-3 w-3 animate-spin" />}
                      {t("earthWireCalc.adoptButton")}
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
