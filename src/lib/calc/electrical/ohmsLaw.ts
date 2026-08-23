/**
 * 基本電力・オームの法則 — DC Ohm's law + Joule's law, AC1φ/AC3φ power
 * triangle (kW/kVA/kvar/cosφ), and motor efficiency η. Every rule here is a
 * basic circuit-theory identity (`engineeringFundamentalSource`) — none of
 * it depends on a JIS/JEAC table, so nothing in this file is ever
 * `verified: false`.
 *
 * Units used throughout this module (practical Japanese design-office
 * convention, not SI-normalized): V in V, I in A, R in Ω, DC power P in W,
 * AC S/P/Q in kVA/kW/kvar, pf (力率) as a 0–1 ratio (cosφ), η as a 0–1 ratio.
 */
import { engineeringFundamentalSource } from "@/lib/calc/technicalSource";
import { solveByRules, type Rule } from "./ruleSolver";
import {
  firstValidationError,
  requireLessOrEqual,
  requireNonNegative,
  requireRatio01,
} from "./validation";
import type { KnownValues, SolveResult } from "./types";

const OHM_SOURCE = engineeringFundamentalSource(
  "オームの法則 V = I × R",
  "線形・定常状態の直流回路",
);
const JOULE_SOURCE = engineeringFundamentalSource(
  "電力の定義 P = V × I（＝I²R＝V²/R）",
  "線形・定常状態の直流回路",
);
const AC_POWER_SOURCE = engineeringFundamentalSource(
  "皮相電力・有効電力・力率の関係 S = V × I、P = S × cosφ",
  "交流回路（正弦波・定常状態）",
);
const POWER_TRIANGLE_SOURCE = engineeringFundamentalSource(
  "電力三角形 S² = P² + Q²",
  "交流回路（正弦波・定常状態）",
);
const EFFICIENCY_SOURCE = engineeringFundamentalSource(
  "効率の定義 η = 出力 / 入力",
  "エネルギー変換機器全般（電動機・変圧器等）",
);

export type DcVar = "V" | "I" | "R" | "P";

