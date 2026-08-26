"use client";

import { useTranslation } from "@/lib/i18n";
import { WhyDisclosure, WhyTable } from "@/components/calculation/FormulaBlock";
import {
  computeHorizontalForce,
  computeKh,
  computeVerticalForce,
  weightKgToKn,
} from "@/lib/calc/seismic/seismicForce";
import {
  getStandardSeismicIntensity,
  SEISMIC_EQUIPMENT_IMPORTANCE,
  SEISMIC_FACILITY_CATEGORIES,
  SEISMIC_FLOOR_POSITIONS,
  type SeismicEquipmentImportanceValue,
  type SeismicFacilityCategoryValue,
  type SeismicFloorPositionValue,
} from "@/lib/calc/seismic/standardIntensity";

const REGION_Z_OPTIONS = [0.7, 0.8, 0.9, 1.0];

/** JSIA-T1018:2012 表1「局部震度法による建築設備機器の設計用標準震度(KS)」— 4組合せ×3階層=12値、全て標準本文で確認済み。 */
const KS_TABLE_ROWS: (string | number)[][] = [
  ["特定の施設", "重要機器", 2.0, 1.5, 1.0],
  ["特定の施設", "一般機器", 1.5, 1.0, 0.6],
  ["一般の施設", "重要機器", 1.5, 1.0, 0.6],
  ["一般の施設", "一般機器", 1.0, 0.6, 0.4],
];

/**
 * 地域係数Zの例 — 提供いただいたExcel(自立形シート 表10-15)に実際に載って
 * いる都道府県のみ(全47都道府県の網羅ではない)。Excelのセルを直接読み取り、
 * 手入力の書き写しではない。載っていない地域や不明な場合は1.0を選ぶ。
 */
const Z_TABLE_ROWS: (string | number)[][] = [
  [0.7, "沖縄"],
  [0.8, "山口・佐賀・福岡・長崎"],
  [0.9, "秋田・島根・愛媛・山形・岡山・高知・新潟・広島"],
  [1.0, "東京・大阪など、上記以外の全国"],
];

export interface SeismicForceInputState {
  facilityCategory: SeismicFacilityCategoryValue;
  importance: SeismicEquipmentImportanceValue;
  floorPosition: SeismicFloorPositionValue;
  regionZ: number;
  weightKgRaw: string;
}

export function blankSeismicForceInputState(): SeismicForceInputState {
  return { facilityCategory: "general", importance: "general", floorPosition: "middle", regionZ: 1.0, weightKgRaw: "" };
}

export interface SeismicForceResult {
  ks: number;
  kh: number;
  weightKn: number;
  horizontalForceKn: number;
  verticalForceKn: number;
}

export function computeSeismicForce(state: SeismicForceInputState): SeismicForceResult | null {
  const weightKg = Number(state.weightKgRaw);
  if (!Number.isFinite(weightKg) || weightKg <= 0) return null;
  const ks = getStandardSeismicIntensity(state.facilityCategory, state.importance, state.floorPosition);
  const kh = computeKh(state.regionZ, ks);
  const weightKn = weightKgToKn(weightKg);
  const horizontalForceKn = computeHorizontalForce(kh, weightKn);
  const verticalForceKn = computeVerticalForce(horizontalForceKn);
  return { ks, kh, weightKn, horizontalForceKn, verticalForceKn };
}

interface Props {
  value: SeismicForceInputState;
  onChange: (next: SeismicForceInputState) => void;
}

/**
 * JSIA-T1018:2012 4章「地震力」— 【１】地震入力の算出。3つの盤形式
 * (自立形/壁掛形/キュービクル) すべてに共通するセクション。ユーザーが
 * 入力するのは「施設・機器の分類」「設置階」「地域係数Z」「盤総重量」
 * だけで、KS・KH・FH・FV は表1・(4-1)〜(4-4)式から自動計算する — 手入力
 * 欄と自動計算欄をはっきり分けて表示する。
 */
