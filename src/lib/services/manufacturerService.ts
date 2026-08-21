import { addManufacturer, getManufacturerById, preloadManufacturers } from "@/lib/mock/manufacturers";
import type { ManufacturerRepository } from "./types";

class SupabaseManufacturerRepository implements ManufacturerRepository {
  async list() {
    return preloadManufacturers();
  }
  async getById(id: string) {
    await preloadManufacturers();
    return getManufacturerById(id) ?? null;
  }
  async create(name: string) {
    return addManufacturer(name);
  }
}

export const manufacturerService: ManufacturerRepository = new SupabaseManufacturerRepository();
