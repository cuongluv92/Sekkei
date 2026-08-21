import { requireSupabase } from "@/lib/supabase/client";
import type { ScheduleCategoryKey, ScheduleColorConfig } from "@/lib/types/design";

/**
 * Starter palette only — used to backfill any category missing from the
 * `schedule_colors` table (e.g. before the seed script has run), never read
 * directly by the timeline renderer, which always goes through
 * `scheduleColorService.list()`. Editable from 設定 > 工程色設定; once a real
 * ⑤工程表 template is uploaded (Phase 5/6) these should be replaced with the
 * template's actual legend colors.
 */
const DEFAULT_COLORS: ScheduleColorConfig[] = [
  { category: "sheetMetal", color: "#8b8f99" },
  { category: "box", color: "#8b8f99" },
  { category: "accessory", color: "#a855f7" },
  { category: "production", color: "#4f8ff0" },
  { category: "inspection", color: "#e7ac4c" },
  { category: "witness", color: "#f25c66" },
  { category: "shipping", color: "#30d17f" },
];

interface ScheduleColorRow {
  category: ScheduleCategoryKey;
  color: string;
}

export const scheduleColorService = {
  async list(): Promise<ScheduleColorConfig[]> {
    const { data, error } = await requireSupabase().from("schedule_colors").select("*");
    if (error) throw error;
    const byCategory = new Map((data ?? []).map((r: ScheduleColorRow) => [r.category, r.color]));
    return DEFAULT_COLORS.map((d) => ({ category: d.category, color: byCategory.get(d.category) ?? d.color }));
  },

  async update(category: ScheduleCategoryKey, color: string): Promise<ScheduleColorConfig[]> {
    const { error } = await requireSupabase()
      .from("schedule_colors")
      .upsert({ category, color }, { onConflict: "category" });
    if (error) throw error;
    return this.list();
  },

  async reset(): Promise<ScheduleColorConfig[]> {
    const { error } = await requireSupabase().from("schedule_colors").upsert(DEFAULT_COLORS, { onConflict: "category" });
    if (error) throw error;
    return this.list();
  },
};
