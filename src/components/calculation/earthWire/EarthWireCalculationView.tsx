"use client";

import { Loader2, Save, Settings } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "@/lib/i18n";
import { formatJaTime } from "@/lib/utils/dateFormat";
import { earthWireSizeService, calculationRecordService } from "@/lib/services";
import { useActiveCase, useEffectiveCaseId } from "@/lib/store/ActiveCaseProvider";
import { PageHeader } from "@/components/common/PageHeader";
import { CaseSelector } from "@/components/common/CaseSelector";
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

const CALCULATION_TYPE = "earth-wire";
const BUSBAR_RECORD_TYPE = "busbar";
const EARTH_WIRE_MODES = ["auto", "manual"] as const;
type EarthWireMode = (typeof EARTH_WIRE_MODES)[number];

const GROUNDING_TYPES: GroundingType[] = ["A", "B", "C", "D"];

function isEarthWireMode(value: string | null): value is EarthWireMode {
  return !!value && (EARTH_WIRE_MODES as readonly string[]).includes(value);
}

function isGroundingType(value: string): value is GroundingType {
  return (GROUNDING_TYPES as readonly string[]).includes(value);
}

/** Adopted candidate as persisted — a snapshot, not a live reference to master data. */
export interface AdoptedEarthWire extends EarthWireCandidate {
  adoptedAt: string;
}

interface EarthWireSavedInput {
  ratedCurrentRaw: string;
  groundingTypeRaw: string;
  mode: EarthWireMode;
  manualSizeId: string;
}

interface EarthWireSavedResult {
  adopted: AdoptedEarthWire | null;
}

