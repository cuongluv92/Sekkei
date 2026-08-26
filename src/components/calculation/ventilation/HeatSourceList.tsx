"use client";

import { Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { partDataService } from "@/lib/services";
import { sumHeatSourcesW, type HeatSourceItem } from "@/lib/calc/ventilation/heatBalance";
import type { PartData } from "@/lib/types";

/** 負荷率(%)は実運用でほぼ100%のため、既定値として初期表示する — 実際と異なる機器のみ手入力で上書きする。 */
export function blankHeatSourceItem(): HeatSourceItem {
  return { name: "", heatW: 0, capacity: "", loadFactorPercent: 100, model: "" };
}

interface Props {
  value: HeatSourceItem[];
  onChange: (next: HeatSourceItem[]) => void;
}

/**
 * 型番セル — 部品データを型番・品名・仕様で検索し、選択すると機器名称・容量・
 * 発熱量Wをまとめて自動入力する(実物のJSIA-T1016様式には無い、アプリ独自の
 * 入力補助)。検索でヒットしない場合や部品データに未登録の機器は、そのまま
 * 型番欄を含め全欄を直接手入力できる(検索を強制しない)。
 */
function PartModelCell({
  value,
  onChange,
  onSelect,
}: {
  value: string;
  onChange: (v: string) => void;
  onSelect: (part: PartData) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<PartData[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const query = value.trim();
    if (!query) {
      setResults([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(() => {
      partDataService.search(query).then((found) => {
        if (cancelled) return;
        setResults(found.slice(0, 8));
        setLoading(false);
      });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [value]);

  return (
    <div ref={containerRef} className="relative">
      <input
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={t("ventilationCalc.heatSourceColumns.modelPlaceholder")}
        className="field-input font-mono"
      />
      {open && value.trim() !== "" && (loading || results.length > 0) && (
        <ul className="absolute z-20 mt-1 max-h-48 w-64 overflow-y-auto rounded-md border border-border-strong bg-surface-2 shadow-lg">
          {loading && <li className="px-2.5 py-1.5 text-[12px] text-muted-2">{t("common.loading")}</li>}
          {!loading &&
            results.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onSelect(p);
                    setOpen(false);
                  }}
                  className="flex w-full flex-col items-start gap-0.5 px-2.5 py-1.5 text-left hover:bg-surface-hover"
                >
                  <span className="font-mono text-[12.5px] text-foreground">{p.model}</span>
                  <span className="truncate text-[11px] text-muted-2">
                    {[p.category, p.specification].filter(Boolean).join(" / ") || "—"}
                  </span>
                </button>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}

/**
 * JSIA-T1016換気計算書 b)「盤内部発熱源」— 盤内の発熱機器を1台ずつ追加する。
 * 容量(F列、自由記入)・負荷率%(H列)は実物の様式にある入力欄をそのまま
 * 再現した記録用の項目 — 発熱量Wはこの2つからの逆算ではなく、実測/カタログ
 * の発熱量そのものを直接入力する(実物の様式でもJ列は数式ではなく直値)。
 * 合計発熱量 Qc は発熱量Wの単純合計として自動表示する。
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
        <table className="data-table" style={{ minWidth: 780 }}>
          <thead>
            <tr>
              <th style={{ width: "140px" }}>{t("ventilationCalc.heatSourceColumns.model")}</th>
              <th style={{ width: "160px" }}>{t("ventilationCalc.heatSourceColumns.name")}</th>
              <th style={{ width: "140px" }}>{t("ventilationCalc.heatSourceColumns.capacity")}</th>
              <th style={{ width: "100px" }} className="text-right">
                {t("ventilationCalc.heatSourceColumns.loadFactor")}
              </th>
              <th style={{ width: "140px" }} className="text-right">
                {t("ventilationCalc.heatSourceColumns.heatW")}
              </th>
              <th style={{ width: "40px" }} />
            </tr>
          </thead>
          <tbody>
            {value.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-4 text-center text-muted-2">
                  {t("ventilationCalc.heatSourceEmpty")}
                </td>
              </tr>
            ) : (
              value.map((item, i) => (
                <tr key={i}>
                  <td>
                    <PartModelCell
                      value={item.model ?? ""}
                      onChange={(v) => updateItem(i, { model: v })}
                      onSelect={(part) =>
                        updateItem(i, {
                          model: part.model,
                          name: part.category || item.name,
                          capacity: part.specification || item.capacity,
                          heatW: part.heatW ?? item.heatW,
                        })
                      }
                    />
                  </td>
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
                      value={item.capacity ?? ""}
                      onChange={(e) => updateItem(i, { capacity: e.target.value })}
                      placeholder={t("ventilationCalc.heatSourceColumns.capacityPlaceholder")}
                      className="field-input"
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={item.loadFactorPercent ?? ""}
                      onChange={(e) => updateItem(i, { loadFactorPercent: e.target.value === "" ? null : Number(e.target.value) })}
                      className="field-input text-right"
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
