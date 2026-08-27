import { requireSupabase } from "@/lib/supabase/client";
import type { CaseSchedule } from "@/lib/types/design";

interface CaseScheduleRow {
  case_id: string;
  sheet_metal_order_date: string | null;
  sheet_metal_delivery_date: string | null;
  sheet_metal_delivery_done: boolean;
  box_order_date: string | null;
  box_delivery_date: string | null;
  box_delivery_done: boolean;
  accessory_order_date: string | null;
  accessory_delivery_date: string | null;
  accessory_delivery_done: boolean;
  production_start_date: string | null;
  production_end_date: string | null;
  production_end_ref_date: string | null;
  production_end_done: boolean;
  inspection_start_date: string | null;
  inspection_end_date: string | null;
  inspection_end_ref_date: string | null;
  inspection_end_done: boolean;
  witness_start_date: string | null;
  witness_end_date: string | null;
  witness_end_ref_date: string | null;
  witness_end_done: boolean;
  shipping_start_date: string | null;
  shipping_end_date: string | null;
  shipping_end_ref_date: string | null;
  shipping_end_done: boolean;
  delivery_date: string | null;
  delivery_done: boolean;
  box_manufacturer: string;
  sheet_metal_manufacturer: string;
}

function emptySchedule(caseId: string): CaseSchedule {
  return {
    caseId,
    sheetMetalOrderDate: null,
    sheetMetalDeliveryDate: null,
    sheetMetalDeliveryDone: false,
    boxOrderDate: null,
    boxDeliveryDate: null,
    boxDeliveryDone: false,
    accessoryOrderDate: null,
    accessoryDeliveryDate: null,
    accessoryDeliveryDone: false,
    productionStartDate: null,
    productionEndDate: null,
    productionEndRefDate: null,
    productionEndDone: false,
    inspectionStartDate: null,
    inspectionEndDate: null,
    inspectionEndRefDate: null,
    inspectionEndDone: false,
    witnessStartDate: null,
    witnessEndDate: null,
    witnessEndRefDate: null,
    witnessEndDone: false,
    shippingStartDate: null,
    shippingEndDate: null,
    shippingEndRefDate: null,
    shippingEndDone: false,
    deliveryDate: null,
    deliveryDone: false,
    boxManufacturer: "",
    sheetMetalManufacturer: "",
  };
}

function fromRow(row: CaseScheduleRow): CaseSchedule {
  return {
    caseId: row.case_id,
    sheetMetalOrderDate: row.sheet_metal_order_date,
    sheetMetalDeliveryDate: row.sheet_metal_delivery_date,
    sheetMetalDeliveryDone: row.sheet_metal_delivery_done,
    boxOrderDate: row.box_order_date,
    boxDeliveryDate: row.box_delivery_date,
    boxDeliveryDone: row.box_delivery_done,
    accessoryOrderDate: row.accessory_order_date,
    accessoryDeliveryDate: row.accessory_delivery_date,
    accessoryDeliveryDone: row.accessory_delivery_done,
    productionStartDate: row.production_start_date,
    productionEndDate: row.production_end_date,
    productionEndRefDate: row.production_end_ref_date,
    productionEndDone: row.production_end_done,
    inspectionStartDate: row.inspection_start_date,
    inspectionEndDate: row.inspection_end_date,
    inspectionEndRefDate: row.inspection_end_ref_date,
    inspectionEndDone: row.inspection_end_done,
    witnessStartDate: row.witness_start_date,
    witnessEndDate: row.witness_end_date,
    witnessEndRefDate: row.witness_end_ref_date,
    witnessEndDone: row.witness_end_done,
    shippingStartDate: row.shipping_start_date,
    shippingEndDate: row.shipping_end_date,
    shippingEndRefDate: row.shipping_end_ref_date,
    shippingEndDone: row.shipping_end_done,
    deliveryDate: row.delivery_date,
    deliveryDone: row.delivery_done,
    boxManufacturer: row.box_manufacturer,
    sheetMetalManufacturer: row.sheet_metal_manufacturer,
  };
}

function toRow(schedule: CaseSchedule) {
  return {
    case_id: schedule.caseId,
    sheet_metal_order_date: schedule.sheetMetalOrderDate,
    sheet_metal_delivery_date: schedule.sheetMetalDeliveryDate,
    sheet_metal_delivery_done: schedule.sheetMetalDeliveryDone,
    box_order_date: schedule.boxOrderDate,
    box_delivery_date: schedule.boxDeliveryDate,
    box_delivery_done: schedule.boxDeliveryDone,
    accessory_order_date: schedule.accessoryOrderDate,
    accessory_delivery_date: schedule.accessoryDeliveryDate,
    accessory_delivery_done: schedule.accessoryDeliveryDone,
    production_start_date: schedule.productionStartDate,
    production_end_date: schedule.productionEndDate,
    production_end_ref_date: schedule.productionEndRefDate,
    production_end_done: schedule.productionEndDone,
    inspection_start_date: schedule.inspectionStartDate,
    inspection_end_date: schedule.inspectionEndDate,
    inspection_end_ref_date: schedule.inspectionEndRefDate,
    inspection_end_done: schedule.inspectionEndDone,
    witness_start_date: schedule.witnessStartDate,
    witness_end_date: schedule.witnessEndDate,
    witness_end_ref_date: schedule.witnessEndRefDate,
    witness_end_done: schedule.witnessEndDone,
    shipping_start_date: schedule.shippingStartDate,
    shipping_end_date: schedule.shippingEndDate,
    shipping_end_ref_date: schedule.shippingEndRefDate,
    shipping_end_done: schedule.shippingEndDone,
    delivery_date: schedule.deliveryDate,
    delivery_done: schedule.deliveryDone,
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
