/**
 * 電圧降下 — 直流／単相2線式／三相3線式。
 *
 * 2つの独立した計算方式を提供する（どちらを使うかは呼び出し側が選ぶ）:
 *
 *  1. R/X法（`solveVoltageDrop`）— 電線こう長あたりの抵抗 r [Ω/km] と
 *     リアクタンス x [Ω/km] から、回路理論そのもの（キルヒホッフの電圧則）
 *     で電圧降下を求める。JIS/JEACの特定条項に依存しないため
 *     `engineeringFundamentalSource`（verified: true）。負荷力率が遅れ
 *     （誘導性）か進み（容量性）かでリアクタンス項の符号が反転する
 *     （ΔV = k×I×(r·cosφ ± x·sinφ)×L/1000、遅れ=+、進み=−）ため、
 *     呼び出し側は必ず `loadType` を明示的に選ばせ、遅れを暗黙のデフォルト
 *     として決め打ちしない。
 *
 *  2. 簡易係数法（`solveSimplifiedVoltageDrop`）— 単相2線式 35.6、三相3線式
 *     30.8 という、内線規程（JEAC 8001）の簡易早見式としてしばしば引用
 *     される係数を使う方式。この係数表を当システムはJEAC 8001原本で直接
 *     確認していないため `verified: false`（要確認）とし、"JEAC 8001準拠"
 *     とは表示しない。
 *
 * どちらの方式も、「ΔVの適合／不適合（○%以内など）」の判定は一切行わない
 * — 許容電圧降下率の具体的な数値（2%/3%/5%等）は内線規程・電気設備技術
 * 基準の該当条項を独自に確認できていないため、本システムはΔVの実数値・
 * 百分率のみを示し、適合判定はユーザー自身が該当規程を確認して行うこと。
 */
import {
  engineeringFundamentalSource,
  type TechnicalSource,
} from "@/lib/calc/technicalSource";
import { solveByRules, type Rule } from "./ruleSolver";
import {
  firstValidationError,
  requireNonNegative,
  requirePositive,
  requireRatio01,
} from "./validation";
import type { KnownValues, SolveResult } from "./types";

const VOLTAGE_DROP_RX_SOURCE = engineeringFundamentalSource(
  "電線こう長あたりのR・Xによる電圧降下 ΔV = k × I × (r·cosφ ± x·sinφ) × L / 1000" +
    "（k: 直流/単相=2、三相=√3。遅れ負荷=+、進み負荷=−。ΔVが負になる場合は電圧降下ではなく電圧上昇を意味する）",
  "電線路のこう長・線路定数（R・X）が既知の回路（キルヒホッフの電圧則に基づく一般式）。" +
    "ΔVは符号付き — 遅れ負荷（誘導性）でも軽負荷・進み成分の影響で理論上は負（電圧上昇）になり得るため、" +
    "本ツールは符号を強制的に非負へ丸めず、そのまま返す。",
);
const VOLTAGE_RELATION_SOURCE = engineeringFundamentalSource(
  "電圧降下率・末端電圧の定義 ΔV% = ΔV / V0 × 100、末端電圧 = V0 − ΔV",
  "配電線路全般",
);

export type VoltageDropMode = "dc" | "single" | "three";
/** 遅れ（誘導性、+x·sinφ）か進み（容量性、−x·sinφ）かで電圧降下式の符号が変わる。DCでは無関係。 */
export type VoltageDropLoadType = "lagging" | "leading";
export type VoltageDropVar =
  | "current"
  | "rOhmPerKm"
  | "xOhmPerKm"
  | "pf"
  | "lengthM"
  | "deltaV"
  | "deltaVPercent"
  | "sourceVoltage"
  | "endVoltage";

function modeFactor(mode: VoltageDropMode): number {
  return mode === "three" ? Math.sqrt(3) : 2;
}

/** 遅れ: +1（r·cosφ + x·sinφ）／進み: −1（r·cosφ − x·sinφ）。 */
function reactiveSign(loadType: VoltageDropLoadType): 1 | -1 {
  return loadType === "leading" ? -1 : 1;
}

