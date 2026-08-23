import { requireSupabase } from "@/lib/supabase/client";
import { fetchFileAssets, fetchFileAssetsByOwners } from "./fileAssetService";
import { rankBySearch } from "@/lib/utils/searchRanking";
import type { Catalog } from "@/lib/types";
import type { CatalogRepository } from "./types";

interface CatalogRow {
  id: string;
  manufacturer_id: string | null;
  category: string;
  model: string;
  file_name: string;
  updated_at: string;
  deleted_at: string | null;
}

function rowToCatalog(row: CatalogRow, files: Catalog["files"]): Catalog {
  return {
    id: row.id,
    manufacturerId: row.manufacturer_id ?? "",
    category: row.category,
    model: row.model,
    fileName: row.file_name,
    files,
    updatedAt: row.updated_at.slice(0, 10),
    deletedAt: row.deleted_at ? row.deleted_at.slice(0, 10) : undefined,
  };
}

async function fromRow(row: CatalogRow): Promise<Catalog> {
  const files = await fetchFileAssets("catalog", row.id);
  return rowToCatalog(row, files);
}

async function attachFiles(rows: CatalogRow[]): Promise<Catalog[]> {
  const fileMap = await fetchFileAssetsByOwners("catalog", rows.map((r) => r.id));
  return rows.map((r) => rowToCatalog(r, fileMap.get(r.id) ?? []));
}

class SupabaseCatalogRepository implements CatalogRepository {
  async search(query: string) {
    const { data, error } = await requireSupabase().from("catalogs").select("*").is("deleted_at", null);
    if (error) throw error;
    const all = await attachFiles((data ?? []) as CatalogRow[]);
    if (!query.trim()) return all;
    return rankBySearch(all, query, (c) => [c.model, c.category, c.fileName]);
  }

  async list() {
    const { data, error } = await requireSupabase()
      .from("catalogs")
      .select("*")
      .is("deleted_at", null)
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return attachFiles((data ?? []) as CatalogRow[]);
  }

  async findByModel(model: string) {
    const { data, error } = await requireSupabase()
      .from("catalogs")
      .select("*")
      .is("deleted_at", null)
      .ilike("model", model.trim())
      .maybeSingle();
    if (error) throw error;
    return data ? fromRow(data as CatalogRow) : null;
  }

  async create(input: Omit<Catalog, "id" | "updatedAt">): Promise<Catalog> {
    const { data, error } = await requireSupabase()
      .from("catalogs")
      .insert({
        manufacturer_id: input.manufacturerId || null,
        category: input.category,
        model: input.model,
        file_name: input.fileName,
      })
      .select()
      .single();
    if (error) throw error;
    return fromRow(data as CatalogRow);
  }

  async update(id: string, patch: Partial<Catalog>): Promise<Catalog> {
    const row: Record<string, unknown> = {};
    if (patch.category !== undefined) row.category = patch.category;
    if (patch.manufacturerId !== undefined) row.manufacturer_id = patch.manufacturerId || null;
    if (patch.model !== undefined) row.model = patch.model;
    if (patch.fileName !== undefined) row.file_name = patch.fileName;
    row.updated_at = new Date().toISOString();

    const { data, error } = await requireSupabase().from("catalogs").update(row).eq("id", id).select().single();
    if (error) throw error;
    return fromRow(data as CatalogRow);
  }

  async moveToTrash(id: string): Promise<void> {
    const { error } = await requireSupabase()
      .from("catalogs")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
  }

  async listTrashed() {
    const { data, error } = await requireSupabase()
      .from("catalogs")
      .select("*")
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false });
    if (error) throw error;
    return attachFiles((data ?? []) as CatalogRow[]);
  }

  async restore(id: string): Promise<void> {
    const { error } = await requireSupabase().from("catalogs").update({ deleted_at: null }).eq("id", id);
    if (error) throw error;
  }

  async purge(id: string): Promise<void> {
    const { error } = await requireSupabase().from("catalogs").delete().eq("id", id);
    if (error) throw error;
  }
}

export const catalogService: CatalogRepository = new SupabaseCatalogRepository();
