"use client";

import { Settings } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { earthWireSizeService } from "@/lib/services";
import { PageHeader } from "@/components/common/PageHeader";
import { Modal } from "@/components/common/Modal";
import { EarthWireSizeSettings } from "@/components/settings/EarthWireSizeSettings";
import {
  evaluateEarthWireCandidate,
  findEarthWireCandidates,
  type EarthWireCandidate,
} from "@/lib/calc/earthWire/candidateSearch";
import { requiredEarthWireCrossSection } from "@/lib/calc/earthWire/requiredCrossSection";
import type { GroundingType } from "@/lib/calc/earthWire/technicalSource";
import { EarthWireBasisPanel } from "./EarthWireBasisPanel";
import { EarthWireCandidateList } from "./EarthWireCandidateList";
import type { EarthWireSize } from "@/lib/types";

const EARTH_WIRE_MODES = ["auto", "manual"] as const;
type EarthWireMode = (typeof EARTH_WIRE_MODES)[number];

const GROUNDING_TYPES: GroundingType[] = ["A", "B", "C", "D"];

function isGroundingType(value: string): value is GroundingType {
  return (GROUNDING_TYPES as readonly string[]).includes(value);
}

/** The candidate currently highlighted as 採用 — a purely local UI pick, not persisted anywhere. */
export type AdoptedEarthWire = EarthWireCandidate;

