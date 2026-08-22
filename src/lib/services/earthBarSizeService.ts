import { requireSupabase } from "@/lib/supabase/client";
import type { EarthBarSize } from "@/lib/types";

interface EarthBarSizeRow {
  id: string;
  thickness_mm: number;
  width_mm: number;
  sort_order: number;
}

function fromRow(row: EarthBarSizeRow): EarthBarSize {
  return {
    id: row.id,
    thicknessMm: row.thickness_mm,
    widthMm: row.width_mm,
    order: row.sort_order,
  };
}

/** アースバー選定マスタ — separate from busbar_sizes even though the shape (t×W) is the same, because this is a separate calculation/selection with its own applicable conditions (spec: never reuse the main-bus busbar master for this). Starts empty, never seeded. */
export const earthBarSizeService = {
  async list(): Promise<EarthBarSize[]> {
    const { data, error } = await requireSupabase()
      .from("earth_bar_sizes")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) throw error;
    return (data ?? []).map(fromRow);
  },

  async create(thicknessMm: number, widthMm: number): Promise<EarthBarSize> {
    const client = requireSupabase();
    const { data: maxRow } = await client
      .from("earth_bar_sizes")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextOrder = maxRow ? (maxRow.sort_order as number) + 1 : 0;

    const { data, error } = await client
      .from("earth_bar_sizes")
      .insert({
        thickness_mm: thicknessMm,
        width_mm: widthMm,
        sort_order: nextOrder,
      })
      .select()
      .single();
    if (error) throw error;
    return fromRow(data as EarthBarSizeRow);
  },

  async update(
    id: string,
    patch: Partial<Pick<EarthBarSize, "thicknessMm" | "widthMm">>,
  ): Promise<EarthBarSize> {
    const row: Record<string, unknown> = {};
    if (patch.thicknessMm !== undefined) row.thickness_mm = patch.thicknessMm;
    if (patch.widthMm !== undefined) row.width_mm = patch.widthMm;

    const { data, error } = await requireSupabase()
      .from("earth_bar_sizes")
      .update(row)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return fromRow(data as EarthBarSizeRow);
  },

  async remove(id: string): Promise<void> {
    const { error } = await requireSupabase()
      .from("earth_bar_sizes")
      .delete()
      .eq("id", id);
    if (error) throw error;
  },
};
