"use client";

import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { listManufacturers, preloadManufacturers } from "@/lib/mock/manufacturers";
import { seismicAnchorBoltService, type SeismicAnchorAllowableDraft } from "@/lib/services";
import type { BoltDiameter, SeismicAnchorAllowable } from "@/lib/types";

const BOLT_DIAMETERS: BoltDiameter[] = ["M8", "M10", "M12", "M16", "M20", "M24"];

function emptyDraft(manufacturerId: string, method: string): SeismicAnchorAllowableDraft {
  return { manufacturerId, method, boltDiameter: "M12", concreteThicknessMm: 0, allowablePulloutKn: 0, remarks: "" };
}

/**
 * あと施工アンカーボルトの許容引抜荷重 (Ta) 社内選定マスタの CRUD 画面 —
 * JSIA-T1018 の判定式 Rb≦Ta で使う唯一のデータ源。会社が実際に使う製品/
 * 施工方法だけを登録する (カタログを丸ごと登録する場ではない)。
 */
export function SeismicAnchorBoltSettings() {
  const { t, locale } = useTranslation();
  const [rows, setRows] = useState<SeismicAnchorAllowable[]>([]);
  const [loading, setLoading] = useState(true);
  const [, forceRerender] = useState(0);
  const [draft, setDraft] = useState<SeismicAnchorAllowableDraft>(emptyDraft("", ""));

  function load() {
    seismicAnchorBoltService.list().then((list) => {
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
    if (!draft.manufacturerId || !draft.method.trim() || draft.concreteThicknessMm <= 0 || draft.allowablePulloutKn <= 0) return;
    await seismicAnchorBoltService.create(draft);
    setDraft(emptyDraft(draft.manufacturerId, draft.method));
    load();
  }

  async function handleRemove(id: string) {
    await seismicAnchorBoltService.remove(id);
    load();
  }

  const canAdd =
    draft.manufacturerId !== "" && draft.method.trim() !== "" && draft.concreteThicknessMm > 0 && draft.allowablePulloutKn > 0;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[12px] text-muted">{t("seismicAnchorBoltSettings.description")}</p>

      <div className="data-table-wrap max-h-[40vh]">
        <table className="data-table" style={{ minWidth: 900 }}>
          <thead>
            <tr>
              <th style={{ width: "130px" }}>{t("seismicAnchorBoltSettings.columns.maker")}</th>
              <th style={{ width: "180px" }}>{t("seismicAnchorBoltSettings.columns.method")}</th>
              <th style={{ width: "80px" }}>{t("seismicAnchorBoltSettings.columns.diameter")}</th>
              <th style={{ width: "110px" }} className="text-right">{t("seismicAnchorBoltSettings.columns.concreteThickness")}</th>
              <th style={{ width: "100px" }} className="text-right">{t("seismicAnchorBoltSettings.columns.allowablePullout")}</th>
              <th>{t("seismicAnchorBoltSettings.columns.remarks")}</th>
              <th style={{ width: "40px" }} />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="py-6 text-center text-muted">
                  {t("common.loading")}
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-6 text-center text-muted-2">
                  {t("seismicAnchorBoltSettings.emptyList")}
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id}>
                  <td>{manufacturerName(r.manufacturerId)}</td>
                  <td>{r.method}</td>
                  <td>{r.boltDiameter}</td>
                  <td className="text-right font-mono">{r.concreteThicknessMm}mm</td>
                  <td className="text-right font-mono">{r.allowablePulloutKn}kN</td>
                  <td className="text-muted">{r.remarks || "—"}</td>
                  <td>
                    <button onClick={() => handleRemove(r.id)} className="btn-ghost btn-icon text-danger hover:bg-danger/10">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-2 gap-2.5 border-t border-border pt-3 sm:grid-cols-3 lg:grid-cols-7 lg:items-end">
        <div>
          <label className="field-label">{t("seismicAnchorBoltSettings.columns.maker")}</label>
          <select value={draft.manufacturerId} onChange={(e) => setDraft({ ...draft, manufacturerId: e.target.value })} className="field-input">
            <option value="">{t("common.unsetManufacturer")}</option>
            {manufacturers.map((m) => (
              <option key={m.id} value={m.id}>
                {locale === "vi" && m.nameVi ? m.nameVi : m.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label">{t("seismicAnchorBoltSettings.columns.method")}</label>
          <input value={draft.method} onChange={(e) => setDraft({ ...draft, method: e.target.value })} className="field-input" placeholder={t("seismicAnchorBoltSettings.methodPlaceholder")} />
        </div>
        <div>
          <label className="field-label">{t("seismicAnchorBoltSettings.columns.diameter")}</label>
          <select value={draft.boltDiameter} onChange={(e) => setDraft({ ...draft, boltDiameter: e.target.value as BoltDiameter })} className="field-input">
            {BOLT_DIAMETERS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label">{t("seismicAnchorBoltSettings.columns.concreteThickness")}</label>
          <input
            type="number"
            min={0}
            step="any"
            value={draft.concreteThicknessMm || ""}
            onChange={(e) => setDraft({ ...draft, concreteThicknessMm: Number(e.target.value) })}
            className="field-input"
          />
        </div>
        <div>
          <label className="field-label">{t("seismicAnchorBoltSettings.columns.allowablePullout")}</label>
          <input
            type="number"
            min={0}
            step="any"
            value={draft.allowablePulloutKn || ""}
            onChange={(e) => setDraft({ ...draft, allowablePulloutKn: Number(e.target.value) })}
            className="field-input"
          />
        </div>
        <div>
          <label className="field-label">{t("seismicAnchorBoltSettings.columns.remarks")}</label>
          <input value={draft.remarks} onChange={(e) => setDraft({ ...draft, remarks: e.target.value })} className="field-input" />
        </div>
        <button onClick={handleAdd} disabled={!canAdd} className="btn-secondary">
          <Plus className="h-3.5 w-3.5" />
          {t("seismicAnchorBoltSettings.addButton")}
        </button>
      </div>
    </div>
  );
}