function parsePositiveNumber(raw: string): number | null {
  const n = Number(raw);
  return raw.trim() !== "" && Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * 接地線 — 接地工事種別・定格電流 In → 必要断面積（0.052×In, C種/D種のみ）→
 * 自動選定 or 手動検証. A stateless calculator like every other 電気技術計算 tool
 * (V/I/A/U etc.) — no 案件 selection, no save/persistence; typing a value
 * shows the result immediately and nothing is kept once you navigate away.
 */
export function EarthWireCalculationView() {
  const { t } = useTranslation();
  const [mode, setMode] = useState<EarthWireMode>("auto");
  const [sizes, setSizes] = useState<EarthWireSize[]>([]);
  const [sizesLoaded, setSizesLoaded] = useState(false);
  const [ratedCurrentRaw, setRatedCurrentRaw] = useState("");
  const [groundingTypeRaw, setGroundingTypeRaw] = useState("");
  const [manualSizeId, setManualSizeId] = useState("");
  const [adopted, setAdopted] = useState<AdoptedEarthWire | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    earthWireSizeService.list().then((list) => {
      setSizes(list);
      setSizesLoaded(true);
    });
  }, []);

  const ratedCurrentA = parsePositiveNumber(ratedCurrentRaw);
  const groundingType = isGroundingType(groundingTypeRaw)
    ? groundingTypeRaw
    : null;

  const requiredResult = useMemo(() => {
    if (ratedCurrentA === null || groundingType === null) return null;
    return requiredEarthWireCrossSection(ratedCurrentA, groundingType);
  }, [ratedCurrentA, groundingType]);

  const requiredAreaMm2 = requiredResult?.applicable
    ? requiredResult.requiredAreaMm2
    : null;
  const unsupportedGroundingType =
    requiredResult !== null &&
    !requiredResult.applicable &&
    requiredResult.reasonKey === "unsupportedGroundingType";

  const candidates = useMemo(() => {
    if (mode !== "auto" || requiredAreaMm2 === null || !sizesLoaded) return [];
    return findEarthWireCandidates(sizes, requiredAreaMm2);
  }, [mode, requiredAreaMm2, sizes, sizesLoaded]);

  const manualSize = sizes.find((s) => s.id === manualSizeId) ?? null;
  const manualCandidate = useMemo(() => {
    if (!manualSize) return null;
    return evaluateEarthWireCandidate(manualSize, requiredAreaMm2);
  }, [manualSize, requiredAreaMm2]);

  function handleAdopt(candidate: EarthWireCandidate) {
    setAdopted(candidate);
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t("earthWireCalc.title")}
        description={t("earthWireCalc.description")}
        backHref={null}
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
              {t("earthWireCalc.ratedCurrentLabel")}
            </span>
          </div>
          <div className="panel-body flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-2.5 sm:max-w-[360px]">
              <div>
                <label htmlFor="earth-wire-grounding-type" className="field-label">
                  {t("earthWireCalc.groundingTypeLabel")}
                </label>
                <select
                  id="earth-wire-grounding-type"
                  value={groundingTypeRaw}
                  onChange={(e) => setGroundingTypeRaw(e.target.value)}
                  className="field-input"
                >
                  <option value="">—</option>
                  <option value="A">{t("earthWireCalc.groundingTypeA")}</option>
                  <option value="B">{t("earthWireCalc.groundingTypeB")}</option>
                  <option value="C">{t("earthWireCalc.groundingTypeC")}</option>
                  <option value="D">{t("earthWireCalc.groundingTypeD")}</option>
                </select>
              </div>
              <div>
                <label className="field-label">
                  {t("earthWireCalc.ratedCurrentLabel")}
                </label>
                <input
                  type="number"
                  step="1"
                  value={ratedCurrentRaw}
                  onChange={(e) => setRatedCurrentRaw(e.target.value)}
                  placeholder="400"
                  className={
                    ratedCurrentRaw.trim() !== "" && ratedCurrentA === null
                      ? "field-input !border-danger"
                      : "field-input"
                  }
                />
                <span className="mt-1 block text-[11px] text-muted-2">A</span>
              </div>
            </div>

            {unsupportedGroundingType && (
              <div className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2.5">
                <p className="text-[12px] text-warning">
                  {t("earthWireCalc.unsupportedGroundingType")}
                </p>
              </div>
            )}
          </div>
        </div>

        {requiredResult?.applicable && (
          <div className="calc-layout-basis panel">
            <div className="panel-header">
              <span className="panel-title">
                {t("earthWireCalc.basisSectionTitle")}
              </span>
            </div>
            <div className="panel-body">
              <EarthWireBasisPanel
                ratedCurrentA={requiredResult.ratedCurrentA}
                coefficientPerA={requiredResult.coefficientPerA}
                requiredAreaMm2={requiredResult.requiredAreaMm2}
                source={requiredResult.source}
              />
            </div>
          </div>
        )}

        <div className="calc-layout-results flex flex-col gap-4">
          <div className="-mx-1 overflow-x-auto px-1">
            <div className="flex w-max min-w-full gap-1 border-b border-border pb-0">
              {EARTH_WIRE_MODES.map((key) => {
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
                    {t(`earthWireCalc.mode${key === "auto" ? "Auto" : "Manual"}`)}
                  </button>
                );
              })}
            </div>
          </div>

          {mode === "auto" ? (
            <div className="panel">
              <div className="panel-header">
                <span className="panel-title">
                  {t("earthWireCalc.candidatesTitle")}
                </span>
              </div>
              <div className="panel-body">
                {!sizesLoaded ? (
                  <p className="text-[12px] text-muted">{t("common.loading")}</p>
                ) : sizes.length === 0 ? (
                  <p className="text-[12px] text-warning">
                    {t("earthWireCalc.noSizesConfigured")}
                  </p>
                ) : requiredAreaMm2 === null ? (
                  <p className="text-[12px] text-muted-2">
                    {t("earthWireCalc.enterInputPrompt")}
                  </p>
                ) : (
                  <EarthWireCandidateList
                    candidates={candidates}
                    adopted={adopted}
                    onAdopt={handleAdopt}
                    saving={false}
                    requiredAreaMm2={requiredAreaMm2}
                  />
                )}
              </div>
            </div>
          ) : (
            <div className="panel">
              <div className="panel-header">
                <span className="panel-title">{t("earthWireCalc.modeManual")}</span>
              </div>
              <div className="panel-body flex flex-col gap-3.5">
                <p className="text-[12px] text-muted">
                  {t("earthWireCalc.manualHint")}
                </p>
                <div className="sm:max-w-[220px]">
                  <label htmlFor="earth-wire-manual-size" className="field-label">
                    {t("earthWireCalc.manualSizeLabel")}
                  </label>
                  <select
                    id="earth-wire-manual-size"
                    value={manualSizeId}
                    onChange={(e) => setManualSizeId(e.target.value)}
                    className="field-input"
                  >
                    <option value="">
                      {t("earthWireCalc.manualSelectPlaceholder")}
                    </option>
                    {sizes.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.areaMm2} mm²
                      </option>
                    ))}
                  </select>
                </div>

                {manualCandidate && (
                  <EarthWireCandidateList
                    candidates={[manualCandidate]}
                    adopted={adopted}
                    onAdopt={handleAdopt}
                    saving={false}
                    requiredAreaMm2={requiredAreaMm2}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {settingsOpen && (
        <Modal
          title={t("earthWireSizeSettings.title")}
          onClose={() => setSettingsOpen(false)}
          widthClassName="max-w-2xl"
        >
          <EarthWireSizeSettings />
        </Modal>
      )}
    </div>
  );
}
