/**
 * インピーダンス・RLC — R/X/Z、XL⇔L⇔f、XC⇔C⇔f、共振周波数、直列・並列合成。
 * すべて交流回路理論の基本定義（engineering_fundamental）。
 *
 * 直列合成はR成分・X成分をそれぞれ単純加算するだけの厳密解（複素数の
 * 実部・虚部が独立に加算されるため）。`solveParallelResistance`は「純抵抗
 * どうしの並列」という、式が明確でテストできる場合のみを実装する。
 *
 * `solveParallelComplexImpedance`は、R・X成分を両方持つ2つの複素
 * インピーダンス Z1=R1+jX1, Z2=R2+jX2 の並列合成 Ztotal=Z1×Z2/(Z1+Z2) を
 * 複素数演算（実部・虚部を明示的に計算）で厳密に求める。逆算（Rtotal・
 * Xtotal・ZtotalからR1/X1/R2/X2を求める）は一意に定まらない不定問題
 * （4未知数に対し実質2つの独立した式しかない）のため、意図的に前方向
 * （R1,X1,R2,X2 → Rtotal,Xtotal,Ztotal）のみを提供する。
 */
import { engineeringFundamentalSource } from "@/lib/calc/technicalSource";
import { solveByRules, type Rule } from "./ruleSolver";
import {
  firstValidationError,
  requireLessOrEqual,
  requireNonNegative,
  requirePositive,
} from "./validation";
import type { KnownValues, SolveResult } from "./types";

const IMPEDANCE_SOURCE = engineeringFundamentalSource(
  "インピーダンスの大きさ Z = √(R² + X²)",
  "R・Xの直列回路（RとXが直交成分であることを前提とする一般式）",
);
const INDUCTIVE_REACTANCE_SOURCE = engineeringFundamentalSource(
  "誘導性リアクタンス XL = 2π × f × L",
  "インダクタンスLを持つ素子の交流回路",
);
const CAPACITIVE_REACTANCE_SOURCE = engineeringFundamentalSource(
  "容量性リアクタンス XC = 1 / (2π × f × C)",
  "静電容量Cを持つ素子の交流回路",
);
const RESONANCE_SOURCE = engineeringFundamentalSource(
  "直列/並列共振周波数 f0 = 1 / (2π√(LC))（XL = XCとなる周波数）",
  "L・Cを含む回路（共振条件）",
);
const SERIES_SOURCE = engineeringFundamentalSource(
  "直列合成 R_total = R1 + R2、X_total = X1 + X2",
  "2素子の直列接続（R成分・X成分はそれぞれ独立に加算される）",
);
const PARALLEL_RESISTANCE_SOURCE = engineeringFundamentalSource(
  "純抵抗2つの並列合成 R_total = R1 × R2 / (R1 + R2)",
  "リアクタンス成分を含まない、純抵抗どうしの並列接続のみ",
);
const PARALLEL_COMPLEX_IMPEDANCE_SOURCE = engineeringFundamentalSource(
  "複素インピーダンスの並列合成 Ztotal = Z1×Z2 / (Z1+Z2)（Z1=R1+jX1, Z2=R2+jX2の複素数演算による厳密解）",
  "R成分・X成分をそれぞれ持つ2つのインピーダンスの並列接続（Xは符号付き：+が誘導性、−が容量性）",
);

