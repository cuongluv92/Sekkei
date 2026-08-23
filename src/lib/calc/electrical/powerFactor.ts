/**
 * 力率・進相コンデンサ — P/Q/S電力三角形の基本式と、力率改善に必要な
 * 進相コンデンサ容量 Qc = P × (tanφ1 − tanφ2) の基本式のみを扱う。
 *
 * どちらも回路理論・三角関数の定義から導かれる engineering_fundamental
 * であり、実際に設置する進相コンデンサ機器の選定（規格容量への丸め、
 * 開閉装置・保護協調等）は一切行わない — それは別途JEMA/JIS/JEACの
 * 該当規格を確認したうえで選定する領域であり、本計算機はその一歩手前の
 * 「必要kvar」の基本式のみを提供する。
 */
import { engineeringFundamentalSource } from "@/lib/calc/technicalSource";
import { solveByRules, type Rule } from "./ruleSolver";
import {
  firstValidationError,
  requireLessOrEqual,
  requireNonNegative,
  requirePositive,
  requireRatio01,
} from "./validation";
import type { KnownValues, SolveResult } from "./types";

const POWER_TRIANGLE_SOURCE = engineeringFundamentalSource(
  "電力三角形 S² = P² + |Q|²、cosφ = P / S（|Q|は無効電力の大きさ。√(S²−P²)は主値〈非負〉のみを返すため、遅れ/進みの符号は表さない）",
  "交流回路（正弦波・定常状態）",
);
const CAPACITOR_CORRECTION_SOURCE = engineeringFundamentalSource(
  "力率改善に必要な進相コンデンサ容量 Qc = P × (tanφ1 − tanφ2)",
  "有効電力Pが一定のまま力率をcosφ1からcosφ2へ改善する場合（基本式のみ。" +
    "実機コンデンサの規格容量選定・保護協調はこの式の対象外）",
);

export type PowerTriangleVar = "activeP" | "reactiveQ" | "apparentS" | "pf";
export const powerTriangleRules: readonly Rule<PowerTriangleVar>[] = [
  {
    output: "apparentS",
    inputs: ["activeP", "reactiveQ"],
    compute: ({ activeP, reactiveQ }) => Math.sqrt(activeP * activeP + reactiveQ * reactiveQ),
    describe: (v, r) => ({
      formula: "S = √(P² + |Q|²)",
      substituted: `S = √(${v.activeP}² + ${v.reactiveQ}²)`,
      resultLine: `S ≈ ${r} kVA`,
    }),
    source: POWER_TRIANGLE_SOURCE,
  },
  {
    output: "activeP",
    inputs: ["apparentS", "reactiveQ"],
    compute: ({ apparentS, reactiveQ }) =>
      Math.sqrt(Math.max(apparentS * apparentS - reactiveQ * reactiveQ, 0)),
    describe: (v, r) => ({
      formula: "P = √(S² − |Q|²)",
      substituted: `P = √(${v.apparentS}² − ${v.reactiveQ}²)`,
      resultLine: `P ≈ ${r} kW`,
    }),
    source: POWER_TRIANGLE_SOURCE,
  },
  {
    output: "reactiveQ",
    inputs: ["apparentS", "activeP"],
    compute: ({ apparentS, activeP }) =>
      Math.sqrt(Math.max(apparentS * apparentS - activeP * activeP, 0)),
    describe: (v, r) => ({
      formula: "|Q| = √(S² − P²)",
      substituted: `|Q| = √(${v.apparentS}² − ${v.activeP}²)`,
      resultLine: `|Q| ≈ ${r} kvar`,
    }),
    source: POWER_TRIANGLE_SOURCE,
  },
  {
    output: "pf",
    inputs: ["activeP", "apparentS"],
    compute: ({ activeP, apparentS }) => activeP / apparentS,
    describe: (v, r) => ({
      formula: "cosφ = P / S",
      substituted: `cosφ = ${v.activeP} / ${v.apparentS}`,
      resultLine: `cosφ ≈ ${r}`,
    }),
    source: POWER_TRIANGLE_SOURCE,
  },
  {
    output: "activeP",
    inputs: ["apparentS", "pf"],
    compute: ({ apparentS, pf }) => apparentS * pf,
    describe: (v, r) => ({
      formula: "P = S × cosφ",
      substituted: `P = ${v.apparentS} × ${v.pf}`,
      resultLine: `P ≈ ${r} kW`,
    }),
    source: POWER_TRIANGLE_SOURCE,
  },
  {
    output: "apparentS",
    inputs: ["activeP", "pf"],
    compute: ({ activeP, pf }) => activeP / pf,
    describe: (v, r) => ({
      formula: "S = P / cosφ",
      substituted: `S = ${v.activeP} / ${v.pf}`,
      resultLine: `S ≈ ${r} kVA`,
    }),
    source: POWER_TRIANGLE_SOURCE,
  },
];
export function solvePowerTriangle(
  known: KnownValues<PowerTriangleVar>,
  target: PowerTriangleVar,
): SolveResult {
  const invalid = firstValidationError(
    requireNonNegative(known.activeP, "有効電力P"),
    requireNonNegative(known.reactiveQ, "無効電力Q"),
    requireNonNegative(known.apparentS, "皮相電力S"),
    requireRatio01(known.pf, "力率cosφ"),
    requireLessOrEqual(known.activeP, known.apparentS, "有効電力P", "皮相電力S"),
    requireLessOrEqual(known.reactiveQ, known.apparentS, "無効電力Q", "皮相電力S"),
  );
  if (invalid) return invalid;
  return solveByRules(powerTriangleRules, known, target);
}

