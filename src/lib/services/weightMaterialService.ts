import { requireSupabase } from "@/lib/supabase/client";
import type { WeightMaterial } from "@/lib/types";

interface WeightMaterialRow {
  id: string;
  name: string;
  density: number;
  sort_order: number;
}

function fromRow(row: WeightMaterialRow): WeightMaterial {
  return { id: row.id, name: row.name, density: row.density, order: row.sort_order };
}

/** 材質 master backing 重量計算 > 基本重量計算's 材質 dropdown — starts empty, populated only via 設定 > 重量計算材質設定 (never seeded with an invented 比重). */
export const weightMaterialService = {
  async list(): Promise<WeightMaterial[]> {
    const { data, error } = await requireSupabase()
      .from("weight_materials")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) throw error;
    return (data ?? []).map(fromRow);
  },

  async create(name: string, density: number): Promise<WeightMaterial> {
    const client = requireSupabase();
    const { data: maxRow } = await client
      .from("weight_materials")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextOrder = maxRow ? (maxRow.sort_order as number) + 1 : 0;

    const { data, error } = await client
      .from("weight_materials")
      .insert({ name, density, sort_order: nextOrder })
      .select()
      .single();
    if (error) throw error;
    return fromRow(data as WeightMaterialRow);
  },

  async update(id: string, patch: Partial<Pick<WeightMaterial, "name" | "density">>): Promise<WeightMaterial> {
    const row: Record<string, unknown> = {};
    if (patch.name !== undefined) row.name = patch.name;
    if (patch.density !== undefined) row.density = patch.density;

    const { data, error } = await requireSupabase()
      .from("weight_materials")
      .update(row)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return fromRow(data as WeightMaterialRow);
  },

  async remove(id: string): Promise<void> {
    const { error } = await requireSupabase().from("weight_materials").delete().eq("id", id);
    if (error) throw error;
  },
};
