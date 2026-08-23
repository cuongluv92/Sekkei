"use client";

import { Loader2, Save } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "@/lib/i18n";
import { formatJaTime } from "@/lib/utils/dateFormat";
import { busbarSizeService, calculationRecordService } from "@/lib/services";
import { useActiveCase } from "@/lib/store/ActiveCaseProvider";
import { PageHeader } from "@/components/common/PageHeader";
import { CaseSelector } from "@/components/common/CaseSelector";
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

const CALCULATION_TYPE = "busbar";
const BUSBAR_MODES = ["auto", "manual"] as const;
type BusbarMode = (typeof BUSBAR_MODES)[number];

function isBusbarMode(value: string | null): value is BusbarMode {
  return !!value && (BUSBAR_MODES as readonly string[]).includes(value);
}

/**
 * Adopted candidate as persisted — a snapshot, not a live reference to
 * master data (a master size could be edited/removed later without
 * invalidating what was actually adopted). A union because ≤630A (verified
 * JIS C 8480 path) and >630A (honest "requiresVerification" path) produce
 * structurally different candidates — see `BusbarCandidate` vs
 * `HighCurrentBusbarCandidate`. `kind` defaults to "standard" on hydration
 * for records saved before this distinction existed (see the load effect
 * below) — every busbar record ever saved was on the ≤630A path back then.
 * Only one construction is ever adopted at a time regardless of which of
 * the two range-scoped candidate lists it came from.
 */
export type AdoptedBusbar =
  | (BusbarCandidate & { kind: "standard"; adoptedAt: string })
  | (HighCurrentBusbarCandidate & { kind: "highCurrent"; adoptedAt: string });

interface BusbarSavedInput {
  ratedCurrentLowRaw: string;
  ratedCurrentHighRaw: string;
  mode: BusbarMode;
  thicknessRaw: string;
  widthRaw: string;
  barsRaw: string;
}

/** Pre-split-input record shape — routed into low/high on load, see the load effect. */
interface LegacyBusbarSavedInput {
  ratedCurrentRaw?: string;
}

interface BusbarSavedResult {
  adopted: AdoptedBusbar | null;
}

function parsePositiveNumber(raw: string): number | null {
  const n = Number(raw);
  return raw.trim() !== "" && Number.isFinite(n) && n > 0 ? n : null;
}

function roundTo(n: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(n * factor) / factor;
}

/**
 * 母線銅帯 — 案件 → 定格電流 → 必要断面積（JIS C 8480 簡易選定, ≤630A）→
 * 自動選定 or 手動検証 → 採用 → 案件 に保存. Bypasses the generic
 * CalculationDefinition/CalculationForm/CalculationPageView registry
 * entirely (same reasoning as 重量計算) — a real formula needs to show its
 * derivation and standard basis, which that generic shell can't render.
 * Persists via the shared `calculation_records` table
 * (case_id + calculation_type="busbar"), the same mechanism every other
 * calculation module already uses — no separate persistence system.
 *
 * 定格電流 is two independent range-scoped inputs (～630A / 630A～), not one
 * field that auto-switches path at 630A (spec follow-up) — each drives its
 * own 自動選定/手動検証 results, and each is paired with its own
 * 断面積→電流 reverse-lookup box beside it. Both can be filled at once (e.g.
 * comparing a ≤630A option against a >630A one for the same 案件); only one
 * candidate is ever 採用 at a time regardless of which list it came from.
 */
export interface BusbarCalculationViewProps {
  /** Route this view's own mode-tab switching (自動選定/手動検証) pushes to. Defaults to its own dedicated route; pass the host page's path (e.g. "/calculations/other") when embedding this view inline as a tab there instead of navigating away. */
  basePath?: string;
}

