/**
 * 変圧器 — 容量(kVA)・一次/二次電圧・一次/二次電流の理想変圧器（無損失）関係。
 *
 * S1 = S2 = 容量[kVA] という「一次側皮相電力＝二次側皮相電力」の保存則
 * (engineering_fundamental) だけを土台にしており、結線方式（Y-Y, Δ-Δ,
 * Y-Δ, Δ-Y ...）を一切仮定しない。単相の場合のみ V1/V2 がそのまま巻数比
 * a = N1/N2 と一致する（結線の曖昧さが存在しない）ため `turnsRatio` を
 * 変数グラフに含めるが、三相の場合は `computeLineVoltageRatio` で別枠の
 * 「線間電圧比（参考値）」として算出し、実際の巻数比と混同されないよう
 * 常に注記を添える — 三相では線間電圧比が実際の巻数比と一致するのは
 * 一次・二次が同一結線（例: Yy）のときに限られるため。
 */
import { engineeringFundamentalSource } from "@/lib/calc/technicalSource";
import type { TechnicalSource } from "@/lib/calc/technicalSource";
import { solveByRules, type Rule } from "./ruleSolver";
import type { KnownValues, SolveResult } from "./types";

export type TransformerPhase = "single" | "three";
export type TransformerVar =
  | "kva"
  | "v1"
  | "i1"
  | "v2"
  | "i2"
  | "turnsRatio";

const CAPACITY_CONSERVATION_SOURCE = engineeringFundamentalSource(
  "理想変圧器の皮相電力保存 S1 = S2（無損失、励磁電流を無視）",
  "変圧器の一次・二次間（結線方式を問わない、線間電圧×線電流ベース）",
);
const TURNS_RATIO_SOURCE = engineeringFundamentalSource(
  "単相変圧器の巻数比 a = N1/N2 = V1/V2 = I2/I1",
  "単相変圧器（結線の曖昧さがないため、電圧比がそのまま巻数比と一致する）",
);

function rulesFor(phase: TransformerPhase): readonly Rule<TransformerVar>[] {
  const isThree = phase === "three";
  const k = isThree ? Math.sqrt(3) : 1;
  const sFormula = isThree ? "S = √3 × V × I / 1000" : "S = V × I / 1000";

  function capacityRule(
    voltageKey: "v1" | "v2",
    currentKey: "i1" | "i2",
  ): Rule<TransformerVar>[] {
    return [
      {
        output: "kva",
        inputs: [voltageKey, currentKey],
        compute: (v) => (k * v[voltageKey] * v[currentKey]) / 1000,
        describe: (v, r) => ({
          formula: sFormula,
          substituted: isThree
            ? `S = √3 × ${v[voltageKey]} × ${v[currentKey]} / 1000`
            : `S = ${v[voltageKey]} × ${v[currentKey]} / 1000`,
          resultLine: `S ≈ ${r} kVA`,
        }),
        source: CAPACITY_CONSERVATION_SOURCE,
      },
      {
        output: currentKey,
        inputs: ["kva", voltageKey],
        compute: (v) => (v.kva * 1000) / (k * v[voltageKey]),
        describe: (v, r) => ({
          formula: isThree
            ? `I = S × 1000 / (√3 × V)`
            : `I = S × 1000 / V`,
          substituted: isThree
            ? `I = ${v.kva} × 1000 / (√3 × ${v[voltageKey]})`
            : `I = ${v.kva} × 1000 / ${v[voltageKey]}`,
          resultLine: `I ≈ ${r} A`,
        }),
        source: CAPACITY_CONSERVATION_SOURCE,
      },
      {
        output: voltageKey,
        inputs: ["kva", currentKey],
        compute: (v) => (v.kva * 1000) / (k * v[currentKey]),
        describe: (v, r) => ({
          formula: isThree
            ? `V = S × 1000 / (√3 × I)`
            : `V = S × 1000 / I`,
          substituted: isThree
            ? `V = ${v.kva} × 1000 / (√3 × ${v[currentKey]})`
            : `V = ${v.kva} × 1000 / ${v[currentKey]}`,
          resultLine: `V ≈ ${r} V`,
        }),
        source: CAPACITY_CONSERVATION_SOURCE,
      },
    ];
  }

  const rules: Rule<TransformerVar>[] = [
    ...capacityRule("v1", "i1"),
    ...capacityRule("v2", "i2"),
  ];

  if (!isThree) {
    rules.push(
      {
        output: "turnsRatio",
        inputs: ["v1", "v2"],
        compute: ({ v1, v2 }) => v1 / v2,
        describe: (v, r) => ({
          formula: "a = V1 / V2",
          substituted: `a = ${v.v1} / ${v.v2}`,
          resultLine: `a ≈ ${r}`,
        }),
        source: TURNS_RATIO_SOURCE,
      },
      {
        output: "v1",
        inputs: ["turnsRatio", "v2"],
        compute: ({ turnsRatio, v2 }) => turnsRatio * v2,
        describe: (v, r) => ({
          formula: "V1 = a × V2",
          substituted: `V1 = ${v.turnsRatio} × ${v.v2}`,
          resultLine: `V1 ≈ ${r} V`,
        }),
        source: TURNS_RATIO_SOURCE,
      },
      {
        output: "v2",
        inputs: ["turnsRatio", "v1"],
        compute: ({ turnsRatio, v1 }) => v1 / turnsRatio,
        describe: (v, r) => ({
          formula: "V2 = V1 / a",
          substituted: `V2 = ${v.v1} / ${v.turnsRatio}`,
          resultLine: `V2 ≈ ${r} V`,
        }),
        source: TURNS_RATIO_SOURCE,
      },
    );
  }

  return rules;
}

