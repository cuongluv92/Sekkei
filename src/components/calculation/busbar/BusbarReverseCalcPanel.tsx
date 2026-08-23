"use client";

import { useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { maxCurrentForArea } from "@/lib/calc/busbar/currentDensityRule";
import { JSIA_T1006_SOURCE } from "@/lib/calc/busbar/highCurrentRule";

function roundTo(n: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(n * factor) / factor;
}

interface BusbarReverseCalcPanelProps {
  /**
   * "low" inverts the JIS C 8480 simplified table (≤630A) via
   * `maxCurrentForArea` — a real computation. "high" has no verified source
   * to invert (see highCurrentRule.ts: JSIA-T1006/JSIA 210 are unobtained
   * paid publications) — rather than fabricate a number, it explains why
   * none is shown, the same honesty principle the >630A candidate search
   * already follows (judgment always "requiresVerification", never a
   * invented pass/fail).
   */
  variant: "low" | "high";
}

/**
 * 断面積 → 電流 の逆算 — a standalone reverse-direction lookup, separate from
 * 手動検証's t×W×n what-if check. Takes a cross-section directly (mm²), not
 * derived from any t/W/n input. Split into a ～630A variant (inverts the
 * JIS C 8480 table, `maxCurrentForArea`) and a 630A～ variant (honest
 * unavailable notice) — paired one-for-one with the ～630A/630A～ 定格電流
 * inputs beside them (spec follow-up: 定格電流 itself is now two independent
 * range-scoped boxes, not one auto-switching field).
 */
export function BusbarReverseCalcPanel({ variant }: BusbarReverseCalcPanelProps) {
  const { t } = useTranslation();
  const [areaRaw, setAreaRaw] = useState("");

  if (variant === "high") {
    return (
      <div className="panel h-full">
        <div className="panel-header">
          <span className="panel-title">
            {t("busbarCalc.reverseCalcHighTitle")}
          </span>
        </div>
        <div className="panel-body flex flex-col gap-3">
          <p className="text-[12px] text-muted">
            {t("busbarCalc.reverseCalcHighUnavailable")}
          </p>
          <div className="rounded-lg border border-border-strong bg-surface px-3 py-2.5 text-[11.5px]">
            <div className="flex flex-wrap items-center gap-2">
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
        </div>
      </div>
    );
  }

  const areaMm2 = Number(areaRaw);
  const result =
    areaRaw.trim() !== "" && Number.isFinite(areaMm2) && areaMm2 > 0
      ? maxCurrentForArea(areaMm2)
      : null;

  return (
    <div className="panel h-full">
      <div className="panel-header">
        <span className="panel-title">
          {t("busbarCalc.reverseCalcLowTitle")}
        </span>
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
      </div>
    </div>
  );
}
