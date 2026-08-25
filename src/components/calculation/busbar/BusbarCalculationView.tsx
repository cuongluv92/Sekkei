"use client";

import { Settings } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { busbarSizeService } from "@/lib/services";
import { PageHeader } from "@/components/common/PageHeader";
import { Modal } from "@/components/common/Modal";
import { BusbarSizeSettings } from "@/components/settings/BusbarSizeSettings";
import {
  evaluateBusbarCandidate,
  findBusbarCandidates,
  type BusbarCandidate,
} from "@/lib/calc/busbar/candidateSearch";
import { requiredCrossSectionArea } from "@/lib/calc/busbar/currentDensityRule";
import {
  isWithinSimpleSelectionRange,
  JSIA_T1006_SOURCE,
} from "@/lib/calc/busbar/highCurrentRule";
import {
  evaluateHighCurrentCandidate,
  findHighCurrentCandidates,
  type HighCurrentBusbarCandidate,
} from "@/lib/calc/busbar/highCurrentCandidateSearch";
import { JIS_H_3140_COPPER_SOURCE } from "@/lib/calc/busbar/material";
import { BusbarBasisPanel } from "./BusbarBasisPanel";
import { BusbarCandidateList } from "./BusbarCandidateList";
import { HighCurrentBusbarCandidateList } from "./HighCurrentBusbarCandidateList";
import { BusbarReverseCalcPanel } from "./BusbarReverseCalcPanel";
import type { BusbarSize } from "@/lib/types";

const BUSBAR_MODES = ["auto", "manual"] as const;
type BusbarMode = (typeof BUSBAR_MODES)[number];

/**
 * The candidate currently highlighted as 採用 — a purely local UI pick (like
 * radio-selecting a row), not persisted anywhere. A union because ≤630A
 * (verified JIS C 8480 path) and >630A (honest "requiresVerification" path)
 * produce structurally different candidates — see `BusbarCandidate` vs
 * `HighCurrentBusbarCandidate`.
 */
export type AdoptedBusbar =
  | (BusbarCandidate & { kind: "standard" })
  | (HighCurrentBusbarCandidate & { kind: "highCurrent" });

function parsePositiveNumber(raw: string): number | null {
  const n = Number(raw);
  return raw.trim() !== "" && Number.isFinite(n) && n > 0 ? n : null;
}

function roundTo(n: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(n * factor) / factor;
}

/**
 * 母線銅帯 — 定格電流 → 必要断面積（JIS C 8480 簡易選定, ≤630A）→ 自動選定 or
 * 手動検証. A stateless calculator like every other 電気技術計算 tool (V/I/A/U
 * etc.) — no 案件 selection, no save/persistence; typing a value shows the
 * result immediately and nothing is kept once you navigate away.
 *
 * 定格電流 is two independent range-scoped inputs (～630A / 630A～), not one
 * field that auto-switches path at 630A (spec follow-up) — each drives its
 * own 自動選定/手動検証 results, and each is paired with its own
 * 断面積→電流 reverse-lookup box beside it. Both can be filled at once (e.g.
 * comparing a ≤630A option against a >630A one); only one candidate is ever
 * highlighted as 採用 at a time regardless of which list it came from.
 */
