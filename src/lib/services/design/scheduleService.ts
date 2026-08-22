import { requireSupabase } from "@/lib/supabase/client";
import type { CaseSchedule } from "@/lib/types/design";

interface CaseScheduleRow {
  case_id: string;
  sheet_metal_order_date: string | null;
  sheet_metal_delivery_date: string | null;
  box_order_date: string | null;
  box_delivery_date: string | null;
  accessory_order_date: string | null;
  accessory_delivery_date: string | null;
  production_start_date: string | null;
  production_end_date: string | null;
  inspection_start_date: string | null;
  inspection_end_date: string | null;
  witness_start_date: string | null;
  witness_end_date: string | null;
  shipping_start_date: string | null;
  shipping_end_date: string | null;
  delivery_date: string | null;
  box_manufacturer: string;
  sheet_metal_manufacturer: string;
}

function emptySchedule(caseId: string): CaseSchedule {
  return {
    caseId,
    sheetMetalOrderDate: null,
    sheetMetalDeliveryDate: null,
    boxOrderDate: null,
    boxDeliveryDate: null,
    accessoryOrderDate: null,
    accessoryDeliveryDate: null,
    productionStartDate: null,
    productionEndDate: null,
    inspectionStartDate: null,
    inspectionEndDate: null,
    witnessStartDate: null,
    witnessEndDate: null,
    shippingStartDate: null,
    shippingEndDate: null,
    deliveryDate: null,
    boxManufacturer: "",
    sheetMetalManufacturer: "",
  };
}

function fromRow(row: CaseScheduleRow): CaseSchedule {
  return {
    caseId: row.case_id,
    sheetMetalOrderDate: row.sheet_metal_order_date,
    sheetMetalDeliveryDate: row.sheet_metal_delivery_date,
    boxOrderDate: row.box_order_date,
    boxDeliveryDate: row.box_delivery_date,
    accessoryOrderDate: row.accessory_order_date,
    accessoryDeliveryDate: row.accessory_delivery_date,
    productionStartDate: row.production_start_date,
    productionEndDate: row.production_end_date,
    inspectionStartDate: row.inspection_start_date,
    inspectionEndDate: row.inspection_end_date,
    witnessStartDate: row.witness_start_date,
    witnessEndDate: row.witness_end_date,
    shippingStartDate: row.shipping_start_date,
    shippingEndDate: row.shipping_end_date,
    deliveryDate: row.delivery_date,
    boxManufacturer: row.box_manufacturer,
    sheetMetalManufacturer: row.sheet_metal_manufacturer,
  };
}

function toRow(schedule: CaseSchedule) {
  return {
    case_id: schedule.caseId,
    sheet_metal_order_date: schedule.sheetMetalOrderDate,
    sheet_metal_delivery_date: schedule.sheetMetalDeliveryDate,
    box_order_date: schedule.boxOrderDate,
    box_delivery_date: schedule.boxDeliveryDate,
    accessory_order_date: schedule.accessoryOrderDate,
    accessory_delivery_date: schedule.accessoryDeliveryDate,
    production_start_date: schedule.productionStartDate,
    production_end_date: schedule.productionEndDate,
    inspection_start_date: schedule.inspectionStartDate,
    inspection_end_date: schedule.inspectionEndDate,
    witness_start_date: schedule.witnessStartDate,
    witness_end_date: schedule.witnessEndDate,
    shipping_start_date: schedule.shippingStartDate,
    shipping_end_date: schedule.shippingEndDate,
    delivery_date: schedule.deliveryDate,
    box_manufacturer: schedule.boxManufacturer,
    sheet_metal_manufacturer: schedule.sheetMetalManufacturer,
  };
}

/** 工程 milestone dates for one 案件 — dates only, all coloring/segmenting is derived at render time. */
export const scheduleService = {
  async getByCase(caseId: string): Promise<CaseSchedule> {
    const { data, error } = await requireSupabase()
      .from("case_schedules")
      .select("*")
      .eq("case_id", caseId)
      .maybeSingle();
    if (error) throw error;
    return data ? fromRow(data as CaseScheduleRow) : emptySchedule(caseId);
  },

  async save(schedule: CaseSchedule): Promise<CaseSchedule> {
    const { data, error } = await requireSupabase()
      .from("case_schedules")
      .upsert(toRow(schedule), { onConflict: "case_id" })
      .select()
      .single();
    if (error) throw error;
    return fromRow(data as CaseScheduleRow);
  },

  /** All schedules across every case — used by the timeline to render every case as one row. */
  async listAll(): Promise<CaseSchedule[]> {
    const { data, error } = await requireSupabase().from("case_schedules").select("*");
    if (error) throw error;
    return (data ?? []).map(fromRow);
  },
};
