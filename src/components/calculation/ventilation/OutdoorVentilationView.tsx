"use client";

import { FileSpreadsheet, Loader2, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { calculationRecordService, ventilationClimateProfileService } from "@/lib/services";
import { designCaseService } from "@/lib/services/design";
import { computeOutdoorVentilation } from "@/lib/calc/ventilation/outdoorVentilation";
import { sumHeatSourcesW, type HeatSourceItem } from "@/lib/calc/ventilation/heatBalance";
import { exportOutdoorVentilationExcel } from "@/lib/services/ventilationExcelExport";
import type { VentilationClimateProfile } from "@/lib/types";
import { useMockFeedback } from "@/lib/hooks/useMockFeedback";
import { OutlineDrawingUpload, type OutlineDrawingRef } from "@/components/calculation/OutlineDrawingUpload";
import { FormulaBlock, SourceNote, WhyDisclosure } from "@/components/calculation/FormulaBlock";
import { HeatSourceList } from "./HeatSourceList";

/** 地域未選択時のデフォルト — 社内選定マスタに常に存在する基準地域。 */
const DEFAULT_REGION = "東京";

interface SurfaceAreaState {
  roofM2Raw: string;
  face1M2Raw: string;
  face2M2Raw: string;
  face3M2Raw: string;
  face4M2Raw: string;
  roofTransmittanceRaw: string;
  sideTransmittanceRaw: string;
}

function blankSurfaceAreas(): SurfaceAreaState {
  return {
    roofM2Raw: "",
    face1M2Raw: "",
    face2M2Raw: "",
    face3M2Raw: "",
    face4M2Raw: "",
    roofTransmittanceRaw: "6.6",
    sideTransmittanceRaw: "6.1",
  };
}

interface VentOpeningState {
  supplyAreaM2Raw: string;
  exhaustAreaM2Raw: string;
  noFilterDischargeCoefficientRaw: string;
  ventResistanceCoefficientRaw: string;
  useFilter: boolean;
  filterResistanceCoefficientRaw: string;
  heightDiffMRaw: string;
  hoodFlowCoefficientXRaw: string;
  fanCapacityM3PerHPerUnitRaw: string;
  filterRatedVelocityMPerSRaw: string;
}

function blankVentOpening(): VentOpeningState {
  return {
    supplyAreaM2Raw: "",
    exhaustAreaM2Raw: "",
    noFilterDischargeCoefficientRaw: "0.65",
    ventResistanceCoefficientRaw: "2.5",
    useFilter: false,
    filterResistanceCoefficientRaw: "",
    heightDiffMRaw: "",
    hoodFlowCoefficientXRaw: "0.8",
    fanCapacityM3PerHPerUnitRaw: "",
    filterRatedVelocityMPerSRaw: "",
  };
}

interface SavedInput {
  climateProfileId: string;
  heatSources: HeatSourceItem[];
  surfaceAreas: SurfaceAreaState;
  ventOpening: VentOpeningState;
  outlineDrawing?: OutlineDrawingRef | null;
  ventLayoutDrawing?: OutlineDrawingRef | null;
}

const CALCULATION_TYPE = "ventilation-outdoor";

interface Props {
  caseId: string;
}

/**
 * JSIA-T1016:2019「配電盤類の換気計算」屋外キュービクルの換気計算。地域の
 * 気象条件(社内選定マスタ、設定から登録) → 盤内発熱源・盤表面積 → 換気口・
 * 自然換気の判定 → (不足時のみ)強制換気の順に、手入力欄と自動計算欄を
 * はっきり分けて表示する。
 */
export function OutdoorVentilationView({ caseId }: Props) {
  const { t } = useTranslation();
  const { message: exportMessage, show: showExportMessage } = useMockFeedback();
  const [climateProfiles, setClimateProfiles] = useState<VentilationClimateProfile[]>([]);
  const [climateProfileId, setClimateProfileId] = useState("");
  const [heatSources, setHeatSources] = useState<HeatSourceItem[]>([]);
  const [surfaceAreas, setSurfaceAreas] = useState<SurfaceAreaState>(blankSurfaceAreas());
  const [ventOpening, setVentOpening] = useState<VentOpeningState>(blankVentOpening());
  const [outlineDrawing, setOutlineDrawing] = useState<OutlineDrawingRef | null>(null);
  const [ventLayoutDrawing, setVentLayoutDrawing] = useState<OutlineDrawingRef | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    ventilationClimateProfileService.list().then(setClimateProfiles);
  }, []);

  useEffect(() => {
    setLoaded(false);
    if (!caseId) {
      setClimateProfileId("");
      setHeatSources([]);
      setSurfaceAreas(blankSurfaceAreas());
      setVentOpening(blankVentOpening());
      setOutlineDrawing(null);
      setVentLayoutDrawing(null);
      setLoaded(true);
      return;
    }
    let cancelled = false;
    calculationRecordService.get(caseId, CALCULATION_TYPE).then((record) => {
      if (cancelled) return;
      const saved = record?.input as unknown as SavedInput | undefined;
      setClimateProfileId(saved?.climateProfileId ?? "");
      setHeatSources(saved?.heatSources ?? []);
      setSurfaceAreas(saved?.surfaceAreas ?? blankSurfaceAreas());
      setVentOpening(saved?.ventOpening ?? blankVentOpening());
      setOutlineDrawing(saved?.outlineDrawing ?? null);
      setVentLayoutDrawing(saved?.ventLayoutDrawing ?? null);
      setSavedAt(record?.updatedAt ?? null);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [caseId]);

  // 保存済みの地域選択が無い場合は東京をデフォルトにする(未選択のまま「—」を
  // 表示し続けない — 社内選定マスタに登録済みの地域のうち東京を基準値とする)。
  useEffect(() => {
    if (!loaded || climateProfileId) return;
    const tokyo = climateProfiles.find((c) => c.region === DEFAULT_REGION);
    if (tokyo) setClimateProfileId(tokyo.id);
  }, [loaded, climateProfileId, climateProfiles]);

  const climate = climateProfiles.find((c) => c.id === climateProfileId) ?? null;
  const totalHeatGainW = sumHeatSourcesW(heatSources);

  const roofM2 = Number(surfaceAreas.roofM2Raw);
  const face1M2 = Number(surfaceAreas.face1M2Raw);
  const face2M2 = Number(surfaceAreas.face2M2Raw);
  const face3M2 = Number(surfaceAreas.face3M2Raw);
  const face4M2 = Number(surfaceAreas.face4M2Raw);
  const roofTransmittance = Number(surfaceAreas.roofTransmittanceRaw);
  const sideTransmittance = Number(surfaceAreas.sideTransmittanceRaw);
  const surfaceAreasComplete = [roofM2, face1M2, face2M2, face3M2, face4M2, roofTransmittance, sideTransmittance].every(
    (v) => Number.isFinite(v) && v > 0,
  );

  const supplyAreaM2 = Number(ventOpening.supplyAreaM2Raw);
  const exhaustAreaM2 = Number(ventOpening.exhaustAreaM2Raw);
  const noFilterDischargeCoefficient = Number(ventOpening.noFilterDischargeCoefficientRaw);
  const ventResistanceCoefficient = Number(ventOpening.ventResistanceCoefficientRaw);
  const filterResistanceCoefficient = ventOpening.useFilter ? Number(ventOpening.filterResistanceCoefficientRaw) : null;
  const heightDiffM = Number(ventOpening.heightDiffMRaw);
  const hoodFlowCoefficientX = Number(ventOpening.hoodFlowCoefficientXRaw);
  const ventOpeningComplete =
    [supplyAreaM2, exhaustAreaM2, noFilterDischargeCoefficient, ventResistanceCoefficient, heightDiffM, hoodFlowCoefficientX].every(
      (v) => Number.isFinite(v) && v > 0,
    ) && (!ventOpening.useFilter || (filterResistanceCoefficient != null && filterResistanceCoefficient > 0));

  const fanCapacityM3PerHPerUnit = Number(ventOpening.fanCapacityM3PerHPerUnitRaw) || null;
  const filterRatedVelocityMPerS = ventOpening.useFilter ? Number(ventOpening.filterRatedVelocityMPerSRaw) || null : null;

  const canCompute = !!climate && surfaceAreasComplete && ventOpeningComplete && totalHeatGainW > 0;

  const result =
    canCompute && climate
      ? computeOutdoorVentilation({
          climate: {
            ambientTempC: climate.ambientTempC,
            topTempC: climate.topTempC,
            airSpecificHeatKjPerKgK: climate.airSpecificHeatKjPerKgK,
            airDensityKgPerM3: climate.airDensityKgPerM3,
          },
          solar: {
            roofC: climate.equivalentOutsideTempRoofC,
            face1C: climate.equivalentOutsideTempFace1C,
            face2C: climate.equivalentOutsideTempFace2C,
            face3C: climate.equivalentOutsideTempFace3C,
            face4C: climate.equivalentOutsideTempFace4C,
          },
          transmittance: { roofWPerM2K: roofTransmittance, sideWPerM2K: sideTransmittance },
          surfaceAreas: { roofM2, face1M2, face2M2, face3M2, face4M2 },
          effectiveSupplyAreaM2: supplyAreaM2,
          effectiveExhaustAreaM2: exhaustAreaM2,
          noFilterDischargeCoefficient,
          ventResistanceCoefficient,
          filterResistanceCoefficient,
          heightDiffM,
          hoodFlowCoefficientX,
          totalHeatGainW,
          fanCapacityM3PerHPerUnit,
          filterRatedVelocityMPerS,
        })
      : null;

  async function handleSave() {
    if (!caseId) return;
    setSaving(true);
    try {
      const saved = await calculationRecordService.save(
        caseId,
        CALCULATION_TYPE,
        { climateProfileId, heatSources, surfaceAreas, ventOpening, outlineDrawing, ventLayoutDrawing } as unknown as Record<
          string,
          unknown
        >,
        result ? { naturalVentilationSufficient: result.naturalVentilationSufficient, finalFanCount: result.finalFanCount } : {},
      );
      setSavedAt(saved.updatedAt);
    } finally {
      setSaving(false);
    }
  }

  async function handleExcelExport() {
    if (!climate || !surfaceAreasComplete || !ventOpeningComplete || totalHeatGainW <= 0) return;
    setExportError(null);
    setExportingExcel(true);
    try {
      const detail = caseId ? await designCaseService.getDetail(caseId) : null;
      const { fileName } = await exportOutdoorVentilationExcel({
        caseInfo: detail
          ? {
              projectName: detail.case.projectName,
              panelName: detail.panels[0]?.panelName ?? "",
              managementNumber: detail.case.managementNumber,
            }
          : undefined,
        outlineDrawing,
        ventLayoutDrawing,
        climate: { ambientTempC: climate.ambientTempC, topTempC: climate.topTempC },
        heatSources,
        surfaceAreas: { roofM2, face1M2, face2M2, face3M2, face4M2 },
        transmittance: { roofWPerM2K: roofTransmittance, sideWPerM2K: sideTransmittance },
        equivalentOutsideTemp: {
          roofC: climate.equivalentOutsideTempRoofC,
          face1C: climate.equivalentOutsideTempFace1C,
          face2C: climate.equivalentOutsideTempFace2C,
          face3C: climate.equivalentOutsideTempFace3C,
          face4C: climate.equivalentOutsideTempFace4C,
        },
        supplyAreaM2,
        exhaustAreaM2,
        useFilter: ventOpening.useFilter,
        noFilterDischargeCoefficient,
        ventResistanceCoefficient,
        filterResistanceCoefficient,
        heightDiffM,
        hoodFlowCoefficientX,
        fanCapacityM3PerHPerUnit,
        filterRatedVelocityMPerS,
      });
      showExportMessage(t("ventilationCalc.exportedMessage", { fileName }));
    } catch {
      setExportError(t("ventilationCalc.exportError"));
    } finally {
      setExportingExcel(false);
    }
  }

  if (!loaded) {
    return <div className="py-8 text-center text-[13px] text-foreground">{t("common.loading")}</div>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-[15px] font-bold">{t("ventilationCalc.outdoorTitle")}</h3>
        <p className="text-[12px] text-foreground">{t("ventilationCalc.outdoorDescription")}</p>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <span className="rounded bg-accent px-1.5 py-0.5 text-[10px] font-bold text-accent-foreground">
            {t("ventilationCalc.manualInputBadge")}
          </span>
          <span className="panel-title">{t("ventilationCalc.climateTitle")}</span>
        </div>
        <p className="text-[12px] text-foreground">{t("ventilationCalc.climateHint")}</p>
        <div className="max-w-xs">
          <label className="field-label">{t("ventilationCalc.regionLabel")}</label>
          <select value={climateProfileId} onChange={(e) => setClimateProfileId(e.target.value)} className="field-input">
            <option value="">—</option>
            {climateProfiles.map((c) => (
              <option key={c.id} value={c.id}>
                {c.region}
              </option>
            ))}
          </select>
        </div>
        {climate && (
          <div className="flex items-center gap-2 pt-1">
            <span className="rounded border border-border px-1.5 py-0.5 text-[10px] font-semibold text-muted-2">
              {t("ventilationCalc.autoCalcBadge")}
            </span>
            <span className="font-mono text-[11.5px] text-foreground">
              to={climate.ambientTempC}℃ tt={climate.topTempC}℃ CP={climate.airSpecificHeatKjPerKgK} ρE=
              {climate.airDensityKgPerM3} ・ tSH={climate.equivalentOutsideTempRoofC} tSE={climate.equivalentOutsideTempFace1C}{" "}
              tWS={climate.equivalentOutsideTempFace2C} tNW={climate.equivalentOutsideTempFace3C} tNE=
              {climate.equivalentOutsideTempFace4C}
            </span>
          </div>
        )}
      </div>

      <HeatSourceList value={heatSources} onChange={setHeatSources} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-3 border-t border-border pt-4">
          <div className="flex items-center gap-2">
            <span className="rounded bg-accent px-1.5 py-0.5 text-[10px] font-bold text-accent-foreground">
              {t("ventilationCalc.manualInputBadge")}
            </span>
            <span className="panel-title">{t("ventilationCalc.surfaceAreaTitle")}</span>
          </div>
          <p className="text-[12px] text-foreground">{t("ventilationCalc.surfaceAreaHintOutdoor")}</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            <NumField label="SRO (屋根/上面)" hintKey="ventilationCalc.roofAreaHint" value={surfaceAreas.roofM2Raw} onChange={(v) => setSurfaceAreas({ ...surfaceAreas, roofM2Raw: v })} unit="m²" />
            <NumField label="面1 (SSE)" hintKey="ventilationCalc.faceAreaHint" value={surfaceAreas.face1M2Raw} onChange={(v) => setSurfaceAreas({ ...surfaceAreas, face1M2Raw: v })} unit="m²" />
            <NumField label="面2 (SWS)" hintKey="ventilationCalc.faceAreaHint" value={surfaceAreas.face2M2Raw} onChange={(v) => setSurfaceAreas({ ...surfaceAreas, face2M2Raw: v })} unit="m²" />
            <NumField label="面3 (SNW)" hintKey="ventilationCalc.faceAreaHint" value={surfaceAreas.face3M2Raw} onChange={(v) => setSurfaceAreas({ ...surfaceAreas, face3M2Raw: v })} unit="m²" />
            <NumField label="面4 (SNE)" hintKey="ventilationCalc.faceAreaHint" value={surfaceAreas.face4M2Raw} onChange={(v) => setSurfaceAreas({ ...surfaceAreas, face4M2Raw: v })} unit="m²" />
            <NumField label="URO" hintKey="ventilationCalc.transmittanceRoofHint" value={surfaceAreas.roofTransmittanceRaw} onChange={(v) => setSurfaceAreas({ ...surfaceAreas, roofTransmittanceRaw: v })} unit="W/m²K" />
            <NumField label="USO" hintKey="ventilationCalc.transmittanceSideHint" value={surfaceAreas.sideTransmittanceRaw} onChange={(v) => setSurfaceAreas({ ...surfaceAreas, sideTransmittanceRaw: v })} unit="W/m²K" />
          </div>
          {result && (
            <FormulaBlock
              badge={t("ventilationCalc.autoCalcBadge")}
              lines={[
                {
                  formula: "QBO = URO(tt−to)SRO + USO(ti−to)ΣS − URO・tSH・SRO − USO・Σ(t面・S面)",
                  result: `${result.naturalHeatLossW.toFixed(1)} W`,
                },
              ]}
            />
          )}
        </div>
        <div className="border-t border-border pt-4">
          <OutlineDrawingUpload
            caseId={caseId || "draft"}
            calculationType={CALCULATION_TYPE}
            value={outlineDrawing}
            onChange={setOutlineDrawing}
            title={t("ventilationCalc.outlineDrawingTitle")}
            hint={t("ventilationCalc.outlineDrawingHintOutdoor")}
            heightClass="h-[440px]"
          />
          <p className="mt-1.5 text-[11.5px] text-foreground">{t("ventilationCalc.outlineDrawingNote")}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <VentOpeningFields value={ventOpening} onChange={setVentOpening} />
        <div className="border-t border-border pt-4">
          <OutlineDrawingUpload
            caseId={caseId || "draft"}
            calculationType={`${CALCULATION_TYPE}-vent-layout`}
            value={ventLayoutDrawing}
            onChange={setVentLayoutDrawing}
            title={t("ventilationCalc.ventLayoutDrawingTitle")}
            hint={t("ventilationCalc.ventLayoutDrawingHint")}
            heightClass="h-[440px]"
          />
          <p className="mt-1.5 text-[11.5px] text-foreground">{t("ventilationCalc.outlineDrawingNote")}</p>
        </div>
      </div>

      {result && (
        <VentilationResultPanel
          totalHeatGainW={totalHeatGainW}
          naturalHeatLossW={result.naturalHeatLossW}
          naturalVentilationHeatRemovalW={result.naturalVentilationHeatRemovalW}
          naturalVentilationSufficient={result.naturalVentilationSufficient}
          effectiveVentAreaM2={result.effectiveVentAreaM2}
          requiredForcedAirflowM3PerH={result.requiredForcedAirflowM3PerH}
          fanCount={result.fanCount}
          staticPressurePa={result.staticPressurePa}
          perFanAirflowAtBaseCountM3PerH={result.perFanAirflowAtBaseCountM3PerH}
          filterLimitedFanCount={result.filterLimitedFanCount}
          finalFanCount={result.finalFanCount}
          useFilter={ventOpening.useFilter}
          fanCapacityM3PerHPerUnitRaw={ventOpening.fanCapacityM3PerHPerUnitRaw}
          onFanCapacityChange={(v) => setVentOpening({ ...ventOpening, fanCapacityM3PerHPerUnitRaw: v })}
          filterRatedVelocityMPerSRaw={ventOpening.filterRatedVelocityMPerSRaw}
          onFilterRatedVelocityChange={(v) => setVentOpening({ ...ventOpening, filterRatedVelocityMPerSRaw: v })}
        />
      )}

      <SourceNote title={t("ventilationCalc.outdoorSourceTitle")} body={t("ventilationCalc.outdoorSourceBody")} />

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <button onClick={handleSave} disabled={!caseId || saving} className="btn-primary">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          {t("common.save")}
        </button>
        <button
          type="button"
          onClick={handleExcelExport}
          disabled={exportingExcel || !result}
          className="btn-secondary !py-1 !text-[12px]"
        >
          {exportingExcel ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileSpreadsheet className="h-3.5 w-3.5" />}
          {t("common.excelExport")}
        </button>
        {savedAt && <span className="text-[11px] text-muted-2">{t("ventilationCalc.savedAt", { date: savedAt.slice(0, 10) })}</span>}
        {exportMessage && <span className="text-[11px] text-success">{exportMessage}</span>}
        {exportError && <span className="text-[11px] text-danger">{exportError}</span>}
      </div>
    </div>
  );
}

export function NumField({
  label,
  hintKey,
  value,
  onChange,
  unit,
}: {
  label: string;
  hintKey: string;
  value: string;
  onChange: (v: string) => void;
  unit: string;
}) {
  const { t } = useTranslation();
  return (
    <div>
      <label className="field-label font-mono">
        {label} <span className="font-normal text-muted-2">({unit})</span>
      </label>
      <input type="number" min={0} step="any" value={value} onChange={(e) => onChange(e.target.value)} className="field-input" />
      <p className="mt-1 text-[11.5px] text-foreground">{t(hintKey)}</p>
    </div>
  );
}

/**
 * Ai・Ao (有効給気口面積・有効排気口面積) は実物のJSIA-T1016テンプレートでは
 * 単一の面積セル(m²)への直接入力(製品図から算出した値を書き込むだけ)で、
 * W×H欄はテンプレート側には存在しない(B43:G43/B44:G44 結合セルにラベルの
 * みで、面積セル自体も数式ではなく直値)。ここでは開口幅W・開口高さHを
 * 入力すると面積を自動計算する補助欄を追加するが、これはExcelテンプレート
 * 由来の項目ではなくアプリ側の入力補助 — 面積欄はいつでも直接上書き可能。
 */
function AreaFromDimensionsField({
  label,
  hintKey,
  value,
  onChange,
}: {
  label: string;
  hintKey: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const { t } = useTranslation();
  const [widthRaw, setWidthRaw] = useState("");
  const [heightRaw, setHeightRaw] = useState("");

  function applyDimensions(w: string, h: string) {
    const wNum = Number(w);
    const hNum = Number(h);
    if (Number.isFinite(wNum) && wNum > 0 && Number.isFinite(hNum) && hNum > 0) {
      onChange(String(Math.round(wNum * hNum * 1e6) / 1e6));
    }
  }

  return (
    <div>
      <label className="field-label font-mono">
        {label} <span className="font-normal text-muted-2">(m²)</span>
      </label>
      <div className="grid grid-cols-3 gap-1.5">
        <div>
          <input
            type="number"
            min={0}
            step="any"
            placeholder="W"
            value={widthRaw}
            onChange={(e) => {
              setWidthRaw(e.target.value);
              applyDimensions(e.target.value, heightRaw);
            }}
            className="field-input"
          />
          <span className="mt-1 block text-[10.5px] text-muted-2">開口幅 W (m)</span>
        </div>
        <div>
          <input
            type="number"
            min={0}
            step="any"
            placeholder="H"
            value={heightRaw}
            onChange={(e) => {
              setHeightRaw(e.target.value);
              applyDimensions(widthRaw, e.target.value);
            }}
            className="field-input"
          />
          <span className="mt-1 block text-[10.5px] text-muted-2">開口高さ H (m)</span>
        </div>
        <div>
          <input type="number" min={0} step="any" value={value} onChange={(e) => onChange(e.target.value)} className="field-input" />
          <span className="mt-1 block text-[10.5px] text-muted-2">面積 (m²)</span>
        </div>
      </div>
      <p className="mt-1 text-[11.5px] text-foreground">{t(hintKey)}</p>
    </div>
  );
}

export function VentOpeningFields({ value, onChange }: { value: VentOpeningState; onChange: (v: VentOpeningState) => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-3 border-t border-border pt-4">
      <div className="flex items-center gap-2">
        <span className="rounded bg-accent px-1.5 py-0.5 text-[10px] font-bold text-accent-foreground">
          {t("ventilationCalc.manualInputBadge")}
        </span>
        <span className="panel-title">{t("ventilationCalc.ventOpeningTitle")}</span>
      </div>
      <p className="text-[12px] text-foreground">{t("ventilationCalc.ventOpeningHint")}</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <AreaFromDimensionsField label="Ai (有効給気口面積)" hintKey="ventilationCalc.supplyAreaHint" value={value.supplyAreaM2Raw} onChange={(v) => onChange({ ...value, supplyAreaM2Raw: v })} />
        <AreaFromDimensionsField label="Ao (有効排気口面積)" hintKey="ventilationCalc.exhaustAreaHint" value={value.exhaustAreaM2Raw} onChange={(v) => onChange({ ...value, exhaustAreaM2Raw: v })} />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <NumField label="h (給排気口の高低差)" hintKey="ventilationCalc.heightDiffHint" value={value.heightDiffMRaw} onChange={(v) => onChange({ ...value, heightDiffMRaw: v })} unit="m" />
        <NumField label="X (換気フード流量係数)" hintKey="ventilationCalc.hoodCoefficientHint" value={value.hoodFlowCoefficientXRaw} onChange={(v) => onChange({ ...value, hoodFlowCoefficientXRaw: v })} unit="—" />
      </div>

      <label className="flex items-center gap-2 text-[12.5px]">
        <input type="checkbox" checked={value.useFilter} onChange={(e) => onChange({ ...value, useFilter: e.target.checked })} />
        {t("ventilationCalc.useFilterLabel")}
      </label>

      {value.useFilter ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <NumField label="ζC (換気口抵抗係数)" hintKey="ventilationCalc.ventResistanceHint" value={value.ventResistanceCoefficientRaw} onChange={(v) => onChange({ ...value, ventResistanceCoefficientRaw: v })} unit="—" />
          <NumField label="ζF (フィルタ抵抗係数)" hintKey="ventilationCalc.filterResistanceHint" value={value.filterResistanceCoefficientRaw} onChange={(v) => onChange({ ...value, filterResistanceCoefficientRaw: v })} unit="—" />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <NumField label="αi及びαo" hintKey="ventilationCalc.noFilterDischargeHint" value={value.noFilterDischargeCoefficientRaw} onChange={(v) => onChange({ ...value, noFilterDischargeCoefficientRaw: v })} unit="—" />
        </div>
      )}
      <WhyDisclosure label={t("ventilationCalc.whyOpeningAreaLabel")} title={t("ventilationCalc.whyOpeningAreaTitle")}>
        {t("ventilationCalc.whyOpeningAreaBody")}
      </WhyDisclosure>
    </div>
  );
}

export function VentilationResultPanel({
  totalHeatGainW,
  naturalHeatLossW,
  naturalVentilationHeatRemovalW,
  naturalVentilationSufficient,
  effectiveVentAreaM2,
  requiredForcedAirflowM3PerH,
  fanCount,
  staticPressurePa,
  perFanAirflowAtBaseCountM3PerH,
  filterLimitedFanCount,
  finalFanCount,
  useFilter,
  fanCapacityM3PerHPerUnitRaw,
  onFanCapacityChange,
  filterRatedVelocityMPerSRaw,
  onFilterRatedVelocityChange,
  heatLossLabel = "QBO",
}: {
  totalHeatGainW: number;
  naturalHeatLossW: number;
  naturalVentilationHeatRemovalW: number;
  naturalVentilationSufficient: boolean;
  effectiveVentAreaM2: number;
  requiredForcedAirflowM3PerH: number | null;
  fanCount: number | null;
  staticPressurePa: number | null;
  perFanAirflowAtBaseCountM3PerH: number | null;
  filterLimitedFanCount: number | null;
  finalFanCount: number | null;
  useFilter: boolean;
  fanCapacityM3PerHPerUnitRaw: string;
  onFanCapacityChange: (v: string) => void;
  filterRatedVelocityMPerSRaw: string;
  onFilterRatedVelocityChange: (v: string) => void;
  /** 自然放熱の記号 — 屋外はQBO、屋内はQBi (呼び方が違うだけで判定式は同じ)。 */
  heatLossLabel?: string;
}) {
  const { t } = useTranslation();
  const naturalRemoval = naturalHeatLossW + naturalVentilationHeatRemovalW;

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-4">
      <div className="flex items-center gap-2">
        <span className="rounded border border-border px-1.5 py-0.5 text-[10px] font-semibold text-muted-2">
          {t("ventilationCalc.autoCalcBadge")}
        </span>
        <span className="panel-title">{t("ventilationCalc.judgementTitle")}</span>
      </div>
      <FormulaBlock
        badge={t("ventilationCalc.autoCalcBadge")}
        lines={[
          { formula: "αxAx = 1/√((1/(α・Ai))² + (1/(α・Ao))²・(322/304))", result: `${effectiveVentAreaM2.toFixed(5)} m²` },
          {
            formula: "QV = Cp・ρE・αxAx・√(2g・h・(ti−to)/(273+ti))・(tt−to)・1000",
            result: `${naturalVentilationHeatRemovalW.toFixed(1)} W`,
          },
          {
            formula: `Qc(${totalHeatGainW.toFixed(1)}W) ${naturalVentilationSufficient ? "≦" : ">"} ${heatLossLabel}+QV(${naturalRemoval.toFixed(1)}W)`,
            result: naturalVentilationSufficient ? t("ventilationCalc.naturalSufficient") : t("ventilationCalc.forcedRequired"),
          },
        ]}
      />
      <WhyDisclosure label={t("ventilationCalc.whyJudgeLabel")} title={t("ventilationCalc.whyJudgeTitle")}>
        <p className="mb-1.5">{t("ventilationCalc.whyEffectiveAreaBody")}</p>
        <p className="mb-1.5">{t("ventilationCalc.whyQvBody")}</p>
        <p>{t("ventilationCalc.whyJudgeBody")}</p>
      </WhyDisclosure>

      <div className={naturalVentilationSufficient ? "rounded-md border border-success/40 bg-success/10 px-3 py-2" : "rounded-md border border-warning/40 bg-warning/10 px-3 py-2"}>
        <span className={naturalVentilationSufficient ? "badge-success" : "badge-danger"}>
          {naturalVentilationSufficient ? t("ventilationCalc.naturalSufficient") : t("ventilationCalc.forcedRequired")}
        </span>
      </div>

      {!naturalVentilationSufficient && (
        <div className="flex flex-col gap-3 border-t border-border pt-3">
          <div className="flex items-center gap-2">
            <span className="rounded bg-accent px-1.5 py-0.5 text-[10px] font-bold text-accent-foreground">
              {t("ventilationCalc.manualInputBadge")}
            </span>
            <span className="panel-title">{t("ventilationCalc.forcedVentilationTitle")}</span>
          </div>
          <FormulaBlock
            badge={t("ventilationCalc.autoCalcBadge")}
            lines={[{ formula: "WK = 3.6・(QC−QBO−QV)/(Cp・ρE・(ti−to)・X)", result: `${requiredForcedAirflowM3PerH?.toFixed(1) ?? "—"} m³/h` }]}
          />
          <WhyDisclosure label={t("ventilationCalc.whyWkLabel")} title={t("ventilationCalc.whyWkTitle")}>
            {t("ventilationCalc.whyWkBody")}
          </WhyDisclosure>
          <p className="text-[12px] text-foreground">{t("ventilationCalc.forcedVentilationHint")}</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <NumField
              label={t("ventilationCalc.fanCapacityLabel")}
              hintKey="ventilationCalc.fanCapacityHint"
              value={fanCapacityM3PerHPerUnitRaw}
              onChange={onFanCapacityChange}
              unit="m³/h"
            />
            {useFilter && (
              <NumField
                label={t("ventilationCalc.filterVelocityLabel")}
                hintKey="ventilationCalc.filterVelocityHint"
                value={filterRatedVelocityMPerSRaw}
                onChange={onFilterRatedVelocityChange}
                unit="m/s"
              />
            )}
          </div>

          {fanCount != null && (
            <div className="data-table-wrap">
              <table className="data-table" style={{ minWidth: 480 }}>
                <tbody>
                  <tr>
                    <td>{t("ventilationCalc.resultColumns.baseFanCount")}</td>
                    <td className="text-right font-mono">{fanCount} 台</td>
                  </tr>
                  <tr>
                    <td>{t("ventilationCalc.resultColumns.staticPressure")}</td>
                    <td className="text-right font-mono">{staticPressurePa?.toFixed(2)} Pa</td>
                  </tr>
                  <tr>
                    <td>{t("ventilationCalc.resultColumns.perFanAirflow")}</td>
                    <td className="text-right font-mono">{perFanAirflowAtBaseCountM3PerH?.toFixed(1)} m³/h</td>
                  </tr>
                  {filterLimitedFanCount != null && (
                    <tr>
                      <td>{t("ventilationCalc.resultColumns.filterLimitedFanCount")}</td>
                      <td className="text-right font-mono">{filterLimitedFanCount}</td>
                    </tr>
                  )}
                  <tr className="font-bold">
                    <td>{t("ventilationCalc.resultColumns.finalFanCount")}</td>
                    <td className="text-right font-mono text-accent">{finalFanCount}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
          {filterLimitedFanCount != null && (
            <WhyDisclosure label={t("ventilationCalc.whyFanCountLabel")} title={t("ventilationCalc.whyFanCountTitle")}>
              {t("ventilationCalc.whyFanCountBody")}
            </WhyDisclosure>
          )}
        </div>
      )}
    </div>
  );
}