export const dcRules: readonly Rule<DcVar>[] = [
  {
    output: "V",
    inputs: ["I", "R"],
    compute: ({ I, R }) => I * R,
    describe: (v, r) => ({
      formula: "V = I × R",
      substituted: `V = ${v.I} × ${v.R}`,
      resultLine: `V ≈ ${r} V`,
    }),
    source: OHM_SOURCE,
  },
  {
    output: "V",
    inputs: ["I", "P"],
    compute: ({ I, P }) => P / I,
    describe: (v, r) => ({
      formula: "V = P / I",
      substituted: `V = ${v.P} / ${v.I}`,
      resultLine: `V ≈ ${r} V`,
    }),
    source: JOULE_SOURCE,
  },
  {
    output: "V",
    inputs: ["R", "P"],
    compute: ({ R, P }) => Math.sqrt(P * R),
    describe: (v, r) => ({
      formula: "V = √(P × R)",
      substituted: `V = √(${v.P} × ${v.R})`,
      resultLine: `V ≈ ${r} V`,
    }),
    source: JOULE_SOURCE,
  },
  {
    output: "I",
    inputs: ["V", "R"],
    compute: ({ V, R }) => V / R,
    describe: (v, r) => ({
      formula: "I = V / R",
      substituted: `I = ${v.V} / ${v.R}`,
      resultLine: `I ≈ ${r} A`,
    }),
    source: OHM_SOURCE,
  },
  {
    output: "I",
    inputs: ["V", "P"],
    compute: ({ V, P }) => P / V,
    describe: (v, r) => ({
      formula: "I = P / V",
      substituted: `I = ${v.P} / ${v.V}`,
      resultLine: `I ≈ ${r} A`,
    }),
    source: JOULE_SOURCE,
  },
  {
    output: "I",
    inputs: ["R", "P"],
    compute: ({ R, P }) => Math.sqrt(P / R),
    describe: (v, r) => ({
      formula: "I = √(P / R)",
      substituted: `I = √(${v.P} / ${v.R})`,
      resultLine: `I ≈ ${r} A`,
    }),
    source: JOULE_SOURCE,
  },
  {
    output: "R",
    inputs: ["V", "I"],
    compute: ({ V, I }) => V / I,
    describe: (v, r) => ({
      formula: "R = V / I",
      substituted: `R = ${v.V} / ${v.I}`,
      resultLine: `R ≈ ${r} Ω`,
    }),
    source: OHM_SOURCE,
  },
  {
    output: "R",
    inputs: ["V", "P"],
    compute: ({ V, P }) => (V * V) / P,
    describe: (v, r) => ({
      formula: "R = V² / P",
      substituted: `R = ${v.V}² / ${v.P}`,
      resultLine: `R ≈ ${r} Ω`,
    }),
    source: JOULE_SOURCE,
  },
  {
    output: "R",
    inputs: ["I", "P"],
    compute: ({ I, P }) => P / (I * I),
    describe: (v, r) => ({
      formula: "R = P / I²",
      substituted: `R = ${v.P} / ${v.I}²`,
      resultLine: `R ≈ ${r} Ω`,
    }),
    source: JOULE_SOURCE,
  },
  {
    output: "P",
    inputs: ["V", "I"],
    compute: ({ V, I }) => V * I,
    describe: (v, r) => ({
      formula: "P = V × I",
      substituted: `P = ${v.V} × ${v.I}`,
      resultLine: `P ≈ ${r} W`,
    }),
    source: JOULE_SOURCE,
  },
  {
    output: "P",
    inputs: ["V", "R"],
    compute: ({ V, R }) => (V * V) / R,
    describe: (v, r) => ({
      formula: "P = V² / R",
      substituted: `P = ${v.V}² / ${v.R}`,
      resultLine: `P ≈ ${r} W`,
    }),
    source: JOULE_SOURCE,
  },
  {
    output: "P",
    inputs: ["I", "R"],
    compute: ({ I, R }) => I * I * R,
    describe: (v, r) => ({
      formula: "P = I² × R",
      substituted: `P = ${v.I}² × ${v.R}`,
      resultLine: `P ≈ ${r} W`,
    }),
    source: JOULE_SOURCE,
  },
];

export function solveDcCircuit(
  known: KnownValues<DcVar>,
  target: DcVar,
): SolveResult {
  // R is a passive resistor's value here — physically it cannot be
  // negative. (V/I/P are left sign-flexible: DC source polarity or
  // direction can legitimately make either negative.)
  const invalid = firstValidationError(requireNonNegative(known.R, "抵抗R"));
  if (invalid) return invalid;
  return solveByRules(dcRules, known, target);
}

export type AcPowerVar = "V" | "I" | "S" | "P" | "Q" | "pf";
export type AcPhase = "single" | "three";

