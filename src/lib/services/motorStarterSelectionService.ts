import { requireSupabase } from "@/lib/supabase/client";
import type { MotorStarterSelection, SelectionCircuitType, SelectionVoltageClass } from "@/lib/types";

interface MotorStarterSelectionRow {
  id: string;
  manufacturer_id: string;
  voltage_class: string;
  circuit_type: string;
  motor_kw: number;
  rated_current: number;
  breaker_model: string | null;
  breaker_rated_current: number | null;
  ct_model: string | null;
  ct_ratio: string | null;
  am_range: string | null;
  contactor_model: string | null;
  inverter_model: string | null;
  wire_size: string | null;
  remarks: string | null;
  sort_order: number;
}

function fromRow(row: MotorStarterSelectionRow): MotorStarterSelection {
  return {
    id: row.id,
    manufacturerId: row.manufacturer_id,
    voltageClass: row.voltage_class as SelectionVoltageClass,
    circuitType: row.circuit_type as SelectionCircuitType,
    motorKw: row.motor_kw,
    ratedCurrent: row.rated_current,
    breakerModel: row.breaker_model ?? undefined,
    breakerRatedCurrent: row.breaker_rated_current ?? undefined,
    ctModel: row.ct_model ?? undefined,
    ctRatio: row.ct_ratio ?? undefined,
    amRange: row.am_range ?? undefined,
    contactorModel: row.contactor_model ?? undefined,
    inverterModel: row.inverter_model ?? undefined,
    wireSize: row.wire_size ?? undefined,
    remarks: row.remarks ?? undefined,
    order: row.sort_order,
  };
}

export type MotorStarterSelectionDraft = Omit<MotorStarterSelection, "id" | "order">;

function toInsertRow(draft: MotorStarterSelectionDraft) {
  return {
    manufacturer_id: draft.manufacturerId,
    voltage_class: draft.voltageClass,
    circuit_type: draft.circuitType,
    motor_kw: draft.motorKw,
    rated_current: draft.ratedCurrent,
    breaker_model: draft.breakerModel || null,
    breaker_rated_current: draft.breakerRatedCurrent ?? null,
    ct_model: draft.ctModel || null,
    ct_ratio: draft.ctRatio || null,
    am_range: draft.amRange || null,
    contactor_model: draft.contactorModel || null,
    inverter_model: draft.inverterModel || null,
    wire_size: draft.wireSize || null,
    remarks: draft.remarks || null,
  };
}

/**
 * 電動機回路選定マスタ (motor_starter_selections) — 選定 > 分岐(電動機回路) の
 * マッチングエンジンが読む唯一のデータ源。会社が実際に採用している機器
 * だけを 設定 から手入力する社内選定マスタ — カタログを丸ごと取り込んで
 * 自動生成することはしない (busbarSizeService/earthWireSizeService と同じ
 * 方針)。空のまま始まる。
 */
export const motorStarterSelectionService = {
  async list(): Promise<MotorStarterSelection[]> {
    const { data, error } = await requireSupabase()
      .from("motor_starter_selections")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) throw error;
    return (data ?? []).map(fromRow);
  },

  async create(draft: MotorStarterSelectionDraft): Promise<MotorStarterSelection> {
    const client = requireSupabase();
    const { data: maxRow } = await client
      .from("motor_starter_selections")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextOrder = maxRow ? (maxRow.sort_order as number) + 1 : 0;

    const { data, error } = await client
      .from("motor_starter_selections")
      .insert({ ...toInsertRow(draft), sort_order: nextOrder })
      .select()
      .single();
    if (error) throw error;
    return fromRow(data as MotorStarterSelectionRow);
  },

  async update(id: string, draft: MotorStarterSelectionDraft): Promise<MotorStarterSelection> {
    const { data, error } = await requireSupabase()
      .from("motor_starter_selections")
      .update(toInsertRow(draft))
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return fromRow(data as MotorStarterSelectionRow);
  },

  async remove(id: string): Promise<void> {
    const { error } = await requireSupabase().from("motor_starter_selections").delete().eq("id", id);
    if (error) throw error;
  },
};
