import { catalogSeed } from "@/lib/mock/catalog";
import { delay } from "@/lib/utils/async";
import { loadFromStorage, saveToStorage } from "@/lib/utils/localStore";
import { rankBySearch } from "@/lib/utils/searchRanking";
import type { Catalog } from "@/lib/types";
import type { CatalogRepository } from "./types";

const KEY = "sekkei.catalog";

function loadAll(): Catalog[] {
  return loadFromStorage<Catalog[]>(KEY, catalogSeed);
}
function saveAll(list: Catalog[]) {
  saveToStorage(KEY, list);
}

class LocalCatalogRepository implements CatalogRepository {
  async search(query: string) {
    if (!query.trim()) return delay(loadAll(), 200);
    return delay(rankBySearch(loadAll(), query, (c) => [c.model, c.category, c.fileName]), 250);
  }
  async list() {
    return delay(loadAll(), 150);
  }
  async findByModel(model: string) {
    const q = model.trim().toLowerCase();
    return loadAll().find((c) => c.model.trim().toLowerCase() === q) ?? null;
  }
  async create(input: Omit<Catalog, "id" | "updatedAt">): Promise<Catalog> {
    const all = loadAll();
    const created: Catalog = {
      ...input,
      id: `cat-${Date.now()}-${all.length}`,
      updatedAt: new Date().toISOString().slice(0, 10),
    };
    all.push(created);
    saveAll(all);
    return delay(created, 200);
  }
  async update(id: string, patch: Partial<Catalog>): Promise<Catalog> {
    const all = loadAll();
    const idx = all.findIndex((c) => c.id === id);
    if (idx === -1) throw new Error(`Catalog not found: ${id}`);
    const updated: Catalog = { ...all[idx], ...patch, id, updatedAt: new Date().toISOString().slice(0, 10) };
    all[idx] = updated;
    saveAll(all);
    return delay(updated, 200);
  }
}

export const catalogService: CatalogRepository = new LocalCatalogRepository();