function acPowerRules(phase: AcPhase): readonly Rule<AcPowerVar>[] {
  const isThree = phase === "three";
  const sFromViFormula = isThree ? "S = √3 × V × I / 1000" : "S = V × I / 1000";
  const sToI = isThree ? "I = S × 1000 / (√3 × V)" : "I = S × 1000 / V";
  const sToV = isThree ? "V = S × 1000 / (√3 × I)" : "V = S × 1000 / I";
  const k = isThree ? Math.sqrt(3) : 1;
  const pFromViPfFormula = isThree
    ? "P = √3 × V × I × cosφ / 1000"
    : "P = V × I × cosφ / 1000";
  const iFromPvPfFormula = isThree
    ? "I = P × 1000 / (√3 × V × cosφ)"
    : "I = P × 1000 / (V × cosφ)";
  const vFromPiPfFormula = isThree
    ? "V = P × 1000 / (√3 × I × cosφ)"
    : "V = P × 1000 / (I × cosφ)";

  return [
    // Direct 3-variable P/V/I/cosφ identities, listed first so the solver
    // (which breaks ties between equal-hop-count rules by array order)
    // prefers a single-hop path (e.g. P,V,cosφ→I) over routing through S.
    {
      output: "P",
      inputs: ["V", "I", "pf"],
      compute: ({ V, I, pf }) => (k * V * I * pf) / 1000,
      describe: (v, r) => ({
        formula: pFromViPfFormula,
        substituted: isThree
          ? `P = √3 × ${v.V} × ${v.I} × ${v.pf} / 1000`
          : `P = ${v.V} × ${v.I} × ${v.pf} / 1000`,
        resultLine: `P ≈ ${r} kW`,
      }),
      source: AC_POWER_SOURCE,
    },
    {
      output: "I",
      inputs: ["P", "V", "pf"],
      compute: ({ P, V, pf }) => (P * 1000) / (k * V * pf),
      describe: (v, r) => ({
        formula: iFromPvPfFormula,
        substituted: isThree
          ? `I = ${v.P} × 1000 / (√3 × ${v.V} × ${v.pf})`
          : `I = ${v.P} × 1000 / (${v.V} × ${v.pf})`,
        resultLine: `I ≈ ${r} A`,
      }),
      source: AC_POWER_SOURCE,
    },
    {
      output: "V",
      inputs: ["P", "I", "pf"],
      compute: ({ P, I, pf }) => (P * 1000) / (k * I * pf),
      describe: (v, r) => ({
        formula: vFromPiPfFormula,
        substituted: isThree
          ? `V = ${v.P} × 1000 / (√3 × ${v.I} × ${v.pf})`
          : `V = ${v.P} × 1000 / (${v.I} × ${v.pf})`,
        resultLine: `V ≈ ${r} V`,
      }),
      source: AC_POWER_SOURCE,
    },
    {
      output: "S",
      inputs: ["V", "I"],
      compute: ({ V, I }) => (k * V * I) / 1000,
      describe: (v, r) => ({
        formula: sFromViFormula,
        substituted: isThree
          ? `S = √3 × ${v.V} × ${v.I} / 1000`
          : `S = ${v.V} × ${v.I} / 1000`,
        resultLine: `S ≈ ${r} kVA`,
      }),
      source: AC_POWER_SOURCE,
    },
    {
      output: "I",
      inputs: ["S", "V"],
      compute: ({ S, V }) => (S * 1000) / (k * V),
      describe: (v, r) => ({
        formula: sToI,
        substituted: isThree
          ? `I = ${v.S} × 1000 / (√3 × ${v.V})`
          : `I = ${v.S} × 1000 / ${v.V}`,
        resultLine: `I ≈ ${r} A`,
      }),
      source: AC_POWER_SOURCE,
    },
    {
      output: "V",
      inputs: ["S", "I"],
      compute: ({ S, I }) => (S * 1000) / (k * I),
      describe: (v, r) => ({
        formula: sToV,
        substituted: isThree
          ? `V = ${v.S} × 1000 / (√3 × ${v.I})`
          : `V = ${v.S} × 1000 / ${v.I}`,
        resultLine: `V ≈ ${r} V`,
      }),
      source: AC_POWER_SOURCE,
    },
    {
      output: "P",
      inputs: ["S", "pf"],
      compute: ({ S, pf }) => S * pf,
      describe: (v, r) => ({
        formula: "P = S × cosφ",
        substituted: `P = ${v.S} × ${v.pf}`,
        resultLine: `P ≈ ${r} kW`,
      }),
      source: AC_POWER_SOURCE,
    },
    {
      output: "S",
      inputs: ["P", "pf"],
      compute: ({ P, pf }) => P / pf,
      describe: (v, r) => ({
        formula: "S = P / cosφ",
        substituted: `S = ${v.P} / ${v.pf}`,
        resultLine: `S ≈ ${r} kVA`,
      }),
      source: AC_POWER_SOURCE,
    },
    {
      output: "pf",
      inputs: ["P", "S"],
      compute: ({ P, S }) => P / S,
      describe: (v, r) => ({
        formula: "cosφ = P / S",
        substituted: `cosφ = ${v.P} / ${v.S}`,
        resultLine: `cosφ ≈ ${r}`,
      }),
      source: AC_POWER_SOURCE,
    },
    {
      output: "Q",
      inputs: ["S", "P"],
      compute: ({ S, P }) => Math.sqrt(Math.max(S * S - P * P, 0)),
      describe: (v, r) => ({
        formula: "Q = √(S² − P²)",
        substituted: `Q = √(${v.S}² − ${v.P}²)`,
        resultLine: `Q ≈ ${r} kvar`,
      }),
      source: POWER_TRIANGLE_SOURCE,
    },
    {
      output: "S",
      inputs: ["P", "Q"],
      compute: ({ P, Q }) => Math.sqrt(P * P + Q * Q),
      describe: (v, r) => ({
        formula: "S = √(P² + Q²)",
        substituted: `S = √(${v.P}² + ${v.Q}²)`,
        resultLine: `S ≈ ${r} kVA`,
      }),
      source: POWER_TRIANGLE_SOURCE,
    },
    {
      output: "P",
      inputs: ["S", "Q"],
      compute: ({ S, Q }) => Math.sqrt(Math.max(S * S - Q * Q, 0)),
      describe: (v, r) => ({
        formula: "P = √(S² − Q²)",
        substituted: `P = √(${v.S}² − ${v.Q}²)`,
        resultLine: `P ≈ ${r} kW`,
      }),
      source: POWER_TRIANGLE_SOURCE,
    },
  ];
}

