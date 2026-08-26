import { requireSupabase } from "@/lib/supabase/client";
import { fetchFileAssets, fetchFileAssetsByOwners } from "./fileAssetService";
import { rankBySearch } from "@/lib/utils/searchRanking";
import type { PartData } from "@/lib/types";
import type { PartDataRepository } from "./types";

interface PartDataRow {
  id: string;
  symbol: string | null;
  category: string;
  manufacturer_id: string | null;
  model: string;
  specification: string;
  weight: number | null;
  quantity: number | null;
  heat_w: number | null;
  remarks: string | null;
  source: string;
  updated_at: string;
  deleted_at: string | null;
}

async function fromRow(row: PartDataRow): Promise<PartData> {
  const files = await fetchFileAssets("part_data", row.id);
  return rowToPart(row, files);
}

function rowToPart(row: PartDataRow, files: PartData["files"]): PartData {
  return {
    id: row.id,
    symbol: row.symbol ?? undefined,
    category: row.category,
    manufacturerId: row.manufacturer_id ?? "",
    model: row.model,
    specification: row.specification,
    weight: row.weight ?? undefined,
    quantity: row.quantity ?? undefined,
    heatW: row.heat_w ?? undefined,
    remarks: row.remarks ?? undefined,
    source: row.source,
    files,
    updatedAt: row.updated_at.slice(0, 10),
    deletedAt: row.deleted_at ? row.deleted_at.slice(0, 10) : undefined,
  };
}

async function attachFiles(rows: PartDataRow[]): Promise<PartData[]> {
  const fileMap = await fetchFileAssetsByOwners("part_data", rows.map((r) => r.id));
  return rows.map((r) => rowToPart(r, fileMap.get(r.id) ?? []));
}

class SupabasePartDataRepository implements PartDataRepository {
  async search(query: string) {
    const { data, error } = await requireSupabase().from("part_data").select("*").is("deleted_at", null);
    if (error) throw error;
    const all = await attachFiles((data ?? []) as PartDataRow[]);
    return rankBySearch(all, query, (p) => [p.model, p.symbol, p.category, p.specification, p.remarks]);
  }

  async list() {
    const { data, error } = await requireSupabase()
      .from("part_data")
      .select("*")
      .is("deleted_at", null)
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return attachFiles((data ?? []) as PartDataRow[]);
  }

  async getById(id: string) {
    const { data, error } = await requireSupabase().from("part_data").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? fromRow(data as PartDataRow) : null;
  }

  async findExisting({
    manufacturerId,
    category,
    model,
    specification,
  }: {
    manufacturerId: string;
    category: string;
    model: string;
    specification: string;
  }) {
    let query = requireSupabase()
      .from("part_data")
      .select("*")
      .is("deleted_at", null)
      .ilike("model", model.trim())
      .ilike("specification", specification.trim())
      .ilike("category", category.trim());
    query = manufacturerId ? query.eq("manufacturer_id", manufacturerId) : query.is("manufacturer_id", null);
    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    return data ? fromRow(data as PartDataRow) : null;
  }

  async create(input: Omit<PartData, "id" | "updatedAt">): Promise<PartData> {
    const { data, error } = await requireSupabase()
      .from("part_data")
      .insert({
        symbol: input.symbol ?? null,
        category: input.category,
        manufacturer_id: input.manufacturerId || null,
        model: input.model,
        specification: input.specification,
        weight: input.weight ?? null,
        quantity: input.quantity ?? null,
        heat_w: input.heatW ?? null,
        remarks: input.remarks ?? null,
        source: input.source,
      })
      .select()
      .single();
    if (error) throw error;
    return fromRow(data as PartDataRow);
  }

  async update(id: string, patch: Partial<PartData>): Promise<PartData> {
    const row: Record<string, unknown> = {};
    if (patch.symbol !== undefined) row.symbol = patch.symbol;
    if (patch.category !== undefined) row.category = patch.category;
    if (patch.manufacturerId !== undefined) row.manufacturer_id = patch.manufacturerId || null;
    if (patch.model !== undefined) row.model = patch.model;
    if (patch.specification !== undefined) row.specification = patch.specification;
    if (patch.weight !== undefined) row.weight = patch.weight;
    if (patch.quantity !== undefined) row.quantity = patch.quantity;
    if (patch.heatW !== undefined) row.heat_w = patch.heatW;
    if (patch.remarks !== undefined) row.remarks = patch.remarks;
    row.updated_at = new Date().toISOString();

    const { data, error } = await requireSupabase().from("part_data").update(row).eq("id", id).select().single();
    if (error) throw error;
    return fromRow(data as PartDataRow);
  }

  async moveToTrash(id: string): Promise<void> {
    const { error } = await requireSupabase()
      .from("part_data")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
  }

  async listTrashed() {
    const { data, error } = await requireSupabase()
      .from("part_data")
      .select("*")
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false });
    if (error) throw error;
    return attachFiles((data ?? []) as PartDataRow[]);
  }

  async restore(id: string): Promise<void> {
    const { error } = await requireSupabase().from("part_data").update({ deleted_at: null }).eq("id", id);
    if (error) throw error;
  }

  async purge(id: string): Promise<void> {
    const { error } = await requireSupabase().from("part_data").delete().eq("id", id);
    if (error) throw error;
  }
}

export const partDataService: PartDataRepository = new SupabasePartDataRepository();
