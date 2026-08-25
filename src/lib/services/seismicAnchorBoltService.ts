import { requireSupabase } from "@/lib/supabase/client";
import type { BoltDiameter, SeismicAnchorAllowable } from "@/lib/types";

interface SeismicAnchorAllowableRow {
  id: string;
  manufacturer_id: string;
  method: string;
  bolt_diameter: string;
  concrete_thickness_mm: number;
  allowable_pullout_kn: number;
  remarks: string | null;
  sort_order: number;
}

function fromRow(row: SeismicAnchorAllowableRow): SeismicAnchorAllowable {
  return {
    id: row.id,
    manufacturerId: row.manufacturer_id,
    method: row.method,
    boltDiameter: row.bolt_diameter as BoltDiameter,
    concreteThicknessMm: row.concrete_thickness_mm,
    allowablePulloutKn: row.allowable_pullout_kn,
    remarks: row.remarks ?? undefined,
    order: row.sort_order,
  };
}

export type SeismicAnchorAllowableDraft = Omit<SeismicAnchorAllowable, "id" | "order">;

function toInsertRow(draft: SeismicAnchorAllowableDraft) {
  return {
    manufacturer_id: draft.manufacturerId,
    method: draft.method,
    bolt_diameter: draft.boltDiameter,
    concrete_thickness_mm: draft.concreteThicknessMm,
    allowable_pullout_kn: draft.allowablePulloutKn,
    remarks: draft.remarks || null,
  };
}

/**
 * あと施工アンカーボルトの許容引抜荷重 (Ta) 社内選定マスタ — JSIA-T1018 の
 * 判定式 (5-2-1) Rb≦Ta で使う唯一のデータ源。会社が実際に使う製品/施工方法
 * だけを 設定 から手入力する (カタログを丸ごと登録する場ではない)。空の
 * まま始まる。
 */
export const seismicAnchorBoltService = {
  async list(): Promise<SeismicAnchorAllowable[]> {
    const { data, error } = await requireSupabase()
      .from("seismic_anchor_bolt_allowables")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) throw error;
    return (data ?? []).map(fromRow);
  },

  async create(draft: SeismicAnchorAllowableDraft): Promise<SeismicAnchorAllowable> {
    const client = requireSupabase();
    const { data: maxRow } = await client
      .from("seismic_anchor_bolt_allowables")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextOrder = maxRow ? (maxRow.sort_order as number) + 1 : 0;

    const { data, error } = await client
      .from("seismic_anchor_bolt_allowables")
      .insert({ ...toInsertRow(draft), sort_order: nextOrder })
      .select()
      .single();
    if (error) throw error;
    return fromRow(data as SeismicAnchorAllowableRow);
  },

  async update(id: string, draft: SeismicAnchorAllowableDraft): Promise<SeismicAnchorAllowable> {
    const { data, error } = await requireSupabase()
      .from("seismic_anchor_bolt_allowables")
      .update(toInsertRow(draft))
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return fromRow(data as SeismicAnchorAllowableRow);
  },

  async remove(id: string): Promise<void> {
    const { error } = await requireSupabase().from("seismic_anchor_bolt_allowables").delete().eq("id", id);
    if (error) throw error;
  },
};
