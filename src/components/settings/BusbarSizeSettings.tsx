"use client";

import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { busbarSizeService } from "@/lib/services";
import type { BusbarSize } from "@/lib/types";

/** 銅帯選定マスタ backing 母線銅帯 > 自動選定's candidate search — starts empty, entered only here (company-preferred sizes, never a technical/standard value). */
export function BusbarSizeSettings() {
  const { t } = useTranslation();
  const [items, setItems] = useState<BusbarSize[]>([]);
  const [loading, setLoading] = useState(true);
  const [newThickness, setNewThickness] = useState("");
  const [newWidth, setNewWidth] = useState("");

  function load() {
    busbarSizeService.list().then((list) => {
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
    await busbarSizeService.create(thickness, width);
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
    await busbarSizeService.update(id, { [field]: num });
    load();
  }

  async function handleRemove(id: string) {
    await busbarSizeService.remove(id);
    load();
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[12px] text-muted">
        {t("busbarSizeSettings.description")}
      </p>

      <div className="data-table-wrap">
        <table className="data-table" style={{ minWidth: 420 }}>
          <thead>
            <tr>
              <th style={{ width: "160px" }}>
                {t("busbarSizeSettings.columns.thickness")}
              </th>
              <th style={{ width: "160px" }}>
                {t("busbarSizeSettings.columns.width")}
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
                  {t("busbarSizeSettings.emptyList")}
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
            {t("busbarSizeSettings.columns.thickness")}
          </label>
          <input
            type="number"
            step="0.1"
            value={newThickness}
            onChange={(e) => setNewThickness(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAdd();
            }}
            placeholder="6"
            className="field-input max-w-[120px]"
          />
        </div>
        <div>
          <label className="field-label">
            {t("busbarSizeSettings.columns.width")}
          </label>
          <input
            type="number"
            step="0.1"
            value={newWidth}
            onChange={(e) => setNewWidth(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAdd();
            }}
            placeholder="50"
            className="field-input max-w-[120px]"
          />
        </div>
        <button
          onClick={handleAdd}
          disabled={!newThickness.trim() || !newWidth.trim()}
          className="btn-secondary"
        >
          <Plus className="h-3.5 w-3.5" />
          {t("busbarSizeSettings.addButton")}
        </button>
      </div>
    </div>
  );
}
