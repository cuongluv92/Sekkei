import { requireSupabase } from "@/lib/supabase/client";
import type { ProductionRequest } from "@/lib/types/design";

interface ProductionRequestRow {
  case_id: string;
  production_notes: string;
  inspection_sheet: string;
  film_thickness: string;
  earth_leakage: string;
  earth_leakage_alarm: string;
  withstand_voltage: string;
}

function emptyRequest(caseId: string): ProductionRequest {
  return {
    caseId,
    productionNotes: "",
    inspectionSheet: "",
    filmThickness: "",
    earthLeakage: "",
    earthLeakageAlarm: "",
    withstandVoltage: "",
  };
}

function fromRow(row: ProductionRequestRow): ProductionRequest {
  return {
    caseId: row.case_id,
    productionNotes: row.production_notes,
    inspectionSheet: row.inspection_sheet,
    filmThickness: row.film_thickness,
    earthLeakage: row.earth_leakage,
    earthLeakageAlarm: row.earth_leakage_alarm,
    withstandVoltage: row.withstand_voltage,
  };
}

/** Case-level 製作依頼 fields (盤 rows themselves live on case_panels via designCaseService.savePanels). */
export const productionRequestService = {
  async getByCase(caseId: string): Promise<ProductionRequest> {
    const { data, error } = await requireSupabase()
      .from("production_requests")
      .select("*")
      .eq("case_id", caseId)
      .maybeSingle();
    if (error) throw error;
    return data ? fromRow(data as ProductionRequestRow) : emptyRequest(caseId);
  },

  async save(request: ProductionRequest): Promise<ProductionRequest> {
    const { data, error } = await requireSupabase()
      .from("production_requests")
      .upsert(
        {
          case_id: request.caseId,
          production_notes: request.productionNotes,
          inspection_sheet: request.inspectionSheet,
          film_thickness: request.filmThickness,
          earth_leakage: request.earthLeakage,
          earth_leakage_alarm: request.earthLeakageAlarm,
          withstand_voltage: request.withstandVoltage,
        },
        { onConflict: "case_id" },
      )
      .select()
      .single();
    if (error) throw error;
    return fromRow(data as ProductionRequestRow);
  },
};
