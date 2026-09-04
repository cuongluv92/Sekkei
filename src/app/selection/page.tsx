"use client";

import { Settings } from "lucide-react";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslation } from "@/lib/i18n";
import { useEffectiveCaseId } from "@/lib/store/ActiveCaseProvider";
import { CaseSelector } from "@/components/common/CaseSelector";
import { Modal } from "@/components/common/Modal";
import { PageHeader } from "@/components/common/PageHeader";
import { LegacySelectionView } from "@/components/selection/LegacySelectionView";
import { WireConductorSelectionView } from "@/components/selection/WireConductorSelectionView";
import { FlexibleMotorBranchSelectionView } from "@/components/selection/FlexibleMotorBranchSelectionView";
import { WireConductorSelectionSettings } from "@/components/settings/WireConductorSelectionSettings";
import { FlexibleMotorSelectionSettings } from "@/components/settings/FlexibleMotorSelectionSettings";

type SelectionTab = "branch" | "main" | "highVoltage" | "legacy";
const TABS: SelectionTab[] = ["branch", "main", "highVoltage", "legacy"];

function SelectionPageView() {
  const { t, locale } = useTranslation();
  const searchParams = useSearchParams();
  const effectiveActiveCaseId = useEffectiveCaseId(false);
  const caseIdParam = searchParams.get("case") ?? "";
  const caseId = caseIdParam || effectiveActiveCaseId;
  const [activeTab, setActiveTab] = useState<SelectionTab>("branch");
  const [settingsOpen, setSettingsOpen] = useState(false);

  const needsCase = activeTab === "branch";
  const wireTabLabel = locale === "vi" ? "Dây dẫn & thanh đồng" : "電線・銅帯選定";
  const motorSettingsLabel = locale === "vi" ? "Thiết kế chọn kW/A dạng xương cá" : "kW/A xương cá選定デザイナー";

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t("selection.title")}
        description={t("selection.description")}
        actions={
          <button onClick={() => setSettingsOpen(true)} className="btn-secondary">
            <Settings className="h-3.5 w-3.5" />
            {t("common.settings")}
          </button>
        }
      />

      <div className="panel">
        <div className="panel-header">
          <div className="flex items-center gap-1">
            {TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={
                  activeTab === tab
                    ? "rounded-md bg-accent px-3 py-1.5 text-[12.5px] font-bold text-accent-foreground"
                    : "rounded-md px-3 py-1.5 text-[12.5px] font-semibold text-muted hover:text-foreground"
                }
              >
                {tab === "main" ? wireTabLabel : t(`motorSelection.tabs.${tab}`)}
              </button>
            ))}
          </div>
        </div>

        <div className="panel-body flex flex-col gap-4">
          {needsCase && (
            <>
              <CaseSelector suppress={false} />
              {!caseId && <p className="text-[11px] text-warning">{t("caseSelector.draftNote")}</p>}
            </>
          )}

          {activeTab === "branch" && <FlexibleMotorBranchSelectionView caseId={caseId} />}
          {activeTab === "main" && <WireConductorSelectionView caseId={caseId} />}
          {activeTab === "highVoltage" && (
            <div className="py-12 text-center text-[13px] text-muted-2">{t("motorSelection.highVoltagePlaceholder")}</div>
          )}
          {activeTab === "legacy" && <LegacySelectionView />}
        </div>
      </div>

      {settingsOpen && (
        <Modal title={t("common.settings")} onClose={() => setSettingsOpen(false)} widthClassName="max-w-7xl">
          <div className="flex flex-col gap-7">
            <div className="flex flex-col gap-2">
              <span className="panel-title">{motorSettingsLabel}</span>
              <FlexibleMotorSelectionSettings />
            </div>
            <div className="flex flex-col gap-2 border-t border-border pt-6">
              <span className="panel-title">{wireTabLabel}</span>
              <WireConductorSelectionSettings />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default function SelectionPage() {
  return (
    <Suspense fallback={null}>
      <SelectionPageView />
    </Suspense>
  );
}
