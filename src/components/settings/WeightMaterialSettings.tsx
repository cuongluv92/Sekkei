"use client";

import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { weightMaterialService } from "@/lib/services";
import type { WeightMaterial } from "@/lib/types";

/** 材質 master backing 重量計算 > 基本重量計算's 材質 dropdown — starts empty, entered only here (never seeded with an invented 比重). */
export function WeightMaterialSettings() {
  const { t } = useTranslation();
  const [items, setItems] = useState<WeightMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newDensity, setNewDensity] = useState("");

  function load() {
    weightMaterialService.list().then((list) => {
      setItems(list);
      setLoading(false);
    });
  }

  useEffect(load, []);

  async function handleAdd() {
    const density = Number(newDensity);
    if (!newName.trim() || !Number.isFinite(density) || density <= 0) return;
    await weightMaterialService.create(newName.trim(), density);
    setNewName("");
    setNewDensity("");
    load();
  }

  async function handleDensityChange(id: string, value: string) {
    const density = Number(value);
    if (!Number.isFinite(density) || density <= 0) return;
    await weightMaterialService.update(id, { density });
    load();
  }

  async function handleRemove(id: string) {
    await weightMaterialService.remove(id);
    load();
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[12px] text-muted">{t("weightMaterialSettings.description")}</p>

      <div className="data-table-wrap">
        <table className="data-table" style={{ minWidth: 460 }}>
          <thead>
            <tr>
              <th>{t("weightMaterialSettings.columns.name")}</th>
              <th style={{ width: "160px" }}>{t("weightMaterialSettings.columns.density")}</th>
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
                  {t("weightMaterialSettings.emptyList")}
                </td>
              </tr>
            ) : (
              items.map((m) => (
                <tr key={m.id}>
                  <td>{m.name}</td>
                  <td>
                    <input
                      type="number"
                      step="0.01"
                      defaultValue={m.density}
                      onBlur={(e) => handleDensityChange(m.id, e.target.value)}
                      className="field-input py-1.5"
                    />
                  </td>
                  <td>
                    <button
                      onClick={() => handleRemove(m.id)}
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
          <label className="field-label">{t("weightMaterialSettings.columns.name")}</label>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAdd();
            }}
            placeholder={t("weightMaterialSettings.namePlaceholder")}
            className="field-input max-w-[200px]"
          />
        </div>
        <div>
          <label className="field-label">{t("weightMaterialSettings.columns.density")}</label>
          <input
            type="number"
            step="0.01"
            value={newDensity}
            onChange={(e) => setNewDensity(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAdd();
            }}
            placeholder="7.85"
            className="field-input max-w-[120px]"
          />
        </div>
        <button onClick={handleAdd} disabled={!newName.trim() || !newDensity.trim()} className="btn-secondary">
          <Plus className="h-3.5 w-3.5" />
          {t("weightMaterialSettings.addButton")}
        </button>
      </div>
    </div>
  );
}
