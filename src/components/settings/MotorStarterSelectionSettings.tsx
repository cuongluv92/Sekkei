"use client";

import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { listManufacturers, preloadManufacturers } from "@/lib/mock/manufacturers";
import { motorStarterSelectionService, type MotorStarterSelectionDraft } from "@/lib/services";
import type { MotorStarterSelection, SelectionCircuitType, SelectionVoltageClass } from "@/lib/types";

const VOLTAGE_CLASSES: SelectionVoltageClass[] = ["100V", "200V", "400V"];
const CIRCUIT_TYPES: SelectionCircuitType[] = ["direct", "starDelta", "inverter"];

function emptyDraft(manufacturerId: string): MotorStarterSelectionDraft {
  return {
    manufacturerId,
    voltageClass: "200V",
    circuitType: "direct",
    motorKw: 0,
    ratedCurrent: 0,
    breakerModel: "",
    ctModel: "",
    ctRatio: "",
    amRange: "",
    contactorModel: "",
    inverterModel: "",
    wireSize: "",
    remarks: "",
  };
}

/**
 * 電動機回路選定マスタ (motor_starter_selections) の CRUD 画面 — 会社が
 * 実際に使うメーカー・電圧クラス・回路方式ごとの機器組み合わせだけを登録する
 * (カタログを丸ごと登録する場ではない)。項目数が多いので2段グリッドの
 * フォームでまとめて入力できるようにしてある。
 */
