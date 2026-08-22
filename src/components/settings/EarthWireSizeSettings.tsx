"use client";

import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { earthWireSizeService } from "@/lib/services";
import type { EarthWireSize } from "@/lib/types";

/** 接地線選定マスタ backing 接地線's candidate search — starts empty, entered only here (company-preferred sizes, never a technical/standard value). */
export function EarthWireSizeSettings() {
  const { t } = useTranslation();
  const [items, setItems] = useState<EarthWireSize[]>([]);
  const [loading, setLoading] = useState(true);
  const [newArea, setNewArea] = useState("");

  function load() {
    earthWireSizeService.list().then((list) => {
      setItems(list);
      setLoading(false);
    });
  }

  useEffect(load, []);

  async function handleAdd() {
    const area = Number(newArea);
    if (!Number.isFinite(area) || area <= 0) return;
    await earthWireSizeService.create(area);
    setNewArea("");
    load();
  }

  async function handleFieldChange(id: string, value: string) {
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0) return;
    await earthWireSizeService.update(id, num);
    load();
  }

  async function handleRemove(id: string) {
    await earthWireSizeService.remove(id);
    load();
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[12px] text-muted">
        {t("earthWireSizeSettings.description")}
      </p>

      <div className="data-table-wrap">
        <table className="data-table" style={{ minWidth: 260 }}>
          <thead>
            <tr>
              <th style={{ width: "160px" }}>
                {t("earthWireSizeSettings.columns.area")}
              </th>
              <th style={{ width: "70px" }} />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={2} className="py-6 text-center text-muted">
                  {t("common.loading")}
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={2} className="py-6 text-center text-muted-2">
                  {t("earthWireSizeSettings.emptyList")}
                </td>
              </tr>
            ) : (
              items.map((s) => (
                <tr key={s.id}>
                  <td>
                    <input
                      type="number"
                      step="0.1"
                      defaultValue={s.areaMm2}
                      onBlur={(e) => handleFieldChange(s.id, e.target.value)}
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
            {t("earthWireSizeSettings.columns.area")}
          </label>
          <input
            type="number"
            step="0.1"
            value={newArea}
            onChange={(e) => setNewArea(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAdd();
            }}
            placeholder="14"
            className="field-input max-w-[120px]"
          />
        </div>
        <button
          onClick={handleAdd}
          disabled={!newArea.trim()}
          className="btn-secondary"
        >
          <Plus className="h-3.5 w-3.5" />
          {t("earthWireSizeSettings.addButton")}
        </button>
      </div>
    </div>
  );
}
