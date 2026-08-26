"use client";

import { FileSpreadsheet, Loader2, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { calculationRecordService } from "@/lib/services";
import { designCaseService } from "@/lib/services/design";
import { computeIndoorVentilation } from "@/lib/calc/ventilation/indoorVentilation";
import { sumHeatSourcesW, type HeatSourceItem } from "@/lib/calc/ventilation/heatBalance";
import { exportIndoorVentilationExcel } from "@/lib/services/ventilationExcelExport";
import { useMockFeedback } from "@/lib/hooks/useMockFeedback";
import { OutlineDrawingUpload, type OutlineDrawingRef } from "@/components/calculation/OutlineDrawingUpload";
import { FormulaBlock, SourceNote } from "@/components/calculation/FormulaBlock";
import { HeatSourceList } from "./HeatSourceList";
import { NumField, VentilationResultPanel, VentOpeningFields } from "./OutdoorVentilationView";

interface DimensionState {
  widthMRaw: string;
  heightMRaw: string;
  depthMRaw: string;
  roofTransmittanceRaw: string;
  sideTransmittanceRaw: string;
}

function blankDimensions(): DimensionState {
  return { widthMRaw: "", heightMRaw: "", depthMRaw: "", roofTransmittanceRaw: "4.6", sideTransmittanceRaw: "4.1" };
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
  heatSources: HeatSourceItem[];
  dimensions: DimensionState;
  ventOpening: VentOpeningState;
}

const CALCULATION_TYPE = "ventilation-indoor";

interface Props {
  caseId: string;
}

/**
 * JSIA-T1016:2019「配電盤類の換気計算」屋内キュービクルの換気計算 —
 * 「すべての地域で共通条件」(使用方法シートより) のため、屋外のような
 * 地域選択欄を持たない。盤内発熱源・外形寸法 → 換気口・自然換気の判定 →
 * (不足時のみ)強制換気の順に表示する。
 */
export function IndoorVentilationView({ caseId }: Props) {
  const { t } = useTranslation();
  const { message: exportMessage, show: showExportMessage } = useMockFeedback();
  const [heatSources, setHeatSources] = useState<HeatSourceItem[]>([]);
  const [dimensions, setDimensions] = useState<DimensionState>(blankDimensions());
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
    setLoaded(false);
    if (!caseId) {
      setHeatSources([]);
      setDimensions(blankDimensions());
      setVentOpening(blankVentOpening());
      setLoaded(true);
      return;
    }
    let cancelled = false;
    calculationRecordService.get(caseId, CALCULATION_TYPE).then((record) => {
      if (cancelled) return;
      const saved = record?.input as unknown as SavedInput | undefined;
      setHeatSources(saved?.heatSources ?? []);
      setDimensions(saved?.dimensions ?? blankDimensions());
      setVentOpening(saved?.ventOpening ?? blankVentOpening());
      setSavedAt(record?.updatedAt ?? null);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [caseId]);

  const totalHeatGainW = sumHeatSourcesW(heatSources);

  const widthM = Number(dimensions.widthMRaw);
  const heightM = Number(dimensions.heightMRaw);
  const depthM = Number(dimensions.depthMRaw);
  const roofTransmittance = Number(dimensions.roofTransmittanceRaw);
  const sideTransmittance = Number(dimensions.sideTransmittanceRaw);
  const dimensionsComplete = [widthM, heightM, depthM, roofTransmittance, sideTransmittance].every(
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

  const canCompute = dimensionsComplete && ventOpeningComplete && totalHeatGainW > 0;

  const result = canCompute
    ? computeIndoorVentilation({
        dimensions: { widthM, heightM, depthM },
        transmittance: { roofWPerM2K: roofTransmittance, sideWPerM2K: sideTransmittance },
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
        { heatSources, dimensions, ventOpening } as unknown as Record<string, unknown>,
        result ? { naturalVentilationSufficient: result.naturalVentilationSufficient, finalFanCount: result.finalFanCount } : {},
      );
      setSavedAt(saved.updatedAt);
    } finally {
      setSaving(false);
    }
  }

  async function handleExcelExport() {
    if (!dimensionsComplete || !ventOpeningComplete || totalHeatGainW <= 0) return;
    setExportError(null);
    setExportErrorDetail(null);
    setExportingExcel(true);
    try {
      const detail = caseId ? await designCaseService.getDetail(caseId) : null;
      const { fileName } = await exportIndoorVentilationExcel({
        caseInfo: detail
          ? {
              projectName: detail.case.projectName,
              panelName: detail.panels[0]?.panelName ?? "",
              managementNumber: detail.case.managementNumber,
            }
          : undefined,
        outlineDrawing,
        ventLayoutDrawing,
        dimensions: { widthM, heightM, depthM },
        heatSources,
        transmittance: { roofWPerM2K: roofTransmittance, sideWPerM2K: sideTransmittance },
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
      console.error("換気計算(屋内)Excel出力エラー:", err);
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
        <h3 className="text-[15px] font-bold">{t("ventilationCalc.indoorTitle")}</h3>
        <p className="text-[12px] text-foreground">{t("ventilationCalc.indoorDescription")}</p>
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
          <p className="text-[12px] text-foreground">{t("ventilationCalc.surfaceAreaHintIndoor")}</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <NumField label="W (横幅)" hintKey="ventilationCalc.widthHint" value={dimensions.widthMRaw} onChange={(v) => setDimensions({ ...dimensions, widthMRaw: v })} unit="m" />
            <NumField label="H (高さ)" hintKey="ventilationCalc.heightHint" value={dimensions.heightMRaw} onChange={(v) => setDimensions({ ...dimensions, heightMRaw: v })} unit="m" />
            <NumField label="D (奥行)" hintKey="ventilationCalc.depthHint" value={dimensions.depthMRaw} onChange={(v) => setDimensions({ ...dimensions, depthMRaw: v })} unit="m" />
            <NumField label="URi" hintKey="ventilationCalc.transmittanceRoofHint" value={dimensions.roofTransmittanceRaw} onChange={(v) => setDimensions({ ...dimensions, roofTransmittanceRaw: v })} unit="W/m²K" />
            <NumField label="USi" hintKey="ventilationCalc.transmittanceSideHint" value={dimensions.sideTransmittanceRaw} onChange={(v) => setDimensions({ ...dimensions, sideTransmittanceRaw: v })} unit="W/m²K" />
          </div>
          {result && (
            <FormulaBlock
              badge={t("ventilationCalc.autoCalcBadge")}
              lines={[
                { formula: "SRi = W × D", result: `${result.roofAreaM2.toFixed(2)} m²` },
                { formula: "SSi = 2(W×H) + 2(D×H)", result: `${result.sideAreaM2.toFixed(2)} m²` },
                { formula: "QBi = URi(tt−to)SRi + USi(ti−to)SSi", result: `${result.naturalHeatLossW.toFixed(1)} W` },
              ]}
            />
          )}
        </div>
        <div className="border-t border-border pt-4">
          <OutlineDrawingUpload
            calculationType={CALCULATION_TYPE}
            onChange={setOutlineDrawing}
            title={t("ventilationCalc.outlineDrawingTitle")}
            hint={t("ventilationCalc.outlineDrawingHintIndoor")}
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
          heatLossLabel="QBi"
        />
      )}

      <SourceNote title={t("ventilationCalc.indoorSourceTitle")} body={t("ventilationCalc.indoorSourceBody")} />

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
