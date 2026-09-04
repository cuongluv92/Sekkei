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
import { GroundingSelectionView } from "@/components/selection/GroundingSelectionView";
import { TerminalBlockSelectionView } from "@/components/selection/TerminalBlockSelectionView";
import { WireConductorSelectionSettings } from "@/components/settings/WireConductorSelectionSettings";
import { FlexibleMotorSelectionSettings } from "@/components/settings/FlexibleMotorSelectionSettings";
import { BusbarSizeSettings } from "@/components/settings/BusbarSizeSettings";
import { EarthWireSizeSettings } from "@/components/settings/EarthWireSizeSettings";
import { EarthBarSizeSettings } from "@/components/settings/EarthBarSizeSettings";
import { TerminalBlockSelectionSettings } from "@/components/settings/TerminalBlockSelectionSettings";

type SelectionTab = "branch" | "main" | "earth" | "terminal" | "highVoltage" | "legacy";
const TABS: SelectionTab[] = ["branch", "main", "earth", "terminal", "highVoltage", "legacy"];

function SelectionPageView() {
  const { t, locale } = useTranslation();
  const searchParams = useSearchParams();
  const effectiveActiveCaseId = useEffectiveCaseId(false);
  const caseIdParam = searchParams.get("case") ?? "";
  const caseId = caseIdParam || effectiveActiveCaseId;
  const [activeTab, setActiveTab] = useState<SelectionTab>("branch");
  const [settingsOpen, setSettingsOpen] = useState(false);

  const needsCase = activeTab === "branch";
  const hasSettings = activeTab === "branch" || activeTab === "main" || activeTab === "earth" || activeTab === "terminal";

  const labels = locale === "vi"
    ? {
        wire: "Dây dẫn & thanh đồng",
        earth: "Tiếp địa",
        terminal: "TB",
        branchSettings: "Cài đặt chọn kW/A",
        wireSettings: "Cài đặt dây dẫn & thanh đồng",
        earthSettings: "Cài đặt tiếp địa",
        terminalSettings: "Cài đặt TB",
      }
    : {
        wire: "電線・銅帯",
        earth: "接地線・アースバー",
        terminal: "TB",
        branchSettings: "kW/A選定設定",
        wireSettings: "電線・銅帯選定設定",
        earthSettings: "接地線・アースバー選定設定",
        terminalSettings: "TB選定設定",
      };

  function tabLabel(tab: SelectionTab): string {
    if (tab === "main") return labels.wire;
    if (tab === "earth") return labels.earth;
    if (tab === "terminal") return labels.terminal;
    return t(`motorSelection.tabs.${tab}`);
  }

  function settingsTitle(): string {
    if (activeTab === "branch") return labels.branchSettings;
    if (activeTab === "main") return labels.wireSettings;
    if (activeTab === "earth") return labels.earthSettings;
    if (activeTab === "terminal") return labels.terminalSettings;
    return t("common.settings");
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t("selection.title")}
        description={t("selection.description")}
        actions={
          hasSettings ? (
            <button onClick={() => setSettingsOpen(true)} className="btn-secondary">
              <Settings className="h-3.5 w-3.5" />
              {t("common.settings")}
            </button>
          ) : undefined
        }
      />

      <div className="panel">
        <div className="panel-header overflow-x-auto">
          <div className="flex min-w-max items-center gap-1">
            {TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => {
                  setActiveTab(tab);
                  setSettingsOpen(false);
                }}
                className={
                  activeTab === tab
                    ? "rounded-md bg-accent px-3 py-1.5 text-[12.5px] font-bold text-accent-foreground"
                    : "rounded-md px-3 py-1.5 text-[12.5px] font-semibold text-muted hover:text-foreground"
                }
              >
                {tabLabel(tab)}
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
          {activeTab === "earth" && <GroundingSelectionView />}
          {activeTab === "terminal" && <TerminalBlockSelectionView />}
          {activeTab === "highVoltage" && (
            <div className="py-12 text-center text-[13px] text-muted-2">{t("motorSelection.highVoltagePlaceholder")}</div>
          )}
          {activeTab === "legacy" && <LegacySelectionView />}
        </div>
      </div>

      {settingsOpen && hasSettings && (
        <Modal title={settingsTitle()} onClose={() => setSettingsOpen(false)} widthClassName="max-w-7xl">
          {activeTab === "branch" && <FlexibleMotorSelectionSettings />}
          {activeTab === "main" && (
            <div className="flex flex-col gap-7">
              <WireConductorSelectionSettings />
              <div className="border-t border-border pt-6"><BusbarSizeSettings /></div>
            </div>
          )}
          {activeTab === "earth" && (
            <div className="flex flex-col gap-7">
              <EarthWireSizeSettings />
              <div className="border-t border-border pt-6"><EarthBarSizeSettings /></div>
            </div>
          )}
          {activeTab === "terminal" && <TerminalBlockSelectionSettings />}
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