export function BusbarCalculationView() {
  const { t } = useTranslation();
  const [mode, setMode] = useState<BusbarMode>("auto");
  const [sizes, setSizes] = useState<BusbarSize[]>([]);
  const [sizesLoaded, setSizesLoaded] = useState(false);
  const [ratedCurrentLowRaw, setRatedCurrentLowRaw] = useState("");
  const [ratedCurrentHighRaw, setRatedCurrentHighRaw] = useState("");
  const [thicknessRaw, setThicknessRaw] = useState("");
  const [widthRaw, setWidthRaw] = useState("");
  const [barsRaw, setBarsRaw] = useState("1");
  const [adopted, setAdopted] = useState<AdoptedBusbar | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    busbarSizeService.list().then((list) => {
      setSizes(list);
      setSizesLoaded(true);
    });
  }, []);

  const ratedCurrentLowA = parsePositiveNumber(ratedCurrentLowRaw);
  const ratedCurrentHighA = parsePositiveNumber(ratedCurrentHighRaw);
  // A value >630A typed into the ～630A box — direct the user to the other
  // box rather than silently applying/extrapolating the JIS table.
  const lowOverflow =
    ratedCurrentLowA !== null && !isWithinSimpleSelectionRange(ratedCurrentLowA);
  // A value ≤630A typed into the 630A～ box — just a hint, doesn't block
  // the (always-honest, requiresVerification) high-current search.
  const highUnderflow =
    ratedCurrentHighA !== null && isWithinSimpleSelectionRange(ratedCurrentHighA);

  const densityResultLow =
    ratedCurrentLowA !== null && !lowOverflow
      ? requiredCrossSectionArea(ratedCurrentLowA)
      : null;
  const requiredAreaLowMm2 = densityResultLow?.inRange
    ? densityResultLow.requiredAreaMm2
    : null;

  // These candidate searches are cheap, pure lookups over a small master
  // list — plain consts recomputed each render, not useMemo. (A hand-rolled
  // useMemo here trips the React Compiler's preserve-manual-memoization
  // check, because candidatesLow/candidatesHigh's dependencies are two
  // pieces of state that clear each other — see handleRatedCurrentLowChange
  // below — which the compiler can't prove is safe to memoize across.)
  const candidatesLow =
    mode === "auto" &&
    requiredAreaLowMm2 !== null &&
    ratedCurrentLowA !== null &&
    sizesLoaded
      ? findBusbarCandidates(sizes, requiredAreaLowMm2, ratedCurrentLowA)
      : [];

  // >630A auto search — real geometry only, every candidate honestly
  // "requiresVerification" (see highCurrentCandidateSearch.ts); never
  // reuses the ≤630A JIS C 8480 table past its range.
  const candidatesHigh =
    mode === "auto" && ratedCurrentHighA !== null && sizesLoaded
      ? findHighCurrentCandidates(sizes, ratedCurrentHighA)
      : [];

  const manualThickness = parsePositiveNumber(thicknessRaw);
  const manualWidth = parsePositiveNumber(widthRaw);
  const manualBars = Math.max(1, parseInt(barsRaw, 10) || 1);

  const manualCandidateLow =
    ratedCurrentLowA !== null &&
    !lowOverflow &&
    manualThickness !== null &&
    manualWidth !== null
      ? evaluateBusbarCandidate(
          { id: "manual", thicknessMm: manualThickness, widthMm: manualWidth },
          manualBars,
          requiredAreaLowMm2,
          ratedCurrentLowA,
        )
      : null;

  const manualCandidateHigh =
    ratedCurrentHighA !== null && manualThickness !== null && manualWidth !== null
      ? evaluateHighCurrentCandidate(
          { id: "manual", thicknessMm: manualThickness, widthMm: manualWidth },
          manualBars,
          ratedCurrentHighA,
        )
      : null;

  // ～630A and 630A～ each apply a different formula/standard — filling one
  // clears the other so the candidate list, 計算根拠, and highlighted result
  // can never be ambiguous about which range is actually being calculated.
  function handleRatedCurrentLowChange(value: string) {
    setRatedCurrentLowRaw(value);
    if (value.trim() !== "") setRatedCurrentHighRaw("");
  }

  function handleRatedCurrentHighChange(value: string) {
    setRatedCurrentHighRaw(value);
    if (value.trim() !== "") setRatedCurrentLowRaw("");
  }

  function handleAdoptStandard(candidate: BusbarCandidate) {
    setAdopted({ ...candidate, kind: "standard" });
  }

  function handleAdoptHighCurrent(candidate: HighCurrentBusbarCandidate) {
    setAdopted({ ...candidate, kind: "highCurrent" });
  }

  const adoptedStandard = adopted?.kind === "standard" ? adopted : null;
  const adoptedHighCurrent = adopted?.kind === "highCurrent" ? adopted : null;

  const hasAnyRatedCurrent = ratedCurrentLowA !== null || ratedCurrentHighA !== null;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t("busbarCalc.title")}
        description={t("busbarCalc.description")}
        backHref={null}
        actions={
          <button onClick={() => setSettingsOpen(true)} className="btn-secondary">
            <Settings className="h-3.5 w-3.5" />
            {t("common.settings")}
          </button>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[4fr_6fr] lg:items-start">
        <div className="flex flex-col gap-3">
          {/* ～630A row: 定格電流 input + 断面積→電流 reverse lookup, height-matched */}
          <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch">
            <div className="panel h-full flex-1">
              <div className="panel-header">
                <span className="panel-title">
                  {t("busbarCalc.ratedCurrentLowLabel")}
                </span>
              </div>
              <div className="panel-body flex flex-col gap-3">
                <div className="flex max-w-[160px] items-center gap-1.5">
                  <input
                    type="number"
                    step="1"
                    value={ratedCurrentLowRaw}
                    onChange={(e) => handleRatedCurrentLowChange(e.target.value)}
                    disabled={ratedCurrentHighRaw.trim() !== ""}
                    placeholder="180"
                    className={
                      lowOverflow
                        ? "field-input min-w-0 !border-danger"
                        : "field-input min-w-0"
                    }
                  />
                  <span className="shrink-0 text-[12px] text-muted-2">A</span>
                </div>
                {lowOverflow && (
                  <p className="text-[11.5px] text-warning">
                    {t("busbarCalc.lowRangeOverflowMessage")}
                  </p>
                )}
                {densityResultLow?.inRange && (
                  <div className="rounded-lg border border-border bg-surface-2 px-3 py-2.5">
                    <span className="field-label">
                      {t("busbarCalc.formulaSectionTitle")}
                    </span>
                    <div className="flex flex-col gap-1 font-mono text-[12px] text-muted">
                      <span>{t("busbarCalc.requiredAreaFormula")}</span>
                      <span className="text-foreground">
                        {densityResultLow.ratedCurrentA} /{" "}
                        {densityResultLow.densityAPerMm2} ={" "}
                        {roundTo(densityResultLow.requiredAreaMm2, 3)} mm²
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="flex-1">
              <BusbarReverseCalcPanel />
            </div>
          </div>

          {/* 630A～ row: 定格電流 input only — no verified source exists
              to invert 断面積→電流 past 630A (see the capped-state
              explanation folded into the ～630A panel above instead of a
              second always-empty panel here). */}
          <div className="panel">
            <div className="panel-header">
              <span className="panel-title">
                {t("busbarCalc.ratedCurrentHighLabel")}
              </span>
            </div>
            <div className="panel-body flex flex-col gap-3">
              <div className="flex max-w-[160px] items-center gap-1.5">
                <input
                  type="number"
                  step="1"
                  value={ratedCurrentHighRaw}
                  onChange={(e) => handleRatedCurrentHighChange(e.target.value)}
                  disabled={ratedCurrentLowRaw.trim() !== ""}
                  placeholder="800"
                  className="field-input min-w-0"
                />
                <span className="shrink-0 text-[12px] text-muted-2">A</span>
              </div>
              {highUnderflow && (
                <p className="text-[11.5px] text-muted">
                  {t("busbarCalc.highRangeUnderflowMessage")}
                </p>
              )}
            </div>
          </div>
        </div>

        {(densityResultLow?.inRange || ratedCurrentHighA !== null) && (
          <div className="panel">
            <div className="panel-header">
              <span className="panel-title">
                {t("busbarCalc.basisSectionTitle")}
              </span>
            </div>
            <div className="panel-body flex flex-col gap-4">
              {densityResultLow?.inRange && (
                <BusbarBasisPanel
                  ratedCurrentA={densityResultLow.ratedCurrentA}
                  densityAPerMm2={densityResultLow.densityAPerMm2}
                  requiredAreaMm2={densityResultLow.requiredAreaMm2}
                  currentDensitySource={densityResultLow.source}
                  materialSource={JIS_H_3140_COPPER_SOURCE}
                  hideFormula
                />
              )}
              {ratedCurrentHighA !== null && (
                <BusbarBasisPanel highCurrentSource={JSIA_T1006_SOURCE} />
              )}
            </div>
          </div>
        )}
      </div>

      {/* 候補 — full width, independent of the 4:6 split above */}
      <div className="flex flex-col gap-4">
        <div className="-mx-1 overflow-x-auto px-1">
          <div className="flex w-max min-w-full gap-1 border-b border-border pb-0">
            {BUSBAR_MODES.map((key) => {
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
                  {t(`busbarCalc.mode${key === "auto" ? "Auto" : "Manual"}`)}
                </button>
              );
            })}
          </div>
        </div>

        {mode === "auto" ? (
          !sizesLoaded ? (
            <div className="panel">
              <div className="panel-body">
                <p className="text-[12px] text-muted">{t("common.loading")}</p>
              </div>
            </div>
          ) : sizes.length === 0 ? (
            <div className="panel">
              <div className="panel-body">
                <p className="text-[12px] text-warning">
                  {t("busbarCalc.noSizesConfigured")}
                </p>
              </div>
            </div>
          ) : !hasAnyRatedCurrent ? (
            <div className="panel">
              <div className="panel-body">
                <p className="text-[12px] text-muted-2">
                  {t("busbarCalc.enterCurrentPrompt")}
                </p>
              </div>
            </div>
          ) : (
            <>
              {ratedCurrentLowA !== null && !lowOverflow && (
                <div className="panel">
                  <div className="panel-header">
                    <span className="panel-title">
                      {t("busbarCalc.candidatesLowTitle")}
                    </span>
                  </div>
                  <div className="panel-body">
                    <BusbarCandidateList
                      candidates={candidatesLow}
                      adopted={adoptedStandard}
                      onAdopt={handleAdoptStandard}
                      saving={false}
                      ratedCurrentA={ratedCurrentLowA}
                    />
                  </div>
                </div>
              )}
              {ratedCurrentHighA !== null && (
                <div className="panel">
                  <div className="panel-header">
                    <span className="panel-title">
                      {t("busbarCalc.candidatesHighTitle")}
                    </span>
                  </div>
                  <div className="panel-body">
                    <HighCurrentBusbarCandidateList
                      candidates={candidatesHigh}
                      adopted={adoptedHighCurrent}
                      onAdopt={handleAdoptHighCurrent}
                      saving={false}
                    />
                  </div>
                </div>
              )}
            </>
          )
        ) : (
          <div className="panel">
            <div className="panel-header">
              <span className="panel-title">{t("busbarCalc.modeManual")}</span>
            </div>
            <div className="panel-body flex flex-col gap-3.5">
              <p className="text-[12px] text-muted">{t("busbarCalc.manualHint")}</p>
              <div className="grid grid-cols-3 gap-2.5 sm:max-w-[380px]">
                <div>
                  <label className="field-label">
                    {t("busbarCalc.thicknessLabel")}
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={thicknessRaw}
                    onChange={(e) => setThicknessRaw(e.target.value)}
                    placeholder="6"
                    className="field-input"
                  />
                </div>
                <div>
                  <label className="field-label">{t("busbarCalc.widthLabel")}</label>
                  <input
                    type="number"
                    step="0.1"
                    value={widthRaw}
                    onChange={(e) => setWidthRaw(e.target.value)}
                    placeholder="50"
                    className="field-input"
                  />
                </div>
                <div>
                  <label className="field-label">{t("busbarCalc.barsLabel")}</label>
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

              {!hasAnyRatedCurrent ? (
                <p className="text-[12px] text-muted-2">
                  {t("busbarCalc.enterCurrentPrompt")}
                </p>
              ) : (
                <>
                  {manualCandidateLow && (
                    <div className="flex flex-col gap-1.5">
                      <span className="field-label">
                        {t("busbarCalc.manualResultLowTitle")}
                      </span>
                      <BusbarCandidateList
                        candidates={[manualCandidateLow]}
                        adopted={adoptedStandard}
                        onAdopt={handleAdoptStandard}
                        saving={false}
                        ratedCurrentA={ratedCurrentLowA}
                      />
                    </div>
                  )}
                  {manualCandidateHigh && (
                    <div className="flex flex-col gap-1.5">
                      <span className="field-label">
                        {t("busbarCalc.manualResultHighTitle")}
                      </span>
                      <HighCurrentBusbarCandidateList
                        candidates={[manualCandidateHigh]}
                        adopted={adoptedHighCurrent}
                        onAdopt={handleAdoptHighCurrent}
                        saving={false}
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {settingsOpen && (
        <Modal
          title={t("busbarSizeSettings.title")}
          onClose={() => setSettingsOpen(false)}
          widthClassName="max-w-2xl"
        >
          <BusbarSizeSettings />
        </Modal>
      )}
    </div>
  );
}
