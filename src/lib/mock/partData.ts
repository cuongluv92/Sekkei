import type { PartData } from "@/lib/types";

export const partDataList: PartData[] = [
  {
    id: "pd-001",
    category: "配線用遮断器",
    manufacturerId: "mitsubishi",
    model: "NF63-CV",
    specification: "3P 50A 定格遮断容量2.5kA",
    quantity: 1,
    remarks: "盤内主幹用",
    source: "社内部品DB",
    files: [
      { id: "pd-001-pdf", kind: "pdf", fileName: "NF63-CV_spec.pdf" },
      { id: "pd-001-dwg", kind: "dwg", fileName: "NF63-CV.dwg" },
    ],
    updatedAt: "2026-06-02",
  },
  {
    id: "pd-002",
    category: "配線用遮断器",
    manufacturerId: "mitsubishi",
    model: "NF125-SV",
    specification: "3P 100A 定格遮断容量5kA",
    quantity: 1,
    remarks: "",
    source: "社内部品DB",
    files: [{ id: "pd-002-pdf", kind: "pdf", fileName: "NF125-SV_spec.pdf" }],
    updatedAt: "2026-05-20",
  },
  {
    id: "pd-003",
    category: "電磁開閉器",
    manufacturerId: "fuji",
    model: "SW-05",
    specification: "AC200V 3.7kW用",
    quantity: 1,
    remarks: "熱動継電器付",
    source: "メーカーカタログ取込",
    files: [{ id: "pd-003-pdf", kind: "pdf", fileName: "SW-05_datasheet.pdf" }],
    updatedAt: "2026-04-11",
  },
  {
    id: "pd-004",
    category: "端子台",
    manufacturerId: "nito",
    model: "TB-20",
    specification: "20極 600V 20A",
    quantity: 2,
    remarks: "",
    source: "社内部品DB",
    files: [],
    updatedAt: "2026-03-30",
  },
  {
    id: "pd-005",
    category: "電磁接触器",
    manufacturerId: "mitsubishi",
    model: "S-N20",
    specification: "AC200V 20A 3a",
    quantity: 1,
    remarks: "補助接点2a2b",
    source: "社内部品DB",
    files: [
      { id: "pd-005-pdf", kind: "pdf", fileName: "S-N20_spec.pdf" },
      { id: "pd-005-dwg", kind: "dwg", fileName: "S-N20.dwg" },
    ],
    updatedAt: "2026-02-14",
  },
  {
    id: "pd-006",
    category: "配線用遮断器",
    manufacturerId: "panasonic",
    model: "BJW3403",
    specification: "3P 30A",
    quantity: 1,
    remarks: "漏電遮断器",
    source: "社内部品DB",
    files: [{ id: "pd-006-pdf", kind: "pdf", fileName: "BJW3403.pdf" }],
    updatedAt: "2026-01-25",
  },
  {
    id: "pd-007",
    category: "表示灯",
    manufacturerId: "fuji",
    model: "AH22-P",
    specification: "AC200V 赤",
    quantity: 3,
    remarks: "",
    source: "社内部品DB",
    files: [],
    updatedAt: "2025-12-18",
  },
  {
    id: "pd-008",
    category: "配線用遮断器",
    manufacturerId: "mitsubishi",
    model: "NF32-SV",
    specification: "3P 20A 定格遮断容量2.5kA",
    quantity: 1,
    remarks: "分岐用",
    source: "社内部品DB",
    files: [{ id: "pd-008-dwg", kind: "dwg", fileName: "NF32-SV.dwg" }],
    updatedAt: "2025-11-09",
  },
];

export function searchPartData(query: string): PartData[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return partDataList.filter((p) =>
    [p.model, p.category, p.specification, p.remarks]
      .filter(Boolean)
      .some((field) => field!.toLowerCase().includes(q)),
  );
}
