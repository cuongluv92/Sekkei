"use client";

import { FileSpreadsheet, Loader2, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { calculationRecordService, seismicAnchorBoltService } from "@/lib/services";
import { designCaseService } from "@/lib/services/design";
import { computeFloorMountAnchorForces } from "@/lib/calc/seismic/floorMountAnchor";
import { findAllowablePulloutKn } from "@/lib/calc/seismic/anchorAllowableLookup";
import { BOLT_SHANK_AREA_MM2 } from "@/lib/calc/seismic/boltStress";
import { exportSeismicCubicleExcel, exportSeismicFreeStandingExcel } from "@/lib/services/seismicExcelExport";
import type { SeismicAnchorAllowable } from "@/lib/types";
import { useMockFeedback } from "@/lib/hooks/useMockFeedback";
import { OutlineDrawingUpload, type OutlineDrawingRef } from "@/components/calculation/OutlineDrawingUpload";
import { FormulaBlock, SourceNote, WhyDisclosure } from "@/components/calculation/FormulaBlock";
import {
  AnchorBoltSection,
  blankAnchorBoltInputState,
  type AnchorBoltInputState,
} from "./AnchorBoltSection";
import {
  blankSeismicForceInputState,
  computeSeismicForce,
  SeismicForceSection,
  type SeismicForceInputState,
} from "./SeismicForceSection";

interface GeometryInputState {
  centerOfGravityHeightMmRaw: string; // hG
  widthSpanMmRaw: string; // ℓ (横幅方向)
  depthSpanMmRaw: string; // ℓ (奥行方向)
  widthCenterToGravityMmRaw: string; // ℓG (横幅方向)
  depthCenterToGravityMmRaw: string; // ℓG (奥行方向)
  widthSideBoltCountRaw: string; // nt (横幅方向)
  depthSideBoltCountRaw: string; // nt (奥行方向)
  totalBoltCountRaw: string; // n
}

function blankGeometry(): GeometryInputState {
  return {
    centerOfGravityHeightMmRaw: "",
    widthSpanMmRaw: "",
    depthSpanMmRaw: "",
    widthCenterToGravityMmRaw: "",
    depthCenterToGravityMmRaw: "",
    widthSideBoltCountRaw: "",
    depthSideBoltCountRaw: "",
    totalBoltCountRaw: "",
  };
}

interface SavedInput {
  force: SeismicForceInputState;
  geometry: GeometryInputState;
  bolt: AnchorBoltInputState;
}

interface Props {
  caseId: string;
  /** "seismic-free-standing" (自立形) | "seismic-cubicle" (キュービクル) */
  calculationType: string;
  titleKey: string;
  descriptionKey: string;
}

/**
 * JSIA-T1018:2012 5.1.1「床、基礎据付けの場合」— 自立形盤類・キュービクル
 * 共通 (7.1/7.3 の計算手順例が同じ式を使っている)。3セクションに分けて
 * 明示する: ①地震入力(手入力+自動計算) → ②盤諸元(手入力の寸法) →
 * ③アンカーボルト選定(手入力+自動判定)。
 */
export function FloorMountSeismicView({ caseId, calculationType, titleKey, descriptionKey }: Props) {
  const { t } = useTranslation();
  const { message: exportMessage, show: showExportMessage } = useMockFeedback();
  const [force, setForce] = useState<SeismicForceInputState>(blankSeismicForceInputState());
  const [geometry, setGeometry] = useState<GeometryInputState>(blankGeometry());
  const [bolt, setBolt] = useState<AnchorBoltInputState>(blankAnchorBoltInputState());
  const [outlineDrawing, setOutlineDrawing] = useState<OutlineDrawingRef | null>(null);
  const [allowables, setAllowables] = useState<SeismicAnchorAllowable[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    seismicAnchorBoltService.list().then(setAllowables);
  }, []);

  useEffect(() => {
    setLoaded(false);
    if (!caseId) {
      setForce(blankSeismicForceInputState());
      setGeometry(blankGeometry());
      setBolt(blankAnchorBoltInputState());
      setLoaded(true);
      return;
    }
    let cancelled = false;
    calculationRecordService.get(caseId, calculationType).then((record) => {
      if (cancelled) return;
      const saved = record?.input as unknown as SavedInput | undefined;
      setForce(saved?.force ?? blankSeismicForceInputState());
      setGeometry(saved?.geometry ?? blankGeometry());
      setBolt(saved?.bolt ?? blankAnchorBoltInputState());
      setSavedAt(record?.updatedAt ?? null);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [caseId, calculationType]);

  const forceResult = computeSeismicForce(force);

  const widthSpan = Number(geometry.widthSpanMmRaw);
  const depthSpan = Number(geometry.depthSpanMmRaw);
  const cgHeight = Number(geometry.centerOfGravityHeightMmRaw);
  const widthCg = Number(geometry.widthCenterToGravityMmRaw);
  const depthCg = Number(geometry.depthCenterToGravityMmRaw);
  const n1 = Number(geometry.widthSideBoltCountRaw);
  const n2 = Number(geometry.depthSideBoltCountRaw);
  const n = Number(geometry.totalBoltCountRaw);
  const geometryComplete =
    forceResult &&
    [widthSpan, depthSpan, cgHeight, widthCg, depthCg, n1, n2, n].every((v) => Number.isFinite(v) && v > 0);

  const anchorResult =
    geometryComplete && forceResult
      ? computeFloorMountAnchorForces(forceResult.horizontalForceKn, forceResult.verticalForceKn, forceResult.weightKn, {
          centerOfGravityHeightMm: cgHeight,
          widthSpanMm: widthSpan,
          depthSpanMm: depthSpan,
          widthCenterToGravityMm: widthCg,
          depthCenterToGravityMm: depthCg,
          widthSideBoltCount: n1,
          depthSideBoltCount: n2,
          totalBoltCount: n,
        })
      : null;

  async function handleSave() {
    if (!caseId) return;
    setSaving(true);
    try {
      const saved = await calculationRecordService.save(
        caseId,
        calculationType,
        { force, geometry, bolt } as unknown as Record<string, unknown>,
        anchorResult ? { pulloutForceKn: anchorResult.pulloutForceKn } : {},
      );
      setSavedAt(saved.updatedAt);
    } finally {
      setSaving(false);
    }
  }

  const concreteThicknessMm = Number(bolt.concreteThicknessMmRaw);
  const allowableTaKn =
    bolt.manufacturerId && bolt.method && Number.isFinite(concreteThicknessMm) && concreteThicknessMm > 0
      ? findAllowablePulloutKn(allowables, {
          manufacturerId: bolt.manufacturerId,
          method: bolt.method,
          boltDiameter: bolt.diameter,
          concreteThicknessMm,
        })
      : null;

  async function handleExcelExport() {
    if (!forceResult || !geometryComplete) return;
    setExportError(null);
    setExportingExcel(true);
    try {
      const caseInfo = caseId ? await designCaseService.getDetail(caseId) : null;
      const exportInput = {
        caseInfo: caseInfo
          ? {
              projectName: caseInfo.case.projectName,
              panelName: caseInfo.panels[0]?.panelName ?? "",
              constructionNumber: caseInfo.case.constructionNumber,
              drawingNumber: caseInfo.case.drawingNumber,
            }
          : undefined,
        outlineDrawing,
        force: { regionZ: force.regionZ, ks: forceResult.ks, weightKg: Number(force.weightKgRaw) },
        geometry: {
          centerOfGravityHeightMm: cgHeight,
          widthSpanMm: widthSpan,
          depthSpanMm: depthSpan,
          widthCenterToGravityMm: widthCg,
          depthCenterToGravityMm: depthCg,
          totalBoltCount: n,
          widthSideBoltCount: n1,
          depthSideBoltCount: n2,
        },
        bolt: {
          material: bolt.material,
          diameter: bolt.diameter,
          areaMm2: BOLT_SHANK_AREA_MM2[bolt.diameter],
          allowableTaKn,
        },
      };
      const { fileName } =
        calculationType === "seismic-cubicle"
          ? await exportSeismicCubicleExcel(exportInput)
          : await exportSeismicFreeStandingExcel(exportInput);
      showExportMessage(t("seismicCalc.exportedMessage", { fileName }));
    } catch {
      setExportError(t("seismicCalc.exportError"));
    } finally {
      setExportingExcel(false);
    }
  }

  if (!loaded) {
    return <div className="py-8 text-center text-[13px] text-muted">{t("common.loading")}</div>;
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h3 className="text-[15px] font-bold">{t(titleKey)}</h3>
        <p className="text-[12px] text-muted">{t(descriptionKey)}</p>
      </div>

      <SeismicForceSection value={force} onChange={setForce} />

      <div className="grid grid-cols-1 gap-4 border-t border-border pt-4 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="rounded bg-accent px-1.5 py-0.5 text-[10px] font-bold text-accent-foreground">
              {t("seismicCalc.manualInputBadge")}
            </span>
            <span className="panel-title">{t("seismicCalc.section2TitleFloor")}</span>
          </div>
          <p className="text-[12px] text-muted">{t("seismicCalc.section2HintFloor")}</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <GeoField label="hG" hintKey="seismicCalc.hGHint" value={geometry.centerOfGravityHeightMmRaw} onChange={(v) => setGeometry({ ...geometry, centerOfGravityHeightMmRaw: v })} />
            <GeoField label="ℓ (横幅方向)" hintKey="seismicCalc.widthSpanHint" value={geometry.widthSpanMmRaw} onChange={(v) => setGeometry({ ...geometry, widthSpanMmRaw: v })} />
            <GeoField label="ℓ (奥行方向)" hintKey="seismicCalc.depthSpanHint" value={geometry.depthSpanMmRaw} onChange={(v) => setGeometry({ ...geometry, depthSpanMmRaw: v })} />
            <GeoField label="ℓG (横幅方向)" hintKey="seismicCalc.widthCgHint" value={geometry.widthCenterToGravityMmRaw} onChange={(v) => setGeometry({ ...geometry, widthCenterToGravityMmRaw: v })} />
            <GeoField label="ℓG (奥行方向)" hintKey="seismicCalc.depthCgHint" value={geometry.depthCenterToGravityMmRaw} onChange={(v) => setGeometry({ ...geometry, depthCenterToGravityMmRaw: v })} />
            <div />
            <GeoField label="nt (横幅方向片側)" hintKey="seismicCalc.n1Hint" value={geometry.widthSideBoltCountRaw} onChange={(v) => setGeometry({ ...geometry, widthSideBoltCountRaw: v })} />
            <GeoField label="nt (奥行方向片側)" hintKey="seismicCalc.n2Hint" value={geometry.depthSideBoltCountRaw} onChange={(v) => setGeometry({ ...geometry, depthSideBoltCountRaw: v })} />
            <GeoField label="n (総本数)" hintKey="seismicCalc.nTotalHint" value={geometry.totalBoltCountRaw} onChange={(v) => setGeometry({ ...geometry, totalBoltCountRaw: v })} />
          </div>

          {forceResult && geometryComplete && anchorResult && (
            <FormulaBlock
              badge={t("seismicCalc.autoCalcBadge")}
              lines={[
                {
                  formula: `Rb(${t("seismicCalc.widthDirection")}) = [FH×hG − (W−FV)×ℓG] / (ℓ×nt)`,
                  result: `${anchorResult.pulloutWidthDirectionKn.toFixed(3)} kN/本`,
                },
                {
                  formula: `Rb(${t("seismicCalc.depthDirection")}) = [FH×hG − (W−FV)×ℓG] / (ℓ×nt)`,
                  result: `${anchorResult.pulloutDepthDirectionKn.toFixed(3)} kN/本`,
                },
                {
                  formula: `${t("seismicCalc.governingDirection")}: ${t(`seismicCalc.${anchorResult.governingDirection}Direction`)}`,
                  result: `Rb = ${anchorResult.pulloutForceKn.toFixed(3)} kN/本`,
                },
              ]}
            />
          )}

          {forceResult && geometryComplete && anchorResult && (
            <WhyDisclosure label={t("seismicCalc.whyRbQLabel")} title={t("seismicCalc.whyRbQTitleFloor")}>
              {t("seismicCalc.whyRbQBodyFloor")}
            </WhyDisclosure>
          )}
        </div>

        <div className="lg:pt-8">
          <OutlineDrawingUpload calculationType={calculationType} onChange={setOutlineDrawing} />
          <p className="mt-1.5 text-[10.5px] text-muted-2">{t("seismicCalc.outlineDrawingHintFloor")}</p>
        </div>
      </div>

      <AnchorBoltSection
        value={bolt}
        onChange={setBolt}
        allowables={allowables}
        pulloutForceKn={anchorResult ? anchorResult.pulloutForceKn : null}
        shearForcePerBoltKn={anchorResult ? anchorResult.shearForcePerBoltKn : null}
      />

      <SourceNote title={t("seismicCalc.floorSourceTitle")} body={t("seismicCalc.floorSourceBody")} />

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <button onClick={handleSave} disabled={!caseId || saving} className="btn-primary">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          {t("common.save")}
        </button>
        <button
          type="button"
          onClick={handleExcelExport}
          disabled={exportingExcel || !forceResult || !geometryComplete}
          className="btn-secondary !py-1 !text-[12px]"
        >
          {exportingExcel ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileSpreadsheet className="h-3.5 w-3.5" />}
          {t("common.excelExport")}
        </button>
        {savedAt && <span className="text-[11px] text-muted-2">{t("seismicCalc.savedAt", { date: savedAt.slice(0, 10) })}</span>}
        {exportMessage && <span className="text-[11px] text-success">{exportMessage}</span>}
        {exportError && <span className="text-[11px] text-danger">{exportError}</span>}
      </div>
    </div>
  );
}

function GeoField({ label, hintKey, value, onChange }: { label: string; hintKey: string; value: string; onChange: (v: string) => void }) {
  const { t } = useTranslation();
  return (
    <div>
      <label className="field-label font-mono">{label}</label>
      <input type="number" min={0} step="any" value={value} onChange={(e) => onChange(e.target.value)} className="field-input" />
      <p className="mt-1 text-[10.5px] text-muted-2">{t(hintKey)}</p>
    </div>
  );
}