export function BusbarCalculationView({
  basePath = "/calculations/busbar",
}: BusbarCalculationViewProps = {}) {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    caseId,
    setCaseId,
    loading: caseLoading,
    registerSaveHandler,
  } = useActiveCase();

  const modeParam = searchParams.get("mode");
  const mode: BusbarMode = isBusbarMode(modeParam) ? modeParam : "auto";

  // Honors a `?case=<id>` deep link (e.g. from Global Search's 計算 result)
  // by resolving it as the app-wide active 案件.
  useEffect(() => {
    const fromUrl = searchParams.get("case");
    if (fromUrl && fromUrl !== caseId) setCaseId(fromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const [sizes, setSizes] = useState<BusbarSize[]>([]);
  const [sizesLoaded, setSizesLoaded] = useState(false);
  const [ratedCurrentLowRaw, setRatedCurrentLowRaw] = useState("");
  const [ratedCurrentHighRaw, setRatedCurrentHighRaw] = useState("");
  const [thicknessRaw, setThicknessRaw] = useState("");
  const [widthRaw, setWidthRaw] = useState("");
  const [barsRaw, setBarsRaw] = useState("1");
  const [adopted, setAdopted] = useState<AdoptedBusbar | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const initializedRef = useRef<string | null>(null);

  useEffect(() => {
    busbarSizeService.list().then((list) => {
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
      if (record) {
        const input = record.input as Partial<BusbarSavedInput> &
          LegacyBusbarSavedInput;
        const result = record.result as Partial<BusbarSavedResult>;
        // Records saved before 定格電流 split into two boxes carried one
        // `ratedCurrentRaw` — route it into whichever box its own value
        // belongs in rather than losing it.
        if (input.ratedCurrentRaw) {
          const legacyValue = Number(input.ratedCurrentRaw);
          if (Number.isFinite(legacyValue) && legacyValue > 630) {
            setRatedCurrentLowRaw("");
            setRatedCurrentHighRaw(input.ratedCurrentRaw);
          } else {
            setRatedCurrentLowRaw(input.ratedCurrentRaw);
            setRatedCurrentHighRaw("");
          }
        } else {
          setRatedCurrentLowRaw(input.ratedCurrentLowRaw ?? "");
          setRatedCurrentHighRaw(input.ratedCurrentHighRaw ?? "");
        }
        setThicknessRaw(input.thicknessRaw ?? "");
        setWidthRaw(input.widthRaw ?? "");
        setBarsRaw(input.barsRaw ?? "1");
        // `kind` defaults to "standard" for records saved before the
        // high-current path existed — every one of those was ≤630A.
        setAdopted(
          result.adopted
            ? ({
                ...result.adopted,
                kind: result.adopted.kind ?? "standard",
              } as AdoptedBusbar)
            : null,
        );
        setSavedAt(record.updatedAt);
        if (input.mode && input.mode !== mode) setTab(input.mode);
      } else {
        setRatedCurrentLowRaw("");
        setRatedCurrentHighRaw("");
        setThicknessRaw("");
        setWidthRaw("");
        setBarsRaw("1");
        setAdopted(null);
        setSavedAt(null);
      }
    });
    return () => {
      cancelled = true;
    };
    // Only re-run when the 案件 changes — mode/tab changes shouldn't refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId]);

  // Unregister this module's save handler on unmount so a stale handler
  // pointing at an old 案件's data can never be invoked by the switch
  // confirmation later.
  useEffect(
    () => () => registerSaveHandler(CALCULATION_TYPE, null),
    [registerSaveHandler],
  );

  function setTab(next: BusbarMode) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("mode", next);
    router.push(`${basePath}?${params.toString()}`);
  }

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

  const candidatesLow = useMemo(() => {
    if (
      mode !== "auto" ||
      requiredAreaLowMm2 === null ||
      ratedCurrentLowA === null ||
      !sizesLoaded
    )
      return [];
    return findBusbarCandidates(sizes, requiredAreaLowMm2, ratedCurrentLowA);
  }, [mode, requiredAreaLowMm2, ratedCurrentLowA, sizes, sizesLoaded]);

  // >630A auto search — real geometry only, every candidate honestly
  // "requiresVerification" (see highCurrentCandidateSearch.ts); never
  // reuses the ≤630A JIS C 8480 table past its range.
  const candidatesHigh = useMemo(() => {
    if (mode !== "auto" || ratedCurrentHighA === null || !sizesLoaded)
      return [];
    return findHighCurrentCandidates(sizes, ratedCurrentHighA);
  }, [mode, ratedCurrentHighA, sizes, sizesLoaded]);

  const manualThickness = parsePositiveNumber(thicknessRaw);
  const manualWidth = parsePositiveNumber(widthRaw);
  const manualBars = Math.max(1, parseInt(barsRaw, 10) || 1);

  const manualCandidateLow = useMemo(() => {
    if (ratedCurrentLowA === null || lowOverflow) return null;
    if (manualThickness === null || manualWidth === null) return null;
    return evaluateBusbarCandidate(
      { id: "manual", thicknessMm: manualThickness, widthMm: manualWidth },
      manualBars,
      requiredAreaLowMm2,
      ratedCurrentLowA,
    );
  }, [
    ratedCurrentLowA,
    lowOverflow,
    manualThickness,
    manualWidth,
    manualBars,
    requiredAreaLowMm2,
  ]);

  const manualCandidateHigh = useMemo(() => {
    if (ratedCurrentHighA === null) return null;
    if (manualThickness === null || manualWidth === null) return null;
    return evaluateHighCurrentCandidate(
      { id: "manual", thicknessMm: manualThickness, widthMm: manualWidth },
      manualBars,
      ratedCurrentHighA,
    );
  }, [ratedCurrentHighA, manualThickness, manualWidth, manualBars]);

  async function persist(nextAdopted: AdoptedBusbar | null) {
    if (!caseId) return;
    setSaving(true);
    try {
      const input: BusbarSavedInput = {
        ratedCurrentLowRaw,
        ratedCurrentHighRaw,
        mode,
        thicknessRaw,
        widthRaw,
        barsRaw,
      };
      const result: BusbarSavedResult = { adopted: nextAdopted };
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

  /** Any input edit registers this module's save handler — marks the page 未保存 and gives the case-switch confirmation's "保存して変更" a real function to call. */
  function markDirty() {
    registerSaveHandler(CALCULATION_TYPE, () => persist(adopted));
  }

  // ～630A and 630A～ each apply a different formula/standard — filling one
  // clears the other so the candidate list, 計算根拠, and adopted result can
  // never be ambiguous about which range is actually being calculated.
  function handleRatedCurrentLowChange(value: string) {
    setRatedCurrentLowRaw(value);
    if (value.trim() !== "") setRatedCurrentHighRaw("");
    markDirty();
  }

  function handleRatedCurrentHighChange(value: string) {
    setRatedCurrentHighRaw(value);
    if (value.trim() !== "") setRatedCurrentLowRaw("");
    markDirty();
  }

  async function handleAdoptStandard(candidate: BusbarCandidate) {
    const next: AdoptedBusbar = {
      ...candidate,
      kind: "standard",
      adoptedAt: new Date().toISOString(),
    };
    setAdopted(next);
    await persist(next);
  }

  async function handleAdoptHighCurrent(candidate: HighCurrentBusbarCandidate) {
    const next: AdoptedBusbar = {
      ...candidate,
      kind: "highCurrent",
      adoptedAt: new Date().toISOString(),
    };
    setAdopted(next);
    await persist(next);
  }

  const adoptedStandard = adopted?.kind === "standard" ? adopted : null;
  const adoptedHighCurrent = adopted?.kind === "highCurrent" ? adopted : null;

  const hasAnyRatedCurrent = ratedCurrentLowA !== null || ratedCurrentHighA !== null;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t("busbarCalc.title")}
        description={t("busbarCalc.description")}
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
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[4fr_6fr] lg:items-start">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-end gap-2">
                {savedAt && (
                  <span className="text-[11px] text-muted-2">
                    {t("busbarCalc.saved")} {formatJaTime(savedAt)}
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
                        onChange={(e) =>
                          handleRatedCurrentLowChange(e.target.value)
                        }
                        disabled={ratedCurrentHighRaw.trim() !== ""}
                        placeholder="180"
                        className={
                          lowOverflow
                            ? "field-input min-w-0 !border-danger"
                            : "field-input min-w-0"
                        }
                      />
                      <span className="shrink-0 text-[12px] text-muted-2">
                        A
                      </span>
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
                      onChange={(e) =>
                        handleRatedCurrentHighChange(e.target.value)
                      }
                      disabled={ratedCurrentLowRaw.trim() !== ""}
                      placeholder="800"
                      className="field-input min-w-0"
                    />
                    <span className="shrink-0 text-[12px] text-muted-2">
                      A
                    </span>
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
                      onClick={() => setTab(key)}
                      className={
                        isActive
                          ? "shrink-0 whitespace-nowrap border-b-2 border-accent px-3.5 py-2.5 text-[14px] font-bold text-accent"
                          : "shrink-0 whitespace-nowrap border-b-2 border-transparent px-3.5 py-2.5 text-[14px] font-semibold text-muted hover:text-foreground"
                      }
                    >
                      {t(
                        `busbarCalc.mode${key === "auto" ? "Auto" : "Manual"}`,
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {mode === "auto" ? (
              !sizesLoaded ? (
                <div className="panel">
                  <div className="panel-body">
                    <p className="text-[12px] text-muted">
                      {t("common.loading")}
                    </p>
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
                          saving={saving}
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
                          saving={saving}
                        />
                      </div>
                    </div>
                  )}
                </>
              )
            ) : (
              <div className="panel">
                <div className="panel-header">
                  <span className="panel-title">
                    {t("busbarCalc.modeManual")}
                  </span>
                </div>
                <div className="panel-body flex flex-col gap-3.5">
                  <p className="text-[12px] text-muted">
                    {t("busbarCalc.manualHint")}
                  </p>
                  <div className="grid grid-cols-3 gap-2.5 sm:max-w-[380px]">
                    <div>
                      <label className="field-label">
                        {t("busbarCalc.thicknessLabel")}
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={thicknessRaw}
                        onChange={(e) => {
                          setThicknessRaw(e.target.value);
                          markDirty();
                        }}
                        placeholder="6"
                        className="field-input"
                      />
                    </div>
                    <div>
                      <label className="field-label">
                        {t("busbarCalc.widthLabel")}
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={widthRaw}
                        onChange={(e) => {
                          setWidthRaw(e.target.value);
                          markDirty();
                        }}
                        placeholder="50"
                        className="field-input"
                      />
                    </div>
                    <div>
                      <label className="field-label">
                        {t("busbarCalc.barsLabel")}
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
                            saving={saving}
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
                            saving={saving}
                          />
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