/** r·cosφ ± x·sinφ（符号はloadType依存）— DC has no x/pf, so it degenerates to plain r. */
function effectiveR(
  mode: VoltageDropMode,
  r: number,
  x: number,
  pf: number,
  loadType: VoltageDropLoadType,
): number {
  if (mode === "dc") return r;
  const sinPhi = Math.sqrt(Math.max(1 - pf * pf, 0));
  return r * pf + reactiveSign(loadType) * x * sinPhi;
}

function physicalRules(
  mode: VoltageDropMode,
  loadType: VoltageDropLoadType,
): Rule<VoltageDropVar>[] {
  const k = modeFactor(mode);
  const isDc = mode === "dc";
  const sign = reactiveSign(loadType);
  const signSymbol = sign === 1 ? "+" : "−";
  const requiredForDeltaV: VoltageDropVar[] = isDc
    ? ["current", "rOhmPerKm", "lengthM"]
    : ["current", "rOhmPerKm", "xOhmPerKm", "pf", "lengthM"];

  const formulaSymbol = isDc
    ? "ΔV = 2 × I × r × L / 1000"
    : mode === "single"
      ? `ΔV = 2 × I × (r·cosφ ${signSymbol} x·sinφ) × L / 1000`
      : `ΔV = √3 × I × (r·cosφ ${signSymbol} x·sinφ) × L / 1000`;

  return [
    {
      output: "deltaV",
      inputs: requiredForDeltaV,
      compute: (v) => {
        const rEff = isDc
          ? v.rOhmPerKm
          : effectiveR(mode, v.rOhmPerKm, v.xOhmPerKm, v.pf, loadType);
        return (k * v.current * rEff * v.lengthM) / 1000;
      },
      describe: (v, r) => ({
        formula: formulaSymbol,
        substituted: isDc
          ? `ΔV = 2 × ${v.current} × ${v.rOhmPerKm} × ${v.lengthM} / 1000`
          : `ΔV = ${mode === "three" ? "√3" : "2"} × ${v.current} × (${v.rOhmPerKm}×${v.pf} ${signSymbol} ${v.xOhmPerKm}×√(1−${v.pf}²)) × ${v.lengthM} / 1000`,
        resultLine: `ΔV ≈ ${r} V`,
      }),
      source: VOLTAGE_DROP_RX_SOURCE,
    },
    {
      output: "lengthM",
      inputs: isDc
        ? ["deltaV", "current", "rOhmPerKm"]
        : ["deltaV", "current", "rOhmPerKm", "xOhmPerKm", "pf"],
      compute: (v) => {
        const rEff = isDc
          ? v.rOhmPerKm
          : effectiveR(mode, v.rOhmPerKm, v.xOhmPerKm, v.pf, loadType);
        return (v.deltaV * 1000) / (k * v.current * rEff);
      },
      describe: (v, r) => ({
        formula: "L = ΔV × 1000 / (k × I × r_eff)",
        substituted: `L = ${v.deltaV} × 1000 / (${k === Math.sqrt(3) ? "√3" : k} × ${v.current} × r_eff)`,
        resultLine: `L ≈ ${r} m`,
      }),
      source: VOLTAGE_DROP_RX_SOURCE,
    },
    {
      output: "rOhmPerKm",
      inputs: isDc
        ? ["deltaV", "current", "lengthM"]
        : ["deltaV", "current", "lengthM", "xOhmPerKm", "pf"],
      compute: (v) => {
        if (isDc) return (v.deltaV * 1000) / (k * v.current * v.lengthM);
        const sinPhi = Math.sqrt(Math.max(1 - v.pf * v.pf, 0));
        const rEffNeeded = (v.deltaV * 1000) / (k * v.current * v.lengthM);
        return (rEffNeeded - sign * v.xOhmPerKm * sinPhi) / v.pf;
      },
      describe: (v, r) => ({
        formula: `r = (必要なr_eff ${signSymbol === "+" ? "−" : "+"} x·sinφ) / cosφ`,
        substituted: `r ≈ ${r} Ω/km（ΔV=${v.deltaV}Vを満たす必要値）`,
        resultLine: `r ≈ ${r} Ω/km`,
      }),
      source: VOLTAGE_DROP_RX_SOURCE,
    },
    {
      output: "current",
      inputs: isDc
        ? ["deltaV", "rOhmPerKm", "lengthM"]
        : ["deltaV", "rOhmPerKm", "xOhmPerKm", "pf", "lengthM"],
      compute: (v) => {
        const rEff = isDc
          ? v.rOhmPerKm
          : effectiveR(mode, v.rOhmPerKm, v.xOhmPerKm, v.pf, loadType);
        return (v.deltaV * 1000) / (k * rEff * v.lengthM);
      },
      describe: (v, r) => ({
        formula: "I = ΔV × 1000 / (k × r_eff × L)",
        substituted: `I ≈ ${r} A（ΔV=${v.deltaV}Vを満たす電流）`,
        resultLine: `I ≈ ${r} A`,
      }),
      source: VOLTAGE_DROP_RX_SOURCE,
    },
    // xOhmPerKm has no meaning in DC mode, so this rule is only added for AC.
    ...(isDc
      ? []
      : [
          {
            output: "xOhmPerKm" as const,
            inputs: ["deltaV", "current", "lengthM", "rOhmPerKm", "pf"] as const,
            compute: (v: Record<VoltageDropVar, number>) => {
              const sinPhi = Math.sqrt(Math.max(1 - v.pf * v.pf, 0));
              const rEffNeeded = (v.deltaV * 1000) / (k * v.current * v.lengthM);
              return (rEffNeeded - v.rOhmPerKm * v.pf) / (sign * sinPhi);
            },
            describe: (v: Record<VoltageDropVar, number>, r: number) => ({
              formula: `x = (必要なr_eff − r·cosφ) / (${signSymbol}sinφ)`,
              substituted: `x ≈ ${r} Ω/km（ΔV=${v.deltaV}Vを満たす必要値）`,
              resultLine: `x ≈ ${r} Ω/km`,
            }),
            source: VOLTAGE_DROP_RX_SOURCE,
          },
        ]),
  ];
}

