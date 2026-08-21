import { requireSupabase } from "@/lib/supabase/client";
import type { SelectionRule, SelectionOutputKey } from "@/lib/types";

interface SelectionRuleRow {
  id: string;
  output_key: SelectionOutputKey;
  unit: string;
  min_value: number;
  max_value: number;
  result_value: string;
  remarks: string | null;
  sort_order: number;
  enabled: boolean;
}

function fromRow(row: SelectionRuleRow): SelectionRule {
  return {
    id: row.id,
    outputKey: row.output_key,
    unit: row.unit,
    minValue: row.min_value,
    maxValue: row.max_value,
    resultValue: row.result_value,
    remarks: row.remarks ?? undefined,
    order: row.sort_order,
    enabled: row.enabled,
  };
}

/** RuleRepository — starts empty on purpose; every row is entered via 設定 > 選定設定 (or a future rule import), never seeded with invented breaker/wire values. */
export const selectionRuleService = {
  async list(): Promise<SelectionRule[]> {
    const { data, error } = await requireSupabase()
      .from("selection_rules")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) throw error;
    return (data ?? []).map(fromRow);
  },

  async create(input: Omit<SelectionRule, "id" | "order">): Promise<SelectionRule> {
    const client = requireSupabase();
    const { data: maxRow } = await client
      .from("selection_rules")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextOrder = maxRow ? (maxRow.sort_order as number) + 1 : 0;

    const { data, error } = await client
      .from("selection_rules")
      .insert({
        output_key: input.outputKey,
        unit: input.unit,
        min_value: input.minValue,
        max_value: input.maxValue,
        result_value: input.resultValue,
        remarks: input.remarks ?? null,
        sort_order: nextOrder,
        enabled: input.enabled,
      })
      .select()
      .single();
    if (error) throw error;
    return fromRow(data as SelectionRuleRow);
  },

  async update(id: string, patch: Partial<SelectionRule>): Promise<SelectionRule> {
    const row: Record<string, unknown> = {};
    if (patch.outputKey !== undefined) row.output_key = patch.outputKey;
    if (patch.unit !== undefined) row.unit = patch.unit;
    if (patch.minValue !== undefined) row.min_value = patch.minValue;
    if (patch.maxValue !== undefined) row.max_value = patch.maxValue;
    if (patch.resultValue !== undefined) row.result_value = patch.resultValue;
    if (patch.remarks !== undefined) row.remarks = patch.remarks;
    if (patch.enabled !== undefined) row.enabled = patch.enabled;

    const { data, error } = await requireSupabase()
      .from("selection_rules")
      .update(row)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return fromRow(data as SelectionRuleRow);
  },

  async remove(id: string): Promise<void> {
    const { error } = await requireSupabase().from("selection_rules").delete().eq("id", id);
    if (error) throw error;
  },

  async toggleEnabled(id: string): Promise<void> {
    const client = requireSupabase();
    const { data } = await client.from("selection_rules").select("enabled").eq("id", id).maybeSingle();
    if (!data) return;
    const { error } = await client.from("selection_rules").update({ enabled: !data.enabled }).eq("id", id);
    if (error) throw error;
  },

  async listByOutput(outputKey: SelectionOutputKey): Promise<SelectionRule[]> {
    const { data, error } = await requireSupabase()
      .from("selection_rules")
      .select("*")
      .eq("output_key", outputKey)
      .order("sort_order", { ascending: true });
    if (error) throw error;
    return (data ?? []).map(fromRow);
  },
};
