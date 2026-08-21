import { catalogList, searchCatalog } from "@/lib/mock/catalog";
import { delay } from "@/lib/utils/async";
import type { CatalogRepository } from "./types";

class MockCatalogRepository implements CatalogRepository {
  async search(query: string) {
    return delay(searchCatalog(query));
  }
  async list() {
    return delay(catalogList);
  }
}

export const catalogService: CatalogRepository = new MockCatalogRepository();
