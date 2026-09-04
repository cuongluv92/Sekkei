import { requireSupabase } from "@/lib/supabase/client";

export type TerminalBlockBasisKind = "reference" | "company";

export interface TerminalBlockSelectionRow {
  id: string;
  basisKind: TerminalBlockBasisKind;
  manufacturer: string;
  series: string;
  model: string;
  ratedCurrentA: number;
  maxWireMm2: number;
  screwSize: string;
  voltageLabel?: string;
  sourceTitle?: string;
  sourceUrl?: string;
  remarks?: string;
  sortOrder: number;
}

export interface TerminalBlockSelectionDraft {
  manufacturer?: string;
  series?: string;
  model: string;
  ratedCurrentA: number;
  maxWireMm2: number;
  screwSize: string;
  voltageLabel?: string;
  remarks?: string;
}

interface Row {
  id: string;
  basis_kind: TerminalBlockBasisKind;
  manufacturer: string;
  series: string;
  model: string;
  rated_current_a: number;
  max_wire_mm2: number;
  screw_size: string;
  voltage_label: string | null;
  source_title: string | null;
  source_url: string | null;
  remarks: string | null;
  sort_order: number;
}

function fromRow(row: Row): TerminalBlockSelectionRow {
  return {
    id: row.id,
    basisKind: row.basis_kind,
    manufacturer: row.manufacturer,
    series: row.series,
    model: row.model,
    ratedCurrentA: Number(row.rated_current_a),
    maxWireMm2: Number(row.max_wire_mm2),
    screwSize: row.screw_size,
    voltageLabel: row.voltage_label ?? undefined,
    sourceTitle: row.source_title ?? undefined,
    sourceUrl: row.source_url ?? undefined,
    remarks: row.remarks ?? undefined,
    sortOrder: row.sort_order,
  };
}

export function pickTerminalBlock(
  rows: TerminalBlockSelectionRow[],
  currentA: number,
  basisKind: TerminalBlockBasisKind,
): TerminalBlockSelectionRow | null {
  return (
    rows
      .filter((row) => row.basisKind === basisKind && row.ratedCurrentA >= currentA)
      .sort((a, b) => a.ratedCurrentA - b.ratedCurrentA || a.sortOrder - b.sortOrder)[0] ?? null
  );
}

export const terminalBlockSelectionService = {
  async list(): Promise<TerminalBlockSelectionRow[]> {
    const { data, error } = await requireSupabase()
      .from("terminal_block_selections")
      .select("*")
      .order("basis_kind", { ascending: false })
      .order("rated_current_a", { ascending: true })
      .order("sort_order", { ascending: true });
    if (error) throw error;
    return (data ?? []).map((row) => fromRow(row as Row));
  },

  async createCompany(draft: TerminalBlockSelectionDraft): Promise<TerminalBlockSelectionRow> {
    const client = requireSupabase();
    const { data: maxRow } = await client
      .from("terminal_block_selections")
      .select("sort_order")
      .eq("basis_kind", "company")
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data, error } = await client
      .from("terminal_block_selections")
      .insert({
        basis_kind: "company",
        manufacturer: draft.manufacturer?.trim() || "東洋技研",
        series: draft.series?.trim() || "AT",
        model: draft.model.trim(),
        rated_current_a: draft.ratedCurrentA,
        max_wire_mm2: draft.maxWireMm2,
        screw_size: draft.screwSize.trim(),
        voltage_label: draft.voltageLabel?.trim() || null,
        remarks: draft.remarks?.trim() || null,
        sort_order: maxRow ? Number(maxRow.sort_order) + 1 : 0,
      })
      .select()
      .single();
    if (error) throw error;
    return fromRow(data as Row);
  },

  async updateCompany(
    id: string,
    draft: TerminalBlockSelectionDraft,
  ): Promise<TerminalBlockSelectionRow> {
    const { data, error } = await requireSupabase()
      .from("terminal_block_selections")
      .update({
        manufacturer: draft.manufacturer?.trim() || "東洋技研",
        series: draft.series?.trim() || "AT",
        model: draft.model.trim(),
        rated_current_a: draft.ratedCurrentA,
        max_wire_mm2: draft.maxWireMm2,
        screw_size: draft.screwSize.trim(),
        voltage_label: draft.voltageLabel?.trim() || null,
        remarks: draft.remarks?.trim() || null,
      })
      .eq("id", id)
      .eq("basis_kind", "company")
      .select()
      .single();
    if (error) throw error;
    return fromRow(data as Row);
  },

  async removeCompany(id: string): Promise<void> {
    const { error } = await requireSupabase()
      .from("terminal_block_selections")
      .delete()
      .eq("id", id)
      .eq("basis_kind", "company");
    if (error) throw error;
  },
};
