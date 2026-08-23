"use client";

import { Loader2, Save } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "@/lib/i18n";
import { formatJaTime } from "@/lib/utils/dateFormat";
import { earthBarSizeService, calculationRecordService } from "@/lib/services";
import { useActiveCase, useEffectiveCaseId } from "@/lib/store/ActiveCaseProvider";
import { PageHeader } from "@/components/common/PageHeader";
import { CaseSelector } from "@/components/common/CaseSelector";
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

const CALCULATION_TYPE = "earth-bar";
const EARTH_WIRE_RECORD_TYPE = "earth-wire";
const EARTH_BAR_MODES = ["auto", "manual"] as const;
type EarthBarMode = (typeof EARTH_BAR_MODES)[number];

function isEarthBarMode(value: string | null): value is EarthBarMode {
  return !!value && (EARTH_BAR_MODES as readonly string[]).includes(value);
}

/** Adopted candidate as persisted — a snapshot, not a live reference to master data. */
export interface AdoptedEarthBar extends EarthBarCandidate {
  adoptedAt: string;
}

interface EarthBarSavedInput {
  equipmentTypeRaw: string;
  groundingTypeRaw: string;
  faultCurrentRaw: string;
  clearingTimeRaw: string;
  mode: EarthBarMode;
  thicknessRaw: string;
  widthRaw: string;
  barsRaw: string;
}

interface EarthBarSavedResult {
  adopted: AdoptedEarthBar | null;
}

