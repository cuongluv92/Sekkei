import { delay } from "@/lib/utils/async";
import type { CaseSchedule } from "@/lib/types/design";
import { loadFromStorage, saveToStorage } from "@/lib/utils/localStore";

const KEY = "sekkei.design.schedules";

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
  };
}

function loadAll(): CaseSchedule[] {
  return loadFromStorage<CaseSchedule[]>(KEY, []);
}
function saveAll(list: CaseSchedule[]) {
  saveToStorage(KEY, list);
}

/** 工程 milestone dates for one 案件 — dates only, all coloring/segmenting is derived at render time. */
export const scheduleService = {
  async getByCase(caseId: string): Promise<CaseSchedule> {
    const found = loadAll().find((s) => s.caseId === caseId);
    return delay(found ?? emptySchedule(caseId), 150);
  },

  async save(schedule: CaseSchedule): Promise<CaseSchedule> {
    const all = loadAll().filter((s) => s.caseId !== schedule.caseId);
    all.push(schedule);
    saveAll(all);
    return delay(schedule, 200);
  },

  /** All schedules across every case — used by the timeline to render every case as one row. */
  async listAll(): Promise<CaseSchedule[]> {
    return delay(loadAll(), 150);
  },
};
