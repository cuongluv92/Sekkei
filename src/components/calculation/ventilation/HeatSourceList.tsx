"use client";

import { Plus, Trash2 } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { sumHeatSourcesW, type HeatSourceItem } from "@/lib/calc/ventilation/heatBalance";

export function blankHeatSourceItem(): HeatSourceItem {
  return { name: "", heatW: 0 };
}

interface Props {
  value: HeatSourceItem[];
  onChange: (next: HeatSourceItem[]) => void;
}

/**
 * JSIA-T1016換気計算書 b)「盤内部発熱源」— 盤内の発熱機器を1台ずつ追加し、
 * 発熱量(W)は機器のカタログ損失値をそのまま手入力する (容量・負荷率からの
 * 自動換算はしない。実測/カタログの発熱量そのものを使うのが計算書の方式)。
 * 合計発熱量 Qc は単純合計として自動表示する。
 */
export function HeatSourceList({ value, onChange }: Props) {
  const { t } = useTranslation();
  const totalHeatW = sumHeatSourcesW(value);

  function updateItem(i: number, patch: Partial<HeatSourceItem>) {
    onChange(value.map((item, idx) => (idx === i ? { ...item, ...patch } : item)));
  }

  function addItem() {
    onChange([...value, blankHeatSourceItem()]);
  }

  function removeItem(i: number) {
    onChange(value.filter((_, idx) => idx !== i));
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="rounded bg-accent px-1.5 py-0.5 text-[10px] font-bold text-accent-foreground">
          {t("ventilationCalc.manualInputBadge")}
        </span>
        <span className="panel-title">{t("ventilationCalc.heatSourceTitle")}</span>
      </div>
      <p className="text-[12px] text-muted">{t("ventilationCalc.heatSourceHint")}</p>

      <div className="data-table-wrap">
        <table className="data-table" style={{ minWidth: 480 }}>
          <thead>
            <tr>
              <th>{t("ventilationCalc.heatSourceColumns.name")}</th>
              <th style={{ width: "140px" }} className="text-right">
                {t("ventilationCalc.heatSourceColumns.heatW")}
              </th>
              <th style={{ width: "40px" }} />
            </tr>
          </thead>
          <tbody>
            {value.length === 0 ? (
              <tr>
                <td colSpan={3} className="py-4 text-center text-muted-2">
                  {t("ventilationCalc.heatSourceEmpty")}
                </td>
              </tr>
            ) : (
              value.map((item, i) => (
                <tr key={i}>
                  <td>
                    <input
                      value={item.name}
                      onChange={(e) => updateItem(i, { name: e.target.value })}
                      placeholder={t("ventilationCalc.heatSourceColumns.namePlaceholder")}
                      className="field-input"
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={item.heatW || ""}
                      onChange={(e) => updateItem(i, { heatW: Number(e.target.value) })}
                      className="field-input text-right"
                    />
                  </td>
                  <td>
                    <button onClick={() => removeItem(i)} className="btn-ghost btn-icon text-danger hover:bg-danger/10">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-2">
        <button onClick={addItem} className="btn-secondary">
          <Plus className="h-3.5 w-3.5" />
          {t("ventilationCalc.heatSourceAddButton")}
        </button>
      </div>

      <div className="flex items-center gap-2 pt-1">
        <span className="rounded border border-border px-1.5 py-0.5 text-[10px] font-semibold text-muted-2">
          {t("ventilationCalc.autoCalcBadge")}
        </span>
        <span className="font-mono text-[13px] font-semibold text-foreground">
          Qc = {totalHeatW.toFixed(1)} W
        </span>
      </div>
    </div>
  );
}