export function solveAcPower(
  known: KnownValues<AcPowerVar>,
  target: AcPowerVar,
  phase: AcPhase,
): SolveResult {
  const invalid = firstValidationError(
    requireNonNegative(known.V, "電圧V"),
    requireNonNegative(known.I, "電流I"),
    requireNonNegative(known.S, "皮相電力S"),
    requireNonNegative(known.P, "有効電力P"),
    requireNonNegative(known.Q, "無効電力Q"),
    requireRatio01(known.pf, "力率cosφ"),
    // P/Q ≤ S is a hard requirement of the power triangle (S²=P²+Q²) — an
    // input violating it must be rejected explicitly, never silently
    // floored to 0 inside a sqrt.
    requireLessOrEqual(known.P, known.S, "有効電力P", "皮相電力S"),
    requireLessOrEqual(known.Q, known.S, "無効電力Q", "皮相電力S"),
  );
  if (invalid) return invalid;
  return solveByRules(acPowerRules(phase), known, target);
}

export type EfficiencyVar = "inputKw" | "outputKw" | "eta";

export const efficiencyRules: readonly Rule<EfficiencyVar>[] = [
  {
    output: "eta",
    inputs: ["outputKw", "inputKw"],
    compute: ({ outputKw, inputKw }) => outputKw / inputKw,
    describe: (v, r) => ({
      formula: "η = 出力 / 入力",
      substituted: `η = ${v.outputKw} / ${v.inputKw}`,
      resultLine: `η ≈ ${r}`,
    }),
    source: EFFICIENCY_SOURCE,
  },
  {
    output: "outputKw",
    inputs: ["inputKw", "eta"],
    compute: ({ inputKw, eta }) => inputKw * eta,
    describe: (v, r) => ({
      formula: "出力 = 入力 × η",
      substituted: `出力 = ${v.inputKw} × ${v.eta}`,
      resultLine: `出力 ≈ ${r} kW`,
    }),
    source: EFFICIENCY_SOURCE,
  },
  {
    output: "inputKw",
    inputs: ["outputKw", "eta"],
    compute: ({ outputKw, eta }) => outputKw / eta,
    describe: (v, r) => ({
      formula: "入力 = 出力 / η",
      substituted: `入力 = ${v.outputKw} / ${v.eta}`,
      resultLine: `入力 ≈ ${r} kW`,
    }),
    source: EFFICIENCY_SOURCE,
  },
];

export function solveEfficiency(
  known: KnownValues<EfficiencyVar>,
  target: EfficiencyVar,
): SolveResult {
  const invalid = firstValidationError(
    requireNonNegative(known.inputKw, "入力電力"),
    requireNonNegative(known.outputKw, "出力電力"),
    requireRatio01(known.eta, "効率η"),
    // A machine cannot output more energy than it consumes.
    requireLessOrEqual(known.outputKw, known.inputKw, "出力電力", "入力電力"),
  );
  if (invalid) return invalid;
  return solveByRules(efficiencyRules, known, target);
}
