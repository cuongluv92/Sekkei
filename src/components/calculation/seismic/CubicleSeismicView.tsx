"use client";

import { Loader2, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { calculationRecordService } from "@/lib/services";
import {
  computeCubicleAnchorTension,
  computeCubicleForces,
  computeCubicleHorizontalIntensity,
  computeCubicleShear,
  CUBICLE_ANCHOR_METHOD_LABEL,
  CUBICLE_CONCRETE_THICKNESS_MM,
  CUBICLE_KS_TABLE,
  lookupCubicleRegionZ,
  selectCubicleAnchorBolt,
  type CubicleAnchorMethod,
  type CubicleConcreteThicknessMm,
  type CubicleInstallFloor,
} from "@/lib/calc/seismic/cubicleAnchor";
import { OutlineDrawingUpload, type OutlineDrawingRef } from "@/components/calculation/OutlineDrawingUpload";

const ALL_PREFECTURES = [
  "北海道", "青森", "岩手", "宮城", "秋田", "山形", "福島",
  "茨城", "栃木", "群馬", "埼玉", "千葉", "東京", "神奈川",
  "新潟", "富山", "石川", "福井", "山梨", "長野", "岐阜", "静岡", "愛知", "三重",
  "滋賀", "京都", "大阪", "兵庫", "奈良", "和歌山",
  "鳥取", "島根", "岡山", "広島", "山口",
  "徳島", "香川", "愛媛", "高知",
  "福岡", "佐賀", "長崎", "熊本", "大分", "宮崎", "鹿児島", "沖縄",
];

interface ForceInputState {
  prefecture: string;
  floor: CubicleInstallFloor;
  weightKgfRaw: string;
}
function blankForce(): ForceInputState {
  return { prefecture: "東京", floor: "middle", weightKgfRaw: "" };
}

interface GeometryInputState {
  centerOfGravityHeightMmRaw: string; // H
  horizontalPitchMmRaw: string; // L
  depthPitchMmRaw: string; // l
  totalBoltCountRaw: string; // N
  horizontalSideBoltCountRaw: string; // Nt
  depthSideBoltCountRaw: string; // nt
}
function blankGeometry(): GeometryInputState {
  return {
    centerOfGravityHeightMmRaw: "",
    horizontalPitchMmRaw: "",
    depthPitchMmRaw: "",
    totalBoltCountRaw: "",
    horizontalSideBoltCountRaw: "",
    depthSideBoltCountRaw: "",
  };
}

interface BoltSelectionInputState {
  method: CubicleAnchorMethod;
  concreteThicknessMm: CubicleConcreteThicknessMm;
}
function blankBoltSelection(): BoltSelectionInputState {
  return { method: "mechanical", concreteThicknessMm: 150 };
}

interface SavedInput {
  force: ForceInputState;
  geometry: GeometryInputState;
  boltSelection: BoltSelectionInputState;
  outlineDrawing?: OutlineDrawingRef | null;
}

const CALCULATION_TYPE = "seismic-cubicle";

/**
 * キュービクル形盤の耐震計算 — 提供された実際の社内Excelツール
 * (キュービクル.xlsx、株式会社ニシナ製作所) に基づく。自立形・壁掛形と
 * 異なり、単位はkgf、地域係数Z・設置階係数Ksの表もこのツール独自の値、
 * アンカーボルトの選定も許容応力度ではなく許容荷重(kgf)を表から直接引く
 * 方式 — 詳細は下部「計算根拠」を参照。
 */
export function CubicleSeismicView({ caseId }: { caseId: string }) {
  const { t } = useTranslation();
  const [force, setForce] = useState<ForceInputState>(blankForce());
  const [geometry, setGeometry] = useState<GeometryInputState>(blankGeometry());
  const [boltSelection, setBoltSelection] = useState<BoltSelectionInputState>(blankBoltSelection());
  const [outlineDrawing, setOutlineDrawing] = useState<OutlineDrawingRef | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    setLoaded(false);
    if (!caseId) {
      setForce(blankForce());
      setGeometry(blankGeometry());
      setBoltSelection(blankBoltSelection());
      setOutlineDrawing(null);
      setLoaded(true);
      return;
    }
    let cancelled = false;
    calculationRecordService.get(caseId, CALCULATION_TYPE).then((record) => {
      if (cancelled) return;
      const saved = record?.input as unknown as SavedInput | undefined;
      setForce(saved?.force ?? blankForce());
      setGeometry(saved?.geometry ?? blankGeometry());
      setBoltSelection(saved?.boltSelection ?? blankBoltSelection());
      setOutlineDrawing(saved?.outlineDrawing ?? null);
      setSavedAt(record?.updatedAt ?? null);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [caseId]);

  const z = lookupCubicleRegionZ(force.prefecture);
  const ks = CUBICLE_KS_TABLE[force.floor];
  const kh = computeCubicleHorizontalIntensity(z, ks);
  const weightKgf = Number(force.weightKgfRaw);
  const weightValid = Number.isFinite(weightKgf) && weightKgf > 0;
  const forces = weightValid ? computeCubicleForces(kh, weightKgf) : null;

  const heightMm = Number(geometry.centerOfGravityHeightMmRaw);
  const horizontalPitchMm = Number(geometry.horizontalPitchMmRaw);
  const depthPitchMm = Number(geometry.depthPitchMmRaw);
  const totalBoltCount = Number(geometry.totalBoltCountRaw);
  const horizontalSideBoltCount = Number(geometry.horizontalSideBoltCountRaw);
  const depthSideBoltCount = Number(geometry.depthSideBoltCountRaw);
  const geometryValid = [heightMm, horizontalPitchMm, depthPitchMm, totalBoltCount, horizontalSideBoltCount, depthSideBoltCount].every(
    (v) => Number.isFinite(v) && v > 0,
  );

  const tension =
    forces && geometryValid
      ? computeCubicleAnchorTension(forces.fhKgf, weightKgf, forces.fvKgf, {
          centerOfGravityHeightMm: heightMm,
          horizontalPitchMm,
          depthPitchMm,
          totalBoltCount,
          horizontalSideBoltCount,
          depthSideBoltCount,
        })
      : null;
  const shearKgf = forces && geometryValid ? computeCubicleShear(forces.fhKgf, totalBoltCount) : null;

  const boltResult =
    tension && shearKgf != null
      ? selectCubicleAnchorBolt({
          tensionKgf: tension.tensionKgf,
          shearKgf,
          method: boltSelection.method,
          concreteThicknessMm: boltSelection.concreteThicknessMm,
        })
      : null;

  async function handleSave() {
    if (!caseId) return;
    setSaving(true);
    try {
      const saved = await calculationRecordService.save(
        caseId,
        CALCULATION_TYPE,
        { force, geometry, boltSelection, outlineDrawing } as unknown as Record<string, unknown>,
        boltResult ? { selectedBolt: boltResult.selectedBolt, recommendedBolt: boltResult.recommendedBolt } : {},
      );
      setSavedAt(saved.updatedAt);
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) {
    return <div className="py-8 text-center text-[13px] text-muted">{t("common.loading")}</div>;
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h3 className="text-[15px] font-bold">{t("seismicCalc.cubicleTitle")}</h3>
        <p className="text-[12px] text-muted">{t("seismicCalc.cubicleDescription")}</p>
      </div>

      {/* ①地震入力 */}
      <div className="flex flex-col gap-3">
        <SectionBadge label={t("seismicCalc.manualInputBadge")} title={t("seismicCalc.section1TitleCubicle")} />
        <p className="text-[12px] text-muted">{t("seismicCalc.section1HintCubicle")}</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="field-label">{t("seismicCalc.prefectureLabel")}</label>
            <select value={force.prefecture} onChange={(e) => setForce({ ...force, prefecture: e.target.value })} className="field-input">
              {ALL_PREFECTURES.map((p) => (
                <option key={p} value={p}>
                  {p}（Z={lookupCubicleRegionZ(p).toFixed(1)}）
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label">{t("seismicCalc.floorPositionLabel")}</label>
            <select value={force.floor} onChange={(e) => setForce({ ...force, floor: e.target.value as CubicleInstallFloor })} className="field-input">
              <option value="upper">{t("seismicCalc.cubicleFloor.upper")}（Ks={CUBICLE_KS_TABLE.upper}）</option>
              <option value="middle">{t("seismicCalc.cubicleFloor.middle")}（Ks={CUBICLE_KS_TABLE.middle}）</option>
              <option value="ground">{t("seismicCalc.cubicleFloor.ground")}（Ks={CUBICLE_KS_TABLE.ground}）</option>
            </select>
          </div>
          <div>
            <label className="field-label">{t("seismicCalc.weightLabelKgf")}</label>
            <input
              type="number"
              min={0}
              step="any"
              value={force.weightKgfRaw}
              onChange={(e) => setForce({ ...force, weightKgfRaw: e.target.value })}
              placeholder={t("seismicCalc.weightPlaceholder")}
              className="field-input"
            />
          </div>
        </div>

        <FormulaBlock
          badge={t("seismicCalc.autoCalcBadge")}
          lines={[
            { formula: "Kh = Z × Ks", substituted: `${z.toFixed(1)} × ${ks.toFixed(1)}`, result: `${kh.toFixed(3)}` },
            { formula: "Fh = Kh × Wg", substituted: forces ? `${kh.toFixed(3)} × ${weightKgf}` : "—", result: forces ? `${forces.fhKgf.toFixed(2)} kgf` : "—" },
            { formula: "Fv = Fh / 2", substituted: forces ? `${forces.fhKgf.toFixed(2)} / 2` : "—", result: forces ? `${forces.fvKgf.toFixed(2)} kgf` : "—" },
          ]}
        />
      </div>

      {/* ②盤諸元 + 外形図（右側） */}
      <div className="grid grid-cols-1 gap-4 border-t border-border pt-4 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-3">
          <SectionBadge label={t("seismicCalc.manualInputBadge")} title={t("seismicCalc.section2TitleCubicle")} />
          <p className="text-[12px] text-muted">{t("seismicCalc.section2HintCubicle")}</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <GeoField label="H" hintKey="seismicCalc.cubicleHHint" value={geometry.centerOfGravityHeightMmRaw} onChange={(v) => setGeometry({ ...geometry, centerOfGravityHeightMmRaw: v })} />
            <GeoField label="L" hintKey="seismicCalc.cubicleLHint" value={geometry.horizontalPitchMmRaw} onChange={(v) => setGeometry({ ...geometry, horizontalPitchMmRaw: v })} />
            <GeoField label="l" hintKey="seismicCalc.cubicleSmallLHint" value={geometry.depthPitchMmRaw} onChange={(v) => setGeometry({ ...geometry, depthPitchMmRaw: v })} />
            <GeoField label="N" hintKey="seismicCalc.cubicleNHint" value={geometry.totalBoltCountRaw} onChange={(v) => setGeometry({ ...geometry, totalBoltCountRaw: v })} />
            <GeoField label="Nt" hintKey="seismicCalc.cubicleNtHint" value={geometry.horizontalSideBoltCountRaw} onChange={(v) => setGeometry({ ...geometry, horizontalSideBoltCountRaw: v })} />
            <GeoField label="nt" hintKey="seismicCalc.cubicleSmallNtHint" value={geometry.depthSideBoltCountRaw} onChange={(v) => setGeometry({ ...geometry, depthSideBoltCountRaw: v })} />
          </div>

          {tension && (
            <FormulaBlock
              badge={t("seismicCalc.autoCalcBadge")}
              lines={[
                { formula: "R1 = (Fh×H − (Wg−Fv)×L/2) / (L×Nt)", substituted: "", result: `${tension.tensionHorizontalKgf.toFixed(2)} kgf/本` },
                { formula: "R2 = (Fh×H − (Wg−Fv)×l/2) / (l×nt)", substituted: "", result: `${tension.tensionDepthKgf.toFixed(2)} kgf/本` },
                { formula: `${t("seismicCalc.governingDirection")}: ${tension.governingDirection === "horizontal" ? t("seismicCalc.cubicleHorizontalDirection") : t("seismicCalc.cubicleDepthDirection")}`, substituted: "", result: `R = ${tension.tensionKgf.toFixed(2)} kgf/本` },
                { formula: "Q = Fh / N", substituted: "", result: shearKgf != null ? `${shearKgf.toFixed(2)} kgf/本` : "—" },
              ]}
            />
          )}
        </div>

        {caseId && (
          <div className="lg:pt-8">
            <OutlineDrawingUpload caseId={caseId} calculationType={CALCULATION_TYPE} value={outlineDrawing} onChange={setOutlineDrawing} />
            <p className="mt-1.5 text-[10.5px] text-muted-2">{t("seismicCalc.cubicleOutlineDrawingHint")}</p>
          </div>
        )}
      </div>

      {/* ③アンカーボルトの選定 */}
      <div className="flex flex-col gap-3 border-t border-border pt-4">
        <SectionBadge label={t("seismicCalc.manualInputBadge")} title={t("seismicCalc.section3TitleCubicle")} />
        <p className="text-[12px] text-muted">{t("seismicCalc.section3HintCubicle")}</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="field-label">{t("seismicCalc.anchorMethodLabel")}</label>
            <select
              value={boltSelection.method}
              onChange={(e) => setBoltSelection({ ...boltSelection, method: e.target.value as CubicleAnchorMethod })}
              className="field-input"
            >
              {(Object.keys(CUBICLE_ANCHOR_METHOD_LABEL) as CubicleAnchorMethod[]).map((m) => (
                <option key={m} value={m}>
                  {CUBICLE_ANCHOR_METHOD_LABEL[m]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label">{t("seismicCalc.concreteThicknessLabel")}</label>
            <select
              value={boltSelection.concreteThicknessMm}
              onChange={(e) => setBoltSelection({ ...boltSelection, concreteThicknessMm: Number(e.target.value) as CubicleConcreteThicknessMm })}
              className="field-input"
            >
              {CUBICLE_CONCRETE_THICKNESS_MM.map((mm) => (
                <option key={mm} value={mm}>
                  {mm} mm
                </option>
              ))}
            </select>
          </div>
        </div>

        {boltResult && (
          <div className="flex flex-col gap-2 pt-1">
            <div className="flex items-center gap-2">
              <span className="rounded border border-border px-1.5 py-0.5 text-[10px] font-semibold text-muted-2">
                {t("seismicCalc.autoCalcBadge")}
              </span>
              <span className="text-[11px] text-muted-2">{t("seismicCalc.section3AutoHintCubicle")}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <ResultStat label={t("seismicCalc.cubicleTensionBolt")} value={boltResult.tensionBolt ?? t("seismicCalc.cubicleNoBoltFits")} />
              <ResultStat label={t("seismicCalc.cubicleShearBolt")} value={boltResult.shearBolt ?? t("seismicCalc.cubicleNoBoltFits")} />
              <ResultStat label={t("seismicCalc.cubiclePulloutBolt")} value={boltResult.pulloutBolt ?? t("seismicCalc.cubicleNoBoltFits")} />
              <ResultStat label={t("seismicCalc.cubicleSelectedBolt")} value={boltResult.recommendedBolt ?? t("seismicCalc.cubicleNoBoltFits")} highlight />
            </div>
            {boltResult.recommendedBolt && boltResult.selectedBolt !== boltResult.recommendedBolt && (
              <p className="text-[11px] text-muted-2">{t("seismicCalc.cubicleRecommendNote")}</p>
            )}
          </div>
        )}
      </div>

      {/* 計算根拠・出典 */}
      <div className="flex flex-col gap-1.5 rounded-md border border-border bg-muted/10 px-3 py-2.5">
        <span className="text-[11px] font-bold text-foreground">{t("seismicCalc.cubicleSourceTitle")}</span>
        <p className="text-[11px] leading-relaxed text-muted-2">{t("seismicCalc.cubicleSourceBody")}</p>
      </div>

      <div className="flex items-center gap-2 border-t border-border pt-3">
        <button onClick={handleSave} disabled={!caseId || saving} className="btn-primary">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          {t("common.save")}
        </button>
        {savedAt && <span className="text-[11px] text-muted-2">{t("seismicCalc.savedAt", { date: savedAt.slice(0, 10) })}</span>}
      </div>
    </div>
  );
}

function SectionBadge({ label, title }: { label: string; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="rounded bg-accent px-1.5 py-0.5 text-[10px] font-bold text-accent-foreground">{label}</span>
      <span className="panel-title">{title}</span>
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

function ResultStat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-md border px-2.5 py-2 ${highlight ? "border-accent bg-accent/10" : "border-border bg-muted/10"}`}>
      <div className="font-mono text-[10.5px] text-muted-2">{label}</div>
      <div className={`font-mono text-[14px] font-semibold ${highlight ? "text-accent" : "text-foreground"}`}>{value}</div>
    </div>
  );
}

/** 計算結果の横に、実際に使った式と代入値をそのまま表示する — 数値だけでなく計算過程を追えるようにする。 */
function FormulaBlock({ badge, lines }: { badge: string; lines: { formula: string; substituted: string; result: string }[] }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-border bg-muted/10 px-3 py-2.5">
      <span className="w-fit rounded border border-border px-1.5 py-0.5 text-[10px] font-semibold text-muted-2">{badge}</span>
      {lines.map((line, i) => (
        <div key={i} className="flex flex-wrap items-baseline gap-x-2 font-mono text-[11.5px]">
          <span className="text-muted-2">{line.formula}</span>
          {line.substituted && <span className="text-muted-2">= {line.substituted}</span>}
          <span className="font-semibold text-foreground">= {line.result}</span>
        </div>
      ))}
    </div>
  );
}
