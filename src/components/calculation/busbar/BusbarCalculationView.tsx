"use client";

import { Loader2, Save } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "@/lib/i18n";
import { busbarSizeService, calculationRecordService } from "@/lib/services";
import { useActiveProject } from "@/lib/store/ActiveProjectProvider";
import { PageHeader } from "@/components/common/PageHeader";
import { ProjectSelector } from "@/components/common/ProjectSelector";
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
import { JIS_H_3140_COPPER_SOURCE } from "@/lib/calc/busbar/material";
import { BusbarBasisPanel } from "./BusbarBasisPanel";
import { BusbarCandidateList } from "./BusbarCandidateList";
import type { BusbarSize } from "@/lib/types";

const CALCULATION_TYPE = "busbar";
const BUSBAR_MODES = ["auto", "manual"] as const;
type BusbarMode = (typeof BUSBAR_MODES)[number];

function isBusbarMode(value: string | null): value is BusbarMode {
  return !!value && (BUSBAR_MODES as readonly string[]).includes(value);
}

/** Adopted candidate as persisted — a snapshot, not a live reference to master data (a master size could be edited/removed later without invalidating what was actually adopted). */
export interface AdoptedBusbar extends BusbarCandidate {
  adoptedAt: string;
}

interface BusbarSavedInput {
  ratedCurrentRaw: string;
  mode: BusbarMode;
  thicknessRaw: string;
  widthRaw: string;
  barsRaw: string;
}

interface BusbarSavedResult {
  adopted: AdoptedBusbar | null;
}