const RELATION_RULES: readonly Rule<VoltageDropVar>[] = [
  {
    output: "deltaVPercent",
    inputs: ["deltaV", "sourceVoltage"],
    compute: ({ deltaV, sourceVoltage }) => (deltaV / sourceVoltage) * 100,
    describe: (v, r) => ({
      formula: "ΔV% = ΔV / V0 × 100",
      substituted: `ΔV% = ${v.deltaV} / ${v.sourceVoltage} × 100`,
      resultLine: `ΔV% ≈ ${r} %`,
    }),
    source: VOLTAGE_RELATION_SOURCE,
  },
  {
    output: "deltaV",
    inputs: ["deltaVPercent", "sourceVoltage"],
    compute: ({ deltaVPercent, sourceVoltage }) => (deltaVPercent / 100) * sourceVoltage,
    describe: (v, r) => ({
      formula: "ΔV = ΔV% / 100 × V0",
      substituted: `ΔV = ${v.deltaVPercent} / 100 × ${v.sourceVoltage}`,
      resultLine: `ΔV ≈ ${r} V`,
    }),
    source: VOLTAGE_RELATION_SOURCE,
  },
  {
    output: "endVoltage",
    inputs: ["sourceVoltage", "deltaV"],
    compute: ({ sourceVoltage, deltaV }) => sourceVoltage - deltaV,
    describe: (v, r) => ({
      formula: "末端電圧 = V0 − ΔV",
      substituted: `末端電圧 = ${v.sourceVoltage} − ${v.deltaV}`,
      resultLine: `末端電圧 ≈ ${r} V`,
    }),
    source: VOLTAGE_RELATION_SOURCE,
  },
  {
    output: "deltaV",
    inputs: ["sourceVoltage", "endVoltage"],
    compute: ({ sourceVoltage, endVoltage }) => sourceVoltage - endVoltage,
    describe: (v, r) => ({
      formula: "ΔV = V0 − 末端電圧",
      substituted: `ΔV = ${v.sourceVoltage} − ${v.endVoltage}`,
      resultLine: `ΔV ≈ ${r} V`,
    }),
    source: VOLTAGE_RELATION_SOURCE,
  },
  {
    output: "sourceVoltage",
    inputs: ["endVoltage", "deltaV"],
    compute: ({ endVoltage, deltaV }) => endVoltage + deltaV,
    describe: (v, r) => ({
      formula: "V0 = 末端電圧 + ΔV",
      substituted: `V0 = ${v.endVoltage} + ${v.deltaV}`,
      resultLine: `V0 ≈ ${r} V`,
    }),
    source: VOLTAGE_RELATION_SOURCE,
  },
];

