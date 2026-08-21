import { partDataSeed } from "@/lib/mock/partData";
import { delay } from "@/lib/utils/async";
import { loadFromStorage, saveToStorage } from "@/lib/utils/localStore";
import { rankBySearch } from "@/lib/utils/searchRanking";
import type { PartData } from "@/lib/types";
import type { PartDataRepository } from "./types";

const KEY = "sekkei.partData";

function loadAll(): PartData[] {
  return loadFromStorage<PartData[]>(KEY, partDataSeed);
}
function saveAll(list: PartData[]) {
  saveToStorage(KEY, list);
}

class LocalPartDataRepository implements PartDataRepository {
  async search(query: string) {
    return delay(
      rankBySearch(loadAll(), query, (p) => [p.model, p.symbol, p.category, p.specification, p.remarks]),
      250,
    );
  }
  async list() {
    return delay(loadAll(), 150);
  }
  async getById(id: string) {
    return delay(loadAll().find((p) => p.id === id) ?? null, 100);
  }
  async findByModel(model: string) {
    const q = model.trim().toLowerCase();
    return loadAll().find((p) => p.model.trim().toLowerCase() === q) ?? null;
  }
  async create(input: Omit<PartData, "id" | "updatedAt">): Promise<PartData> {
    const all = loadAll();
    const created: PartData = {
      ...input,
      id: `pd-${Date.now()}-${all.length}`,
      updatedAt: new Date().toISOString().slice(0, 10),
    };
    all.push(created);
    saveAll(all);
    return delay(created, 200);
  }
  async update(id: string, patch: Partial<PartData>): Promise<PartData> {
    const all = loadAll();
    const idx = all.findIndex((p) => p.id === id);
    if (idx === -1) throw new Error(`PartData not found: ${id}`);
    const updated: PartData = { ...all[idx], ...patch, id, updatedAt: new Date().toISOString().slice(0, 10) };
    all[idx] = updated;
    saveAll(all);
    return delay(updated, 200);
  }
}

export const partDataService: PartDataRepository = new LocalPartDataRepository();
