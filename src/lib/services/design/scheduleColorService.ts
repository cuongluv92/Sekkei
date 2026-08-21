import { delay } from "@/lib/utils/async";
import type { ScheduleCategoryKey, ScheduleColorConfig } from "@/lib/types/design";
import { loadFromStorage, saveToStorage } from "@/lib/utils/localStore";

const KEY = "sekkei.design.scheduleColors";

/**
 * Starter palette only — never read directly by the timeline renderer, which
 * always goes through `scheduleColorService.list()`. Editable from 設定 >
 * 工程色設定; once a real ⑤工程表 template is uploaded (Phase 5/6) these
 * should be replaced with the template's actual legend colors.
 */
const DEFAULT_COLORS: ScheduleColorConfig[] = [
  { category: "sheetMetal", color: "#8b8f99" },
  { category: "box", color: "#6b7280" },
  { category: "accessory", color: "#a855f7" },
  { category: "production", color: "#4f8ff0" },
  { category: "inspection", color: "#e7ac4c" },
  { category: "witness", color: "#f25c66" },
  { category: "shipping", color: "#30d17f" },
];

function loadAll(): ScheduleColorConfig[] {
  const stored = loadFromStorage<ScheduleColorConfig[]>(KEY, DEFAULT_COLORS);
  // Backfill any category missing from an older stored config instead of dropping it silently.
  const byCategory = new Map(stored.map((c) => [c.category, c]));
  return DEFAULT_COLORS.map((d) => byCategory.get(d.category) ?? d);
}

export const scheduleColorService = {
  async list(): Promise<ScheduleColorConfig[]> {
    return delay(loadAll(), 100);
  },

  async update(category: ScheduleCategoryKey, color: string): Promise<ScheduleColorConfig[]> {
    const next = loadAll().map((c) => (c.category === category ? { ...c, color } : c));
    saveToStorage(KEY, next);
    return delay(next, 100);
  },

  async reset(): Promise<ScheduleColorConfig[]> {
    saveToStorage(KEY, DEFAULT_COLORS);
    return delay(DEFAULT_COLORS, 100);
  },
};
