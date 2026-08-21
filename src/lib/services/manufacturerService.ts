import { manufacturers, getManufacturerById } from "@/lib/mock/manufacturers";
import { delay } from "@/lib/utils/async";
import type { ManufacturerRepository } from "./types";

class MockManufacturerRepository implements ManufacturerRepository {
  async list() {
    return delay(manufacturers);
  }
  async getById(id: string) {
    return delay(getManufacturerById(id) ?? null);
  }
}

export const manufacturerService: ManufacturerRepository = new MockManufacturerRepository();