export type ImpedanceVar = "R" | "X" | "Z";
export const impedanceRules: readonly Rule<ImpedanceVar>[] = [
  {
    output: "Z",
    inputs: ["R", "X"],
    compute: ({ R, X }) => Math.sqrt(R * R + X * X),
    describe: (v, r) => ({
      formula: "Z = √(R² + X²)",
      substituted: `Z = √(${v.R}² + ${v.X}²)`,
      resultLine: `Z ≈ ${r} Ω`,
    }),
    source: IMPEDANCE_SOURCE,
  },
  {
    output: "R",
    inputs: ["Z", "X"],
    compute: ({ Z, X }) => Math.sqrt(Math.max(Z * Z - X * X, 0)),
    describe: (v, r) => ({
      formula: "R = √(Z² − X²)",
      substituted: `R = √(${v.Z}² − ${v.X}²)`,
      resultLine: `R ≈ ${r} Ω`,
    }),
    source: IMPEDANCE_SOURCE,
  },
  {
    output: "X",
    inputs: ["Z", "R"],
    compute: ({ Z, R }) => Math.sqrt(Math.max(Z * Z - R * R, 0)),
    describe: (v, r) => ({
      formula: "X = √(Z² − R²)",
      substituted: `X = √(${v.Z}² − ${v.R}²)`,
      resultLine: `X ≈ ${r} Ω`,
    }),
    source: IMPEDANCE_SOURCE,
  },
];
export function solveImpedance(
  known: KnownValues<ImpedanceVar>,
  target: ImpedanceVar,
): SolveResult {
  const invalid = firstValidationError(
    requireNonNegative(known.R, "抵抗R"),
    requireNonNegative(known.X, "リアクタンスX"),
    requireNonNegative(known.Z, "インピーダンスZ"),
    // R and X are the orthogonal legs of Z — neither can exceed the hypotenuse.
    requireLessOrEqual(known.R, known.Z, "抵抗R", "インピーダンスZ"),
    requireLessOrEqual(known.X, known.Z, "リアクタンスX", "インピーダンスZ"),
  );
  if (invalid) return invalid;
  return solveByRules(impedanceRules, known, target);
}

export type InductiveReactanceVar = "XL" | "L" | "f";
export const inductiveReactanceRules: readonly Rule<InductiveReactanceVar>[] = [
  {
    output: "XL",
    inputs: ["f", "L"],
    compute: ({ f, L }) => 2 * Math.PI * f * L,
    describe: (v, r) => ({
      formula: "XL = 2π × f × L",
      substituted: `XL = 2π × ${v.f} × ${v.L}`,
      resultLine: `XL ≈ ${r} Ω`,
    }),
    source: INDUCTIVE_REACTANCE_SOURCE,
  },
  {
    output: "L",
    inputs: ["XL", "f"],
    compute: ({ XL, f }) => XL / (2 * Math.PI * f),
    describe: (v, r) => ({
      formula: "L = XL / (2π × f)",
      substituted: `L = ${v.XL} / (2π × ${v.f})`,
      resultLine: `L ≈ ${r} H`,
    }),
    source: INDUCTIVE_REACTANCE_SOURCE,
  },
  {
    output: "f",
    inputs: ["XL", "L"],
    compute: ({ XL, L }) => XL / (2 * Math.PI * L),
    describe: (v, r) => ({
      formula: "f = XL / (2π × L)",
      substituted: `f = ${v.XL} / (2π × ${v.L})`,
      resultLine: `f ≈ ${r} Hz`,
    }),
    source: INDUCTIVE_REACTANCE_SOURCE,
  },
];
export function solveInductiveReactance(
  known: KnownValues<InductiveReactanceVar>,
  target: InductiveReactanceVar,
): SolveResult {
  const invalid = firstValidationError(
    requirePositive(known.f, "周波数"),
    requirePositive(known.L, "インダクタンスL"),
    requirePositive(known.XL, "誘導性リアクタンスXL"),
  );
  if (invalid) return invalid;
  return solveByRules(inductiveReactanceRules, known, target);
}

