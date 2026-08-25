"use client";

import { Settings } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { useEffectiveCaseId } from "@/lib/store/ActiveCaseProvider";
import { CaseSelector } from "@/components/common/CaseSelector";
import { Modal } from "@/components/common/Modal";
import { PageHeader } from "@/components/common/PageHeader";
import { SeismicAnchorBoltSettings } from "@/components/settings/SeismicAnchorBoltSettings";
import { FloorMountSeismicView } from "./FloorMountSeismicView";
import { WallMountSeismicView } from "./WallMountSeismicView";

type SeismicTab = "freeStanding" | "wallMounted" | "cubicle";
const TABS: SeismicTab[] = ["freeStanding", "wallMounted", "cubicle"];

/**
 * JSIA-T1018:2012「配電盤類の耐震設計マニュアル」準拠の耐震計算。案件ごとに
 * 保存する (他の 計算 モジュールと同じ — 案件を選ぶ/作るまでは保存できない
 * ことを明示する)。盤形式 (自立形/壁掛形/キュービクル) はタブで分ける —
 * 転倒モーメントの計算式そのものが異なるため。
 */
export function SeismicCalculationView() {
  const { t } = useTranslation();
  const caseId = useEffectiveCaseId(false);
  const [activeTab, setActiveTab] = useState<SeismicTab>("freeStanding");
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t("seismicCalc.title")}
        description={t("seismicCalc.description")}
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
                {t(`seismicCalc.tabs.${tab}`)}
              </button>
            ))}
          </div>
        </div>

        <div className="panel-body">
          {activeTab === "freeStanding" && (
            <FloorMountSeismicView
              caseId={caseId}
              calculationType="seismic-free-standing"
              titleKey="seismicCalc.freeStandingTitle"
              descriptionKey="seismicCalc.freeStandingDescription"
            />
          )}
          {activeTab === "wallMounted" && <WallMountSeismicView caseId={caseId} />}
          {activeTab === "cubicle" && (
            <FloorMountSeismicView
              caseId={caseId}
              calculationType="seismic-cubicle"
              titleKey="seismicCalc.cubicleTitle"
              descriptionKey="seismicCalc.cubicleDescription"
            />
          )}
        </div>
      </div>

      {settingsOpen && (
        <Modal title={t("seismicAnchorBoltSettings.title")} onClose={() => setSettingsOpen(false)} widthClassName="max-w-4xl">
          <SeismicAnchorBoltSettings />
        </Modal>
      )}
    </div>
  );
}