function parsePositiveNumber(raw: string): number | null {
  const n = Number(raw);
  return raw.trim() !== "" && Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * 接地線 — 案件 → 接地工事種別・定格電流 In → 必要断面積（0.052×In, C種/D種のみ）→
 * 自動選定 or 手動検証 → 採用 → 案件 に保存. Bypasses the generic
 * CalculationDefinition/CalculationForm/CalculationPageView registry
 * entirely, same as 母線銅帯 — a real formula needs to show its derivation
 * and standard basis, which that generic shell can't render. Persists via
 * the shared `calculation_records` table (case_id + calculation_type=
 * "earth-wire"). Prefills In from the active 案件's saved 母線銅帯
 * (calculation_type="busbar") 定格電流 when no 接地線 input exists yet, per
 * spec #29 (never force re-entry of already-known data) — the field stays
 * fully editable, and the prefill is clearly labeled in the UI.
 */
export interface EarthWireCalculationViewProps {
  /** Route this view's own mode-tab switching (自動選定/手動検証) pushes to. Defaults to its own dedicated route; pass the host page's path (e.g. "/electrical-tools") when embedding this view inline as a category there instead of navigating away. */
  basePath?: string;
}

export function EarthWireCalculationView({
  basePath = "/calculations/earth-wire",
}: EarthWireCalculationViewProps = {}) {
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
  const mode: EarthWireMode = isEarthWireMode(modeParam) ? modeParam : "auto";

  // Broadcast the effective 案件 (URL-provided or a genuine pick here) up
  // to the app-wide active 案件 so it's what other modules resume.
  useEffect(() => {
    if (caseId && caseId !== activeCaseId) setActiveCaseId(caseId);
  }, [caseId, activeCaseId, setActiveCaseId]);

  const [sizes, setSizes] = useState<EarthWireSize[]>([]);
  const [sizesLoaded, setSizesLoaded] = useState(false);
  const [ratedCurrentRaw, setRatedCurrentRaw] = useState("");
  const [groundingTypeRaw, setGroundingTypeRaw] = useState("");
  const [manualSizeId, setManualSizeId] = useState("");
  const [adopted, setAdopted] = useState<AdoptedEarthWire | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [prefilledFromBusbar, setPrefilledFromBusbar] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const initializedRef = useRef<string | null>(null);

  useEffect(() => {
    earthWireSizeService.list().then((list) => {
      setSizes(list);
      setSizesLoaded(true);
    });
  }, []);

  // Load the saved calculation for this 案件 — reset the hydrate guard
  // whenever the 案件 changes so switching 案件 never leaves stale
  // input/adopted state from a previous 案件 on screen.
  useEffect(() => {
    registerSaveHandler(CALCULATION_TYPE, null);
    if (!caseId) return;
    if (initializedRef.current === caseId) return;
    let cancelled = false;
    calculationRecordService.get(caseId, CALCULATION_TYPE).then((record) => {
      if (cancelled || initializedRef.current === caseId) return;
      initializedRef.current = caseId;
      setPrefilledFromBusbar(false);
      if (record) {
        const input = record.input as Partial<EarthWireSavedInput>;
        const result = record.result as Partial<EarthWireSavedResult>;
        setRatedCurrentRaw(input.ratedCurrentRaw ?? "");
        setGroundingTypeRaw(input.groundingTypeRaw ?? "");
        setManualSizeId(input.manualSizeId ?? "");
        setAdopted(result.adopted ?? null);
        setSavedAt(record.updatedAt);
        if (input.mode && input.mode !== mode) setTab(input.mode);
      } else {
        setRatedCurrentRaw("");
        setGroundingTypeRaw("");
        setManualSizeId("");
        setAdopted(null);
        setSavedAt(null);
        // No 接地線 input saved yet for this 案件 — try to prefill 定格電流
        // from 母線銅帯's already-saved 定格電流 (same 案件), so the designer
        // never has to re-type a value the app already knows.
        calculationRecordService
          .get(caseId, BUSBAR_RECORD_TYPE)
          .then((busbarRecord) => {
            if (cancelled || initializedRef.current !== caseId) return;
            const busbarInput = busbarRecord?.input as
              | { ratedCurrentRaw?: string }
              | undefined;
            const fromBusbar = busbarInput?.ratedCurrentRaw;
            if (fromBusbar && parsePositiveNumber(fromBusbar) !== null) {
              setRatedCurrentRaw(fromBusbar);
              setPrefilledFromBusbar(true);
            }
          });
      }
    });
    return () => {
      cancelled = true;
    };
    // Only re-run when the 案件 changes — mode/tab changes shouldn't refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId]);

  useEffect(
    () => () => registerSaveHandler(CALCULATION_TYPE, null),
    [registerSaveHandler],
  );

  function setTab(next: EarthWireMode) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("mode", next);
    router.push(`${basePath}?${params.toString()}`);
  }

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

  async function persist(nextAdopted: AdoptedEarthWire | null) {
    if (!caseId) return;
    setSaving(true);
    try {
      const input: EarthWireSavedInput = {
        ratedCurrentRaw,
        groundingTypeRaw,
        mode,
        manualSizeId,
      };
      const result: EarthWireSavedResult = { adopted: nextAdopted };
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

  async function handleAdopt(candidate: EarthWireCandidate) {
    const next: AdoptedEarthWire = {
      ...candidate,
      adoptedAt: new Date().toISOString(),
    };
    setAdopted(next);
    await persist(next);
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t("earthWireCalc.title")}
        description={t("earthWireCalc.description")}
        actions={
          <button onClick={() => setSettingsOpen(true)} className="btn-secondary">
            <Settings className="h-3.5 w-3.5" />
            {t("common.settings")}
          </button>
        }
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
                {t("earthWireCalc.ratedCurrentLabel")}
              </span>
              <div className="flex items-center gap-2">
                {savedAt && (
                  <span className="text-[11px] text-muted-2">
                    {t("earthWireCalc.saved")}{" "}
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
              <div className="grid grid-cols-2 gap-2.5 sm:max-w-[360px]">
                <div>
                  <label
                    htmlFor="earth-wire-grounding-type"
                    className="field-label"
                  >
                    {t("earthWireCalc.groundingTypeLabel")}
                  </label>
                  <select
                    id="earth-wire-grounding-type"
                    value={groundingTypeRaw}
                    onChange={(e) => {
                      setGroundingTypeRaw(e.target.value);
                      markDirty();
                    }}
                    className="field-input"
                  >
                    <option value="">—</option>
                    <option value="A">
                      {t("earthWireCalc.groundingTypeA")}
                    </option>
                    <option value="B">
                      {t("earthWireCalc.groundingTypeB")}
                    </option>
                    <option value="C">
                      {t("earthWireCalc.groundingTypeC")}
                    </option>
                    <option value="D">
                      {t("earthWireCalc.groundingTypeD")}
                    </option>
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
                    onChange={(e) => {
                      setRatedCurrentRaw(e.target.value);
                      setPrefilledFromBusbar(false);
                      markDirty();
                    }}
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

              {prefilledFromBusbar && (
                <p className="text-[11.5px] text-accent">
                  {t("earthWireCalc.prefilledFromBusbar")}
                </p>
              )}

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
                      onClick={() => setTab(key)}
                      className={
                        isActive
                          ? "shrink-0 whitespace-nowrap border-b-2 border-accent px-3.5 py-2.5 text-[14px] font-bold text-accent"
                          : "shrink-0 whitespace-nowrap border-b-2 border-transparent px-3.5 py-2.5 text-[14px] font-semibold text-muted hover:text-foreground"
                      }
                    >
                      {t(
                        `earthWireCalc.mode${key === "auto" ? "Auto" : "Manual"}`,
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
                    {t("earthWireCalc.candidatesTitle")}
                  </span>
                </div>
                <div className="panel-body">
                  {!sizesLoaded ? (
                    <p className="text-[12px] text-muted">
                      {t("common.loading")}
                    </p>
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
                      saving={saving}
                      requiredAreaMm2={requiredAreaMm2}
                    />
                  )}
                </div>
              </div>
            ) : (
              <div className="panel">
                <div className="panel-header">
                  <span className="panel-title">
                    {t("earthWireCalc.modeManual")}
                  </span>
                </div>
                <div className="panel-body flex flex-col gap-3.5">
                  <p className="text-[12px] text-muted">
                    {t("earthWireCalc.manualHint")}
                  </p>
                  <div className="sm:max-w-[220px]">
                    <label
                      htmlFor="earth-wire-manual-size"
                      className="field-label"
                    >
                      {t("earthWireCalc.manualSizeLabel")}
                    </label>
                    <select
                      id="earth-wire-manual-size"
                      value={manualSizeId}
                      onChange={(e) => {
                        setManualSizeId(e.target.value);
                        markDirty();
                      }}
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
                      saving={saving}
                      requiredAreaMm2={requiredAreaMm2}
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

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
