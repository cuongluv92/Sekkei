import { requireSupabase } from "@/lib/supabase/client";
import type { ScheduleCategoryKey, ScheduleColorConfig } from "@/lib/types/design";

/**
 * Matches the real ⑤工程表 template's own legend exactly (extracted directly
 * from the uploaded template's XML — legend cell fills at BK1/BS2/CA1 are
 * plain RGB, BK2/BS1/CA2 are theme colors with a tint, resolved via the
 * theme's clrScheme + HLS tint formula): 板金・BOX納入=Accent6(緑) #92D050,
 * アクセサリー納入=Accent4 Lighter60% #FFE699, 製作=Accent3 #A5A5A5,
 * 検査=#00B0F0, 立会=Accent4 #FFC000, 出荷=Accent2 Lighter40% #F4B183.
 * Backfills any category missing from the `schedule_colors` table (e.g.
 * before the seed script has run), never read directly by the timeline
 * renderer, which always goes through `scheduleColorService.list()`.
 * Editable from 設定 > 工程色設定 — use the reset button there to re-apply
 * these values to already-seeded rows.
 */
const DEFAULT_COLORS: ScheduleColorConfig[] = [
  { category: "sheetMetal", color: "#92d050" },
  { category: "box", color: "#92d050" },
  { category: "accessory", color: "#ffe699" },
  { category: "production", color: "#a5a5a5" },
  { category: "inspection", color: "#00b0f0" },
  { category: "witness", color: "#ffc000" },
  { category: "shipping", color: "#f4b183" },
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
