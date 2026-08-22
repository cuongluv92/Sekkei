"use client";

import { Construction } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

/**
 * 盤重量計算 — a real, separate branch from 基本重量計算 (not a sub-section of
 * it), scaffolded now so it has its own URL/tab. No formula logic yet: the
 * plan (盤サイズ入力 + 部品データ's 重量 + 基本重量計算の材料重量 → 合計) is confirmed
 * but deliberately not implemented until specified. Already linked to the
 * active 案件 (via `calculation_records`, calculation_type "weight-panel")
 * so the real save logic can be added later without restructuring.
 */
export function PanelWeightCalc({ caseId: _caseId }: { caseId: string }) {
  const { t } = useTranslation();
  return (
    <div className="panel">
      <div className="panel-body flex flex-col items-center gap-3 py-14 text-center">
        <Construction className="h-9 w-9 text-muted-2" />
        <p className="text-[14px] font-semibold text-foreground">
          {t("weightCalc.panel.title")}
        </p>
        <p className="max-w-md text-[12.5px] text-muted">
          {t("weightCalc.panel.comingSoon")}
        </p>
      </div>
    </div>
  );
}
