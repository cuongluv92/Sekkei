"use client";

import { Construction } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { PanelBodyWeightCalc } from "@/components/calculation/PanelBodyWeightCalc";

const DEFERRED_GROUPS = ["baseL", "baseC", "duct"] as const;

/**
 * 盤重量計算 — 盤本体重量 (PanelBodyWeightCalc) is fully implemented; formulas
 * confirmed against 盤重量計算.xlsx + explicit user corrections (see
 * src/lib/utils/panelWeight.ts). 基台(L50×50)/基台(C100×50)/ダクト are
 * deliberately deferred — real drawings/dimensions for these are still
 * pending, so no formula is guessed for them. Their cards stay visible
 * (per spec: keep the layer/card in the UI, just mark it not-yet-done)
 * so tomorrow's work only has to fill in a computeArea function, not
 * restructure the page.
 */
export function PanelWeightCalc({ caseId }: { caseId: string }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-4">
      <PanelBodyWeightCalc caseId={caseId} />

      {DEFERRED_GROUPS.map((key) => (
        <div key={key} className="panel">
          <div className="panel-header">
            <span className="panel-title">{t(`weightCalc.panel.deferred.${key}`)}</span>
          </div>
          <div className="panel-body flex flex-col items-center gap-2 py-8 text-center">
            <Construction className="h-7 w-7 text-muted-2" />
            <p className="text-[12.5px] text-muted">{t("weightCalc.panel.deferredNote")}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
