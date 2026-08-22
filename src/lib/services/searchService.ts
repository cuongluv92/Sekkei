import { partDataService } from "./partDataService";
import { partDrawingService } from "./partDrawingService";
import { catalogService } from "./catalogService";
import { delay } from "@/lib/utils/async";
import type { SearchResultItem } from "@/lib/types";
import type { SearchRepository } from "./types";

function toSearchResultItems(
  dataHits: Awaited<ReturnType<typeof partDataService.list>>,
  drawingHits: Awaited<ReturnType<typeof partDrawingService.list>>,
  catalogHits: Awaited<ReturnType<typeof catalogService.list>>,
): SearchResultItem[] {
  const fromData: SearchResultItem[] = dataHits.map((p) => ({
    id: p.id,
    source: "part-data",
    symbol: p.symbol,
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

  return [...fromData, ...fromDrawing, ...fromCatalog];
}

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
    return delay(toSearchResultItems(dataHits, drawingHits, catalogHits), 300);
  }

  /** Every non-trashed 部品データ・部品図・カタログ row, unfiltered — backs 部品製作's own search/filter bar, which filters client-side (メーカー/分類/仕様 combined with AND) instead of a single server query string. */
  async listAll(): Promise<SearchResultItem[]> {
    const [dataHits, drawingHits, catalogHits] = await Promise.all([
      partDataService.list(),
      partDrawingService.list(),
      catalogService.list(),
    ]);
    return toSearchResultItems(dataHits, drawingHits, catalogHits);
  }
}

export const searchService: SearchRepository = new RealSearchRepository();
