"use client";

import { Settings } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { earthBarSizeService } from "@/lib/services";
import { PageHeader } from "@/components/common/PageHeader";
import { Modal } from "@/components/common/Modal";
import { EarthBarSizeSettings } from "@/components/settings/EarthBarSizeSettings";
import {
  evaluateEarthBarCandidate,
  findEarthBarCandidates,
  type EarthBarCandidate,
} from "@/lib/calc/earthBar/candidateSearch";
import {
  JIS_C60364_5_54_ADIABATIC_SOURCE,
  JIS_C4620_CUBICLE_EARTH_BUS_SOURCE,
} from "@/lib/calc/earthBar/technicalSource";
import { EarthBarBasisPanel } from "./EarthBarBasisPanel";
import { EarthBarCandidateList } from "./EarthBarCandidateList";
import type { EarthBarSize } from "@/lib/types";

const EARTH_BAR_MODES = ["auto", "manual"] as const;
type EarthBarMode = (typeof EARTH_BAR_MODES)[number];

/** The candidate currently highlighted as 採用 — a purely local UI pick, not persisted anywhere. */
export type AdoptedEarthBar = EarthBarCandidate;

function parsePositiveNumber(raw: string): number | null {
  const n = Number(raw);
  return raw.trim() !== "" && Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * アースバー（盤内接地母線）— a SEPARATE module from 接地線, per spec (never
 * default to AT×0.052 for every case; never compute by summing load
 * current like the main busbar module). 設備種別・接地工事種別・
 * 事故電流/遮断時間（記録用）→ 自動選定 or 手動検証. A stateless calculator like
 * every other 電気技術計算 tool — no 案件 selection, no save/persistence.
 * No verified short-circuit-withstand (短絡耐量) source/k-value table is
 * available in this environment (see technicalSource.ts), so every
 * candidate here shows real geometry only (A = t × W × n) with judgment
 * always "requiresVerification"／短絡耐量：未検証 — the same honest-fallback
 * shape already used for 母線銅帯's >630A path, never a fabricated OK/NG
 * (spec #19, #26-28, #37). 事故電流/遮断時間 have no existing source in this
 * app (no ブレーカー module yet) so they start blank and are recorded only
 * for traceability, never used to compute a fabricated required area.
 */
export function EarthBarCalculationView() {
  const { t } = useTranslation();
  const [mode, setMode] = useState<EarthBarMode>("auto");
  const [sizes, setSizes] = useState<EarthBarSize[]>([]);
  const [sizesLoaded, setSizesLoaded] = useState(false);
  const [equipmentTypeRaw, setEquipmentTypeRaw] = useState("");
  const [groundingTypeRaw, setGroundingTypeRaw] = useState("");
  const [faultCurrentRaw, setFaultCurrentRaw] = useState("");
  const [clearingTimeRaw, setClearingTimeRaw] = useState("");
  const [thicknessRaw, setThicknessRaw] = useState("");
  const [widthRaw, setWidthRaw] = useState("");
  const [barsRaw, setBarsRaw] = useState("1");
  const [adopted, setAdopted] = useState<AdoptedEarthBar | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    earthBarSizeService.list().then((list) => {
      setSizes(list);
      setSizesLoaded(true);
    });
  }, []);

  const faultCurrentKA = parsePositiveNumber(faultCurrentRaw);
  const clearingTimeS = parsePositiveNumber(clearingTimeRaw);

  const candidates = useMemo(() => {
    if (mode !== "auto" || !sizesLoaded) return [];
    return findEarthBarCandidates(sizes, faultCurrentKA, clearingTimeS);
  }, [mode, sizes, sizesLoaded, faultCurrentKA, clearingTimeS]);

  const manualThickness = parsePositiveNumber(thicknessRaw);
  const manualWidth = parsePositiveNumber(widthRaw);
  const manualBars = Math.max(1, parseInt(barsRaw, 10) || 1);

  const manualCandidate = useMemo(() => {
    if (manualThickness === null || manualWidth === null) return null;
    return evaluateEarthBarCandidate(
      { id: "manual", thicknessMm: manualThickness, widthMm: manualWidth },
      manualBars,
      faultCurrentKA,
      clearingTimeS,
    );
  }, [manualThickness, manualWidth, manualBars, faultCurrentKA, clearingTimeS]);

  function handleAdopt(candidate: EarthBarCandidate) {
    setAdopted(candidate);
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t("earthBarCalc.title")}
        description={t("earthBarCalc.description")}
        actions={
          <button onClick={() => setSettingsOpen(true)} className="btn-secondary">
            <Settings className="h-3.5 w-3.5" />
            {t("common.settings")}
          </button>
        }
      />

      <div className="calc-layout">
        <div className="calc-layout-input panel">
          <div className="panel-header">
            <span className="panel-title">
              {t("earthBarCalc.inputSectionTitle")}
            </span>
          </div>
          <div className="panel-body flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-2.5 sm:max-w-[440px] sm:grid-cols-4">
              <div>
                <label htmlFor="earth-bar-equipment-type" className="field-label">
                  {t("earthBarCalc.equipmentTypeLabel")}
                </label>
                <select
                  id="earth-bar-equipment-type"
                  value={equipmentTypeRaw}
                  onChange={(e) => setEquipmentTypeRaw(e.target.value)}
                  className="field-input"
                >
                  <option value="">—</option>
                  <option value="cabinet">
                    {t("earthBarCalc.equipmentTypeCabinet")}
                  </option>
                  <option value="cubicle">
                    {t("earthBarCalc.equipmentTypeCubicle")}
                  </option>
                  <option value="other">{t("earthBarCalc.equipmentTypeOther")}</option>
                </select>
              </div>
              <div>
                <label htmlFor="earth-bar-grounding-type" className="field-label">
                  {t("earthBarCalc.groundingTypeLabel")}
                </label>
                <select
                  id="earth-bar-grounding-type"
                  value={groundingTypeRaw}
                  onChange={(e) => setGroundingTypeRaw(e.target.value)}
                  className="field-input"
                >
                  <option value="">—</option>
                  <option value="A">A種</option>
                  <option value="B">B種</option>
                  <option value="C">C種</option>
                  <option value="D">D種</option>
                </select>
              </div>
              <div>
                <label className="field-label">
                  {t("earthBarCalc.faultCurrentLabel")}
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={faultCurrentRaw}
                  onChange={(e) => setFaultCurrentRaw(e.target.value)}
                  placeholder="31.5"
                  className="field-input"
                />
              </div>
              <div>
                <label className="field-label">
                  {t("earthBarCalc.clearingTimeLabel")}
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={clearingTimeRaw}
                  onChange={(e) => setClearingTimeRaw(e.target.value)}
                  placeholder="0.5"
                  className="field-input"
                />
              </div>
            </div>

            <div className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2.5">
              <p className="text-[12px] text-warning">
                {t("earthBarCalc.requiresVerificationNotice")}
              </p>
            </div>
          </div>
        </div>

        <div className="calc-layout-basis panel">
          <div className="panel-header">
            <span className="panel-title">
              {t("earthBarCalc.basisSectionTitle")}
            </span>
          </div>
          <div className="panel-body">
            <EarthBarBasisPanel
              sources={[
                JIS_C60364_5_54_ADIABATIC_SOURCE,
                JIS_C4620_CUBICLE_EARTH_BUS_SOURCE,
              ]}
            />
          </div>
        </div>

        <div className="calc-layout-results flex flex-col gap-4">
          <div className="-mx-1 overflow-x-auto px-1">
            <div className="flex w-max min-w-full gap-1 border-b border-border pb-0">
              {EARTH_BAR_MODES.map((key) => {
                const isActive = key === mode;
                return (
                  <button
                    key={key}
                    onClick={() => setMode(key)}
                    className={
                      isActive
                        ? "shrink-0 whitespace-nowrap border-b-2 border-accent px-3.5 py-2.5 text-[14px] font-bold text-accent"
                        : "shrink-0 whitespace-nowrap border-b-2 border-transparent px-3.5 py-2.5 text-[14px] font-semibold text-muted hover:text-foreground"
                    }
                  >
                    {t(`earthBarCalc.mode${key === "auto" ? "Auto" : "Manual"}`)}
                  </button>
                );
              })}
            </div>
          </div>

          {mode === "auto" ? (
            <div className="panel">
              <div className="panel-header">
                <span className="panel-title">
                  {t("earthBarCalc.candidatesTitle")}
                </span>
              </div>
              <div className="panel-body">
                {!sizesLoaded ? (
                  <p className="text-[12px] text-muted">{t("common.loading")}</p>
                ) : sizes.length === 0 ? (
                  <p className="text-[12px] text-warning">
                    {t("earthBarCalc.noSizesConfigured")}
                  </p>
                ) : (
                  <EarthBarCandidateList
                    candidates={candidates}
                    adopted={adopted}
                    onAdopt={handleAdopt}
                    saving={false}
                  />
                )}
              </div>
            </div>
          ) : (
            <div className="panel">
              <div className="panel-header">
                <span className="panel-title">{t("earthBarCalc.modeManual")}</span>
              </div>
              <div className="panel-body flex flex-col gap-3.5">
                <p className="text-[12px] text-muted">
                  {t("earthBarCalc.manualHint")}
                </p>
                <div className="grid grid-cols-3 gap-2.5 sm:max-w-[380px]">
                  <div>
                    <label className="field-label">
                      {t("earthBarCalc.thicknessLabel")}
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={thicknessRaw}
                      onChange={(e) => setThicknessRaw(e.target.value)}
                      placeholder="3"
                      className="field-input"
                    />
                  </div>
                  <div>
                    <label className="field-label">
                      {t("earthBarCalc.widthLabel")}
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={widthRaw}
                      onChange={(e) => setWidthRaw(e.target.value)}
                      placeholder="25"
                      className="field-input"
                    />
                  </div>
                  <div>
                    <label className="field-label">
                      {t("earthBarCalc.barsLabel")}
                    </label>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      value={barsRaw}
                      onChange={(e) => setBarsRaw(e.target.value)}
                      className="field-input"
                    />
                  </div>
                </div>

                {manualCandidate && (
                  <EarthBarCandidateList
                    candidates={[manualCandidate]}
                    adopted={adopted}
                    onAdopt={handleAdopt}
                    saving={false}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {settingsOpen && (
        <Modal
          title={t("earthBarSizeSettings.title")}
          onClose={() => setSettingsOpen(false)}
          widthClassName="max-w-2xl"
        >
          <EarthBarSizeSettings />
        </Modal>
      )}
    </div>
  );
}
