import { requireSupabase } from "@/lib/supabase/client";
import type { EarthWireSize } from "@/lib/types";

interface EarthWireSizeRow {
  id: string;
  area_mm2: number;
  sort_order: number;
}

function fromRow(row: EarthWireSizeRow): EarthWireSize {
  return {
    id: row.id,
    areaMm2: row.area_mm2,
    order: row.sort_order,
  };
}

/** 接地線サイズ選定マスタ backing 接地線's candidate search — starts empty, populated only via 設定 (company preference data, never seeded — see spec's "no invented values" rule, same as busbarSizeService). */
export const earthWireSizeService = {
  async list(): Promise<EarthWireSize[]> {
    const { data, error } = await requireSupabase()
      .from("earth_wire_sizes")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) throw error;
    return (data ?? []).map(fromRow);
  },

  async create(areaMm2: number): Promise<EarthWireSize> {
    const client = requireSupabase();
    const { data: maxRow } = await client
      .from("earth_wire_sizes")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextOrder = maxRow ? (maxRow.sort_order as number) + 1 : 0;

    const { data, error } = await client
      .from("earth_wire_sizes")
      .insert({ area_mm2: areaMm2, sort_order: nextOrder })
      .select()
      .single();
    if (error) throw error;
    return fromRow(data as EarthWireSizeRow);
  },

  async update(id: string, areaMm2: number): Promise<EarthWireSize> {
    const { data, error } = await requireSupabase()
      .from("earth_wire_sizes")
      .update({ area_mm2: areaMm2 })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return fromRow(data as EarthWireSizeRow);
  },

  async remove(id: string): Promise<void> {
    const { error } = await requireSupabase()
      .from("earth_wire_sizes")
      .delete()
      .eq("id", id);
    if (error) throw error;
  },
};
