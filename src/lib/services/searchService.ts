import { partDataService } from "./partDataService";
import { partDrawingService } from "./partDrawingService";
import { catalogService } from "./catalogService";
import { delay } from "@/lib/utils/async";
import type { SearchResultItem } from "@/lib/types";
import type { SearchRepository } from "./types";

/**
 * Global 検索 — spans 部品データ・部品図・カタログ (real repositories, not
 * fabricated results), each hit clearly labeled with its source so results
 * from different tables are never confused with each other.
 */
class RealSearchRepository implements SearchRepository {
  async search(query: string): Promise<SearchResultItem[]> {
    if (!query.trim()) return delay([], 100);

    const [dataHits, drawingHits, catalogHits] = await Promise.all([
      partDataService.search(query),
      partDrawingService.search(query),
      catalogService.search(query),
    ]);

    const fromData: SearchResultItem[] = dataHits.map((p) => ({
      id: p.id,
      source: "part-data",
      category: p.category,
      manufacturerId: p.manufacturerId,
      model: p.model,
      specification: p.specification,
      weight: p.weight,
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

    const fromCatalog: SearchResultItem[] = catalogHits.map((c) => ({
      id: c.id,
      source: "catalog",
      category: c.category,
      manufacturerId: c.manufacturerId,
      model: c.model,
      specification: c.fileName,
      sourceLabel: c.fileName,
      files: c.files,
    }));

    return delay([...fromData, ...fromDrawing, ...fromCatalog], 300);
  }
}

export const searchService: SearchRepository = new RealSearchRepository();
