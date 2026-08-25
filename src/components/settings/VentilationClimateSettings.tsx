"use client";

import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { ventilationClimateProfileService, type VentilationClimateProfileDraft } from "@/lib/services";
import type { VentilationClimateProfile } from "@/lib/types";

function emptyDraft(): VentilationClimateProfileDraft {
  return {
    region: "",
    ambientTempC: 0,
    topTempC: 0,
    equivalentOutsideTempRoofC: 0,
    equivalentOutsideTempFace1C: 0,
    equivalentOutsideTempFace2C: 0,
    equivalentOutsideTempFace3C: 0,
    equivalentOutsideTempFace4C: 0,
    airSpecificHeatKjPerKgK: 1.02,
    airDensityKgPerM3: 1.15,
    remarks: "",
  };
}

/**
 * 屋外キュービクルの設計用気象条件 (地域別) 社内選定マスタの CRUD 画面 —
 * JSIA-T1016換気計算書の判定式で使う唯一のデータ源。東京・那覇の2地域は
 * 同標準準拠の計算書使用例からの検証済みの値で初期登録済み。他の地域を
 * 計算する場合は JSIA-T1016原本または自社の設計基準にある値を確認のうえ、
 * ここから追加登録する。
 */
export function VentilationClimateSettings() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<VentilationClimateProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<VentilationClimateProfileDraft>(emptyDraft());

  function load() {
    ventilationClimateProfileService.list().then((list) => {
      setRows(list);
      setLoading(false);
    });
  }

  useEffect(() => {
    load();
  }, []);

  async function handleAdd() {
    if (!draft.region.trim() || draft.ambientTempC <= 0 || draft.topTempC <= 0) return;
    await ventilationClimateProfileService.create(draft);
    setDraft(emptyDraft());
    load();
  }

  async function handleRemove(id: string) {
    await ventilationClimateProfileService.remove(id);
    load();
  }

  const canAdd = draft.region.trim() !== "" && draft.ambientTempC > 0 && draft.topTempC > 0;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[12px] text-muted">{t("ventilationClimateSettings.description")}</p>

      <div className="data-table-wrap max-h-[40vh]">
        <table className="data-table" style={{ minWidth: 1080 }}>
          <thead>
            <tr>
              <th style={{ width: "100px" }}>{t("ventilationClimateSettings.columns.region")}</th>
              <th style={{ width: "70px" }} className="text-right">to</th>
              <th style={{ width: "70px" }} className="text-right">tt</th>
              <th style={{ width: "70px" }} className="text-right">tSH</th>
              <th style={{ width: "70px" }} className="text-right">tSE</th>
              <th style={{ width: "70px" }} className="text-right">tWS</th>
              <th style={{ width: "70px" }} className="text-right">tNW</th>
              <th style={{ width: "70px" }} className="text-right">tNE</th>
              <th style={{ width: "70px" }} className="text-right">CP</th>
              <th style={{ width: "70px" }} className="text-right">ρE</th>
              <th>{t("ventilationClimateSettings.columns.remarks")}</th>
              <th style={{ width: "40px" }} />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={12} className="py-6 text-center text-muted">
                  {t("common.loading")}
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={12} className="py-6 text-center text-muted-2">
                  {t("ventilationClimateSettings.emptyList")}
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.region}</td>
                  <td className="text-right font-mono">{r.ambientTempC}</td>
                  <td className="text-right font-mono">{r.topTempC}</td>
                  <td className="text-right font-mono">{r.equivalentOutsideTempRoofC}</td>
                  <td className="text-right font-mono">{r.equivalentOutsideTempFace1C}</td>
                  <td className="text-right font-mono">{r.equivalentOutsideTempFace2C}</td>
                  <td className="text-right font-mono">{r.equivalentOutsideTempFace3C}</td>
                  <td className="text-right font-mono">{r.equivalentOutsideTempFace4C}</td>
                  <td className="text-right font-mono">{r.airSpecificHeatKjPerKgK}</td>
                  <td className="text-right font-mono">{r.airDensityKgPerM3}</td>
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

      <div className="grid grid-cols-2 gap-2.5 border-t border-border pt-3 sm:grid-cols-4 lg:grid-cols-6">
        <div>
          <label className="field-label">{t("ventilationClimateSettings.columns.region")}</label>
          <input value={draft.region} onChange={(e) => setDraft({ ...draft, region: e.target.value })} className="field-input" />
        </div>
        <NumInput label="to (℃)" value={draft.ambientTempC} onChange={(v) => setDraft({ ...draft, ambientTempC: v })} />
        <NumInput label="tt (℃)" value={draft.topTempC} onChange={(v) => setDraft({ ...draft, topTempC: v })} />
        <NumInput label="tSH" value={draft.equivalentOutsideTempRoofC} onChange={(v) => setDraft({ ...draft, equivalentOutsideTempRoofC: v })} />
        <NumInput label="tSE" value={draft.equivalentOutsideTempFace1C} onChange={(v) => setDraft({ ...draft, equivalentOutsideTempFace1C: v })} />
        <NumInput label="tWS" value={draft.equivalentOutsideTempFace2C} onChange={(v) => setDraft({ ...draft, equivalentOutsideTempFace2C: v })} />
        <NumInput label="tNW" value={draft.equivalentOutsideTempFace3C} onChange={(v) => setDraft({ ...draft, equivalentOutsideTempFace3C: v })} />
        <NumInput label="tNE" value={draft.equivalentOutsideTempFace4C} onChange={(v) => setDraft({ ...draft, equivalentOutsideTempFace4C: v })} />
        <NumInput label="CP" value={draft.airSpecificHeatKjPerKgK} onChange={(v) => setDraft({ ...draft, airSpecificHeatKjPerKgK: v })} />
        <NumInput label="ρE" value={draft.airDensityKgPerM3} onChange={(v) => setDraft({ ...draft, airDensityKgPerM3: v })} />
        <div>
          <label className="field-label">{t("ventilationClimateSettings.columns.remarks")}</label>
          <input value={draft.remarks} onChange={(e) => setDraft({ ...draft, remarks: e.target.value })} className="field-input" />
        </div>
        <button onClick={handleAdd} disabled={!canAdd} className="btn-secondary self-end">
          <Plus className="h-3.5 w-3.5" />
          {t("ventilationClimateSettings.addButton")}
        </button>
      </div>
    </div>
  );
}

function NumInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="field-label font-mono">{label}</label>
      <input
        type="number"
        step="any"
        value={value || ""}
        onChange={(e) => onChange(Number(e.target.value))}
        className="field-input"
      />
    </div>
  );
}
