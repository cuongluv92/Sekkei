"use client";

import { Settings } from "lucide-react";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "@/lib/i18n";
import { useActiveCase } from "@/lib/store/ActiveCaseProvider";
import { BusbarCalculationView } from "@/components/calculation/busbar/BusbarCalculationView";
import { EarthWireCalculationView } from "@/components/calculation/earthWire/EarthWireCalculationView";
import { EarthBarCalculationView } from "@/components/calculation/earthBar/EarthBarCalculationView";
import { SavedCasesList } from "@/components/common/SavedCasesList";
import { Modal } from "@/components/common/Modal";
import { PageHeader } from "@/components/common/PageHeader";
import { BusbarSizeSettings } from "@/components/settings/BusbarSizeSettings";
import { EarthWireSizeSettings } from "@/components/settings/EarthWireSizeSettings";
import { EarthBarSizeSettings } from "@/components/settings/EarthBarSizeSettings";

const BASE_PATH = "/calculations/other";

/**
 * 他計算 — a single hub tab bar hosting 母線銅帯/接地線/アースバー (each a real,
 * standard-backed bespoke module — see `basePath` prop on their View
 * components) plus 保存済み (browse/reopen/edit any past 案件, the same list
 * `SavedCasesModal` uses, embedded inline instead of behind a popup button).
 * Consolidated here per explicit request — these 3 calc modules no longer
 * have their own sidebar entries (see `nav.ts`); their dedicated routes
 * (`/calculations/busbar` etc.) now just redirect here.
 */
const MODULE_KEYS = ["busbar", "earth-wire", "earth-bar", "saved"] as const;
type ModuleKey = (typeof MODULE_KEYS)[number];

function isModuleKey(value: string | null): value is ModuleKey {
  return !!value && (MODULE_KEYS as readonly string[]).includes(value);
}

const MODULE_LABEL_KEYS: Record<ModuleKey, string> = {
  busbar: "nav.busbarCalc",
  "earth-wire": "nav.earthWireCalc",
  "earth-bar": "nav.earthBarCalc",
  saved: "otherCalc.savedTab",
};

const MODULE_SETTINGS_TITLE_KEYS: Partial<Record<ModuleKey, string>> = {
  busbar: "busbarSizeSettings.title",
  "earth-wire": "earthWireSizeSettings.title",
  "earth-bar": "earthBarSizeSettings.title",
};

function OtherCalculationContent() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setCaseId } = useActiveCase();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const moduleParam = searchParams.get("module");
  const activeModule: ModuleKey = isModuleKey(moduleParam)
    ? moduleParam
    : "busbar";

  function setActiveModule(next: ModuleKey) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("module", next);
    // Switching module resets that module's own mode tab (自動選定/手動検証)
    // to its default rather than carrying over an unrelated module's state.
    params.delete("mode");
    router.push(`${BASE_PATH}?${params.toString()}`);
  }

  /** 保存済み タブの開く — sets the 案件 active app-wide, then jumps straight to 母線銅帯 so the user immediately sees that 案件's calculations, satisfying "xem lại/sửa chữa" (view/edit) in one click rather than leaving them on a bare list. */
  function handleOpenSavedCase(caseId: string) {
    setCaseId(caseId);
    const params = new URLSearchParams();
    params.set("module", "busbar");
    router.push(`${BASE_PATH}?${params.toString()}`);
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t("otherCalc.title")}
        description={t("otherCalc.description")}
        actions={
          activeModule !== "saved" && (
            <button
              onClick={() => setSettingsOpen(true)}
              className="btn-secondary"
            >
              <Settings className="h-3.5 w-3.5" />
              {t("common.settings")}
            </button>
          )
        }
      />

      <div className="-mx-1 overflow-x-auto px-1">
        <div className="flex w-max min-w-full gap-1 border-b border-border pb-0">
          {MODULE_KEYS.map((key) => {
            const isActive = key === activeModule;
            return (
              <button
                key={key}
                onClick={() => setActiveModule(key)}
                className={
                  isActive
                    ? "shrink-0 whitespace-nowrap border-b-2 border-accent px-3.5 py-2.5 text-[14px] font-bold text-accent"
                    : "shrink-0 whitespace-nowrap border-b-2 border-transparent px-3.5 py-2.5 text-[14px] font-semibold text-muted hover:text-foreground"
                }
              >
                {t(MODULE_LABEL_KEYS[key])}
              </button>
            );
          })}
        </div>
      </div>

      {activeModule === "busbar" && (
        <BusbarCalculationView basePath={BASE_PATH} />
      )}
      {activeModule === "earth-wire" && (
        <EarthWireCalculationView basePath={BASE_PATH} />
      )}
      {activeModule === "earth-bar" && (
        <EarthBarCalculationView basePath={BASE_PATH} />
      )}
      {activeModule === "saved" && (
        <div className="panel">
          <div className="panel-header">
            <span className="panel-title">{t("otherCalc.savedTab")}</span>
          </div>
          <div className="panel-body">
            <SavedCasesList onOpen={handleOpenSavedCase} />
          </div>
        </div>
      )}

      {settingsOpen && activeModule !== "saved" && (
        <Modal
          title={t(MODULE_SETTINGS_TITLE_KEYS[activeModule] ?? "common.settings")}
          onClose={() => setSettingsOpen(false)}
          widthClassName="max-w-2xl"
        >
          {activeModule === "busbar" && <BusbarSizeSettings />}
          {activeModule === "earth-wire" && <EarthWireSizeSettings />}
          {activeModule === "earth-bar" && <EarthBarSizeSettings />}
        </Modal>
      )}
    </div>
  );
}

export default function OtherCalculationPage() {
  return (
    <Suspense fallback={null}>
      <OtherCalculationContent />
    </Suspense>
  );
}
