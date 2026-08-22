import { requireSupabase } from "@/lib/supabase/client";

export interface CalculationRecord {
  id: string;
  caseId: string;
  calculationType: string;
  input: Record<string, unknown>;
  result: Record<string, unknown>;
  updatedAt: string;
}

interface CalculationRecordRow {
  id: string;
  case_id: string;
  calculation_type: string;
  input: Record<string, unknown> | null;
  result: Record<string, unknown> | null;
  updated_at: string;
}

function fromRow(row: CalculationRecordRow): CalculationRecord {
  return {
    id: row.id,
    caseId: row.case_id,
    calculationType: row.calculation_type,
    input: row.input ?? {},
    result: row.result ?? {},
    updatedAt: row.updated_at,
  };
}

/**
 * Generic per-案件 calculation persistence, shared by every calculation
 * module (基本重量計算/盤重量計算/換気計算/耐震計算/母線銅帯/他計算 and anything added
 * later) instead of a bespoke table per module. `calculationType` is a
 * free-form key the caller owns — 基本重量計算 uses one per shape (e.g.
 * "weight-basic-angle"), other modules use one flat key (e.g. "ventilation",
 * "busbar"). One row per (案件, type); saving again replaces it — no version
 * history yet, per spec. Scoped by `case_id` (design_cases.id) — 案件 IS the
 * root record, there is no separate Project grouping above it.
 */
export const calculationRecordService = {
  async get(
    caseId: string,
    calculationType: string,
  ): Promise<CalculationRecord | null> {
    const { data, error } = await requireSupabase()
      .from("calculation_records")
      .select("*")
      .eq("case_id", caseId)
      .eq("calculation_type", calculationType)
      .maybeSingle();
    if (error) throw error;
    return data ? fromRow(data as CalculationRecordRow) : null;
  },

  /** Every record for a 案件 whose type starts with `typePrefix` — e.g. "weight-basic-" fetches all 4 shapes in one query. */
  async listByPrefix(
    caseId: string,
    typePrefix: string,
  ): Promise<CalculationRecord[]> {
    const { data, error } = await requireSupabase()
      .from("calculation_records")
      .select("*")
      .eq("case_id", caseId)
      .like("calculation_type", `${typePrefix}%`);
    if (error) throw error;
    return (data ?? []).map(fromRow);
  },

  /** Every saved calculation for a 案件, regardless of type — backs Global Search's 計算 provider and 保存済み案件's archive-impact warning. */
  async listByCase(caseId: string): Promise<CalculationRecord[]> {
    const { data, error } = await requireSupabase()
      .from("calculation_records")
      .select("*")
      .eq("case_id", caseId);
    if (error) throw error;
    return (data ?? []).map(fromRow);
  },

  async save(
    caseId: string,
    calculationType: string,
    input: Record<string, unknown>,
    result: Record<string, unknown>,
  ): Promise<CalculationRecord> {
    const { data, error } = await requireSupabase()
      .from("calculation_records")
      .upsert(
        {
          case_id: caseId,
          calculation_type: calculationType,
          input,
          result,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "case_id,calculation_type" },
      )
      .select()
      .single();
    if (error) throw error;
    return fromRow(data as CalculationRecordRow);
  },
};
