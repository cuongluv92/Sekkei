import { requireSupabase } from "@/lib/supabase/client";
import { fetchFileAssets, fetchFileAssetsByOwners } from "./fileAssetService";
import { rankBySearch } from "@/lib/utils/searchRanking";
import type { PartDrawing } from "@/lib/types";
import type { PartDrawingRepository } from "./types";

interface PartDrawingRow {
  id: string;
  category: string;
  manufacturer_id: string | null;
  model: string;
  specification: string;
  remarks: string | null;
  source: string;
  updated_at: string;
}

function rowToDrawing(row: PartDrawingRow, files: PartDrawing["files"]): PartDrawing {
  return {
    id: row.id,
    category: row.category,
    manufacturerId: row.manufacturer_id ?? "",
    model: row.model,
    specification: row.specification,
    remarks: row.remarks ?? undefined,
    source: row.source,
    files,
    updatedAt: row.updated_at.slice(0, 10),
  };
}

async function fromRow(row: PartDrawingRow): Promise<PartDrawing> {
  const files = await fetchFileAssets("part_drawing", row.id);
  return rowToDrawing(row, files);
}

async function attachFiles(rows: PartDrawingRow[]): Promise<PartDrawing[]> {
  const fileMap = await fetchFileAssetsByOwners("part_drawing", rows.map((r) => r.id));
  return rows.map((r) => rowToDrawing(r, fileMap.get(r.id) ?? []));
}

class SupabasePartDrawingRepository implements PartDrawingRepository {
  async search(query: string) {
    const { data, error } = await requireSupabase().from("part_drawings").select("*");
    if (error) throw error;
    const all = await attachFiles((data ?? []) as PartDrawingRow[]);
    return rankBySearch(all, query, (p) => [p.model, p.category, p.specification, p.remarks]);
  }

  async list() {
    const { data, error } = await requireSupabase()
      .from("part_drawings")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return attachFiles((data ?? []) as PartDrawingRow[]);
  }

  async getById(id: string) {
    const { data, error } = await requireSupabase().from("part_drawings").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? fromRow(data as PartDrawingRow) : null;
  }

  async findByModel(model: string) {
    const { data, error } = await requireSupabase()
      .from("part_drawings")
      .select("*")
      .ilike("model", model.trim())
      .maybeSingle();
    if (error) throw error;
    return data ? fromRow(data as PartDrawingRow) : null;
  }

  async create(input: Omit<PartDrawing, "id" | "updatedAt">): Promise<PartDrawing> {
    const { data, error } = await requireSupabase()
      .from("part_drawings")
      .insert({
        category: input.category,
        manufacturer_id: input.manufacturerId || null,
        model: input.model,
        specification: input.specification,
        remarks: input.remarks ?? null,
        source: input.source,
      })
      .select()
      .single();
    if (error) throw error;
    return fromRow(data as PartDrawingRow);
  }

  async update(id: string, patch: Partial<PartDrawing>): Promise<PartDrawing> {
    const row: Record<string, unknown> = {};
    if (patch.category !== undefined) row.category = patch.category;
    if (patch.manufacturerId !== undefined) row.manufacturer_id = patch.manufacturerId || null;
    if (patch.model !== undefined) row.model = patch.model;
    if (patch.specification !== undefined) row.specification = patch.specification;
    if (patch.remarks !== undefined) row.remarks = patch.remarks;
    row.updated_at = new Date().toISOString();

    const { data, error } = await requireSupabase()
      .from("part_drawings")
      .update(row)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return fromRow(data as PartDrawingRow);
  }
}

export const partDrawingService: PartDrawingRepository = new SupabasePartDrawingRepository();
