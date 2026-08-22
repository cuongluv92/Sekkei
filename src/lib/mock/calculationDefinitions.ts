import type { CalculationDefinition } from "@/lib/types";

/**
 * Placeholder input/output shape for calculation modules that still use the
 * generic Project→入力→計算→保存 shell (`CalculationPageView`). None of
 * these carry real formulas (`hasFormula: false` — this generic mock
 * `calculate()` never computes anything real; see calculationService.ts).
 * A module with a real, standard-backed formula (計算式/計算過程/根拠規格)
 * graduates out of this registry into its own bespoke component instead —
 * see 重量計算 (`BasicWeightCalc`/`WeightShapeCalcSection`) and 母線銅帯
 * (`src/components/calculation/busbar/*`, `src/lib/calc/busbar/*`) for that
 * pattern. There is no Settings UI to "register a formula" here — technical
 * formulas are implemented in code with tests and a cited standard/source,
 * never user-entered (see `src/lib/calc/technicalSource.ts`).
 */
export const calculationDefinitions: CalculationDefinition[] = [
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
    id: "calc-earth-wire",
    key: "earth-wire",
    name: "アース電線サイズ",
    nameVi: "Kích thước dây tiếp đất",
    description: "アース電線サイズを計算します。",
    descriptionVi: "Tính kích thước dây tiếp đất.",
    inputFields: [
      {
        key: "breakerCapacity",
        label: "遮断器定格",
        unit: "A",
        type: "number",
      },
      {
        key: "wireMaterial",
        label: "電線材質",
        type: "text",
        placeholder: "例）IV",
      },
    ],
    resultColumns: [
      { key: "size", label: "電線サイズ" },
      { key: "remarks", label: "備考" },
    ],
    hasFormula: false,
  },
];

export function getCalculationDefinition(
  key: string,
): CalculationDefinition | undefined {
  return calculationDefinitions.find((c) => c.key === key);
}
