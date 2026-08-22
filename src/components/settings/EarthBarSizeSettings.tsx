"use client";

import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { earthBarSizeService } from "@/lib/services";
import type { EarthBarSize } from "@/lib/types";

/** アースバー選定マスタ backing アースバー's candidate search — starts empty, entered only here. Separate from busbar_sizes even though the shape (t×W) is the same (spec: never reuse the main-bus busbar master for this). */
export function EarthBarSizeSettings() {
  const { t } = useTranslation();
  const [items, setItems] = useState<EarthBarSize[]>([]);
  const [loading, setLoading] = useState(true);
  const [newThickness, setNewThickness] = useState("");
  const [newWidth, setNewWidth] = useState("");

  function load() {
    earthBarSizeService.list().then((list) => {
      setItems(list);
      setLoading(false);
    });
  }

  useEffect(load, []);

  async function handleAdd() {
    const thickness = Number(newThickness);
    const width = Number(newWidth);
    if (
      !Number.isFinite(thickness) ||
      thickness <= 0 ||
      !Number.isFinite(width) ||
      width <= 0
    )
      return;
    await earthBarSizeService.create(thickness, width);
    setNewThickness("");
    setNewWidth("");
    load();
  }

  async function handleFieldChange(
    id: string,
    field: "thicknessMm" | "widthMm",
    value: string,
  ) {
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0) return;
    await earthBarSizeService.update(id, { [field]: num });
    load();
  }

  async function handleRemove(id: string) {
    await earthBarSizeService.remove(id);
    load();
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[12px] text-muted">
        {t("earthBarSizeSettings.description")}
      </p>

      <div className="data-table-wrap">
        <table className="data-table" style={{ minWidth: 420 }}>
          <thead>
            <tr>
              <th style={{ width: "160px" }}>
                {t("earthBarSizeSettings.columns.thickness")}
              </th>
              <th style={{ width: "160px" }}>
                {t("earthBarSizeSettings.columns.width")}
              </th>
              <th style={{ width: "70px" }} />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={3} className="py-6 text-center text-muted">
                  {t("common.loading")}
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={3} className="py-6 text-center text-muted-2">
                  {t("earthBarSizeSettings.emptyList")}
                </td>
              </tr>
            ) : (
              items.map((s) => (
                <tr key={s.id}>
                  <td>
                    <input
                      type="number"
                      step="0.1"
                      defaultValue={s.thicknessMm}
                      onBlur={(e) =>
                        handleFieldChange(s.id, "thicknessMm", e.target.value)
                      }
                      className="field-input py-1.5"
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="0.1"
                      defaultValue={s.widthMm}
                      onBlur={(e) =>
                        handleFieldChange(s.id, "widthMm", e.target.value)
                      }
                      className="field-input py-1.5"
                    />
                  </td>
                  <td>
                    <button
                      onClick={() => handleRemove(s.id)}
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

      <div className="flex flex-wrap items-end gap-2.5 border-t border-border pt-3">
        <div>
          <label className="field-label">
            {t("earthBarSizeSettings.columns.thickness")}
          </label>
          <input
            type="number"
            step="0.1"
            value={newThickness}
            onChange={(e) => setNewThickness(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAdd();
            }}
            placeholder="3"
            className="field-input max-w-[120px]"
          />
        </div>
        <div>
          <label className="field-label">
            {t("earthBarSizeSettings.columns.width")}
          </label>
          <input
            type="number"
            step="0.1"
            value={newWidth}
            onChange={(e) => setNewWidth(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAdd();
            }}
            placeholder="25"
            className="field-input max-w-[120px]"
          />
        </div>
        <button
          onClick={handleAdd}
          disabled={!newThickness.trim() || !newWidth.trim()}
          className="btn-secondary"
        >
          <Plus className="h-3.5 w-3.5" />
          {t("earthBarSizeSettings.addButton")}
        </button>
      </div>
    </div>
  );
}
