import { requireSupabase } from "@/lib/supabase/client";
import type { VentilationClimateProfile } from "@/lib/types";

interface VentilationClimateProfileRow {
  id: string;
  region: string;
  ambient_temp_c: number;
  top_temp_c: number;
  equivalent_outside_temp_roof_c: number;
  equivalent_outside_temp_face1_c: number;
  equivalent_outside_temp_face2_c: number;
  equivalent_outside_temp_face3_c: number;
  equivalent_outside_temp_face4_c: number;
  air_specific_heat_kj_per_kg_k: number;
  air_density_kg_per_m3: number;
  remarks: string | null;
  sort_order: number;
}

function fromRow(row: VentilationClimateProfileRow): VentilationClimateProfile {
  return {
    id: row.id,
    region: row.region,
    ambientTempC: row.ambient_temp_c,
    topTempC: row.top_temp_c,
    equivalentOutsideTempRoofC: row.equivalent_outside_temp_roof_c,
    equivalentOutsideTempFace1C: row.equivalent_outside_temp_face1_c,
    equivalentOutsideTempFace2C: row.equivalent_outside_temp_face2_c,
    equivalentOutsideTempFace3C: row.equivalent_outside_temp_face3_c,
    equivalentOutsideTempFace4C: row.equivalent_outside_temp_face4_c,
    airSpecificHeatKjPerKgK: row.air_specific_heat_kj_per_kg_k,
    airDensityKgPerM3: row.air_density_kg_per_m3,
    remarks: row.remarks ?? undefined,
    order: row.sort_order,
  };
}

export type VentilationClimateProfileDraft = Omit<VentilationClimateProfile, "id" | "order">;

function toInsertRow(draft: VentilationClimateProfileDraft) {
  return {
    region: draft.region,
    ambient_temp_c: draft.ambientTempC,
    top_temp_c: draft.topTempC,
    equivalent_outside_temp_roof_c: draft.equivalentOutsideTempRoofC,
    equivalent_outside_temp_face1_c: draft.equivalentOutsideTempFace1C,
    equivalent_outside_temp_face2_c: draft.equivalentOutsideTempFace2C,
    equivalent_outside_temp_face3_c: draft.equivalentOutsideTempFace3C,
    equivalent_outside_temp_face4_c: draft.equivalentOutsideTempFace4C,
    air_specific_heat_kj_per_kg_k: draft.airSpecificHeatKjPerKgK,
    air_density_kg_per_m3: draft.airDensityKgPerM3,
    remarks: draft.remarks || null,
  };
}

/**
 * 屋外キュービクルの設計用気象条件 (地域別) 社内選定マスタ — JSIA-T1016
 * 換気計算書の判定式で使う唯一のデータ源。東京・那覇の2地域は同標準準拠の
 * 計算書使用例からの検証済みの値で初期登録済み、他地域は設定から追加登録
 * する (JSIA-T1016原本または自社基準の値を確認のうえで)。
 */
export const ventilationClimateProfileService = {
  async list(): Promise<VentilationClimateProfile[]> {
    const { data, error } = await requireSupabase()
      .from("ventilation_climate_profiles")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) throw error;
    return (data ?? []).map(fromRow);
  },

  async create(draft: VentilationClimateProfileDraft): Promise<VentilationClimateProfile> {
    const client = requireSupabase();
    const { data: maxRow } = await client
      .from("ventilation_climate_profiles")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextOrder = maxRow ? (maxRow.sort_order as number) + 1 : 0;

    const { data, error } = await client
      .from("ventilation_climate_profiles")
      .insert({ ...toInsertRow(draft), sort_order: nextOrder })
      .select()
      .single();
    if (error) throw error;
    return fromRow(data as VentilationClimateProfileRow);
  },

  async update(id: string, draft: VentilationClimateProfileDraft): Promise<VentilationClimateProfile> {
    const { data, error } = await requireSupabase()
      .from("ventilation_climate_profiles")
      .update(toInsertRow(draft))
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return fromRow(data as VentilationClimateProfileRow);
  },

  async remove(id: string): Promise<void> {
    const { error } = await requireSupabase().from("ventilation_climate_profiles").delete().eq("id", id);
    if (error) throw error;
  },
};