export function SeismicForceSection({ value, onChange }: Props) {
  const { t } = useTranslation();
  const result = computeSeismicForce(value);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="rounded bg-accent px-1.5 py-0.5 text-[10px] font-bold text-accent-foreground">
          {t("seismicCalc.manualInputBadge")}
        </span>
        <span className="panel-title">{t("seismicCalc.section1Title")}</span>
      </div>
      <p className="text-[12px] text-muted">{t("seismicCalc.section1Hint")}</p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label className="field-label">{t("seismicCalc.facilityCategoryLabel")}</label>
          <select
            value={value.facilityCategory}
            onChange={(e) => onChange({ ...value, facilityCategory: e.target.value as SeismicFacilityCategoryValue })}
            className="field-input"
          >
            {SEISMIC_FACILITY_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {t(`seismicCalc.facilityCategory.${c}`)}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[11px] text-muted-2">{t("seismicCalc.facilityCategoryHint")}</p>
        </div>
        <div>
          <label className="field-label">{t("seismicCalc.importanceLabel")}</label>
          <select
            value={value.importance}
            onChange={(e) => onChange({ ...value, importance: e.target.value as SeismicEquipmentImportanceValue })}
            className="field-input"
          >
            {SEISMIC_EQUIPMENT_IMPORTANCE.map((imp) => (
              <option key={imp} value={imp}>
                {t(`seismicCalc.importance.${imp}`)}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[11px] text-muted-2">{t("seismicCalc.importanceHint")}</p>
        </div>
        <div>
          <label className="field-label">{t("seismicCalc.floorPositionLabel")}</label>
          <select
            value={value.floorPosition}
            onChange={(e) => onChange({ ...value, floorPosition: e.target.value as SeismicFloorPositionValue })}
            className="field-input"
          >
            {SEISMIC_FLOOR_POSITIONS.map((f) => (
              <option key={f} value={f}>
                {t(`seismicCalc.floorPosition.${f}`)}
              </option>
            ))}
          </select>
          <WhyDisclosure label={t("seismicCalc.whyKsLabel")} title={t("seismicCalc.whyKsTitle")}>
            <p className="mb-1.5">{t("seismicCalc.whyKsBody")}</p>
            <WhyTable headers={[t("seismicCalc.facilityCategoryLabel"), t("seismicCalc.importanceLabel"), t("seismicCalc.floorPosition.upper"), t("seismicCalc.floorPosition.middle"), t("seismicCalc.floorPosition.groundOrFirst")]} rows={KS_TABLE_ROWS} />
          </WhyDisclosure>
        </div>
        <div>
          <label className="field-label">{t("seismicCalc.regionZLabel")}</label>
          <select value={value.regionZ} onChange={(e) => onChange({ ...value, regionZ: Number(e.target.value) })} className="field-input">
            {REGION_Z_OPTIONS.map((z) => (
              <option key={z} value={z}>
                {z.toFixed(1)}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[11px] text-muted-2">{t("seismicCalc.regionZHint")}</p>
          <WhyDisclosure label={t("seismicCalc.whyZLabel")} title={t("seismicCalc.whyZTitle")}>
            <p className="mb-1.5">{t("seismicCalc.whyZBody")}</p>
            <WhyTable headers={["Z", t("seismicCalc.whyZTableRegionHeader")]} rows={Z_TABLE_ROWS} />
          </WhyDisclosure>
        </div>
        <div>
          <label className="field-label">{t("seismicCalc.weightLabel")}</label>
          <input
            type="number"
            min={0}
            step="any"
            value={value.weightKgRaw}
            onChange={(e) => onChange({ ...value, weightKgRaw: e.target.value })}
            placeholder={t("seismicCalc.weightPlaceholder")}
            className="field-input"
          />
          <p className="mt-1 text-[11px] text-muted-2">{t("seismicCalc.weightHint")}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 pt-1">
        <span className="rounded border border-border px-1.5 py-0.5 text-[10px] font-semibold text-muted-2">
          {t("seismicCalc.autoCalcBadge")}
        </span>
        <span className="text-[11px] text-muted-2">{t("seismicCalc.section1AutoHint")}</span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <ForceStat label="KS" value={result ? result.ks.toFixed(2) : "—"} unit="" />
        <ForceStat label="KH = Z × KS" value={result ? result.kh.toFixed(3) : "—"} unit="" />
        <ForceStat label="W" value={result ? result.weightKn.toFixed(3) : "—"} unit="kN" />
        <ForceStat label="FH = KH × W" value={result ? result.horizontalForceKn.toFixed(3) : "—"} unit="kN" />
        <ForceStat label="FV = FH / 2" value={result ? result.verticalForceKn.toFixed(3) : "—"} unit="kN" />
      </div>
    </div>
  );
}

function ForceStat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="rounded-md border border-border bg-muted/10 px-2.5 py-2">
      <div className="font-mono text-[10.5px] text-muted-2">{label}</div>
      <div className="font-mono text-[14px] font-semibold text-foreground">
        {value} <span className="text-[11px] font-normal text-muted-2">{unit}</span>
      </div>
    </div>
  );
}
