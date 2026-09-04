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
import { MotorBranchSelectionView } from "@/components/selection/MotorBranchSelectionView";
import { WireConductorSelectionSettings } from "@/components/settings/WireConductorSelectionSettings";
import { MotorStarterSelectionSettings } from "@/components/settings/MotorStarterSelectionSettings";

type SelectionTab = "branch" | "main" | "highVoltage" | "legacy";
const TABS: SelectionTab[] = ["branch", "main", "highVoltage", "legacy"];

function SelectionPageView() {
  const { t, locale } = useTranslation();
  const searchParams = useSearchParams();
  // 部品製作 と同じパターン: ?case= の明示的なディープリンクがアプリ全体の
  // アクティブ案件より優先される。
  const effectiveActiveCaseId = useEffectiveCaseId(false);
  const caseIdParam = searchParams.get("case") ?? "";
  const caseId = caseIdParam || effectiveActiveCaseId;
  const [activeTab, setActiveTab] = useState<SelectionTab>("branch");
  const [settingsOpen, setSettingsOpen] = useState(false);

  // 電線・銅帯はAを直接入力して単独でも使える。案件がある場合だけ分岐合計を補助表示する。
  const needsCase = activeTab === "branch";
  const wireTabLabel = locale === "vi" ? "Dây dẫn & thanh đồng" : "電線・銅帯選定";

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

          {activeTab === "branch" && <MotorBranchSelectionView caseId={caseId} />}
          {activeTab === "main" && <WireConductorSelectionView caseId={caseId} />}
          {activeTab === "highVoltage" && (
            <div className="py-12 text-center text-[13px] text-muted-2">{t("motorSelection.highVoltagePlaceholder")}</div>
          )}
          {activeTab === "legacy" && <LegacySelectionView />}
        </div>
      </div>

      {settingsOpen && (
        <Modal title={t("common.settings")} onClose={() => setSettingsOpen(false)} widthClassName="max-w-6xl">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <span className="panel-title">{t("motorStarterSelectionSettings.title")}</span>
              <MotorStarterSelectionSettings />
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
