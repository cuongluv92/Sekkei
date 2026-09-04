import { requireSupabase } from "@/lib/supabase/client";

export type WireConductorBasisKind = "reference" | "company";
export type WireConductorItemKind = "wire" | "busbar";
export type WireConductorWireType = "IV" | "WL1";

export interface WireConductorSource {
  id: string;
  title: string;
  url?: string;
  documentNo?: string;
  verifiedAt?: string;
  remarks?: string;
}

export interface WireConductorSelectionRow {
  id: string;
  basisKind: WireConductorBasisKind;
  itemKind: WireConductorItemKind;
  wireType?: WireConductorWireType;
  currentA: number;
  resultValue: string;
  conditionLabel?: string;
  remarks?: string;
  order: number;
  source?: WireConductorSource;
}

export interface WireConductorSelectionDraft {
  basisKind: "company";
  itemKind: WireConductorItemKind;
  wireType?: WireConductorWireType;
  currentA: number;
  resultValue: string;
  conditionLabel?: string;
  remarks?: string;
}

interface SourceRow {
  id: string;
  title: string;
  url: string | null;
  document_no: string | null;
  verified_at: string | null;
  remarks: string | null;
}

interface DbRow {
  id: string;
  basis_kind: string;
  item_kind: string;
  wire_type: string | null;
  current_a: number;
  result_value: string;
  condition_label: string | null;
  remarks: string | null;
  sort_order: number;
  selection_sources: SourceRow | SourceRow[] | null;
}

function normalizeSource(value: DbRow["selection_sources"]): SourceRow | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function fromRow(row: DbRow): WireConductorSelectionRow {
  const source = normalizeSource(row.selection_sources);
  return {
    id: row.id,
    basisKind: row.basis_kind as WireConductorBasisKind,
    itemKind: row.item_kind as WireConductorItemKind,
    wireType: row.wire_type ? (row.wire_type as WireConductorWireType) : undefined,
    currentA: Number(row.current_a),
    resultValue: row.result_value,
    conditionLabel: row.condition_label ?? undefined,
    remarks: row.remarks ?? undefined,
    order: row.sort_order,
    source: source
      ? {
          id: source.id,
          title: source.title,
          url: source.url ?? undefined,
          documentNo: source.document_no ?? undefined,
          verifiedAt: source.verified_at ?? undefined,
          remarks: source.remarks ?? undefined,
        }
      : undefined,
  };
}

function toWriteRow(draft: WireConductorSelectionDraft) {
  return {
    basis_kind: "company",
    item_kind: draft.itemKind,
    wire_type: draft.itemKind === "wire" ? draft.wireType ?? null : null,
    current_a: draft.currentA,
    result_value: draft.resultValue.trim(),
    condition_label: draft.conditionLabel?.trim() || null,
    remarks: draft.remarks?.trim() || null,
  };
}

export function pickWireConductorSelection(
  rows: WireConductorSelectionRow[],
  currentA: number,
  basisKind: WireConductorBasisKind,
  itemKind: WireConductorItemKind,
  wireType?: WireConductorWireType,
): WireConductorSelectionRow | null {
  if (!Number.isFinite(currentA) || currentA <= 0) return null;
  const candidates = rows
    .filter(
      (row) =>
        row.basisKind === basisKind &&
        row.itemKind === itemKind &&
        (itemKind === "busbar" || row.wireType === wireType) &&
        row.currentA >= currentA,
    )
    .sort((a, b) => a.currentA - b.currentA || a.order - b.order);
  return candidates[0] ?? null;
}

export const wireConductorSelectionService = {
  async list(): Promise<WireConductorSelectionRow[]> {
    const { data, error } = await requireSupabase()
      .from("wire_conductor_selection_rows")
      .select("*, selection_sources(id,title,url,document_no,verified_at,remarks)")
      .order("basis_kind", { ascending: true })
      .order("item_kind", { ascending: true })
      .order("wire_type", { ascending: true })
      .order("current_a", { ascending: true })
      .order("sort_order", { ascending: true });
    if (error) throw error;
    return ((data ?? []) as DbRow[]).map(fromRow);
  },

  async createCompany(draft: WireConductorSelectionDraft): Promise<WireConductorSelectionRow> {
    const client = requireSupabase();
    const { data: maxRow } = await client
      .from("wire_conductor_selection_rows")
      .select("sort_order")
      .eq("basis_kind", "company")
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextOrder = maxRow ? Number(maxRow.sort_order) + 1 : 0;
    const { data, error } = await client
      .from("wire_conductor_selection_rows")
      .insert({ ...toWriteRow(draft), sort_order: nextOrder })
      .select("*, selection_sources(id,title,url,document_no,verified_at,remarks)")
      .single();
    if (error) throw error;
    return fromRow(data as DbRow);
  },

  async updateCompany(id: string, draft: WireConductorSelectionDraft): Promise<WireConductorSelectionRow> {
    const { data, error } = await requireSupabase()
      .from("wire_conductor_selection_rows")
      .update(toWriteRow(draft))
      .eq("id", id)
      .eq("basis_kind", "company")
      .select("*, selection_sources(id,title,url,document_no,verified_at,remarks)")
      .single();
    if (error) throw error;
    return fromRow(data as DbRow);
  },

  async removeCompany(id: string): Promise<void> {
    const { error } = await requireSupabase()
      .from("wire_conductor_selection_rows")
      .delete()
      .eq("id", id)
      .eq("basis_kind", "company");
    if (error) throw error;
  },
};
