"use client";

import { Settings } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { useEffectiveCaseId } from "@/lib/store/ActiveCaseProvider";
import { CaseSelector } from "@/components/common/CaseSelector";
import { Modal } from "@/components/common/Modal";
import { PageHeader } from "@/components/common/PageHeader";
import { VentilationClimateSettings } from "@/components/settings/VentilationClimateSettings";
import { OutdoorVentilationView } from "./OutdoorVentilationView";
import { IndoorVentilationView } from "./IndoorVentilationView";

type VentilationTab = "outdoor" | "indoor";
const TABS: VentilationTab[] = ["outdoor", "indoor"];

/**
 * JSIA-T1016:2019「配電盤類の換気計算」準拠の換気計算。案件ごとに保存する
 * (他の 計算 モジュールと同じ — 案件を選ぶ/作るまでは保存できないことを
 * 明示する)。屋外/屋内キュービクルはタブで分ける — 屋外は方位別の日射
 * (相当外気温度) を考慮するため、熱貫流の計算式そのものが異なる。
 */
export function VentilationCalculationView() {
  const { t } = useTranslation();
  const caseId = useEffectiveCaseId(false);
  const [activeTab, setActiveTab] = useState<VentilationTab>("outdoor");
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t("ventilationCalc.title")}
        description={t("ventilationCalc.description")}
        actions={
          <button onClick={() => setSettingsOpen(true)} className="btn-secondary">
            <Settings className="h-3.5 w-3.5" />
            {t("common.settings")}
          </button>
        }
      />

      <CaseSelector suppress={false} />
      {!caseId && <p className="text-[11px] text-warning">{t("caseSelector.draftNote")}</p>}

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
                {t(`ventilationCalc.tabs.${tab}`)}
              </button>
            ))}
          </div>
        </div>

        <div className="panel-body">
          {activeTab === "outdoor" && <OutdoorVentilationView caseId={caseId} />}
          {activeTab === "indoor" && <IndoorVentilationView caseId={caseId} />}
        </div>
      </div>

      {settingsOpen && (
        <Modal title={t("ventilationClimateSettings.title")} onClose={() => setSettingsOpen(false)} widthClassName="max-w-6xl">
          <VentilationClimateSettings />
        </Modal>
      )}
    </div>
  );
}
