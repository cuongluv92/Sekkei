"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { designCaseService } from "@/lib/services/design";
import type { DesignCase } from "@/lib/types/design";

/**
 * 製作依頼書 content for the selected 案件. Phase 2 (製作依頼-specific fields:
 * per-panel electrical ratings, 検査表/膜厚/漏電/耐圧, etc.) is not built yet —
 * per the phased rollout this stays a placeholder until Phase 1 is confirmed
 * working. The 盤 data itself already lives on the same 案件 record and will
 * be reused here without any schema change once Phase 2 starts.
 */
export function ProductionRequestPanel({ caseId }: { caseId: string }) {
  const { t } = useTranslation();
  const [designCase, setDesignCase] = useState<DesignCase | null>(null);

  useEffect(() => {
    let active = true;
    designCaseService.getDetail(caseId).then((detail) => {
      if (active && detail) setDesignCase(detail.case);
    });
    return () => {
      active = false;
    };
  }, [caseId]);

  return (
    <div className="flex flex-col gap-3">
      {designCase && (
        <div>
          <h2 className="text-[18px] font-bold tracking-tight text-foreground">
            {designCase.drawingNumber}　{designCase.projectName || ""}
          </h2>
          <p className="text-[13px] text-muted">{designCase.managementNumber}</p>
        </div>
      )}
      <div className="panel">
        <div className="panel-body py-12 text-center text-[13px] text-muted">
          {t("design.productionComingSoon")}
        </div>
      </div>
    </div>
  );
}