export function MotorStarterSelectionSettings() {
  const { t, locale } = useTranslation();
  const [rows, setRows] = useState<MotorStarterSelection[]>([]);
  const [loading, setLoading] = useState(true);
  const [, forceRerender] = useState(0);
  const [draft, setDraft] = useState<MotorStarterSelectionDraft>(emptyDraft(""));

  function load() {
    motorStarterSelectionService.list().then((list) => {
      setRows(list);
      setLoading(false);
    });
  }

  useEffect(() => {
    preloadManufacturers().then(() => forceRerender((v) => v + 1));
    load();
  }, []);

  const manufacturers = listManufacturers();

  function manufacturerName(id: string): string {
    const m = manufacturers.find((mm) => mm.id === id);
    if (!m) return id;
    return locale === "vi" && m.nameVi ? m.nameVi : m.name;
  }

  async function handleAdd() {
    if (!draft.manufacturerId || draft.motorKw <= 0 || draft.ratedCurrent <= 0) return;
    await motorStarterSelectionService.create(draft);
    setDraft({ ...emptyDraft(draft.manufacturerId), voltageClass: draft.voltageClass, circuitType: draft.circuitType });
    load();
  }

  async function handleRemove(id: string) {
    await motorStarterSelectionService.remove(id);
    load();
  }

  const canAdd = draft.manufacturerId !== "" && draft.motorKw > 0 && draft.ratedCurrent > 0;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[12px] text-muted">{t("motorStarterSelectionSettings.description")}</p>

      <div className="data-table-wrap max-h-[40vh]">
        <table className="data-table" style={{ minWidth: 1400 }}>
          <thead>
            <tr>
              <th style={{ width: "120px" }}>{t("motorStarterSelectionSettings.columns.maker")}</th>
              <th style={{ width: "80px" }}>{t("motorStarterSelectionSettings.columns.voltage")}</th>
              <th style={{ width: "100px" }}>{t("motorStarterSelectionSettings.columns.circuit")}</th>
              <th style={{ width: "80px" }} className="text-right">{t("motorStarterSelectionSettings.columns.motorKw")}</th>
              <th style={{ width: "90px" }} className="text-right">{t("motorStarterSelectionSettings.columns.ratedCurrent")}</th>
              <th style={{ width: "130px" }}>{t("motorStarterSelectionSettings.columns.breakerModel")}</th>
              <th style={{ width: "110px" }}>{t("motorStarterSelectionSettings.columns.ctModel")}</th>
              <th style={{ width: "90px" }}>{t("motorStarterSelectionSettings.columns.ctRatio")}</th>
              <th style={{ width: "90px" }}>{t("motorStarterSelectionSettings.columns.amRange")}</th>
              <th style={{ width: "140px" }}>{t("motorStarterSelectionSettings.columns.contactorModel")}</th>
              <th style={{ width: "130px" }}>{t("motorStarterSelectionSettings.columns.inverterModel")}</th>
              <th style={{ width: "110px" }}>{t("motorStarterSelectionSettings.columns.wireSize")}</th>
              <th>{t("motorStarterSelectionSettings.columns.remarks")}</th>
              <th style={{ width: "40px" }} />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={14} className="py-6 text-center text-muted">
                  {t("common.loading")}
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={14} className="py-6 text-center text-muted-2">
                  {t("motorStarterSelectionSettings.emptyList")}
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id}>
                  <td>{manufacturerName(r.manufacturerId)}</td>
                  <td>{r.voltageClass}</td>
                  <td>{t(`motorSelection.circuitTypes.${r.circuitType}`)}</td>
                  <td className="text-right font-mono">{r.motorKw}</td>
                  <td className="text-right font-mono">{r.ratedCurrent}</td>
                  <td className="font-mono text-[12px]">{r.breakerModel || "—"}</td>
                  <td className="font-mono text-[12px]">{r.ctModel || "—"}</td>
                  <td className="font-mono text-[12px]">{r.ctRatio || "—"}</td>
                  <td className="font-mono text-[12px]">{r.amRange || "—"}</td>
                  <td className="font-mono text-[12px]">{r.contactorModel || "—"}</td>
                  <td className="font-mono text-[12px]">{r.inverterModel || "—"}</td>
                  <td className="font-mono text-[12px]">{r.wireSize || "—"}</td>
                  <td className="text-muted">{r.remarks || "—"}</td>
                  <td>
                    <button
                      onClick={() => handleRemove(r.id)}
                      className="btn-ghost btn-icon text-danger hover:bg-danger/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-2 border-t border-border pt-3">
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-5">
          <div>
            <label className="field-label">{t("motorSelection.manufacturerLabel")}</label>
            <select
              value={draft.manufacturerId}
              onChange={(e) => setDraft({ ...draft, manufacturerId: e.target.value })}
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
            <label className="field-label">{t("motorSelection.voltageClassLabel")}</label>
            <select
              value={draft.voltageClass}
              onChange={(e) => setDraft({ ...draft, voltageClass: e.target.value as SelectionVoltageClass })}
              className="field-input"
            >
              {VOLTAGE_CLASSES.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label">{t("motorSelection.circuitTypeLabel")}</label>
            <select
              value={draft.circuitType}
              onChange={(e) => setDraft({ ...draft, circuitType: e.target.value as SelectionCircuitType })}
              className="field-input"
            >
              {CIRCUIT_TYPES.map((c) => (
                <option key={c} value={c}>
                  {t(`motorSelection.circuitTypes.${c}`)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label">{t("motorStarterSelectionSettings.columns.motorKw")}</label>
            <input
              type="number"
              min={0}
              step="any"
              value={draft.motorKw || ""}
              onChange={(e) => setDraft({ ...draft, motorKw: Number(e.target.value) })}
              className="field-input"
            />
          </div>
          <div>
            <label className="field-label">{t("motorStarterSelectionSettings.columns.ratedCurrent")}</label>
            <input
              type="number"
              min={0}
              step="any"
              value={draft.ratedCurrent || ""}
              onChange={(e) => setDraft({ ...draft, ratedCurrent: Number(e.target.value) })}
              className="field-input"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-6">
          <div>
            <label className="field-label">{t("motorStarterSelectionSettings.columns.breakerModel")}</label>
            <input value={draft.breakerModel} onChange={(e) => setDraft({ ...draft, breakerModel: e.target.value })} className="field-input" />
          </div>
          <div>
            <label className="field-label">{t("motorStarterSelectionSettings.columns.ctModel")}</label>
            <input value={draft.ctModel} onChange={(e) => setDraft({ ...draft, ctModel: e.target.value })} className="field-input" />
          </div>
          <div>
            <label className="field-label">{t("motorStarterSelectionSettings.columns.ctRatio")}</label>
            <input value={draft.ctRatio} onChange={(e) => setDraft({ ...draft, ctRatio: e.target.value })} className="field-input" />
          </div>
          <div>
            <label className="field-label">{t("motorStarterSelectionSettings.columns.amRange")}</label>
            <input value={draft.amRange} onChange={(e) => setDraft({ ...draft, amRange: e.target.value })} className="field-input" />
          </div>
          <div>
            <label className="field-label">{t("motorStarterSelectionSettings.columns.contactorModel")}</label>
            <input
              value={draft.contactorModel}
              onChange={(e) => setDraft({ ...draft, contactorModel: e.target.value })}
              className="field-input"
            />
          </div>
          <div>
            <label className="field-label">{t("motorStarterSelectionSettings.columns.inverterModel")}</label>
            <input
              value={draft.inverterModel}
              onChange={(e) => setDraft({ ...draft, inverterModel: e.target.value })}
              className="field-input"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:items-end lg:[grid-template-columns:1fr_2fr_auto]">
          <div>
            <label className="field-label">{t("motorStarterSelectionSettings.columns.wireSize")}</label>
            <input value={draft.wireSize} onChange={(e) => setDraft({ ...draft, wireSize: e.target.value })} className="field-input" />
          </div>
          <div>
            <label className="field-label">{t("motorStarterSelectionSettings.columns.remarks")}</label>
            <input value={draft.remarks} onChange={(e) => setDraft({ ...draft, remarks: e.target.value })} className="field-input" />
          </div>
          <button onClick={handleAdd} disabled={!canAdd} className="btn-secondary">
            <Plus className="h-3.5 w-3.5" />
            {t("motorStarterSelectionSettings.addButton")}
          </button>
        </div>
      </div>
    </div>
  );
}
