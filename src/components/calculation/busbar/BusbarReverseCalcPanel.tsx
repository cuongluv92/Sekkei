"use client";

import { useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { maxCurrentForArea } from "@/lib/calc/busbar/currentDensityRule";
import { JSIA_T1006_SOURCE } from "@/lib/calc/busbar/highCurrentRule";

function roundTo(n: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(n * factor) / factor;
}

/**
 * 断面積 → 電流 の逆算 — a standalone reverse-direction lookup, separate from
 * 手動検証's t×W×n what-if check. Takes a cross-section directly (mm²), not
 * derived from any t/W/n input, and inverts the JIS C 8480 simplified table
 * (`maxCurrentForArea`). One tool, not two: an area that implies more than
 * 630A (`cappedAtCeiling`) has no verified source to invert past that point
 * (JSIA-T1006/JSIA 210 are unobtained paid publications — see
 * highCurrentRule.ts), so rather than a separate always-visible "630A～"
 * panel that can never produce a number, this same panel explains why none
 * is shown right where the capped reading already appears.
 */
export function BusbarReverseCalcPanel() {
  const { t } = useTranslation();
  const [areaRaw, setAreaRaw] = useState("");

  const areaMm2 = Number(areaRaw);
  const result =
    areaRaw.trim() !== "" && Number.isFinite(areaMm2) && areaMm2 > 0
      ? maxCurrentForArea(areaMm2)
      : null;

  return (
    <div className="panel h-full">
      <div className="panel-header">
        <span className="panel-title">{t("busbarCalc.reverseCalcTitle")}</span>
      </div>
      <div className="panel-body flex flex-col gap-3">
        <p className="text-[12px] text-muted">
          {t("busbarCalc.reverseCalcHint")}
        </p>
        <div className="flex max-w-[160px] items-center gap-1.5">
          <input
            type="number"
            step="0.1"
            value={areaRaw}
            onChange={(e) => setAreaRaw(e.target.value)}
            placeholder="72"
            className="field-input min-w-0"
          />
          <span className="shrink-0 text-[12px] text-muted-2">mm²</span>
        </div>

        {result?.inRange && (
          <div className="rounded-lg border border-border bg-surface-2 px-3 py-3">
            <div className="flex flex-col gap-1 font-mono text-[12px] text-muted">
              <span>{t("busbarCalc.reverseCalcFormula")}</span>
              <span className="text-foreground">
                {roundTo(result.areaMm2, 2)} × {result.densityAPerMm2} ={" "}
                {roundTo(result.maxCurrentA, 1)} A
              </span>
            </div>
            <p className="mt-2 text-[22px] font-extrabold text-foreground">
              {roundTo(result.maxCurrentA, 1)}
              {result.cappedAtCeiling ? "+" : ""} A
            </p>
            {result.cappedAtCeiling && (
              <p className="mt-1.5 border-t border-border pt-1.5 text-[11px] text-warning">
                {t("busbarCalc.maxCurrentCappedNote")}
              </p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-border pt-2">
              <span className="font-bold text-foreground">
                {result.source.standard}:{result.source.edition}
              </span>
              <span className="badge-warning">
                {t("busbarCalc.unverifiedBadge")}
              </span>
            </div>
          </div>
        )}

        {result?.inRange && result.cappedAtCeiling && (
          <div className="rounded-lg border border-border-strong bg-surface px-3 py-2.5 text-[11.5px]">
            <p className="text-muted">
              {t("busbarCalc.reverseCalcHighUnavailable")}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <span className="font-bold text-foreground">
                {JSIA_T1006_SOURCE.standard}:{JSIA_T1006_SOURCE.edition}
              </span>
              <span className="badge-warning">
                {t("busbarCalc.unverifiedBadge")}
              </span>
            </div>
            <p className="mt-1.5 text-muted">
              {JSIA_T1006_SOURCE.verificationNote}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
