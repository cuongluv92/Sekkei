import type { PartDrawing } from "@/lib/types";

export const partDrawingList: PartDrawing[] = [
  {
    id: "dw-001",
    category: "配線用遮断器",
    manufacturerId: "mitsubishi",
    model: "NF63-CV",
    specification: "外形図・取付寸法図",
    remarks: "盤設計標準図",
    source: "社内図面DB",
    files: [{ id: "dw-001-dwg", kind: "dwg", fileName: "NF63-CV_outline.dwg" }],
    updatedAt: "2026-06-05",
  },
  {
    id: "dw-002",
    category: "電磁接触器",
    manufacturerId: "mitsubishi",
    model: "S-N20",
    specification: "外形図",
    remarks: "",
    source: "社内図面DB",
    files: [{ id: "dw-002-dwg", kind: "dwg", fileName: "S-N20_outline.dwg" }],
    updatedAt: "2026-05-02",
  },
  {
    id: "dw-003",
    category: "盤筐体",
    manufacturerId: "nito",
    model: "CASE-800x600",
    specification: "自立盤 800x600x2000",
    remarks: "標準キャビネット",
    source: "社内図面DB",
    files: [
      { id: "dw-003-dwg", kind: "dwg", fileName: "CASE-800x600.dwg" },
      { id: "dw-003-pdf", kind: "pdf", fileName: "CASE-800x600.pdf" },
    ],
    updatedAt: "2026-04-28",
  },
  {
    id: "dw-004",
    category: "電磁開閉器",
    manufacturerId: "fuji",
    model: "SW-05",
    specification: "外形図",
    remarks: "",
    source: "社内図面DB",
    files: [],
    updatedAt: "2026-03-15",
  },
  {
    id: "dw-005",
    category: "配線用遮断器",
    manufacturerId: "mitsubishi",
    model: "NF32-SV",
    specification: "外形図・盤内配置図",
    remarks: "",
    source: "社内図面DB",
    files: [{ id: "dw-005-dwg", kind: "dwg", fileName: "NF32-SV_layout.dwg" }],
    updatedAt: "2026-01-30",
  },
];

export function searchPartDrawing(query: string): PartDrawing[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return partDrawingList.filter((p) =>
    [p.model, p.category, p.specification, p.remarks]
      .filter(Boolean)
      .some((field) => field!.toLowerCase().includes(q)),
  );
}