export type CapacitiveReactanceVar = "XC" | "C" | "f";
export const capacitiveReactanceRules: readonly Rule<CapacitiveReactanceVar>[] = [
  {
    output: "XC",
    inputs: ["f", "C"],
    compute: ({ f, C }) => 1 / (2 * Math.PI * f * C),
    describe: (v, r) => ({
      formula: "XC = 1 / (2π × f × C)",
      substituted: `XC = 1 / (2π × ${v.f} × ${v.C})`,
      resultLine: `XC ≈ ${r} Ω`,
    }),
    source: CAPACITIVE_REACTANCE_SOURCE,
  },
  {
    output: "C",
    inputs: ["XC", "f"],
    compute: ({ XC, f }) => 1 / (2 * Math.PI * f * XC),
    describe: (v, r) => ({
      formula: "C = 1 / (2π × f × XC)",
      substituted: `C = 1 / (2π × ${v.f} × ${v.XC})`,
      resultLine: `C ≈ ${r} F`,
    }),
    source: CAPACITIVE_REACTANCE_SOURCE,
  },
  {
    output: "f",
    inputs: ["XC", "C"],
    compute: ({ XC, C }) => 1 / (2 * Math.PI * C * XC),
    describe: (v, r) => ({
      formula: "f = 1 / (2π × C × XC)",
      substituted: `f = 1 / (2π × ${v.C} × ${v.XC})`,
      resultLine: `f ≈ ${r} Hz`,
    }),
    source: CAPACITIVE_REACTANCE_SOURCE,
  },
];
export function solveCapacitiveReactance(
  known: KnownValues<CapacitiveReactanceVar>,
  target: CapacitiveReactanceVar,
): SolveResult {
  const invalid = firstValidationError(
    requirePositive(known.f, "周波数"),
    requirePositive(known.C, "静電容量C"),
    requirePositive(known.XC, "容量性リアクタンスXC"),
  );
  if (invalid) return invalid;
  return solveByRules(capacitiveReactanceRules, known, target);
}

export type ResonanceVar = "f0" | "L" | "C";
export const resonanceRules: readonly Rule<ResonanceVar>[] = [
  {
    output: "f0",
    inputs: ["L", "C"],
    compute: ({ L, C }) => 1 / (2 * Math.PI * Math.sqrt(L * C)),
    describe: (v, r) => ({
      formula: "f0 = 1 / (2π√(LC))",
      substituted: `f0 = 1 / (2π√(${v.L} × ${v.C}))`,
      resultLine: `f0 ≈ ${r} Hz`,
    }),
    source: RESONANCE_SOURCE,
  },
  {
    output: "L",
    inputs: ["f0", "C"],
    compute: ({ f0, C }) => 1 / (4 * Math.PI * Math.PI * f0 * f0 * C),
    describe: (v, r) => ({
      formula: "L = 1 / (4π²f0²C)",
      substituted: `L = 1 / (4π² × ${v.f0}² × ${v.C})`,
      resultLine: `L ≈ ${r} H`,
    }),
    source: RESONANCE_SOURCE,
  },
  {
    output: "C",
    inputs: ["f0", "L"],
    compute: ({ f0, L }) => 1 / (4 * Math.PI * Math.PI * f0 * f0 * L),
    describe: (v, r) => ({
      formula: "C = 1 / (4π²f0²L)",
      substituted: `C = 1 / (4π² × ${v.f0}² × ${v.L})`,
      resultLine: `C ≈ ${r} F`,
    }),
    source: RESONANCE_SOURCE,
  },
];
export function solveResonance(
  known: KnownValues<ResonanceVar>,
  target: ResonanceVar,
): SolveResult {
  const invalid = firstValidationError(
    requirePositive(known.f0, "共振周波数"),
    requirePositive(known.L, "インダクタンスL"),
    requirePositive(known.C, "静電容量C"),
  );
  if (invalid) return invalid;
  return solveByRules(resonanceRules, known, target);
}

