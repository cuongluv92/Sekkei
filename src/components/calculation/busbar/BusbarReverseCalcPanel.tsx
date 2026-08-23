"use client";

import { useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { maxCurrentForArea } from "@/lib/calc/busbar/currentDensityRule";

function roundTo(n: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(n * factor) / factor;
}

/**
 * 断面積 → 電流 の逆算 — a standalone reverse-direction lookup, separate from
 * 手動検証's t×W×n what-if check. Takes a cross-section directly (mm²), not
 * derived from any t/W/n input, and answers "what current is this JIS
 * C 8480 simplified table good for" — the explicit reverse of 自動選定's
 * 定格電流→必要断面積 direction (spec follow-up: this must be a real,
 * discoverable mode, not just a column attached to a differently-derived
 * candidate list). Inverts the same table (`maxCurrentForArea`), never a
 * new/invented value — same `verified: false` source as the forward
 * direction. A quick reference tool, not part of the persisted calculation.
 * Rendered beside the 定格電流 I input in both 自動選定/手動検証 modes (not
 * mode-gated) so it's always reachable next to the field it complements.
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
    <div className="panel">
      <div className="panel-header">
        <span className="panel-title">{t("busbarCalc.reverseCalcTitle")}</span>
      </div>
      <div className="panel-body flex flex-col gap-3">
        <p className="text-[12px] text-muted">
          {t("busbarCalc.reverseCalcHint")}
        </p>
        <div className="max-w-[200px]">
          <input
            type="number"
            step="0.1"
            value={areaRaw}
            onChange={(e) => setAreaRaw(e.target.value)}
            placeholder="72"
            className="field-input"
          />
          <span className="mt-1 block text-[11px] text-muted-2">mm²</span>
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
