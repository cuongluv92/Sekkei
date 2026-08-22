import { requireSupabase } from "@/lib/supabase/client";
import type { PartAssemblyRow } from "@/lib/types";

interface PartAssemblyRow_DB {
  id: string;
  project_id: string;
  position: number;
  symbol: string;
  name: string;
  manufacturer_id: string | null;
  model: string;
  specification: string;
  weight: number | null;
  quantity: number;
  remarks: string | null;
  source_ref_id: string | null;
  source_type: PartAssemblyRow["sourceType"] | null;
  case_id: string | null;
  panel_id: string | null;
}

function fromRow(row: PartAssemblyRow_DB): PartAssemblyRow {
  return {
    id: row.id,
    symbol: row.symbol,
    name: row.name,
    manufacturerId: row.manufacturer_id ?? "",
    model: row.model,
    specification: row.specification,
    weight: row.weight ?? undefined,
    quantity: row.quantity,
    remarks: row.remarks ?? undefined,
    sourceRefId: row.source_ref_id ?? undefined,
    sourceType: row.source_type ?? undefined,
    caseId: row.case_id ?? undefined,
    panelId: row.panel_id ?? undefined,
  };
}

function toRow(projectId: string, position: number, row: PartAssemblyRow) {
  return {
    project_id: projectId,
    position,
    symbol: row.symbol,
    name: row.name,
    manufacturer_id: row.manufacturerId || null,
    model: row.model,
    specification: row.specification,
    weight: row.weight ?? null,
    quantity: row.quantity,
    remarks: row.remarks ?? null,
    source_ref_id: row.sourceRefId ?? null,
    source_type: row.sourceType ?? null,
    case_id: row.caseId ?? null,
    panel_id: row.panelId ?? null,
  };
}

/**
 * 部品製作 rows, scoped per Project (never mixed between Projects). Reuses
 * the same `Project` entity as 設計管理 — one shared Project concept, not a
 * second parallel one. "Last active project" is a per-browser UI
 * convenience, not real data, so it stays in localStorage per the
 * "localStorage only for UI preference" rule.
 */
export const partAssemblyService = {
  async listByProject(projectId: string): Promise<PartAssemblyRow[]> {
    const { data, error } = await requireSupabase()
      .from("part_assembly_rows")
      .select("*")
      .eq("project_id", projectId)
      .order("position", { ascending: true });
    if (error) throw error;
    return (data ?? []).map(fromRow);
  },

  async saveRows(projectId: string, rows: PartAssemblyRow[]): Promise<void> {
    const client = requireSupabase();
    const { error: deleteError } = await client
      .from("part_assembly_rows")
      .delete()
      .eq("project_id", projectId);
    if (deleteError) throw deleteError;
    if (rows.length === 0) return;
    const { error: insertError } = await client
      .from("part_assembly_rows")
      .insert(rows.map((r, i) => toRow(projectId, i, r)));
    if (insertError) throw insertError;
  },
};