/** tanφ = √(1 − cosφ²) / cosφ — NaN for pf outside (0, 1], which the rule solver treats as "not derivable" rather than surfacing garbage. */
function tanFromPf(pf: number): number {
  if (pf <= 0 || pf > 1) return NaN;
  return Math.sqrt(Math.max(1 - pf * pf, 0)) / pf;
}

export type CapacitorCorrectionVar = "activePowerKw" | "pfBefore" | "pfAfter" | "qcKvar";
export const capacitorCorrectionRules: readonly Rule<CapacitorCorrectionVar>[] = [
  {
    output: "qcKvar",
    inputs: ["activePowerKw", "pfBefore", "pfAfter"],
    compute: ({ activePowerKw, pfBefore, pfAfter }) =>
      activePowerKw * (tanFromPf(pfBefore) - tanFromPf(pfAfter)),
    describe: (v, r) => ({
      formula: "Qc = P × (tanφ1 − tanφ2)",
      substituted: `Qc = ${v.activePowerKw} × (tanφ(${v.pfBefore}) − tanφ(${v.pfAfter}))`,
      resultLine: `Qc ≈ ${r} kvar`,
    }),
    source: CAPACITOR_CORRECTION_SOURCE,
  },
  {
    output: "pfAfter",
    inputs: ["activePowerKw", "pfBefore", "qcKvar"],
    compute: ({ activePowerKw, pfBefore, qcKvar }) => {
      const tan2 = tanFromPf(pfBefore) - qcKvar / activePowerKw;
      if (tan2 < 0) return NaN; // would require a leading (over-corrected) PF — outside this basic formula's intended use
      return 1 / Math.sqrt(1 + tan2 * tan2);
    },
    describe: (v, r) => ({
      formula: "cosφ2 = 1 / √(1 + tanφ2²)、tanφ2 = tanφ1 − Qc/P",
      substituted: `tanφ2 = tanφ(${v.pfBefore}) − ${v.qcKvar}/${v.activePowerKw}`,
      resultLine: `cosφ2 ≈ ${r}`,
    }),
    source: CAPACITOR_CORRECTION_SOURCE,
  },
  {
    output: "activePowerKw",
    inputs: ["qcKvar", "pfBefore", "pfAfter"],
    compute: ({ qcKvar, pfBefore, pfAfter }) =>
      qcKvar / (tanFromPf(pfBefore) - tanFromPf(pfAfter)),
    describe: (v, r) => ({
      formula: "P = Qc / (tanφ1 − tanφ2)",
      substituted: `P = ${v.qcKvar} / (tanφ(${v.pfBefore}) − tanφ(${v.pfAfter}))`,
      resultLine: `P ≈ ${r} kW`,
    }),
    source: CAPACITOR_CORRECTION_SOURCE,
  },
  {
    output: "pfBefore",
    inputs: ["activePowerKw", "pfAfter", "qcKvar"],
    compute: ({ activePowerKw, pfAfter, qcKvar }) => {
      const tan1 = tanFromPf(pfAfter) + qcKvar / activePowerKw;
      if (tan1 < 0) return NaN; // would require a leading pfBefore — outside this basic formula's intended use
      return 1 / Math.sqrt(1 + tan1 * tan1);
    },
    describe: (v, r) => ({
      formula: "cosφ1 = 1 / √(1 + tanφ1²)、tanφ1 = tanφ2 + Qc/P",
      substituted: `tanφ1 = tanφ(${v.pfAfter}) + ${v.qcKvar}/${v.activePowerKw}`,
      resultLine: `cosφ1 ≈ ${r}`,
    }),
    source: CAPACITOR_CORRECTION_SOURCE,
  },
];
export function solveCapacitorCorrection(
  known: KnownValues<CapacitorCorrectionVar>,
  target: CapacitorCorrectionVar,
): SolveResult {
  const invalid = firstValidationError(
    requirePositive(known.activePowerKw, "有効電力P"),
    requireRatio01(known.pfBefore, "改善前の力率cosφ1"),
    requireRatio01(known.pfAfter, "目標力率cosφ2"),
    requireNonNegative(known.qcKvar, "必要コンデンサ容量Qc"),
    // This formula models adding capacitive kvar to IMPROVE (raise) power
    // factor from pfBefore toward pfAfter — pfBefore must not exceed
    // pfAfter, or Qc would come out negative (removing capacitance, not
    // sizing one), which this basic formula does not represent.
    requireLessOrEqual(known.pfBefore, known.pfAfter, "改善前の力率cosφ1", "目標力率cosφ2"),
  );
  if (invalid) return invalid;
  return solveByRules(capacitorCorrectionRules, known, target);
}
