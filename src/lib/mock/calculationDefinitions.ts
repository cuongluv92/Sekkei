import type { CalculationDefinition } from "@/lib/types";

/**
 * Placeholder input/output shape for each calculation module. None of these
 * carry real formulas yet (`hasFormula: false`) — they only exist so the
 * generic calculation UI has something to render. Real fields, formulas and
 * result columns will be registered from 設定 > 計算設定 later.
 */
export const calculationDefinitions: CalculationDefinition[] = [
  {
    id: "calc-weight",
    key: "weight",
    name: "重量計算",
    nameVi: "Tính trọng lượng",
    description: "構造・部材の重量を計算します。",
    descriptionVi: "Tính trọng lượng kết cấu / vật liệu.",
    inputFields: [
      { key: "material", label: "材質", type: "text", placeholder: "例）SS400" },
      { key: "width", label: "幅", unit: "mm", type: "number" },
      { key: "height", label: "高さ", unit: "mm", type: "number" },
      { key: "thickness", label: "板厚", unit: "mm", type: "number" },
    ],
    resultColumns: [
      { key: "item", label: "項目" },
      { key: "weight", label: "重量", unit: "kg" },
      { key: "remarks", label: "備考" },
    ],
    hasFormula: false,
  },
  {
    id: "calc-ventilation",
    key: "ventilation",
    name: "換気計算",
    nameVi: "Tính thông gió",
    description: "必要換気量・開口面積などを計算します。",
    descriptionVi: "Tính lưu lượng gió cần thiết, diện tích mở...",
    inputFields: [
      { key: "heatLoss", label: "発熱量", unit: "W", type: "number" },
      { key: "tempRise", label: "許容温度上昇", unit: "℃", type: "number" },
      {
        key: "method",
        label: "換気方式",
        type: "select",
        options: [
          { label: "自然換気", labelVi: "Tự nhiên", value: "natural" },
          { label: "強制換気", labelVi: "Cưỡng bức", value: "forced" },
        ],
      },
    ],
    resultColumns: [
      { key: "item", label: "項目" },
      { key: "value", label: "値" },
      { key: "remarks", label: "備考" },
    ],
    hasFormula: false,
  },
  {
    id: "calc-seismic",
    key: "seismic",
    name: "耐震計算",
    nameVi: "Tính chống động đất",
    description: "耐震強度・固定方法を計算します。",
    descriptionVi: "Tính cường độ chịu động đất và phương án cố định.",
    inputFields: [
      { key: "weight", label: "対象重量", unit: "kg", type: "number" },
      { key: "seismicCoeff", label: "設計震度", type: "number" },
      { key: "installLocation", label: "設置階", type: "text" },
    ],
    resultColumns: [
      { key: "item", label: "項目" },
      { key: "value", label: "値" },
      { key: "judgement", label: "判定" },
    ],
    hasFormula: false,
  },
  {
    id: "calc-busbar",
    key: "busbar",
    name: "母線銅帯",
    nameVi: "Thanh cái đồng",
    description: "母線銅帯のサイズを計算します。",
    descriptionVi: "Tính kích thước thanh cái đồng.",
    inputFields: [
      { key: "current", label: "定格電流", unit: "A", type: "number" },
      { key: "phase", label: "相数", type: "select", options: [
        { label: "単相", labelVi: "1 pha", value: "1p" },
        { label: "三相", labelVi: "3 pha", value: "3p" },
      ] },
    ],
    resultColumns: [
      { key: "size", label: "銅帯サイズ" },
      { key: "count", label: "本数" },
      { key: "remarks", label: "備考" },
    ],
    hasFormula: false,
  },
  {
    id: "calc-earth-wire",
    key: "earth-wire",
    name: "アース電線サイズ",
    nameVi: "Kích thước dây tiếp đất",
    description: "アース電線サイズを計算します。",
    descriptionVi: "Tính kích thước dây tiếp đất.",
    inputFields: [
      { key: "breakerCapacity", label: "遮断器定格", unit: "A", type: "number" },
      { key: "wireMaterial", label: "電線材質", type: "text", placeholder: "例）IV" },
    ],
    resultColumns: [
      { key: "size", label: "電線サイズ" },
      { key: "remarks", label: "備考" },
    ],
    hasFormula: false,
  },
];

export function getCalculationDefinition(key: string): CalculationDefinition | undefined {
  return calculationDefinitions.find((c) => c.key === key);
}
