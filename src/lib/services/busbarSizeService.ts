import { requireSupabase } from "@/lib/supabase/client";
import type { BusbarSize } from "@/lib/types";

interface BusbarSizeRow {
  id: string;
  thickness_mm: number;
  width_mm: number;
  sort_order: number;
}

function fromRow(row: BusbarSizeRow): BusbarSize {
  return {
    id: row.id,
    thicknessMm: row.thickness_mm,
    widthMm: row.width_mm,
    order: row.sort_order,
  };
}

/** 銅帯選定マスタ backing 母線銅帯's Auto-mode candidate search — starts empty, populated only via 設定 > 銅帯選定マスタ (company preference data, never seeded). */
export const busbarSizeService = {
  async list(): Promise<BusbarSize[]> {
    const { data, error } = await requireSupabase()
      .from("busbar_sizes")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) throw error;
    return (data ?? []).map(fromRow);
  },

  async create(thicknessMm: number, widthMm: number): Promise<BusbarSize> {
    const client = requireSupabase();
    const { data: maxRow } = await client
      .from("busbar_sizes")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextOrder = maxRow ? (maxRow.sort_order as number) + 1 : 0;

    const { data, error } = await client
      .from("busbar_sizes")
      .insert({
        thickness_mm: thicknessMm,
        width_mm: widthMm,
        sort_order: nextOrder,
      })
      .select()
      .single();
    if (error) throw error;
    return fromRow(data as BusbarSizeRow);
  },

  async update(
    id: string,
    patch: Partial<Pick<BusbarSize, "thicknessMm" | "widthMm">>,
  ): Promise<BusbarSize> {
    const row: Record<string, unknown> = {};
    if (patch.thicknessMm !== undefined) row.thickness_mm = patch.thicknessMm;
    if (patch.widthMm !== undefined) row.width_mm = patch.widthMm;

    const { data, error } = await requireSupabase()
      .from("busbar_sizes")
      .update(row)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return fromRow(data as BusbarSizeRow);
  },

  async remove(id: string): Promise<void> {
    const { error } = await requireSupabase()
      .from("busbar_sizes")
      .delete()
      .eq("id", id);
    if (error) throw error;
  },
};
