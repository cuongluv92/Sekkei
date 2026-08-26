"use client";

import { FileSpreadsheet, Loader2, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { calculationRecordService, seismicAnchorBoltService } from "@/lib/services";
import { designCaseService } from "@/lib/services/design";
import { computeWallMountAnchorForces } from "@/lib/calc/seismic/wallMountAnchor";
import { findAllowablePulloutKn } from "@/lib/calc/seismic/anchorAllowableLookup";
import { BOLT_SHANK_AREA_MM2 } from "@/lib/calc/seismic/boltStress";
import { exportSeismicWallMountedExcel } from "@/lib/services/seismicExcelExport";
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
  horizontalSpanMmRaw: string; // ℓ1
  verticalSpanMmRaw: string; // ℓ2
  verticalCenterToGravityMmRaw: string; // ℓ2G
  wallToGravityMmRaw: string; // ℓ3G
  horizontalFaceBoltCountRaw: string; // nt1
  verticalFaceBoltCountRaw: string; // nt2
  totalBoltCountRaw: string; // n
}

function blankGeometry(): GeometryInputState {
  return {
    horizontalSpanMmRaw: "",
    verticalSpanMmRaw: "",
    verticalCenterToGravityMmRaw: "",
    wallToGravityMmRaw: "",
    horizontalFaceBoltCountRaw: "",
    verticalFaceBoltCountRaw: "",
    totalBoltCountRaw: "",
  };
}

interface SavedInput {
  force: SeismicForceInputState;
  geometry: GeometryInputState;
  bolt: AnchorBoltInputState;
}

const CALCULATION_TYPE = "seismic-wall-mounted";

interface Props {
  caseId: string;
}

