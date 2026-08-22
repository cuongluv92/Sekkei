import { requireSupabase } from "@/lib/supabase/client";
import type { PartAssemblyRow } from "@/lib/types";

interface PartAssemblyRow_DB {
  id: string;
  design_case_id: string;
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

function toRow(caseId: string, position: number, row: PartAssemblyRow) {
  return {
    design_case_id: caseId,
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
 * 部品製作 rows, scoped per 案件 (never mixed between 案件 — see
 * `design_case_id`, distinct from the optional per-row `case_id`/`panel_id`
 * traceability fields above). 案件 is the single root record shared by the
 * whole app — there is no separate "Project" system for 部品製作 to belong
 * to.
 */
export const partAssemblyService = {
  async listByCase(caseId: string): Promise<PartAssemblyRow[]> {
    const { data, error } = await requireSupabase()
      .from("part_assembly_rows")
      .select("*")
      .eq("design_case_id", caseId)
      .order("position", { ascending: true });
    if (error) throw error;
    return (data ?? []).map(fromRow);
  },

  async saveRows(caseId: string, rows: PartAssemblyRow[]): Promise<void> {
    const client = requireSupabase();
    const { error: deleteError } = await client
      .from("part_assembly_rows")
      .delete()
      .eq("design_case_id", caseId);
    if (deleteError) throw deleteError;
    if (rows.length === 0) return;
    const { error: insertError } = await client
      .from("part_assembly_rows")
      .insert(rows.map((r, i) => toRow(caseId, i, r)));
    if (insertError) throw insertError;
  },

  /**
   * Free-text OR search across 記号/品名/型式/定格・仕様/備考 for one query
   * string, across every 案件 — backs Global Search's 部品製作 provider (point
   * 12: "部品製作 - 部品 thuộc案件 nào"). Each field runs as its own `ilike`
   * and results are merged/deduped client-side, same reasoning as
   * `designCaseService.quickSearch` (avoids `.or()` filter-string injection
   * from user-typed punctuation). Returns the owning 案件's id alongside
   * each row (distinct from the row's own optional, unrelated `caseId`
   * traceability field) so callers can label/link back to the right 案件.
   */
  async searchAll(
    query: string,
  ): Promise<{ row: PartAssemblyRow; caseId: string }[]> {
    const q = query.trim();
    if (!q) return [];
    const client = requireSupabase();
    const fields = [
      "symbol",
      "name",
      "model",
      "specification",
      "remarks",
    ] as const;
    const results = await Promise.all(
      fields.map((f) =>
        client.from("part_assembly_rows").select("*").ilike(f, `%${q}%`),
      ),
    );
    const rowsById = new Map<string, PartAssemblyRow_DB>();
    for (const result of results) {
      if (result.error) throw result.error;
      for (const row of (result.data ?? []) as PartAssemblyRow_DB[])
        rowsById.set(row.id, row);
    }
    return Array.from(rowsById.values()).map((row) => ({
      row: fromRow(row),
      caseId: row.design_case_id,
    }));
  },
};
