"use client";

import { useMemo } from "react";
import { useTranslation } from "@/lib/i18n";
import { listManufacturers } from "@/lib/mock/manufacturers";
import { findAllowablePulloutKn } from "@/lib/calc/seismic/anchorAllowableLookup";
import { BOLT_SHANK_AREA_MM2, judgeAnchorBolt } from "@/lib/calc/seismic/boltStress";
import type { BoltDiameter, BoltMaterial, SeismicAnchorAllowable } from "@/lib/types";

const BOLT_DIAMETERS: BoltDiameter[] = ["M8", "M10", "M12", "M16", "M20", "M24"];
const BOLT_MATERIALS: BoltMaterial[] = ["ss400", "stainless"];

export interface AnchorBoltInputState {
  material: BoltMaterial;
  diameter: BoltDiameter;
  manufacturerId: string;
  method: string;
  concreteThicknessMmRaw: string;
}

export function blankAnchorBoltInputState(): AnchorBoltInputState {
  return { material: "ss400", diameter: "M12", manufacturerId: "", method: "", concreteThicknessMmRaw: "" };
}

interface Props {
  value: AnchorBoltInputState;
  onChange: (next: AnchorBoltInputState) => void;
  allowables: SeismicAnchorAllowable[];
  /** Rb — pullout force per bolt (kN), from the panel-type-specific geometry calc. null until geometry is filled in. */
  pulloutForceKn: number | null;
  /** Q — shear force per bolt (kN). */
  shearForcePerBoltKn: number | null;
}

/**
 * JSIA-T1018:2012 5.2「アンカーボルトの選定」— 引抜力Rb・引張応力度σ・
 * せん断応力度τ を、社内選定マスタ (許容引抜荷重Ta) と表2 (許容応力度) に
 * 照らして3条件すべて判定する。3つの盤形式すべてで共通の最終セクション
 * (Rb/Q の求め方だけが盤形式ごとに違う)。
 */
