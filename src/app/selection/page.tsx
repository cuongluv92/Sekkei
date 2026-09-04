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
import { MotorKwSelectionView } from "@/components/selection/MotorKwSelectionView";
import { GroundingSelectionView } from "@/components/selection/GroundingSelectionView";
import { TerminalBlockSelectionView } from "@/components/selection/TerminalBlockSelectionView";
import { WireConductorSelectionSettings } from "@/components/settings/WireConductorSelectionSettings";
import { MotorKwSelectionSettings } from "@/components/settings/MotorKwSelectionSettings";
import { BusbarSizeSettings } from "@/components/settings/BusbarSizeSettings";
import { EarthWireSizeSettings } from "@/components/settings/EarthWireSizeSettings";
import { EarthBarSizeSettings } from "@/components/settings/EarthBarSizeSettings";
import { TerminalBlockSelectionSettings } from "@/components/settings/TerminalBlockSelectionSettings";

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
  const [mainCurrentRaw, setMainCurrentRaw] = useState("");

  const mainCurrentNumber = Number(mainCurrentRaw);
  const mainCurrent =
    mainCurrentRaw.trim() !== "" && Number.isFinite(mainCurrentNumber) && mainCurrentNumber > 0
      ? mainCurrentNumber
      : null;

  const needsCase = activeTab === "branch";
  const hasSettings = activeTab === "branch" || activeTab === "main";

  const labels = locale === "vi"
    ? {
        main: "Dây dẫn・Thanh đồng・TB",
        branchSettings: "Tiêu chuẩn công ty chọn theo kW",
        mainSettings: "Cài đặt dây dẫn・thanh đồng・tiếp địa・TB",
        wire: "Dây dẫn・Thanh đồng",
        earth: "Tiếp địa",
        terminal: "TB (CT / PT)",
        commonCurrent: "Dòng điện chọn chung (A)",
        commonHint: "Chỉ nhập A một lần. IV, WL1, thanh đồng, dây tiếp địa và TB CT/PT sẽ cập nhật đồng thời.",
      }
    : {
        main: "電線・銅帯・TB",
        branchSettings: "kW選定 社内基準",
        mainSettings: "電線・銅帯・接地・TB 選定設定",
        wire: "電線・銅帯",
        earth: "接地線・アースバー",
        terminal: "TB（CT / PT）",
        commonCurrent: "共通選定電流 (A)",
        commonHint: "Aはここに1回入力するだけです。IV・WL1・銅帯・接地線・TB（CT/PT）が同時に更新されます。",
      };

  function tabLabel(tab: SelectionTab): string {
    if (tab === "main") return labels.main;
    return t(`motorSelection.tabs.${tab}`);
  }

  function settingsTitle(): string {
    if (activeTab === "branch") return labels.branchSettings;
    if (activeTab === "main") return labels.mainSettings;
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

          {activeTab === "branch" && <MotorKwSelectionView caseId={caseId} />}
          {activeTab === "main" && (
            <div className="flex flex-col gap-5">
              <section className="rounded-xl border border-accent/30 bg-accent/5 p-4">
                <div className="grid gap-2 md:grid-cols-[minmax(220px,360px)_1fr] md:items-end">
                  <label>
                    <span className="field-label">{labels.commonCurrent}</span>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={mainCurrentRaw}
                      onChange={(e) => setMainCurrentRaw(e.target.value)}
                      placeholder="例）150"
                      className="field-input text-[16px] font-mono font-semibold"
                    />
                  </label>
                  <p className="pb-2 text-[11px] text-muted">{labels.commonHint}</p>
                </div>
              </section>

              <section className="rounded-xl border border-border bg-background/40 p-4">
                <div className="mb-3 text-[13px] font-bold text-foreground">{labels.wire}</div>
                <WireConductorSelectionView caseId={caseId} currentA={mainCurrent} hideInput />
              </section>

              <section className="rounded-xl border border-border bg-background/40 p-4">
                <div className="mb-3 text-[13px] font-bold text-foreground">{labels.earth}</div>
                <GroundingSelectionView currentA={mainCurrent} hideCurrentInput />
              </section>

              <section className="rounded-xl border border-border bg-background/40 p-4">
                <div className="mb-3 text-[13px] font-bold text-foreground">{labels.terminal}</div>
                <TerminalBlockSelectionView currentA={mainCurrent} hideInput />
              </section>
            </div>
          )}
          {activeTab === "highVoltage" && (
            <div className="py-12 text-center text-[13px] text-muted-2">{t("motorSelection.highVoltagePlaceholder")}</div>
          )}
          {activeTab === "legacy" && <LegacySelectionView />}
        </div>
      </div>

      {settingsOpen && hasSettings && (
        <Modal title={settingsTitle()} onClose={() => setSettingsOpen(false)} widthClassName="max-w-7xl">
          {activeTab === "branch" && <MotorKwSelectionSettings />}
          {activeTab === "main" && (
            <div className="flex flex-col gap-7">
              <section>
                <div className="mb-3 panel-title">{labels.wire}</div>
                <div className="flex flex-col gap-6">
                  <WireConductorSelectionSettings />
                  <div className="border-t border-border pt-5"><BusbarSizeSettings /></div>
                </div>
              </section>

              <section className="border-t border-border pt-6">
                <div className="mb-3 panel-title">{labels.earth}</div>
                <div className="flex flex-col gap-6">
                  <EarthWireSizeSettings />
                  <div className="border-t border-border pt-5"><EarthBarSizeSettings /></div>
                </div>
              </section>

              <section className="border-t border-border pt-6">
                <div className="mb-3 panel-title">{labels.terminal}</div>
                <TerminalBlockSelectionSettings />
              </section>
            </div>
          )}
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
