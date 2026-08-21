import { addManufacturer, getManufacturerById, listManufacturers } from "@/lib/mock/manufacturers";
import { delay } from "@/lib/utils/async";
import type { ManufacturerRepository } from "./types";

class LocalManufacturerRepository implements ManufacturerRepository {
  async list() {
    return delay(listManufacturers());
  }
  async getById(id: string) {
    return delay(getManufacturerById(id) ?? null);
  }
  async create(name: string) {
    return delay(addManufacturer(name), 150);
  }
}

export const manufacturerService: ManufacturerRepository = new LocalManufacturerRepository();
