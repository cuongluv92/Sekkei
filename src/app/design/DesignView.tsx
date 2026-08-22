"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { useTranslation } from "@/lib/i18n";
import { PageHeader } from "@/components/common/PageHeader";
import { DesignTabBar, isDesignTopTab, type DesignTopTab } from "@/components/design/DesignTabBar";
import { CaseWorkspaceBar } from "@/components/design/CaseWorkspaceBar";
import { DesignRequestForm } from "@/components/design/DesignRequestForm";
import { ProductionRequestForm } from "@/components/design/ProductionRequestForm";
import { CaseLedgerTable } from "@/components/design/CaseLedgerTable";
import { DesignRequestIndexTable } from "@/components/design/DesignRequestIndexTable";
import { ScheduleTimeline } from "@/components/design/ScheduleTimeline";
import { CostLaborTable } from "@/components/design/CostLaborTable";

/**
 * 設計管理 entry point. A single page with a top-level tab strip (order fixed:
 * 設計依頼書/製作依頼書/図面管理台帳/設計依頼書目次・京王/設計依頼書目次・その他/工程表/
 * 仕入原価・工数一覧表) — no separate Project screen. Selection state
 * (tab/project/case) lives in the URL so Project/案件 survive switching
 * between 設計依頼書 and 製作依頼書, and the view is directly linkable/shareable
 * (used by 案件検索's "open this case" navigation).
 */
export function DesignView() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();

  const tabParam = searchParams.get("tab");
  const tab: DesignTopTab = isDesignTopTab(tabParam) ? tabParam : "designRequest";
  const projectId = searchParams.get("project") ?? "";
  const caseId = searchParams.get("case") ?? "";

  const setParams = useCallback(
    (next: { tab?: DesignTopTab; project?: string; case?: string }) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", next.tab ?? tab);
      const nextProject = next.project !== undefined ? next.project : projectId;
      const nextCase = next.case !== undefined ? next.case : caseId;
      if (nextProject) params.set("project", nextProject);
      else params.delete("project");
      if (nextCase) params.set("case", nextCase);
      else params.delete("case");
      router.push(`/design?${params.toString()}`);
    },
    [router, searchParams, tab, projectId, caseId],
  );

  const usesWorkspace = tab === "designRequest" || tab === "productionRequest";

  return (
    <div className="flex flex-col gap-3">
      <PageHeader title={t("design.title")} />
      <DesignTabBar active={tab} onChange={(nextTab) => setParams({ tab: nextTab })} />

      {usesWorkspace && (
        <>
          <CaseWorkspaceBar
            projectId={projectId}
            caseId={caseId}
            onProjectChange={(nextProject) => setParams({ project: nextProject, case: "" })}
            onCaseChange={(nextCase) => setParams({ case: nextCase })}
            allowCreate={tab === "designRequest"}
          />
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
        <DesignRequestIndexTable kind="keio" filter={({ case: c }) => c.indexCategory === "keio"} />
      )}
      {tab === "designIndexOther" && (
        <DesignRequestIndexTable kind="other" filter={({ case: c }) => c.indexCategory !== "keio"} />
      )}
      {tab === "schedule" && <ScheduleTimeline />}
      {tab === "costLabor" && <CostLaborTable />}
    </div>
  );
}
