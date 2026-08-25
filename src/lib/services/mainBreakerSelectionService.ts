import { requireSupabase } from "@/lib/supabase/client";
import type { MainBreakerSelection, SelectionVoltageClass } from "@/lib/types";

interface MainBreakerSelectionRow {
  id: string;
  manufacturer_id: string;
  voltage_class: string;
  rated_current: number;
  breaker_model: string;
  poles: string | null;
  wire_size: string | null;
  remarks: string | null;
  sort_order: number;
}

function fromRow(row: MainBreakerSelectionRow): MainBreakerSelection {
  return {
    id: row.id,
    manufacturerId: row.manufacturer_id,
    voltageClass: row.voltage_class as SelectionVoltageClass,
    ratedCurrent: row.rated_current,
    breakerModel: row.breaker_model,
    poles: row.poles ?? undefined,
    wireSize: row.wire_size ?? undefined,
    remarks: row.remarks ?? undefined,
    order: row.sort_order,
  };
}

export type MainBreakerSelectionDraft = Omit<MainBreakerSelection, "id" | "order">;

function toInsertRow(draft: MainBreakerSelectionDraft) {
  return {
    manufacturer_id: draft.manufacturerId,
    voltage_class: draft.voltageClass,
    rated_current: draft.ratedCurrent,
    breaker_model: draft.breakerModel,
    poles: draft.poles || null,
    wire_size: draft.wireSize || null,
    remarks: draft.remarks || null,
  };
}

/**
 * 主幹(一次側)選定マスタ (main_breaker_selections) — 幹線の総電流(A)から
 * 主開閉器を選ぶための社内選定マスタ。motor_starter_selections と同じ方針
 * (会社が実際に使う機器だけを 設定 から手入力、空のまま始まる)。
 */
export const mainBreakerSelectionService = {
  async list(): Promise<MainBreakerSelection[]> {
    const { data, error } = await requireSupabase()
      .from("main_breaker_selections")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) throw error;
    return (data ?? []).map(fromRow);
  },

  async create(draft: MainBreakerSelectionDraft): Promise<MainBreakerSelection> {
    const client = requireSupabase();
    const { data: maxRow } = await client
      .from("main_breaker_selections")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextOrder = maxRow ? (maxRow.sort_order as number) + 1 : 0;

    const { data, error } = await client
      .from("main_breaker_selections")
      .insert({ ...toInsertRow(draft), sort_order: nextOrder })
      .select()
      .single();
    if (error) throw error;
    return fromRow(data as MainBreakerSelectionRow);
  },

  async update(id: string, draft: MainBreakerSelectionDraft): Promise<MainBreakerSelection> {
    const { data, error } = await requireSupabase()
      .from("main_breaker_selections")
      .update(toInsertRow(draft))
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return fromRow(data as MainBreakerSelectionRow);
  },

  async remove(id: string): Promise<void> {
    const { error } = await requireSupabase().from("main_breaker_selections").delete().eq("id", id);
    if (error) throw error;
  },
};
