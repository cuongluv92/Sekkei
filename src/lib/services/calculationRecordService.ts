import { requireSupabase } from "@/lib/supabase/client";

export interface CalculationRecord {
  id: string;
  projectId: string;
  calculationType: string;
  input: Record<string, unknown>;
  result: Record<string, unknown>;
  updatedAt: string;
}

interface CalculationRecordRow {
  id: string;
  project_id: string;
  calculation_type: string;
  input: Record<string, unknown> | null;
  result: Record<string, unknown> | null;
  updated_at: string;
}

function fromRow(row: CalculationRecordRow): CalculationRecord {
  return {
    id: row.id,
    projectId: row.project_id,
    calculationType: row.calculation_type,
    input: row.input ?? {},
    result: row.result ?? {},
    updatedAt: row.updated_at,
  };
}

/**
 * Generic per-Project calculation persistence, shared by every calculation
 * module (基本重量計算/盤重量計算/換気計算/耐震計算/他計算 and anything added later)
 * instead of a bespoke table per module. `calculationType` is a free-form
 * key the caller owns — 基本重量計算 uses one per shape (e.g.
 * "weight-basic-angle"), other modules use one flat key (e.g. "ventilation").
 * One row per (project, type); saving again replaces it — no version
 * history yet, per spec.
 */
export const calculationRecordService = {
  async get(projectId: string, calculationType: string): Promise<CalculationRecord | null> {
    const { data, error } = await requireSupabase()
      .from("calculation_records")
      .select("*")
      .eq("project_id", projectId)
      .eq("calculation_type", calculationType)
      .maybeSingle();
    if (error) throw error;
    return data ? fromRow(data as CalculationRecordRow) : null;
  },

  /** Every record for a Project whose type starts with `typePrefix` — e.g. "weight-basic-" fetches all 4 shapes in one query. */
  async listByPrefix(projectId: string, typePrefix: string): Promise<CalculationRecord[]> {
    const { data, error } = await requireSupabase()
      .from("calculation_records")
      .select("*")
      .eq("project_id", projectId)
      .like("calculation_type", `${typePrefix}%`);
    if (error) throw error;
    return (data ?? []).map(fromRow);
  },

  async save(
    projectId: string,
    calculationType: string,
    input: Record<string, unknown>,
    result: Record<string, unknown>,
  ): Promise<CalculationRecord> {
    const { data, error } = await requireSupabase()
      .from("calculation_records")
      .upsert(
        {
          project_id: projectId,
          calculation_type: calculationType,
          input,
          result,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "project_id,calculation_type" },
      )
      .select()
      .single();
    if (error) throw error;
    return fromRow(data as CalculationRecordRow);
  },
};
