import type { ComponentType } from "react";
import { OhmsLawCalculators } from "./calculators/OhmsLawCalculators";
import { ThreePhaseCalculator } from "./calculators/ThreePhaseCalculator";
import { TransformerCalculator } from "./calculators/TransformerCalculator";
import { MotorFrequencyCalculators } from "./calculators/MotorFrequencyCalculators";
import { VoltageDropCalculators } from "./calculators/VoltageDropCalculators";
import { PowerFactorCalculators } from "./calculators/PowerFactorCalculators";
import { ImpedanceCalculators } from "./calculators/ImpedanceCalculators";
import { ShortCircuitCalculators } from "./calculators/ShortCircuitCalculators";
import { CtVtCalculator } from "./calculators/CtVtCalculator";
import { HighLowVoltageCalculator } from "./calculators/HighLowVoltageCalculator";

export interface ElectricalToolCategory {
  id: string;
  titleJa: string;
  titleVi: string;
  /** Lowercased search terms (both languages) matched against the top search box. */
  keywords: string[];
  component: ComponentType;
}

/**
 * The 10 電気技術計算 categories, in sidebar/category-nav order. Each entry's
 * `component` is a thin category view that itself hosts one or more
 * sub-tools built on `VariableSolverCard` — see `src/components/
 * electricalTools/calculators/*`. Adding a new calculator is: write its
 * engine under `src/lib/calc/electrical/*`, its category component here (or
 * a new sub-tool inside an existing one), then list it below.
 */
export const ELECTRICAL_TOOL_CATEGORIES: ElectricalToolCategory[] = [
  {
    id: "ohmsLaw",
    titleJa: "基本電力・オームの法則",
    titleVi: "Điện cơ bản / Định luật Ohm",
    keywords: [
      "v", "i", "r", "p", "kw", "kva", "kvar", "力率", "cosφ", "オームの法則",
      "電圧", "電流", "抵抗", "電力", "効率", "hieu suat", "dien ap", "dong dien",
    ],
    component: OhmsLawCalculators,
  },
  {
    id: "threePhase",
    titleJa: "三相・Y/Δ",
    titleVi: "3 pha / Y-Δ",
    keywords: [
      "三相", "yδ", "y-δ", "スター", "デルタ", "線間電圧", "相電圧", "線電流", "相電流",
      "y/d", "yd", "ba pha",
    ],
    component: ThreePhaseCalculator,
  },
  {
    id: "transformer",
    titleJa: "変圧器",
    titleVi: "Máy biến áp",
    keywords: [
      "変圧器", "トランス", "kva", "巻数比", "変圧比", "一次電圧", "二次電圧",
      "yy0", "dyn11", "6.6kv", "may bien ap",
    ],
    component: TransformerCalculator,
  },
  {
    id: "motorFrequency",
    titleJa: "電動機・周波数",
    titleVi: "Động cơ / Tần số",
    keywords: [
      "電動機", "モーター", "周波数", "極数", "同期速度", "すべり", "50hz", "60hz",
      "hz", "dong co", "tan so",
    ],
    component: MotorFrequencyCalculators,
  },
  {
    id: "voltageDrop",
    titleJa: "電圧降下",
    titleVi: "Sụt áp",
    keywords: [
      "電圧降下", "こう長", "断面積", "末端電圧", "35.6", "30.8", "sut ap",
    ],
    component: VoltageDropCalculators,
  },
  {
    id: "powerFactor",
    titleJa: "力率・進相コンデンサ",
    titleVi: "Hệ số công suất / Tụ bù",
    keywords: [
      "力率", "cosφ", "進相コンデンサ", "kvar", "電力三角形", "he so cong suat", "tu bu",
    ],
    component: PowerFactorCalculators,
  },
  {
    id: "impedance",
    titleJa: "インピーダンス・RLC",
    titleVi: "Trở kháng / RLC",
    keywords: [
      "インピーダンス", "z", "rlc", "リアクタンス", "xl", "xc", "共振", "直列", "並列",
      "tro khang",
    ],
    component: ImpedanceCalculators,
  },
  {
    id: "shortCircuit",
    titleJa: "短絡電流・%Z",
    titleVi: "Dòng ngắn mạch / %Z",
    keywords: [
      "短絡電流", "%z", "パーセントインピーダンス", "isc", "定格電流", "ngan mach",
    ],
    component: ShortCircuitCalculators,
  },
  {
    id: "ctVt",
    titleJa: "CT・VT",
    titleVi: "CT / VT",
    keywords: [
      "ct", "vt", "変流器", "計器用変圧器", "変流比", "変圧比",
    ],
    component: CtVtCalculator,
  },
  {
    id: "highLowVoltage",
    titleJa: "高圧・低圧 基本計算",
    titleVi: "Cao áp / Hạ áp cơ bản",
    keywords: [
      "高圧", "低圧", "特別高圧", "6.6kv", "キュービクル", "cao ap", "ha ap",
    ],
    component: HighLowVoltageCalculator,
  },
];

export function searchElectricalToolCategories(query: string): ElectricalToolCategory[] {
  const q = query.trim().toLowerCase();
  if (!q) return ELECTRICAL_TOOL_CATEGORIES;
  return ELECTRICAL_TOOL_CATEGORIES.filter(
    (c) =>
      c.titleJa.toLowerCase().includes(q) ||
      c.titleVi.toLowerCase().includes(q) ||
      c.keywords.some((k) => k.includes(q) || q.includes(k)),
  );
}
