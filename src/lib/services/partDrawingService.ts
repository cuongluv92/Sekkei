import { partDrawingSeed } from "@/lib/mock/partDrawing";
import { delay } from "@/lib/utils/async";
import { loadFromStorage, saveToStorage } from "@/lib/utils/localStore";
import { rankBySearch } from "@/lib/utils/searchRanking";
import type { PartDrawing } from "@/lib/types";
import type { PartDrawingRepository } from "./types";

const KEY = "sekkei.partDrawing";

function loadAll(): PartDrawing[] {
  return loadFromStorage<PartDrawing[]>(KEY, partDrawingSeed);
}
function saveAll(list: PartDrawing[]) {
  saveToStorage(KEY, list);
}

class LocalPartDrawingRepository implements PartDrawingRepository {
  async search(query: string) {
    return delay(
      rankBySearch(loadAll(), query, (p) => [p.model, p.category, p.specification, p.remarks]),
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
  async create(input: Omit<PartDrawing, "id" | "updatedAt">): Promise<PartDrawing> {
    const all = loadAll();
    const created: PartDrawing = {
      ...input,
      id: `dw-${Date.now()}-${all.length}`,
      updatedAt: new Date().toISOString().slice(0, 10),
    };
    all.push(created);
    saveAll(all);
    return delay(created, 200);
  }
  async update(id: string, patch: Partial<PartDrawing>): Promise<PartDrawing> {
    const all = loadAll();
    const idx = all.findIndex((p) => p.id === id);
    if (idx === -1) throw new Error(`PartDrawing not found: ${id}`);
    const updated: PartDrawing = { ...all[idx], ...patch, id, updatedAt: new Date().toISOString().slice(0, 10) };
    all[idx] = updated;
    saveAll(all);
    return delay(updated, 200);
  }
}

export const partDrawingService: PartDrawingRepository = new LocalPartDrawingRepository();
