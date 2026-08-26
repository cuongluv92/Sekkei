"use client";

import { FileSpreadsheet, Loader2, Plus, Save, Trash2 } from "lucide-react";
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
  /** 外形寸法 — 面積の自動計算補助 (実物のJSIA-T1016テンプレートで確認済みの
   * 式: SRO=W×D1, SSE=SNW=H×D, SWS=W×H, SNE=W×H1)。面積欄自体はこの補助の
   * 有無に関わらずいつでも直接上書きできる。 */
  widthWRaw: string;
  heightHRaw: string;
  heightH1Raw: string;
  depthDRaw: string;
  depthD1Raw: string;
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
    widthWRaw: "",
    heightHRaw: "",
    heightH1Raw: "",
    depthDRaw: "",
    depthD1Raw: "",
  };
}

/**
 * 外形寸法(W・H・H1・D・D1)から5面の面積を計算する — 実物のJSIA-T1016
 * 「屋外フィルタ有り 東京」シートのF25:P25セルの数式(F23*N23 等)をunzipして
 * 直接確認済み。5寸法すべてが揃った時だけ上書きし、面積欄は常に直接編集も
 * 可能(この関数を経由しない手動入力を上書きしない)。
 */
function applySurfaceDimensions(next: SurfaceAreaState): SurfaceAreaState {
  const W = Number(next.widthWRaw);
  const H = Number(next.heightHRaw);
  const H1 = Number(next.heightH1Raw);
  const D = Number(next.depthDRaw);
  const D1 = Number(next.depthD1Raw);
  if (![W, H, H1, D, D1].every((v) => Number.isFinite(v) && v > 0)) return next;
  const round = (v: number) => String(Math.round(v * 1e6) / 1e6);
  return {
    ...next,
    roofM2Raw: round(W * D1),
    face1M2Raw: round(H * D),
    face2M2Raw: round(W * H),
    face3M2Raw: round(H * D),
    face4M2Raw: round(W * H1),
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
  const [exportErrorDetail, setExportErrorDetail] = useState<string | null>(null);

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
        { climateProfileId, heatSources, surfaceAreas, ventOpening } as unknown as Record<string, unknown>,
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
    setExportErrorDetail(null);
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
        dimensions:
          Number(surfaceAreas.widthWRaw) > 0 &&
          Number(surfaceAreas.heightHRaw) > 0 &&
          Number(surfaceAreas.heightH1Raw) > 0 &&
          Number(surfaceAreas.depthDRaw) > 0 &&
          Number(surfaceAreas.depthD1Raw) > 0
            ? {
                widthM: Number(surfaceAreas.widthWRaw),
                heightM: Number(surfaceAreas.heightHRaw),
                heightH1M: Number(surfaceAreas.heightH1Raw),
                depthM: Number(surfaceAreas.depthDRaw),
                depthD1M: Number(surfaceAreas.depthD1Raw),
              }
            : null,
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
    } catch (err) {
      console.error("換気計算(屋外)Excel出力エラー:", err);
      const message = err instanceof Error ? err.message : String(err);
      setExportError(
        message.startsWith("no-active-template")
          ? t("ventilationCalc.exportErrorNoTemplate")
          : t("ventilationCalc.exportError"),
      );
      setExportErrorDetail(message);
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
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <NumField compact label="W" hintKey="ventilationCalc.dimWHint" value={surfaceAreas.widthWRaw} onChange={(v) => setSurfaceAreas(applySurfaceDimensions({ ...surfaceAreas, widthWRaw: v }))} unit="m" />
            <NumField compact label="H" hintKey="ventilationCalc.dimHHint" value={surfaceAreas.heightHRaw} onChange={(v) => setSurfaceAreas(applySurfaceDimensions({ ...surfaceAreas, heightHRaw: v }))} unit="m" />
            <NumField compact label="H1" hintKey="ventilationCalc.dimH1Hint" value={surfaceAreas.heightH1Raw} onChange={(v) => setSurfaceAreas(applySurfaceDimensions({ ...surfaceAreas, heightH1Raw: v }))} unit="m" />
            <NumField compact label="D" hintKey="ventilationCalc.dimDHint" value={surfaceAreas.depthDRaw} onChange={(v) => setSurfaceAreas(applySurfaceDimensions({ ...surfaceAreas, depthDRaw: v }))} unit="m" />
            <NumField compact label="D1" hintKey="ventilationCalc.dimD1Hint" value={surfaceAreas.depthD1Raw} onChange={(v) => setSurfaceAreas(applySurfaceDimensions({ ...surfaceAreas, depthD1Raw: v }))} unit="m" />
          </div>
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
            calculationType={CALCULATION_TYPE}
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
            calculationType={`${CALCULATION_TYPE}-vent-layout`}
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
        {exportError && (
          <span className="text-[11px] text-danger">
            {exportError}
            {exportErrorDetail && <span className="font-mono text-muted-2"> ({exportErrorDetail})</span>}
          </span>
        )}
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
  compact,
}: {
  label: string;
  hintKey: string;
  value: string;
  onChange: (v: string) => void;
  unit: string;
  /** 短い値(寸法など)専用の小さめの入力欄。既定の高さ・文字サイズは変えない。 */
  compact?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div>
      <label className="field-label font-mono">
        {label} <span className="font-normal text-muted-2">({unit})</span>
      </label>
      <input
        type="number"
        min={0}
        step="any"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={compact ? "field-input !px-2 !py-1.5 !text-[13px]" : "field-input"}
      />
      <p className="mt-1 text-[11.5px] text-foreground">{t(hintKey)}</p>
    </div>
  );
}