export type SeriesVar = "R1" | "R2" | "Rtotal" | "X1" | "X2" | "Xtotal";
export const seriesRules: readonly Rule<SeriesVar>[] = [
  {
    output: "Rtotal",
    inputs: ["R1", "R2"],
    compute: ({ R1, R2 }) => R1 + R2,
    describe: (v, r) => ({
      formula: "R_total = R1 + R2",
      substituted: `R_total = ${v.R1} + ${v.R2}`,
      resultLine: `R_total ≈ ${r} Ω`,
    }),
    source: SERIES_SOURCE,
  },
  {
    output: "R1",
    inputs: ["Rtotal", "R2"],
    compute: ({ Rtotal, R2 }) => Rtotal - R2,
    describe: (v, r) => ({
      formula: "R1 = R_total − R2",
      substituted: `R1 = ${v.Rtotal} − ${v.R2}`,
      resultLine: `R1 ≈ ${r} Ω`,
    }),
    source: SERIES_SOURCE,
  },
  {
    output: "R2",
    inputs: ["Rtotal", "R1"],
    compute: ({ Rtotal, R1 }) => Rtotal - R1,
    describe: (v, r) => ({
      formula: "R2 = R_total − R1",
      substituted: `R2 = ${v.Rtotal} − ${v.R1}`,
      resultLine: `R2 ≈ ${r} Ω`,
    }),
    source: SERIES_SOURCE,
  },
  {
    output: "Xtotal",
    inputs: ["X1", "X2"],
    compute: ({ X1, X2 }) => X1 + X2,
    describe: (v, r) => ({
      formula: "X_total = X1 + X2",
      substituted: `X_total = ${v.X1} + ${v.X2}`,
      resultLine: `X_total ≈ ${r} Ω`,
    }),
    source: SERIES_SOURCE,
  },
  {
    output: "X1",
    inputs: ["Xtotal", "X2"],
    compute: ({ Xtotal, X2 }) => Xtotal - X2,
    describe: (v, r) => ({
      formula: "X1 = X_total − X2",
      substituted: `X1 = ${v.Xtotal} − ${v.X2}`,
      resultLine: `X1 ≈ ${r} Ω`,
    }),
    source: SERIES_SOURCE,
  },
  {
    output: "X2",
    inputs: ["Xtotal", "X1"],
    compute: ({ Xtotal, X1 }) => Xtotal - X1,
    describe: (v, r) => ({
      formula: "X2 = X_total − X1",
      substituted: `X2 = ${v.Xtotal} − ${v.X1}`,
      resultLine: `X2 ≈ ${r} Ω`,
    }),
    source: SERIES_SOURCE,
  },
];
export function solveSeriesRX(
  known: KnownValues<SeriesVar>,
  target: SeriesVar,
): SolveResult {
  const invalid = firstValidationError(
    requireNonNegative(known.R1, "抵抗R1"),
    requireNonNegative(known.R2, "抵抗R2"),
    requireNonNegative(known.Rtotal, "合成抵抗"),
    requireNonNegative(known.X1, "リアクタンスX1"),
    requireNonNegative(known.X2, "リアクタンスX2"),
    requireNonNegative(known.Xtotal, "合成リアクタンス"),
  );
  if (invalid) return invalid;
  return solveByRules(seriesRules, known, target);
}

export type ParallelResistanceVar = "R1" | "R2" | "Rtotal";
export const parallelResistanceRules: readonly Rule<ParallelResistanceVar>[] = [
  {
    output: "Rtotal",
    inputs: ["R1", "R2"],
    compute: ({ R1, R2 }) => (R1 * R2) / (R1 + R2),
    describe: (v, r) => ({
      formula: "R_total = R1 × R2 / (R1 + R2)",
      substituted: `R_total = ${v.R1} × ${v.R2} / (${v.R1} + ${v.R2})`,
      resultLine: `R_total ≈ ${r} Ω`,
    }),
    source: PARALLEL_RESISTANCE_SOURCE,
  },
  {
    output: "R1",
    inputs: ["Rtotal", "R2"],
    compute: ({ Rtotal, R2 }) => (Rtotal * R2) / (R2 - Rtotal),
    describe: (v, r) => ({
      formula: "R1 = R_total × R2 / (R2 − R_total)",
      substituted: `R1 = ${v.Rtotal} × ${v.R2} / (${v.R2} − ${v.Rtotal})`,
      resultLine: `R1 ≈ ${r} Ω`,
    }),
    source: PARALLEL_RESISTANCE_SOURCE,
  },
  {
    output: "R2",
    inputs: ["Rtotal", "R1"],
    compute: ({ Rtotal, R1 }) => (Rtotal * R1) / (R1 - Rtotal),
    describe: (v, r) => ({
      formula: "R2 = R_total × R1 / (R1 − R_total)",
      substituted: `R2 = ${v.Rtotal} × ${v.R1} / (${v.R1} − ${v.Rtotal})`,
      resultLine: `R2 ≈ ${r} Ω`,
    }),
    source: PARALLEL_RESISTANCE_SOURCE,
  },
];
export function solveParallelResistance(
  known: KnownValues<ParallelResistanceVar>,
  target: ParallelResistanceVar,
): SolveResult {
  const invalid = firstValidationError(
    requirePositive(known.R1, "抵抗R1"),
    requirePositive(known.R2, "抵抗R2"),
    requirePositive(known.Rtotal, "合成抵抗"),
  );
  if (invalid) return invalid;
  return solveByRules(parallelResistanceRules, known, target);
}

