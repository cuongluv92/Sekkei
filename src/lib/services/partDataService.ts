import { partDataList, searchPartData } from "@/lib/mock/partData";
import { delay } from "@/lib/utils/async";
import type { PartDataRepository } from "./types";

class MockPartDataRepository implements PartDataRepository {
  async search(query: string) {
    return delay(searchPartData(query));
  }
  async list() {
    return delay(partDataList);
  }
  async getById(id: string) {
    return delay(partDataList.find((p) => p.id === id) ?? null);
  }
}

export const partDataService: PartDataRepository = new MockPartDataRepository();