const VOLTAGE_RISE_WARNING =
  "計算結果は負のΔVです — これは電圧降下ではなく電圧上昇（末端電圧が始端電圧より高くなる）を意味します。" +
  "進み負荷（容量性）や、遅れ負荷でもリアクタンス成分の影響が抵抗成分より大きい軽負荷条件などで理論上生じ得ます。" +
  "符号を反転させず、そのままの値としてご確認ください。";

export function solveVoltageDrop(
  known: KnownValues<VoltageDropVar>,
  target: VoltageDropVar,
  mode: VoltageDropMode,
  loadType: VoltageDropLoadType = "lagging",
): SolveResult {
  const invalid = firstValidationError(
    requirePositive(known.current, "電流"),
    requirePositive(known.rOhmPerKm, "抵抗r"),
    requireNonNegative(known.xOhmPerKm, "リアクタンスx"),
    requireRatio01(known.pf, "力率cosφ"),
    requirePositive(known.lengthM, "こう長"),
    requirePositive(known.sourceVoltage, "始端電圧"),
    requirePositive(known.endVoltage, "末端電圧"),
    // deltaV/deltaVPercent are intentionally signed — a negative value is a
    // legitimate voltage RISE (leading load, or a lagging load whose x-term
    // dominates), not an error to reject. endVoltage is likewise not
    // capped at sourceVoltage: with a signed ΔV, endVoltage can exceed it.
  );
  if (invalid) return invalid;
  const rules = [...physicalRules(mode, loadType), ...RELATION_RULES];
  const result = solveByRules(rules, known, target);
  if (
    result.ok &&
    (target === "deltaV" || target === "deltaVPercent") &&
    result.value < 0
  ) {
    result.warnings = [...(result.warnings ?? []), VOLTAGE_RISE_WARNING];
  }
  return result;
}

// ---- 簡易係数法（要確認） ----

export const SIMPLIFIED_VOLTAGE_DROP_SOURCE: TechnicalSource = {
  standard: "JEAC 8001",
  edition: "2022",
  reference:
    "電圧降下の簡易計算式 ΔV = k × L × I / (1000 × A)（単相2線式 k=35.6、三相3線式 k=30.8、軟銅線・標準温度を想定）",
  applicability: "低圧配電線路・軟銅線を用いた簡易概算（正確な計算にはR/X法を推奨）",
  sourceType: "association_technical_document",
  verified: false,
  verificationNote:
    "この係数（35.6 / 30.8）は複数の実務資料・教科書でJEAC 8001内線規程の早見式として一致して引用されているが、" +
    "当システムはJEAC 8001:2022原本で該当条項・数値を直接確認していない。本番運用前に原本を確認すること。" +
    "正確な計算が必要な場合はR/X法（線路定数ベース）を使用すること。",
};

export type SimplifiedVoltageDropWiring = "single2wire" | "three3wire";
export type SimplifiedVoltageDropVar =
  | "current"
  | "lengthM"
  | "areaMm2"
  | "deltaV";

function simplifiedCoefficient(wiring: SimplifiedVoltageDropWiring): number {
  return wiring === "single2wire" ? 35.6 : 30.8;
}

