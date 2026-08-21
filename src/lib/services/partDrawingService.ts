import { partDrawingList, searchPartDrawing } from "@/lib/mock/partDrawing";
import { delay } from "@/lib/utils/async";
import type { PartDrawingRepository } from "./types";

class MockPartDrawingRepository implements PartDrawingRepository {
  async search(query: string) {
    return delay(searchPartDrawing(query));
  }
  async list() {
    return delay(partDrawingList);
  }
  async getById(id: string) {
    return delay(partDrawingList.find((p) => p.id === id) ?? null);
  }
}

export const partDrawingService: PartDrawingRepository = new MockPartDrawingRepository();
