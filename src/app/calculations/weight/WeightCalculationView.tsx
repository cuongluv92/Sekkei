"use client";

import { Settings } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "@/lib/i18n";
import { PageHeader } from "@/components/common/PageHeader";
import { CaseSelector } from "@/components/common/CaseSelector";
import { Modal } from "@/components/common/Modal";
import { WeightMaterialSettings } from "@/components/settings/WeightMaterialSettings";
import { useActiveCase, useEffectiveCaseId } from "@/lib/store/ActiveCaseProvider";
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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const {
    caseId: activeCaseId,
    setCaseId: setActiveCaseId,
    loading: caseLoading,
  } = useActiveCase();
  // This screen must never silently show whatever 案件 was left active
  // elsewhere — opening it always starts at 案件選択 until the user
  // genuinely picks one here (see useEffectiveCaseId). An explicit
  // `?case=` deep link (e.g. Global Search's 計算 result) always wins over
  // that, exactly like DesignView.
  //
  // 盤重量計算 (tab === "panel") is a trial exception: it must be usable the
  // instant the page opens, with no forced 案件選択 first — so it does NOT
  // suppress the already-active 案件 (still overridable via `?case=` or the
  // compact CaseSelector), and stays usable even with caseId === "" (see
  // PanelBodyWeightCalc's own localStorage-draft mode below).
  const effectiveActiveCaseId = useEffectiveCaseId(tab !== "panel");
  const caseIdParam = searchParams.get("case") ?? "";
  const caseId = caseIdParam || effectiveActiveCaseId;

  // Broadcast the effective 案件 (URL-provided or a genuine pick here) up
  // to the app-wide active 案件 so it's what other modules resume.
  useEffect(() => {
    if (caseId && caseId !== activeCaseId) setActiveCaseId(caseId);
  }, [caseId, activeCaseId, setActiveCaseId]);

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
        actions={
          <button
            onClick={() => setSettingsOpen(true)}
            className="btn-secondary"
          >
            <Settings className="h-3.5 w-3.5" />
            {t("common.settings")}
          </button>
        }
      />

      <CaseSelector suppress={tab !== "panel"} />

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

      {caseLoading ? (
        <div className="panel">
          <div className="panel-body py-12 text-center text-[13px] text-muted-2">
            {t("common.loading")}
          </div>
        </div>
      ) : tab === "basic" && !caseId ? (
        <div className="panel">
          <div className="panel-body py-12 text-center text-[13px] text-muted-2">
            {t("caseSelector.selectCaseFirst")}
          </div>
        </div>
      ) : tab === "basic" ? (
        <BasicWeightCalc caseId={caseId} />
      ) : (
        // 盤重量計算 は 案件 未選択でも即使える (trial) — caseId === "" のときは
        // PanelBodyWeightCalc 側がローカル下書きモードで動作する。
        <PanelWeightCalc caseId={caseId} />
      )}

      {settingsOpen && (
        <Modal
          title={t("common.settings")}
          onClose={() => setSettingsOpen(false)}
          widthClassName="max-w-2xl"
        >
          <WeightMaterialSettings />
        </Modal>
      )}
    </div>
  );
}