interface OpeningDimensionPair {
  w: string;
  h: string;
}

function blankOpeningPair(): OpeningDimensionPair {
  return { w: "", h: "" };
}

/**
 * Ai・Ao (有効給気口面積・有効排気口面積) は実物のJSIA-T1016テンプレートでは
 * 単一の面積セル(m²)への直接入力(製品図から算出した値を書き込むだけ)で、
 * W×H欄はテンプレート側には存在しない(B43:G43/B44:G44 結合セルにラベルの
 * みで、面積セル自体も数式ではなく直値)。ここでは開口幅W・開口高さHを
 * 入力すると面積を自動計算する補助欄を追加するが、これはExcelテンプレート
 * 由来の項目ではなくアプリ側の入力補助 — 面積欄はいつでも直接上書き可能。
 *
 * 開口は1箇所とは限らない(例: 4〜6面盤を連結した1系統で、盤ごとに給排気口
 * を持つ場合)ため、W×H欄は複数追加でき、合計面積を自動計算する。
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
  const [pairs, setPairs] = useState<OpeningDimensionPair[]>([blankOpeningPair()]);

  function applyDimensions(next: OpeningDimensionPair[]) {
    const total = next.reduce((sum, p) => {
      const w = Number(p.w);
      const h = Number(p.h);
      return Number.isFinite(w) && w > 0 && Number.isFinite(h) && h > 0 ? sum + w * h : sum;
    }, 0);
    if (total > 0) onChange(String(Math.round(total * 1e6) / 1e6));
  }

  function updatePair(i: number, patch: Partial<OpeningDimensionPair>) {
    const next = pairs.map((p, idx) => (idx === i ? { ...p, ...patch } : p));
    setPairs(next);
    applyDimensions(next);
  }

  function addPair() {
    setPairs([...pairs, blankOpeningPair()]);
  }

  function removePair(i: number) {
    const next = pairs.filter((_, idx) => idx !== i);
    setPairs(next);
    applyDimensions(next);
  }

  function clearPairs() {
    setPairs([blankOpeningPair()]);
  }

  return (
    <div>
      <label className="field-label font-mono">
        {label} <span className="font-normal text-muted-2">(m²)</span>
      </label>
      <div className="flex flex-col gap-1.5">
        {pairs.map((p, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-center gap-1.5">
            <input
              type="number"
              min={0}
              step="any"
              placeholder="W (m)"
              value={p.w}
              onChange={(e) => updatePair(i, { w: e.target.value })}
              className="field-input"
            />
            <input
              type="number"
              min={0}
              step="any"
              placeholder="H (m)"
              value={p.h}
              onChange={(e) => updatePair(i, { h: e.target.value })}
              className="field-input"
            />
            {pairs.length > 1 && (
              <button
                type="button"
                onClick={() => removePair(i)}
                className="btn-ghost btn-icon !p-1.5 text-danger hover:bg-danger/10"
                title={t("common.delete")}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={addPair} className="btn-ghost w-fit !py-1 !text-[11.5px]">
            <Plus className="h-3 w-3" />
            {t("ventilationCalc.addOpeningButton")}
          </button>
          {(pairs.length > 1 || pairs[0].w || pairs[0].h) && (
            <button type="button" onClick={clearPairs} className="btn-ghost w-fit !py-1 !text-[11.5px] text-danger hover:bg-danger/10">
              <Trash2 className="h-3 w-3" />
              {t("ventilationCalc.clearOpeningsButton")}
            </button>
          )}
        </div>
        <div>
          <input type="number" min={0} step="any" value={value} onChange={(e) => onChange(e.target.value)} className="field-input" />
          <span className="mt-1 block text-[10.5px] text-muted-2">{t("ventilationCalc.openingTotalAreaLabel")}</span>
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
