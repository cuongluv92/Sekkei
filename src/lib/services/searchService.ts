import { searchPartData } from "@/lib/mock/partData";
import { searchPartDrawing } from "@/lib/mock/partDrawing";
import { delay } from "@/lib/utils/async";
import type { SearchResultItem } from "@/lib/types";
import type { SearchRepository } from "./types";

class MockSearchRepository implements SearchRepository {
  async search(query: string): Promise<SearchResultItem[]> {
    const [dataHits, drawingHits] = await Promise.all([
      searchPartData(query),
      searchPartDrawing(query),
    ]);

    const fromData: SearchResultItem[] = dataHits.map((p) => ({
      id: p.id,
      source: "part-data",
      category: p.category,
      manufacturerId: p.manufacturerId,
      model: p.model,
      specification: p.specification,
      quantity: p.quantity,
      remarks: p.remarks,
      sourceLabel: p.source,
      files: p.files,
    }));

    const fromDrawing: SearchResultItem[] = drawingHits.map((p) => ({
      id: p.id,
      source: "part-drawing",
      category: p.category,
      manufacturerId: p.manufacturerId,
      model: p.model,
      specification: p.specification,
      remarks: p.remarks,
      sourceLabel: p.source,
      files: p.files,
    }));

    return delay([...fromData, ...fromDrawing], 400);
  }
}

export const searchService: SearchRepository = new MockSearchRepository();