export function AnchorBoltSection({ value, onChange, allowables, pulloutForceKn, shearForcePerBoltKn }: Props) {
  const { t, locale } = useTranslation();
  const manufacturers = listManufacturers();

  const methodOptions = useMemo(() => {
    const set = new Set(
      allowables.filter((a) => a.manufacturerId === value.manufacturerId && a.boltDiameter === value.diameter).map((a) => a.method),
    );
    return Array.from(set);
  }, [allowables, value.manufacturerId, value.diameter]);

  const areaMm2 = BOLT_SHANK_AREA_MM2[value.diameter];
  const tensileStress = pulloutForceKn !== null && pulloutForceKn > 0 ? pulloutForceKn / areaMm2 : 0;
  const shearStress = shearForcePerBoltKn !== null ? shearForcePerBoltKn / areaMm2 : null;

  const concreteThicknessMm = Number(value.concreteThicknessMmRaw);
  const allowableTaKn =
    value.manufacturerId && value.method && Number.isFinite(concreteThicknessMm) && concreteThicknessMm > 0
      ? findAllowablePulloutKn(allowables, {
          manufacturerId: value.manufacturerId,
          method: value.method,
          boltDiameter: value.diameter,
          concreteThicknessMm,
        })
      : null;

  const judgement =
    pulloutForceKn !== null && shearStress !== null
      ? judgeAnchorBolt({
          pulloutForceRbKn: pulloutForceKn,
          allowablePulloutTaKn: allowableTaKn,
          tensileStressSigma: tensileStress,
          shearStressTau: shearStress,
          material: value.material,
        })
      : null;

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-4">
      <div className="flex items-center gap-2">
        <span className="rounded bg-accent px-1.5 py-0.5 text-[10px] font-bold text-accent-foreground">
          {t("seismicCalc.manualInputBadge")}
        </span>
        <span className="panel-title">{t("seismicCalc.section3Title")}</span>
      </div>
      <p className="text-[12px] text-muted">{t("seismicCalc.section3Hint")}</p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <div>
          <label className="field-label">{t("seismicCalc.boltMaterialLabel")}</label>
          <select value={value.material} onChange={(e) => onChange({ ...value, material: e.target.value as BoltMaterial })} className="field-input">
            {BOLT_MATERIALS.map((m) => (
              <option key={m} value={m}>
                {t(`seismicCalc.boltMaterial.${m}`)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label">{t("seismicCalc.boltDiameterLabel")}</label>
          <select value={value.diameter} onChange={(e) => onChange({ ...value, diameter: e.target.value as BoltDiameter })} className="field-input">
            {BOLT_DIAMETERS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[11px] text-muted-2">A = {areaMm2}mm²</p>
        </div>
        <div>
          <label className="field-label">{t("seismicCalc.anchorManufacturerLabel")}</label>
          <select
            value={value.manufacturerId}
            onChange={(e) => onChange({ ...value, manufacturerId: e.target.value, method: "" })}
            className="field-input"
          >
            <option value="">{t("common.unsetManufacturer")}</option>
            {manufacturers.map((m) => (
              <option key={m.id} value={m.id}>
                {locale === "vi" && m.nameVi ? m.nameVi : m.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label">{t("seismicCalc.anchorMethodLabel")}</label>
          <select value={value.method} onChange={(e) => onChange({ ...value, method: e.target.value })} className="field-input">
            <option value="">—</option>
            {methodOptions.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label">{t("seismicCalc.concreteThicknessLabel")}</label>
          <input
            type="number"
            min={0}
            step="any"
            value={value.concreteThicknessMmRaw}
            onChange={(e) => onChange({ ...value, concreteThicknessMmRaw: e.target.value })}
            className="field-input"
          />
        </div>
      </div>
      {value.manufacturerId && methodOptions.length === 0 && (
        <p className="text-[11px] text-warning">{t("seismicCalc.noAllowableRegistered")}</p>
      )}

      <div className="flex items-center gap-2 pt-1">
        <span className="rounded border border-border px-1.5 py-0.5 text-[10px] font-semibold text-muted-2">
          {t("seismicCalc.autoCalcBadge")}
        </span>
        <span className="text-[11px] text-muted-2">{t("seismicCalc.section3AutoHint")}</span>
      </div>

      <div className="data-table-wrap">
        <table className="data-table" style={{ minWidth: 640 }}>
          <thead>
            <tr>
              <th>{t("seismicCalc.judgementItem")}</th>
              <th className="text-right">{t("seismicCalc.calculatedValue")}</th>
              <th className="text-right">{t("seismicCalc.allowableValue")}</th>
              <th style={{ width: "90px" }}>{t("seismicCalc.judgementResult")}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Rb ({t("seismicCalc.pulloutForce")})</td>
              <td className="text-right font-mono">{pulloutForceKn !== null ? `${pulloutForceKn.toFixed(3)} kN` : "—"}</td>
              <td className="text-right font-mono">{allowableTaKn !== null ? `${allowableTaKn.toFixed(2)} kN` : "—"}</td>
              <td>{judgement && <JudgementPill value={judgement.pulloutOk} />}</td>
            </tr>
            <tr>
              <td>σ ({t("seismicCalc.tensileStress")})</td>
              <td className="text-right font-mono">{judgement ? `${tensileStress.toFixed(4)} kN/mm²` : "—"}</td>
              <td className="text-right font-mono">{judgement ? `${judgement.tensileAllowable.toFixed(4)} kN/mm²` : "—"}</td>
              <td>{judgement && <JudgementPill value={judgement.tensileOk} />}</td>
            </tr>
            <tr>
              <td>τ ({t("seismicCalc.shearStress")})</td>
              <td className="text-right font-mono">{shearStress !== null ? `${shearStress.toFixed(4)} kN/mm²` : "—"}</td>
              <td className="text-right font-mono">—</td>
              <td>{judgement && <JudgementPill value={judgement.shearOk} />}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {judgement && (
        <div className={judgement.overallOk ? "rounded-md border border-success/40 bg-success/10 px-3 py-2" : "rounded-md border border-danger/40 bg-danger/10 px-3 py-2"}>
          <span className={judgement.overallOk ? "badge-success" : "badge-danger"}>
            {judgement.overallOk ? t("seismicCalc.overallPass") : t("seismicCalc.overallFail")}
          </span>
        </div>
      )}
    </div>
  );
}

function JudgementPill({ value }: { value: boolean | null }) {
  const { t } = useTranslation();
  if (value === null) return <span className="text-[11px] text-muted-2">{t("seismicCalc.notApplicable")}</span>;
  return <span className={value ? "badge-success" : "badge-danger"}>{value ? t("seismicCalc.pass") : t("seismicCalc.fail")}</span>;
}