function parsePositiveNumber(raw: string): number | null {
  const n = Number(raw);
  return raw.trim() !== "" && Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * 母線銅帯 — Project → 定格電流 → 必要断面積（JIS C 8480 簡易選定, ≤630A）→
 * 自動選定 or 手動検証 → 採用 → Project に保存. Bypasses the generic
 * CalculationDefinition/CalculationForm/CalculationPageView registry
 * entirely (same reasoning as 重量計算) — a real formula needs to show its
 * derivation and standard basis, which that generic shell can't render.
 * Persists via the shared `calculation_records` table
 * (project_id + calculation_type="busbar"), the same mechanism every other
 * calculation module already uses — no separate persistence system.
 */
export function BusbarCalculationView() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    projectId,
    setProjectId,
    loading: projectLoading,
  } = useActiveProject();

  const modeParam = searchParams.get("mode");
  const mode: BusbarMode = isBusbarMode(modeParam) ? modeParam : "auto";

  const [sizes, setSizes] = useState<BusbarSize[]>([]);
  const [sizesLoaded, setSizesLoaded] = useState(false);
  const [ratedCurrentRaw, setRatedCurrentRaw] = useState("");
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

  // Load the saved calculation for this Project — reset the hydrate guard
  // whenever the Project changes so switching Projects never leaves stale
  // input/adopted state from a previous Project on screen.
  useEffect(() => {
    if (!projectId) return;
    if (initializedRef.current === projectId) return;
    let cancelled = false;
    calculationRecordService.get(projectId, CALCULATION_TYPE).then((record) => {
      if (cancelled || initializedRef.current === projectId) return;
      initializedRef.current = projectId;
      if (record) {
        const input = record.input as Partial<BusbarSavedInput>;
        const result = record.result as Partial<BusbarSavedResult>;
        setRatedCurrentRaw(input.ratedCurrentRaw ?? "");
        setThicknessRaw(input.thicknessRaw ?? "");
        setWidthRaw(input.widthRaw ?? "");
        setBarsRaw(input.barsRaw ?? "1");
        setAdopted(result.adopted ?? null);
        setSavedAt(record.updatedAt);
        if (input.mode && input.mode !== mode) setTab(input.mode);
      } else {
        setRatedCurrentRaw("");
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
    // Only re-run when the Project changes — mode/tab changes shouldn't refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  function setTab(next: BusbarMode) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("mode", next);
    router.push(`/calculations/busbar?${params.toString()}`);
  }

  const ratedCurrentA = parsePositiveNumber(ratedCurrentRaw);
  const withinSimpleRange =
    ratedCurrentA !== null && isWithinSimpleSelectionRange(ratedCurrentA);
  const densityResult =
    ratedCurrentA !== null ? requiredCrossSectionArea(ratedCurrentA) : null;
  const requiredAreaMm2 = densityResult?.inRange
    ? densityResult.requiredAreaMm2
    : null;
  const outOfRange = ratedCurrentA !== null && !withinSimpleRange;

  const candidates = useMemo(() => {
    if (
      mode !== "auto" ||
      requiredAreaMm2 === null ||
      ratedCurrentA === null ||
      !sizesLoaded
    )
      return [];
    return findBusbarCandidates(sizes, requiredAreaMm2, ratedCurrentA);
  }, [mode, requiredAreaMm2, ratedCurrentA, sizes, sizesLoaded]);

  const manualThickness = parsePositiveNumber(thicknessRaw);
  const manualWidth = parsePositiveNumber(widthRaw);
  const manualBars = Math.max(1, parseInt(barsRaw, 10) || 1);
  const manualCandidate = useMemo(() => {
    if (manualThickness === null || manualWidth === null) return null;
    return evaluateBusbarCandidate(
      { id: "manual", thicknessMm: manualThickness, widthMm: manualWidth },
      manualBars,
      requiredAreaMm2,
      ratedCurrentA,
    );
  }, [
    manualThickness,
    manualWidth,
    manualBars,
    requiredAreaMm2,
    ratedCurrentA,
  ]);

  async function persist(nextAdopted: AdoptedBusbar | null) {
    if (!projectId) return;
    setSaving(true);
    try {
      const input: BusbarSavedInput = {
        ratedCurrentRaw,
        mode,
        thicknessRaw,
        widthRaw,
        barsRaw,
      };
      const result: BusbarSavedResult = { adopted: nextAdopted };
      const saved = await calculationRecordService.save(
        projectId,
        CALCULATION_TYPE,
        input as unknown as Record<string, unknown>,
        result as unknown as Record<string, unknown>,
      );
      setSavedAt(saved.updatedAt);
    } finally {
      setSaving(false);
    }
  }

  async function handleAdopt(candidate: BusbarCandidate) {
    const next: AdoptedBusbar = {
      ...candidate,
      adoptedAt: new Date().toISOString(),
    };
    setAdopted(next);
    await persist(next);
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t("busbarCalc.title")}
        description={t("busbarCalc.description")}
      />

      <ProjectSelector projectId={projectId} onProjectChange={setProjectId} />

      {projectLoading ? (
        <div className="panel">
          <div className="panel-body py-12 text-center text-[13px] text-muted-2">
            {t("common.loading")}
          </div>
        </div>
      ) : !projectId ? (
        <div className="panel">
          <div className="panel-body py-12 text-center text-[13px] text-muted-2">
            {t("design.workspaceBar.selectProjectFirst")}
          </div>
        </div>
      ) : (
        <>
          <div className="panel">
            <div className="panel-header flex items-center justify-between gap-2">
              <span className="panel-title">
                {t("busbarCalc.ratedCurrentLabel")}
              </span>
              <div className="flex items-center gap-2">
                {savedAt && (
                  <span className="text-[11px] text-muted-2">
                    {t("busbarCalc.saved")}{" "}
                    {new Date(savedAt).toLocaleTimeString()}
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
              <div className="max-w-[200px]">
                <input
                  type="number"
                  step="1"
                  value={ratedCurrentRaw}
                  onChange={(e) => setRatedCurrentRaw(e.target.value)}
                  placeholder="180"
                  className={
                    ratedCurrentRaw.trim() !== "" && ratedCurrentA === null
                      ? "field-input !border-danger"
                      : "field-input"
                  }
                />
                <span className="mt-1 block text-[11px] text-muted-2">A</span>
              </div>

              {outOfRange && (
                <div className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2.5">
                  <p className="text-[13px] font-bold text-warning">
                    {t("busbarCalc.outOfRangeTitle")}
                  </p>
                  <p className="mt-1 text-[12px] text-muted">
                    {t("busbarCalc.outOfRangeDescription")}
                  </p>
                  <p className="mt-2 text-[12px] font-semibold text-foreground">
                    {t("busbarCalc.highCurrentModeTitle")}
                  </p>
                  <p className="mt-1 text-[11.5px] text-muted">
                    {t("busbarCalc.highCurrentNotAvailable")}
                  </p>
                </div>
              )}

              {densityResult?.inRange && (
                <BusbarBasisPanel
                  ratedCurrentA={densityResult.ratedCurrentA}
                  densityAPerMm2={densityResult.densityAPerMm2}
                  requiredAreaMm2={densityResult.requiredAreaMm2}
                  currentDensitySource={densityResult.source}
                  materialSource={JIS_H_3140_COPPER_SOURCE}
                />
              )}
              {outOfRange && (
                <BusbarBasisPanel highCurrentSource={JSIA_T1006_SOURCE} />
              )}
            </div>
          </div>

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
                    {t(`busbarCalc.mode${key === "auto" ? "Auto" : "Manual"}`)}
                  </button>
                );
              })}
            </div>
          </div>

          {mode === "auto" ? (
            <div className="panel">
              <div className="panel-header">
                <span className="panel-title">
                  {t("busbarCalc.candidatesTitle")}
                </span>
              </div>
              <div className="panel-body">
                {!sizesLoaded ? (
                  <p className="text-[12px] text-muted">
                    {t("common.loading")}
                  </p>
                ) : sizes.length === 0 ? (
                  <p className="text-[12px] text-warning">
                    {t("busbarCalc.noSizesConfigured")}
                  </p>
                ) : ratedCurrentA === null || requiredAreaMm2 === null ? (
                  <p className="text-[12px] text-muted-2">
                    {t("busbarCalc.enterCurrentPrompt")}
                  </p>
                ) : (
                  <BusbarCandidateList
                    candidates={candidates}
                    adopted={adopted}
                    onAdopt={handleAdopt}
                    saving={saving}
                    ratedCurrentA={ratedCurrentA}
                  />
                )}
              </div>
            </div>
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
                      onChange={(e) => setThicknessRaw(e.target.value)}
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
                      onChange={(e) => setWidthRaw(e.target.value)}
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
                      onChange={(e) => setBarsRaw(e.target.value)}
                      className="field-input"
                    />
                  </div>
                </div>

                {manualCandidate && (
                  <BusbarCandidateList
                    candidates={[manualCandidate]}
                    adopted={adopted}
                    onAdopt={handleAdopt}
                    saving={saving}
                    ratedCurrentA={ratedCurrentA}
                    highCurrentUnverified={outOfRange}
                  />
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
