"use client";

import { Search as SearchIcon } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect } from "react";
import { useTranslation } from "@/lib/i18n";
import { useActiveCase } from "@/lib/store/ActiveCaseProvider";
import { PageHeader } from "@/components/common/PageHeader";
import { CaseSelector } from "@/components/common/CaseSelector";
import {
  DesignTabBar,
  isDesignTopTab,
  type DesignTopTab,
} from "@/components/design/DesignTabBar";
import { DesignRequestForm } from "@/components/design/DesignRequestForm";
import { ProductionRequestForm } from "@/components/design/ProductionRequestForm";
import { CaseLedgerTable } from "@/components/design/CaseLedgerTable";
import { DesignRequestIndexTable } from "@/components/design/DesignRequestIndexTable";
import { ScheduleTimeline } from "@/components/design/ScheduleTimeline";
import { CostLaborTable } from "@/components/design/CostLaborTable";

/**
 * 設計管理 entry point. A single page with a top-level tab strip (order fixed:
 * 設計依頼書/製作依頼書/図面管理台帳/設計依頼書目次・京王/設計依頼書目次・その他/工程表/
 * 仕入原価・工数一覧表) — no separate 案件 picker screen; the shared
 * `CaseSelector` handles that. Selection state (tab/case) lives in the URL
 * so the active 案件 survives switching between 設計依頼書 and 製作依頼書, and
 * the view is directly linkable/shareable (used by Global Search's "open
 * this 案件" navigation).
 */
export function DesignView() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();

  const tabParam = searchParams.get("tab");
  const tab: DesignTopTab = isDesignTopTab(tabParam)
    ? tabParam
    : "designRequest";
  const { caseId: activeCaseId, setCaseId: setActiveCaseId } = useActiveCase();
  // The URL is still the source of truth when it names a 案件 (deep links /
  // Global Search's "open this 案件" navigation keep working exactly as
  // before) — it only falls back to the app-wide active 案件 when the URL
  // doesn't say one, so switching 設計管理 → 部品製作 → 重量計算 → ... → back to
  // 設計管理 keeps the same 案件 active instead of starting blank.
  const caseIdParam = searchParams.get("case") ?? "";
  const caseId = caseIdParam || activeCaseId;

  const setParams = useCallback(
    (next: { tab?: DesignTopTab; case?: string }) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", next.tab ?? tab);
      const nextCase = next.case !== undefined ? next.case : caseId;
      if (nextCase) params.set("case", nextCase);
      else params.delete("case");
      router.push(`/design?${params.toString()}`);
    },
    [router, searchParams, tab, caseId],
  );

  // Broadcast the effective 案件 (URL-provided or restored) upward so it
  // stays active when the user leaves 設計管理 for another module.
  useEffect(() => {
    if (caseId && caseId !== activeCaseId) setActiveCaseId(caseId);
  }, [caseId, activeCaseId, setActiveCaseId]);

  const usesWorkspace = tab === "designRequest" || tab === "productionRequest";

  return (
    <div className="flex flex-col gap-3">
      <PageHeader title={t("design.title")} />
      <DesignTabBar
        active={tab}
        onChange={(nextTab) => setParams({ tab: nextTab })}
      />

      {usesWorkspace && (
        <>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
            <div className="flex-1">
              <CaseSelector />
            </div>
            <Link href="/design/search" className="btn-secondary shrink-0">
              <SearchIcon className="h-3.5 w-3.5" />
              {t("design.workspaceBar.advancedSearchButton")}
            </Link>
          </div>
          {!caseId ? (
            <div className="panel">
              <div className="panel-body py-12 text-center text-[13px] text-muted-2">
                {t("design.workspaceBar.selectCasePrompt")}
              </div>
            </div>
          ) : tab === "designRequest" ? (
            <DesignRequestForm caseId={caseId} />
          ) : (
            <ProductionRequestForm caseId={caseId} />
          )}
        </>
      )}

      {tab === "drawingRegister" && <CaseLedgerTable />}
      {tab === "designIndexKeio" && (
        <DesignRequestIndexTable
          kind="keio"
          filter={({ case: c }) => c.indexCategory === "keio"}
        />
      )}
      {tab === "designIndexOther" && (
        <DesignRequestIndexTable
          kind="other"
          filter={({ case: c }) => c.indexCategory !== "keio"}
        />
      )}
      {tab === "schedule" && <ScheduleTimeline />}
      {tab === "costLabor" && <CostLaborTable />}
    </div>
  );
}
