import { delay } from "@/lib/utils/async";
import type { ProductionRequest } from "@/lib/types/design";
import { loadFromStorage, saveToStorage } from "@/lib/utils/localStore";

const KEY = "sekkei.design.productionRequests";

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

function loadAll(): ProductionRequest[] {
  return loadFromStorage<ProductionRequest[]>(KEY, []);
}
function saveAll(list: ProductionRequest[]) {
  saveToStorage(KEY, list);
}

/** Case-level 製作依頼 fields (盤 rows themselves live on CasePanel via designCaseService.savePanels). */
export const productionRequestService = {
  async getByCase(caseId: string): Promise<ProductionRequest> {
    const found = loadAll().find((r) => r.caseId === caseId);
    return delay(found ?? emptyRequest(caseId), 150);
  },

  async save(request: ProductionRequest): Promise<ProductionRequest> {
    const all = loadAll().filter((r) => r.caseId !== request.caseId);
    all.push(request);
    saveAll(all);
    return delay(request, 200);
  },
};
