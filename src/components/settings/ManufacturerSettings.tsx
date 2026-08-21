"use client";

import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { manufacturerService } from "@/lib/services";
import type { Manufacturer } from "@/lib/types";

/** メーカー list backing 部品データ/部品図/カタログ's manufacturer dropdowns — add-only for now (existing 6 are seed data, never deleted here). */
export function ManufacturerSettings() {
  const { t } = useTranslation();
  const [items, setItems] = useState<Manufacturer[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");

  function load() {
    manufacturerService.list().then((list) => {
      setItems(list);
      setLoading(false);
    });
  }

  useEffect(load, []);

  async function handleAdd() {
    if (!newName.trim()) return;
    await manufacturerService.create(newName.trim());
    setNewName("");
    load();
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[12px] text-muted">{t("partSettings.manufacturers.description")}</p>
      {loading ? (
        <p className="text-[12.5px] text-muted">{t("common.loading")}</p>
      ) : items.length === 0 ? (
        <p className="text-[12.5px] text-muted-2">{t("partSettings.manufacturers.empty")}</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {items.map((m) => (
            <span key={m.id} className="badge-neutral">
              {m.name}
            </span>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleAdd();
          }}
          placeholder={t("partSettings.manufacturers.addPlaceholder")}
          className="field-input max-w-xs"
        />
        <button onClick={handleAdd} disabled={!newName.trim()} className="btn-secondary">
          <Plus className="h-3.5 w-3.5" />
          {t("partSettings.manufacturers.addButton")}
        </button>
      </div>
    </div>
  );
}
