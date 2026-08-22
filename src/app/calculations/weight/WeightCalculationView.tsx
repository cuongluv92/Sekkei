"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "@/lib/i18n";
import { PageHeader } from "@/components/common/PageHeader";
import { ProjectSelector } from "@/components/common/ProjectSelector";
import { useCalculationProject } from "@/lib/store/CalculationProjectProvider";
import { BasicWeightCalc } from "@/components/calculation/BasicWeightCalc";
import { PanelWeightCalc } from "@/components/calculation/PanelWeightCalc";

const WEIGHT_TOP_TABS = ["basic", "panel"] as const;
type WeightTopTab = (typeof WEIGHT_TOP_TABS)[number];

function isWeightTopTab(value: string | null): value is WeightTopTab {
  return !!value && (WEIGHT_TOP_TABS as readonly string[]).includes(value);
}

/**
 * 重量計算 top level — 基本重量計算 (アングル/チャンネル/フラットバー) and 盤重量計算 are two
 * separate branches, not a nested sub-section of one another, per the
 * confirmed structure. Tab state lives in the URL (`?tab=`), same pattern
 * as 設計管理's DesignTabBar.
 */
export function WeightCalculationView() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const tab: WeightTopTab = isWeightTopTab(tabParam) ? tabParam : "basic";
  const { projectId, setProjectId } = useCalculationProject();

  function setTab(next: WeightTopTab) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", next);
    router.push(`/calculations/weight?${params.toString()}`);
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t("weightCalc.title")}
        description={t("weightCalc.description")}
      />

      <ProjectSelector projectId={projectId} onProjectChange={setProjectId} />

      <div className="-mx-1 overflow-x-auto px-1">
        <div className="flex w-max min-w-full gap-1 border-b border-border pb-0">
          {WEIGHT_TOP_TABS.map((key) => {
            const isActive = key === tab;
            return (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={
                  isActive
                    ? "shrink-0 whitespace-nowrap border-b-2 border-accent px-3.5 py-2.5 text-[14px] font-bold text-accent"
                    : "shrink-0 whitespace-nowrap border-b-2 border-transparent px-3.5 py-2.5 text-[14px] font-semibold text-muted hover:text-foreground"
                }
              >
                {t(`weightCalc.topTabs.${key}`)}
              </button>
            );
          })}
        </div>
      </div>

      {!projectId ? (
        <div className="panel">
          <div className="panel-body py-12 text-center text-[13px] text-muted-2">
            {t("design.workspaceBar.selectProjectFirst")}
          </div>
        </div>
      ) : tab === "basic" ? (
        <BasicWeightCalc projectId={projectId} />
      ) : (
        <PanelWeightCalc projectId={projectId} />
      )}
    </div>
  );
}
