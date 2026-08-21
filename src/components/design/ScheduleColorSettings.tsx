"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { scheduleColorService } from "@/lib/services/design";
import type { ScheduleColorConfig } from "@/lib/types/design";

/**
 * Editable color config for 工程表 (categories: 鈑金/BOX/アクセサリー/製作/検査/立会/出荷).
 * The timeline never hard-codes these — it always reads through
 * scheduleColorService, so a change here is reflected immediately without
 * touching any stored schedule date.
 */
export function ScheduleColorSettings() {
  const { t } = useTranslation();
  const [colors, setColors] = useState<ScheduleColorConfig[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    scheduleColorService.list().then((list) => {
      setColors(list);
      setLoading(false);
    });
  }, []);

  async function handleChange(category: ScheduleColorConfig["category"], color: string) {
    setColors((prev) => prev.map((c) => (c.category === category ? { ...c, color } : c)));
    await scheduleColorService.update(category, color);
  }

  async function handleReset() {
    const next = await scheduleColorService.reset();
    setColors(next);
  }

  if (loading) return <p className="text-[12.5px] text-muted">{t("common.loading")}</p>;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[12px] text-muted">{t("scheduleColorSettings.description")}</p>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
        {colors.map((c) => (
          <div key={c.category} className="flex items-center gap-2 rounded-lg border border-border bg-surface-2 px-3 py-2">
            <input
              type="color"
              value={c.color}
              onChange={(e) => handleChange(c.category, e.target.value)}
              className="h-8 w-8 shrink-0 cursor-pointer rounded border border-border-strong bg-transparent"
            />
            <span className="truncate text-[12.5px] text-foreground">
              {t(`scheduleColorSettings.categories.${c.category}`)}
            </span>
          </div>
        ))}
      </div>
      <div>
        <button onClick={handleReset} className="btn-ghost">
          {t("scheduleColorSettings.resetButton")}
        </button>
      </div>
    </div>
  );
}
