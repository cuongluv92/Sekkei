"use client";

import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { listManufacturers, preloadManufacturers } from "@/lib/mock/manufacturers";
import { mainBreakerSelectionService, type MainBreakerSelectionDraft } from "@/lib/services";
import type { MainBreakerSelection, SelectionVoltageClass } from "@/lib/types";

const VOLTAGE_CLASSES: SelectionVoltageClass[] = ["100V", "200V", "400V"];

function emptyDraft(manufacturerId: string, voltageClass: SelectionVoltageClass): MainBreakerSelectionDraft {
  return {
    manufacturerId,
    voltageClass,
    ratedCurrent: 0,
    breakerModel: "",
    poles: "",
    wireSize: "",
    remarks: "",
  };
}

/** 主幹（一次側）選定マスタ (main_breaker_selections) の CRUD 画面。 */
export function MainBreakerSelectionSettings() {
  const { t, locale } = useTranslation();
  const [rows, setRows] = useState<MainBreakerSelection[]>([]);
  const [loading, setLoading] = useState(true);
  const [, forceRerender] = useState(0);
  const [draft, setDraft] = useState<MainBreakerSelectionDraft>(emptyDraft("", "200V"));

  function load() {
    mainBreakerSelectionService.list().then((list) => {
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
    if (!draft.manufacturerId || draft.ratedCurrent <= 0 || !draft.breakerModel.trim()) return;
    await mainBreakerSelectionService.create(draft);
    setDraft(emptyDraft(draft.manufacturerId, draft.voltageClass));
    load();
  }

  async function handleRemove(id: string) {
    await mainBreakerSelectionService.remove(id);
    load();
  }

  const canAdd = draft.manufacturerId !== "" && draft.ratedCurrent > 0 && draft.breakerModel.trim() !== "";

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[12px] text-muted">{t("mainBreakerSelectionSettings.description")}</p>

      <div className="data-table-wrap max-h-[40vh]">
        <table className="data-table" style={{ minWidth: 900 }}>
          <thead>
            <tr>
              <th style={{ width: "140px" }}>{t("mainBreakerSelectionSettings.columns.maker")}</th>
              <th style={{ width: "90px" }}>{t("mainBreakerSelectionSettings.columns.voltage")}</th>
              <th style={{ width: "110px" }} className="text-right">{t("mainBreakerSelectionSettings.columns.ratedCurrent")}</th>
              <th style={{ width: "160px" }}>{t("mainBreakerSelectionSettings.columns.breakerModel")}</th>
              <th style={{ width: "80px" }}>{t("mainBreakerSelectionSettings.columns.poles")}</th>
              <th style={{ width: "120px" }}>{t("mainBreakerSelectionSettings.columns.wireSize")}</th>
              <th>{t("mainBreakerSelectionSettings.columns.remarks")}</th>
              <th style={{ width: "40px" }} />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="py-6 text-center text-muted">
                  {t("common.loading")}
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-6 text-center text-muted-2">
                  {t("mainBreakerSelectionSettings.emptyList")}
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id}>
                  <td>{manufacturerName(r.manufacturerId)}</td>
                  <td>{r.voltageClass}</td>
                  <td className="text-right font-mono">{r.ratedCurrent}</td>
                  <td className="font-mono text-[12px]">{r.breakerModel}</td>
                  <td>{r.poles || "—"}</td>
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

      <div className="grid grid-cols-2 gap-2.5 border-t border-border pt-3 sm:grid-cols-4 lg:grid-cols-7 lg:items-end">
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
          <label className="field-label">{t("mainBreakerSelectionSettings.columns.ratedCurrent")}</label>
          <input
            type="number"
            min={0}
            step="any"
            value={draft.ratedCurrent || ""}
            onChange={(e) => setDraft({ ...draft, ratedCurrent: Number(e.target.value) })}
            className="field-input"
          />
        </div>
        <div>
          <label className="field-label">{t("mainBreakerSelectionSettings.columns.breakerModel")}</label>
          <input value={draft.breakerModel} onChange={(e) => setDraft({ ...draft, breakerModel: e.target.value })} className="field-input" />
        </div>
        <div>
          <label className="field-label">{t("mainBreakerSelectionSettings.columns.poles")}</label>
          <input value={draft.poles} onChange={(e) => setDraft({ ...draft, poles: e.target.value })} className="field-input" />
        </div>
        <div>
          <label className="field-label">{t("mainBreakerSelectionSettings.columns.wireSize")}</label>
          <input value={draft.wireSize} onChange={(e) => setDraft({ ...draft, wireSize: e.target.value })} className="field-input" />
        </div>
        <button onClick={handleAdd} disabled={!canAdd} className="btn-secondary">
          <Plus className="h-3.5 w-3.5" />
          {t("mainBreakerSelectionSettings.addButton")}
        </button>
      </div>
    </div>
  );
}
