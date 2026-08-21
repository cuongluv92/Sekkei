import type { Catalog } from "@/lib/types";

export const catalogList: Catalog[] = [
  {
    id: "cat-001",
    manufacturerId: "mitsubishi",
    category: "配線用遮断器",
    model: "NFシリーズ",
    fileName: "NFseries_catalog_2026.pdf",
    updatedAt: "2026-04-01",
    files: [{ id: "cat-001-pdf", kind: "pdf", fileName: "NFseries_catalog_2026.pdf" }],
  },
  {
    id: "cat-002",
    manufacturerId: "fuji",
    category: "電磁開閉器",
    model: "SWシリーズ",
    fileName: "SWseries_catalog_2025.pdf",
    updatedAt: "2025-10-14",
    files: [{ id: "cat-002-pdf", kind: "pdf", fileName: "SWseries_catalog_2025.pdf" }],
  },
  {
    id: "cat-003",
    manufacturerId: "nito",
    category: "盤筐体",
    model: "キャビネット総合カタログ",
    fileName: "cabinet_catalog_2026.pdf",
    updatedAt: "2026-02-20",
    files: [{ id: "cat-003-pdf", kind: "pdf", fileName: "cabinet_catalog_2026.pdf" }],
  },
  {
    id: "cat-004",
    manufacturerId: "panasonic",
    category: "配線用遮断器",
    model: "BJWシリーズ",
    fileName: "BJW_catalog_image.png",
    updatedAt: "2025-08-05",
    files: [{ id: "cat-004-img", kind: "image", fileName: "BJW_catalog_image.png" }],
  },
];

export function searchCatalog(query: string): Catalog[] {
  const q = query.trim().toLowerCase();
  if (!q) return catalogList;
  return catalogList.filter((c) =>
    [c.model, c.category, c.fileName].some((f) => f.toLowerCase().includes(q)),
  );
}