function parsePositiveNumber(raw: string): number | null {
  const n = Number(raw);
  return raw.trim() !== "" && Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * アースバー（盤内接地母線）— a SEPARATE module from 接地線, per spec (never
 * default to AT×0.052 for every case; never compute by summing load
 * current like the main busbar module). 案件 → 設備種別・接地工事種別・
 * 事故電流/遮断時間（記録用）→ 自動選定 or 手動検証 → 採用 → 案件 に保存.
 * No verified short-circuit-withstand (短絡耐量) source/k-value table is
 * available in this environment (see technicalSource.ts), so every
 * candidate here shows real geometry only (A = t × W × n) with judgment
 * always "requiresVerification"／短絡耐量：未検証 — the same honest-fallback
 * shape already used for 母線銅帯's >630A path, never a fabricated OK/NG
 * (spec #19, #26-28, #37). Prefills 接地工事種別 from the same 案件's saved
 * 接地線 record when available (spec #29 — never force re-entry of
 * already-known data); 事故電流/遮断時間 have no existing source in this
 * app (no ブレーカー module yet) so they start blank and are recorded only
 * for traceability, never used to compute a fabricated required area.
 */
export interface EarthBarCalculationViewProps {
  /** Route this view's own mode-tab switching (自動選定/手動検証) pushes to. Defaults to its own dedicated route; pass the host page's path (e.g. "/calculations/other") when embedding this view inline as a tab there instead of navigating away. */
  basePath?: string;
}

export function EarthBarCalculationView({
  basePath = "/calculations/earth-bar",
}: EarthBarCalculationViewProps = {}) {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    caseId: activeCaseId,
    setCaseId: setActiveCaseId,
    loading: caseLoading,
    registerSaveHandler,
  } = useActiveCase();
  // This screen must never silently show whatever 案件 was left active
  // elsewhere — opening it always starts at 案件選択 until the user
  // genuinely picks one here (see useEffectiveCaseId). An explicit
  // `?case=` deep link (e.g. Global Search's 計算 result) always wins over
  // that, exactly like DesignView.
  const effectiveActiveCaseId = useEffectiveCaseId(true);
  const caseIdParam = searchParams.get("case") ?? "";
  const caseId = caseIdParam || effectiveActiveCaseId;

  const modeParam = searchParams.get("mode");
  const mode: EarthBarMode = isEarthBarMode(modeParam) ? modeParam : "auto";

  // Broadcast the effective 案件 (URL-provided or a genuine pick here) up
  // to the app-wide active 案件 so it's what other modules resume.
  useEffect(() => {
    if (caseId && caseId !== activeCaseId) setActiveCaseId(caseId);
  }, [caseId, activeCaseId, setActiveCaseId]);

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
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [prefilledFromEarthWire, setPrefilledFromEarthWire] = useState(false);
  const initializedRef = useRef<string | null>(null);

  useEffect(() => {
    earthBarSizeService.list().then((list) => {
      setSizes(list);
      setSizesLoaded(true);
    });
  }, []);

  useEffect(() => {
    registerSaveHandler(CALCULATION_TYPE, null);
    if (!caseId) return;
    if (initializedRef.current === caseId) return;
    let cancelled = false;
    calculationRecordService.get(caseId, CALCULATION_TYPE).then((record) => {
      if (cancelled || initializedRef.current === caseId) return;
      initializedRef.current = caseId;
      setPrefilledFromEarthWire(false);
      if (record) {
        const input = record.input as Partial<EarthBarSavedInput>;
        const result = record.result as Partial<EarthBarSavedResult>;
        setEquipmentTypeRaw(input.equipmentTypeRaw ?? "");
        setGroundingTypeRaw(input.groundingTypeRaw ?? "");
        setFaultCurrentRaw(input.faultCurrentRaw ?? "");
        setClearingTimeRaw(input.clearingTimeRaw ?? "");
        setThicknessRaw(input.thicknessRaw ?? "");
        setWidthRaw(input.widthRaw ?? "");
        setBarsRaw(input.barsRaw ?? "1");
        setAdopted(result.adopted ?? null);
        setSavedAt(record.updatedAt);
        if (input.mode && input.mode !== mode) setTab(input.mode);
      } else {
        setEquipmentTypeRaw("");
        setGroundingTypeRaw("");
        setFaultCurrentRaw("");
        setClearingTimeRaw("");
        setThicknessRaw("");
        setWidthRaw("");
        setBarsRaw("1");
        setAdopted(null);
        setSavedAt(null);
        calculationRecordService
          .get(caseId, EARTH_WIRE_RECORD_TYPE)
          .then((earthWireRecord) => {
            if (cancelled || initializedRef.current !== caseId) return;
            const earthWireInput = earthWireRecord?.input as
              | { groundingTypeRaw?: string }
              | undefined;
            if (earthWireInput?.groundingTypeRaw) {
              setGroundingTypeRaw(earthWireInput.groundingTypeRaw);
              setPrefilledFromEarthWire(true);
            }
          });
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId]);

  useEffect(
    () => () => registerSaveHandler(CALCULATION_TYPE, null),
    [registerSaveHandler],
  );

  function setTab(next: EarthBarMode) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("mode", next);
    router.push(`${basePath}?${params.toString()}`);
  }

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

  async function persist(nextAdopted: AdoptedEarthBar | null) {
    if (!caseId) return;
    setSaving(true);
    try {
      const input: EarthBarSavedInput = {
        equipmentTypeRaw,
        groundingTypeRaw,
        faultCurrentRaw,
        clearingTimeRaw,
        mode,
        thicknessRaw,
        widthRaw,
        barsRaw,
      };
      const result: EarthBarSavedResult = { adopted: nextAdopted };
      const saved = await calculationRecordService.save(
        caseId,
        CALCULATION_TYPE,
        input as unknown as Record<string, unknown>,
        result as unknown as Record<string, unknown>,
      );
      setSavedAt(saved.updatedAt);
      registerSaveHandler(CALCULATION_TYPE, null);
    } finally {
      setSaving(false);
    }
  }

  function markDirty() {
    registerSaveHandler(CALCULATION_TYPE, () => persist(adopted));
  }

  async function handleAdopt(candidate: EarthBarCandidate) {
    const next: AdoptedEarthBar = {
      ...candidate,
      adoptedAt: new Date().toISOString(),
    };
    setAdopted(next);
    await persist(next);
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t("earthBarCalc.title")}
        description={t("earthBarCalc.description")}
      />

      <CaseSelector />

      {caseLoading ? (
        <div className="panel">
          <div className="panel-body py-12 text-center text-[13px] text-muted-2">
            {t("common.loading")}
          </div>
        </div>
      ) : !caseId ? (
        <div className="panel">
          <div className="panel-body py-12 text-center text-[13px] text-muted-2">
            {t("caseSelector.selectCaseFirst")}
          </div>
        </div>
      ) : (
        <div className="calc-layout">
          <div className="calc-layout-input panel">
            <div className="panel-header flex items-center justify-between gap-2">
              <span className="panel-title">
                {t("earthBarCalc.inputSectionTitle")}
              </span>
              <div className="flex items-center gap-2">
                {savedAt && (
                  <span className="text-[11px] text-muted-2">
                    {t("earthBarCalc.saved")}{" "}
                    {formatJaTime(savedAt)}
                  </span>
                )}
                <button
                  onClick={() => persist(adopted)}
                  disabled={saving}
                  className="btn-secondary !py-1 !text-[12px]"
                >
                  {saving ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                  {t("common.save")}
                </button>
              </div>
            </div>
            <div className="panel-body flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-2.5 sm:max-w-[440px] sm:grid-cols-4">
                <div>
                  <label
                    htmlFor="earth-bar-equipment-type"
                    className="field-label"
                  >
                    {t("earthBarCalc.equipmentTypeLabel")}
                  </label>
                  <select
                    id="earth-bar-equipment-type"
                    value={equipmentTypeRaw}
                    onChange={(e) => {
                      setEquipmentTypeRaw(e.target.value);
                      markDirty();
                    }}
                    className="field-input"
                  >
                    <option value="">—</option>
                    <option value="cabinet">
                      {t("earthBarCalc.equipmentTypeCabinet")}
                    </option>
                    <option value="cubicle">
                      {t("earthBarCalc.equipmentTypeCubicle")}
                    </option>
                    <option value="other">
                      {t("earthBarCalc.equipmentTypeOther")}
                    </option>
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="earth-bar-grounding-type"
                    className="field-label"
                  >
                    {t("earthBarCalc.groundingTypeLabel")}
                  </label>
                  <select
                    id="earth-bar-grounding-type"
                    value={groundingTypeRaw}
                    onChange={(e) => {
                      setGroundingTypeRaw(e.target.value);
                      setPrefilledFromEarthWire(false);
                      markDirty();
                    }}
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
                    onChange={(e) => {
                      setFaultCurrentRaw(e.target.value);
                      markDirty();
                    }}
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
                    onChange={(e) => {
                      setClearingTimeRaw(e.target.value);
                      markDirty();
                    }}
                    placeholder="0.5"
                    className="field-input"
                  />
                </div>
              </div>

              {prefilledFromEarthWire && (
                <p className="text-[11.5px] text-accent">
                  {t("earthBarCalc.prefilledFromEarthWire")}
                </p>
              )}

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
                      onClick={() => setTab(key)}
                      className={
                        isActive
                          ? "shrink-0 whitespace-nowrap border-b-2 border-accent px-3.5 py-2.5 text-[14px] font-bold text-accent"
                          : "shrink-0 whitespace-nowrap border-b-2 border-transparent px-3.5 py-2.5 text-[14px] font-semibold text-muted hover:text-foreground"
                      }
                    >
                      {t(
                        `earthBarCalc.mode${key === "auto" ? "Auto" : "Manual"}`,
                      )}
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
                    <p className="text-[12px] text-muted">
                      {t("common.loading")}
                    </p>
                  ) : sizes.length === 0 ? (
                    <p className="text-[12px] text-warning">
                      {t("earthBarCalc.noSizesConfigured")}
                    </p>
                  ) : (
                    <EarthBarCandidateList
                      candidates={candidates}
                      adopted={adopted}
                      onAdopt={handleAdopt}
                      saving={saving}
                    />
                  )}
                </div>
              </div>
            ) : (
              <div className="panel">
                <div className="panel-header">
                  <span className="panel-title">
                    {t("earthBarCalc.modeManual")}
                  </span>
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
                        onChange={(e) => {
                          setThicknessRaw(e.target.value);
                          markDirty();
                        }}
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
                        onChange={(e) => {
                          setWidthRaw(e.target.value);
                          markDirty();
                        }}
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
                        onChange={(e) => {
                          setBarsRaw(e.target.value);
                          markDirty();
                        }}
                        className="field-input"
                      />
                    </div>
                  </div>

                  {manualCandidate && (
                    <EarthBarCandidateList
                      candidates={[manualCandidate]}
                      adopted={adopted}
                      onAdopt={handleAdopt}
                      saving={saving}
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
