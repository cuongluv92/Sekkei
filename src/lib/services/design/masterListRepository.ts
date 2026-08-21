import { requireSupabase } from "@/lib/supabase/client";
import type { MasterListItem } from "@/lib/types/design";

interface MasterListRow {
  id: string;
  list_key: string;
  value: string;
  sort_order: number;
  enabled: boolean;
}

function fromRow(row: MasterListRow): MasterListItem {
  return { id: row.id, listKey: row.list_key, value: row.value, order: row.sort_order, enabled: row.enabled };
}

/**
 * Every dropdown/combobox candidate list in 設計管理 (設計依頼区分, 盤構造, the
 * 16 仕様 fields, electrical fields, ...) is backed by this, never hard-coded
 * in a component. Editable from 設定 > 設計管理設定. Starter values live in
 * the seed script (supabase/seed.sql), not here.
 */
export const masterListRepository = {
  async listKeys(): Promise<string[]> {
    const { data, error } = await requireSupabase().from("master_list_items").select("list_key");
    if (error) throw error;
    return Array.from(new Set((data ?? []).map((r) => r.list_key as string)));
  },

  async listByKey(listKey: string, includeDisabled = false): Promise<MasterListItem[]> {
    let query = requireSupabase()
      .from("master_list_items")
      .select("*")
      .eq("list_key", listKey)
      .order("sort_order", { ascending: true });
    if (!includeDisabled) query = query.eq("enabled", true);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map(fromRow);
  },

  async add(listKey: string, value: string): Promise<MasterListItem> {
    const trimmed = value.trim();
    const client = requireSupabase();

    const { data: existing } = await client
      .from("master_list_items")
      .select("*")
      .eq("list_key", listKey)
      .eq("value", trimmed)
      .maybeSingle();
    if (existing) return fromRow(existing as MasterListRow);

    const { data: maxRow } = await client
      .from("master_list_items")
      .select("sort_order")
      .eq("list_key", listKey)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextOrder = maxRow ? (maxRow.sort_order as number) + 1 : 0;

    const { data, error } = await client
      .from("master_list_items")
      .insert({ list_key: listKey, value: trimmed, sort_order: nextOrder, enabled: true })
      .select()
      .single();
    if (error) throw error;
    return fromRow(data as MasterListRow);
  },

  async update(id: string, value: string): Promise<void> {
    const { error } = await requireSupabase()
      .from("master_list_items")
      .update({ value: value.trim() })
      .eq("id", id);
    if (error) throw error;
  },

  async remove(id: string): Promise<void> {
    const { error } = await requireSupabase().from("master_list_items").delete().eq("id", id);
    if (error) throw error;
  },

  async toggleEnabled(id: string): Promise<void> {
    const client = requireSupabase();
    const { data } = await client.from("master_list_items").select("enabled").eq("id", id).maybeSingle();
    if (!data) return;
    const { error } = await client
      .from("master_list_items")
      .update({ enabled: !data.enabled })
      .eq("id", id);
    if (error) throw error;
  },

  async move(id: string, direction: "up" | "down"): Promise<void> {
    const client = requireSupabase();
    const { data: item } = await client.from("master_list_items").select("*").eq("id", id).maybeSingle();
    if (!item) return;

    const { data: siblings } = await client
      .from("master_list_items")
      .select("id, sort_order")
      .eq("list_key", item.list_key)
      .order("sort_order", { ascending: true });
    if (!siblings) return;

    const index = siblings.findIndex((s) => s.id === id);
    const swapWith = direction === "up" ? index - 1 : index + 1;
    if (swapWith < 0 || swapWith >= siblings.length) return;

    const a = siblings[index];
    const b = siblings[swapWith];
    await client.from("master_list_items").update({ sort_order: b.sort_order }).eq("id", a.id);
    await client.from("master_list_items").update({ sort_order: a.sort_order }).eq("id", b.id);
  },
};