function simplifiedRules(
  wiring: SimplifiedVoltageDropWiring,
): readonly Rule<SimplifiedVoltageDropVar>[] {
  const coeff = simplifiedCoefficient(wiring);
  return [
    {
      output: "deltaV",
      inputs: ["current", "lengthM", "areaMm2"],
      compute: ({ current, lengthM, areaMm2 }) =>
        (coeff * lengthM * current) / (1000 * areaMm2),
      describe: (v, r) => ({
        formula: `ΔV = ${coeff} × L × I / (1000 × A)`,
        substituted: `ΔV = ${coeff} × ${v.lengthM} × ${v.current} / (1000 × ${v.areaMm2})`,
        resultLine: `ΔV ≈ ${r} V`,
      }),
      source: SIMPLIFIED_VOLTAGE_DROP_SOURCE,
    },
    {
      output: "lengthM",
      inputs: ["deltaV", "current", "areaMm2"],
      compute: ({ deltaV, current, areaMm2 }) =>
        (deltaV * 1000 * areaMm2) / (coeff * current),
      describe: (v, r) => ({
        formula: `L = ΔV × 1000 × A / (${coeff} × I)`,
        substituted: `L = ${v.deltaV} × 1000 × ${v.areaMm2} / (${coeff} × ${v.current})`,
        resultLine: `L ≈ ${r} m`,
      }),
      source: SIMPLIFIED_VOLTAGE_DROP_SOURCE,
    },
    {
      output: "areaMm2",
      inputs: ["deltaV", "current", "lengthM"],
      compute: ({ deltaV, current, lengthM }) =>
        (coeff * lengthM * current) / (1000 * deltaV),
      describe: (v, r) => ({
        formula: `A = ${coeff} × L × I / (1000 × ΔV)`,
        substituted: `A = ${coeff} × ${v.lengthM} × ${v.current} / (1000 × ${v.deltaV})`,
        resultLine: `A ≈ ${r} mm²`,
      }),
      source: SIMPLIFIED_VOLTAGE_DROP_SOURCE,
    },
    {
      output: "current",
      inputs: ["deltaV", "lengthM", "areaMm2"],
      compute: ({ deltaV, lengthM, areaMm2 }) =>
        (deltaV * 1000 * areaMm2) / (coeff * lengthM),
      describe: (v, r) => ({
        formula: `I = ΔV × 1000 × A / (${coeff} × L)`,
        substituted: `I = ${v.deltaV} × 1000 × ${v.areaMm2} / (${coeff} × ${v.lengthM})`,
        resultLine: `I ≈ ${r} A`,
      }),
      source: SIMPLIFIED_VOLTAGE_DROP_SOURCE,
    },
  ];
}

export function solveSimplifiedVoltageDrop(
  known: KnownValues<SimplifiedVoltageDropVar>,
  target: SimplifiedVoltageDropVar,
  wiring: SimplifiedVoltageDropWiring,
): SolveResult {
  const invalid = firstValidationError(
    requirePositive(known.current, "電流"),
    requirePositive(known.lengthM, "こう長"),
    requirePositive(known.areaMm2, "断面積"),
    requireNonNegative(known.deltaV, "電圧降下"),
  );
  if (invalid) return invalid;
  return solveByRules(simplifiedRules(wiring), known, target);
}

// ---- 電圧降下率の適合判定（純粋な算術比較のみ） ----

export interface VoltageDropConformityCheck {
  actualPercent: number;
  allowedPercent: number;
  conforms: boolean;
  /** allowedPercent − actualPercent（正なら余裕、負なら超過）。 */
  marginPercent: number;
}

/**
 * 計算されたΔV%と、ユーザー自身が入力した許容電圧降下率とを比較するだけの
 * 単純な算術判定 — 許容値（2%/3%/5%等）そのものを本システムが規定・推測
 * することは一切ない。内線規程・電気設備技術基準等の該当条項をユーザー
 * 自身が確認した上で入力した許容値との比較にのみ用いること。
 */
export function checkVoltageDropConformity(
  actualPercent: number,
  allowedPercent: number,
): VoltageDropConformityCheck | null {
  if (!Number.isFinite(actualPercent) || actualPercent < 0) return null;
  if (!Number.isFinite(allowedPercent) || allowedPercent <= 0) return null;
  return {
    actualPercent,
    allowedPercent,
    conforms: actualPercent <= allowedPercent,
    marginPercent: allowedPercent - actualPercent,
  };
}