/** JSIA-T1018:2012 5.1.2「壁面取付けの場合」— 壁掛形盤類。 */
export function WallMountSeismicView({ caseId }: Props) {
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
    calculationRecordService.get(caseId, CALCULATION_TYPE).then((record) => {
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
  }, [caseId]);

  const forceResult = computeSeismicForce(force);

  const horizontalSpan = Number(geometry.horizontalSpanMmRaw);
  const verticalSpan = Number(geometry.verticalSpanMmRaw);
  const verticalCg = Number(geometry.verticalCenterToGravityMmRaw);
  const wallCg = Number(geometry.wallToGravityMmRaw);
  const nt1 = Number(geometry.horizontalFaceBoltCountRaw);
  const nt2 = Number(geometry.verticalFaceBoltCountRaw);
  const n = Number(geometry.totalBoltCountRaw);
  const geometryComplete =
    forceResult && [horizontalSpan, verticalSpan, verticalCg, wallCg, nt1, nt2, n].every((v) => Number.isFinite(v) && v > 0);

  const anchorResult =
    geometryComplete && forceResult
      ? computeWallMountAnchorForces(forceResult.horizontalForceKn, forceResult.verticalForceKn, forceResult.weightKn, {
          horizontalSpanMm: horizontalSpan,
          verticalSpanMm: verticalSpan,
          verticalCenterToGravityMm: verticalCg,
          wallToGravityMm: wallCg,
          horizontalFaceBoltCount: nt1,
          verticalFaceBoltCount: nt2,
          totalBoltCount: n,
        })
      : null;

  async function handleSave() {
    if (!caseId) return;
    setSaving(true);
    try {
      const saved = await calculationRecordService.save(
        caseId,
        CALCULATION_TYPE,
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
      const { fileName } = await exportSeismicWallMountedExcel({
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
          horizontalSpanMm: horizontalSpan,
          verticalSpanMm: verticalSpan,
          verticalCenterToGravityMm: verticalCg,
          wallToGravityMm: wallCg,
          totalBoltCount: n,
          horizontalFaceBoltCount: nt1,
          verticalFaceBoltCount: nt2,
        },
        bolt: {
          material: bolt.material,
          diameter: bolt.diameter,
          areaMm2: BOLT_SHANK_AREA_MM2[bolt.diameter],
          allowableTaKn,
        },
      });
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
        <h3 className="text-[15px] font-bold">{t("seismicCalc.wallMountedTitle")}</h3>
        <p className="text-[12px] text-muted">{t("seismicCalc.wallMountedDescription")}</p>
      </div>

      <SeismicForceSection value={force} onChange={setForce} />

      <div className="grid grid-cols-1 gap-4 border-t border-border pt-4 lg:grid-cols-2">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="rounded bg-accent px-1.5 py-0.5 text-[10px] font-bold text-accent-foreground">
              {t("seismicCalc.manualInputBadge")}
            </span>
            <span className="panel-title">{t("seismicCalc.section2TitleWall")}</span>
          </div>
          <p className="text-[12px] text-muted">{t("seismicCalc.section2HintWall")}</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <GeoField label="ℓ1 (水平方向)" hintKey="seismicCalc.l1Hint" value={geometry.horizontalSpanMmRaw} onChange={(v) => setGeometry({ ...geometry, horizontalSpanMmRaw: v })} />
            <GeoField label="ℓ2 (鉛直方向)" hintKey="seismicCalc.l2Hint" value={geometry.verticalSpanMmRaw} onChange={(v) => setGeometry({ ...geometry, verticalSpanMmRaw: v })} />
            <GeoField label="ℓ2G" hintKey="seismicCalc.l2gHint" value={geometry.verticalCenterToGravityMmRaw} onChange={(v) => setGeometry({ ...geometry, verticalCenterToGravityMmRaw: v })} />
            <GeoField label="ℓ3G" hintKey="seismicCalc.l3gHint" value={geometry.wallToGravityMmRaw} onChange={(v) => setGeometry({ ...geometry, wallToGravityMmRaw: v })} />
            <GeoField label="nt1 (上下面片側)" hintKey="seismicCalc.nt1Hint" value={geometry.horizontalFaceBoltCountRaw} onChange={(v) => setGeometry({ ...geometry, horizontalFaceBoltCountRaw: v })} />
            <GeoField label="nt2 (側面片側)" hintKey="seismicCalc.nt2Hint" value={geometry.verticalFaceBoltCountRaw} onChange={(v) => setGeometry({ ...geometry, verticalFaceBoltCountRaw: v })} />
            <GeoField label="n (総本数)" hintKey="seismicCalc.nTotalHint" value={geometry.totalBoltCountRaw} onChange={(v) => setGeometry({ ...geometry, totalBoltCountRaw: v })} />
          </div>

          {anchorResult && (
            <FormulaBlock
              badge={t("seismicCalc.autoCalcBadge")}
              lines={[
                {
                  formula: "Rb(①式) = FH×ℓ3G/(ℓ1×nt2) + (W+FV)×ℓ3G/(ℓ2×nt1)",
                  result: `${anchorResult.pulloutFormula1Kn.toFixed(3)} kN/本`,
                },
                {
                  formula: "Rb(②式) = FH×(ℓ2−ℓ2G)/(ℓ2×nt1) + (W+FV)×ℓ3G/(ℓ2×nt1)",
                  result: `${anchorResult.pulloutFormula2Kn.toFixed(3)} kN/本`,
                },
                {
                  formula: `${t("seismicCalc.governingFormula")}: ${anchorResult.governingFormula}`,
                  result: `Rb = ${anchorResult.pulloutForceKn.toFixed(3)} kN/本`,
                },
                {
                  formula: "Q = √(FH² + (W+FV)²) / n",
                  result: `${anchorResult.shearForcePerBoltKn.toFixed(3)} kN/本`,
                },
              ]}
            />
          )}

          {anchorResult && (
            <WhyDisclosure label={t("seismicCalc.whyRbQLabel")} title={t("seismicCalc.whyRbQTitleWall")}>
              {t("seismicCalc.whyRbQBodyWall")}
            </WhyDisclosure>
          )}
        </div>

        <div className="lg:pt-8">
          <OutlineDrawingUpload calculationType={CALCULATION_TYPE} onChange={setOutlineDrawing} heightClass="h-[440px]" />
          <p className="mt-1.5 text-[10.5px] text-muted-2">{t("seismicCalc.outlineDrawingHintWall")}</p>
        </div>
      </div>

      <AnchorBoltSection
        value={bolt}
        onChange={setBolt}
        allowables={allowables}
        pulloutForceKn={anchorResult ? anchorResult.pulloutForceKn : null}
        shearForcePerBoltKn={anchorResult ? anchorResult.shearForcePerBoltKn : null}
      />

      <SourceNote title={t("seismicCalc.wallSourceTitle")} body={t("seismicCalc.wallSourceBody")} />

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