export function solveTransformer(
  known: KnownValues<TransformerVar>,
  target: TransformerVar,
  phase: TransformerPhase,
): SolveResult {
  return solveByRules(rulesFor(phase), known, target);
}

/**
 * 三相変圧器の「線間電圧比」だけを単独計算する参考値 — 巻数比とは呼ばない。
 * 一次・二次が異なる結線（例: Δ-Y）の場合、線間電圧比は実際の巻数比と
 * 一致しないため、常にこの関数の呼び出し元で注記を表示すること。
 */
export interface LineVoltageRatioResult {
  ratio: number;
  note: string;
}
export function computeLineVoltageRatio(
  v1: number,
  v2: number,
): LineVoltageRatioResult | null {
  if (!Number.isFinite(v1) || !Number.isFinite(v2) || v2 === 0) return null;
  return {
    ratio: v1 / v2,
    note:
      "これは一次・二次の線間電圧の比であり、巻数比そのものではありません。" +
      "一次・二次が同一結線（例: Y-Y、Δ-Δ）の場合は巻数比と一致しますが、" +
      "異なる結線（例: Δ-Y、Y-Δ）の場合は一致しません。正確な巻数比には" +
      "各巻線の相電圧を使用し、実際の結線方式を銘板で確認してください。",
  };
}

/**
 * Vector group（結線記号・時計表示）の一般的な定義 — 実際の製品がどの
 * ベクトル群に該当するかは計算で求められるものではなく、必ず銘板・仕様書で
 * 確認する。ここでは各記号が表す一次・二次の位相差（clock notation:
 * 1時間=30°）を参考情報として示すのみで、数値計算の対象ではない。
 */
export interface VectorGroupInfo {
  code: string;
  phaseShiftDeg: number;
  descriptionJa: string;
}
export const TRANSFORMER_VECTOR_GROUP_SOURCE: TechnicalSource = {
  standard: "JEC-2200",
  edition: "2014",
  reference: "変圧器の結線記号（Y, D, z）と時計表示（clock number）の定義",
  applicability: "三相変圧器の結線表示全般",
  sourceType: "standard",
  verified: false,
  verificationNote:
    "clock numberが1時間=30°の位相差を表すという定義自体は電気工学の教科書レベルで広く一致しているが、" +
    "本システムはJEC-2200:2014の原文でこの定義を直接確認していない。実機のベクトル群（Yy0/Dyn11等）は" +
    "計算で求めず、必ず対象製品の銘板・試験成績書で確認すること。",
};
export const TRANSFORMER_VECTOR_GROUPS: VectorGroupInfo[] = [
  { code: "Yy0", phaseShiftDeg: 0, descriptionJa: "一次Y・二次Y、位相差0°" },
  { code: "Dd0", phaseShiftDeg: 0, descriptionJa: "一次Δ・二次Δ、位相差0°" },
  { code: "Dyn1", phaseShiftDeg: 30, descriptionJa: "一次Δ・二次Y（中性点引出）、位相差+30°" },
  { code: "Ynd1", phaseShiftDeg: 30, descriptionJa: "一次Y（中性点引出）・二次Δ、位相差+30°" },
  { code: "Dyn11", phaseShiftDeg: -30, descriptionJa: "一次Δ・二次Y（中性点引出）、位相差-30°" },
  { code: "Ynd11", phaseShiftDeg: -30, descriptionJa: "一次Y（中性点引出）・二次Δ、位相差-30°" },
];

/**
 * 6.6kV配電用変圧器の適用規格に関する参考情報 — 数値（%Z・損失等）は含まず、
 * 適用範囲を示すだけの情報。値そのものは要確認。
 */
export const JIS_C4304_DISTRIBUTION_TRANSFORMER_SOURCE: TechnicalSource = {
  standard: "JIS C 4304",
  edition: "2024",
  reference: "配電用6kV油入変圧器の適用範囲",
  applicability: "6.6kV配電用・油入変圧器",
  sourceType: "standard",
  verified: false,
  verificationNote:
    "規格番号・対象機種（油入変圧器）までは把握しているが、2024年版原文の適用範囲・定格・試験項目の詳細は未確認。" +
    "本番運用前にJIS C 4304:2024原本で該当条項を確認すること。",
};
export const JIS_C4306_DISTRIBUTION_TRANSFORMER_SOURCE: TechnicalSource = {
  standard: "JIS C 4306",
  edition: "2024",
  reference: "配電用6kVモールド変圧器の適用範囲",
  applicability: "6.6kV配電用・モールド（樹脂モールド）変圧器",
  sourceType: "standard",
  verified: false,
  verificationNote:
    "規格番号・対象機種（モールド変圧器）までは把握しているが、2024年版原文の適用範囲・定格・試験項目の詳細は未確認。" +
    "本番運用前にJIS C 4306:2024原本で該当条項を確認すること。",
};