export type ParallelComplexImpedanceVar =
  | "R1"
  | "X1"
  | "R2"
  | "X2"
  | "Rtotal"
  | "Xtotal"
  | "Ztotal";

/** Z1×Z2/(Z1+Z2) の実部・虚部を明示的な複素数演算で求める（符号付きXに対応）。 */
function parallelComplexParts(
  R1: number,
  X1: number,
  R2: number,
  X2: number,
): { rTotal: number; xTotal: number } {
  const numeratorReal = R1 * R2 - X1 * X2;
  const numeratorImag = R1 * X2 + X1 * R2;
  const denomReal = R1 + R2;
  const denomImag = X1 + X2;
  const denomMagSq = denomReal * denomReal + denomImag * denomImag;
  return {
    rTotal: (numeratorReal * denomReal + numeratorImag * denomImag) / denomMagSq,
    xTotal: (numeratorImag * denomReal - numeratorReal * denomImag) / denomMagSq,
  };
}

export const parallelComplexImpedanceRules: readonly Rule<ParallelComplexImpedanceVar>[] = [
  {
    output: "Rtotal",
    inputs: ["R1", "X1", "R2", "X2"],
    compute: ({ R1, X1, R2, X2 }) => parallelComplexParts(R1, X1, R2, X2).rTotal,
    describe: (v, r) => ({
      formula: "Ztotal = Z1×Z2/(Z1+Z2)（Z1=R1+jX1, Z2=R2+jX2）の実部 Rtotal",
      substituted: `R1=${v.R1}, X1=${v.X1}, R2=${v.R2}, X2=${v.X2}`,
      resultLine: `Rtotal ≈ ${r} Ω`,
    }),
    source: PARALLEL_COMPLEX_IMPEDANCE_SOURCE,
  },
  {
    output: "Xtotal",
    inputs: ["R1", "X1", "R2", "X2"],
    compute: ({ R1, X1, R2, X2 }) => parallelComplexParts(R1, X1, R2, X2).xTotal,
    describe: (v, r) => ({
      formula: "Ztotal = Z1×Z2/(Z1+Z2)（Z1=R1+jX1, Z2=R2+jX2）の虚部 Xtotal",
      substituted: `R1=${v.R1}, X1=${v.X1}, R2=${v.R2}, X2=${v.X2}`,
      resultLine: `Xtotal ≈ ${r} Ω`,
    }),
    source: PARALLEL_COMPLEX_IMPEDANCE_SOURCE,
  },
  {
    output: "Ztotal",
    inputs: ["R1", "X1", "R2", "X2"],
    compute: ({ R1, X1, R2, X2 }) => {
      const { rTotal, xTotal } = parallelComplexParts(R1, X1, R2, X2);
      return Math.sqrt(rTotal * rTotal + xTotal * xTotal);
    },
    describe: (v, r) => ({
      formula: "|Ztotal| = |Z1×Z2/(Z1+Z2)|",
      substituted: `R1=${v.R1}, X1=${v.X1}, R2=${v.R2}, X2=${v.X2}`,
      resultLine: `|Ztotal| ≈ ${r} Ω`,
    }),
    source: PARALLEL_COMPLEX_IMPEDANCE_SOURCE,
  },
];

/**
 * 前方向のみ（R1,X1,R2,X2 → Rtotal/Xtotal/Ztotal）。Xは符号付き実数
 * （+誘導性・−容量性）として扱うため、R/X（大きさのみ）を前提とする他の
 * 関数とは異なり requireNonNegative(X) は課さない。
 */
export function solveParallelComplexImpedance(
  known: KnownValues<ParallelComplexImpedanceVar>,
  target: ParallelComplexImpedanceVar,
): SolveResult {
  const invalid = firstValidationError(
    requireNonNegative(known.R1, "抵抗R1"),
    requireNonNegative(known.R2, "抵抗R2"),
  );
  if (invalid) return invalid;
  return solveByRules(parallelComplexImpedanceRules, known, target);
}
