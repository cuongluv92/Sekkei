/**
 * 電動機・周波数 — 同期速度 ns = 120f/p、すべり率、電動機電流⇔出力。
 *
 * すべて回転磁界の基本理論・電力の定義から導かれる engineering_fundamental
 * — ただし実回転数は「50/60Hzの比でそのままスケールする」ものでは断じて
 * ない（すべりは負荷・電動機設計に依存し、周波数比と無関係）ため、
 * `compareSyncSpeed` は必ず「同期速度の比較であり実回転数の比較ではない」
 * という注記付きで返す。
 */
import { engineeringFundamentalSource } from "@/lib/calc/technicalSource";
import { solveByRules, type Rule } from "./ruleSolver";
import {
  firstValidationError,
  invalidInput,
  requireLessOrEqual,
  requireNonNegative,
  requirePositive,
  requirePositiveEvenInteger,
  requireRatio01,
  requireRatio01Inclusive,
} from "./validation";
import type { KnownValues, SolveResult } from "./types";

const SYNC_SPEED_SOURCE = engineeringFundamentalSource(
  "同期速度の定義 ns = 120 × f / p",
  "誘導電動機・同期電動機の回転磁界（pは極数、偶数）",
);
const SLIP_SOURCE = engineeringFundamentalSource(
  "すべり率の定義 s = (ns − nr) / ns",
  "誘導電動機",
);
const MOTOR_POWER_SOURCE = engineeringFundamentalSource(
  "電動機の入力電力 Pin = √3 × V × I × cosφ（三相）／ Pin = V × I × cosφ（単相）",
  "交流電動機（正弦波・定常状態）",
);
const EFFICIENCY_SOURCE = engineeringFundamentalSource(
  "効率の定義 η = 出力 / 入力",
  "電動機",
);

export type SyncSpeedVar = "frequencyHz" | "poles" | "nsRpm";
export const syncSpeedRules: readonly Rule<SyncSpeedVar>[] = [
  {
    output: "nsRpm",
    inputs: ["frequencyHz", "poles"],
    compute: ({ frequencyHz, poles }) => (120 * frequencyHz) / poles,
    describe: (v, r) => ({
      formula: "ns = 120 × f / p",
      substituted: `ns = 120 × ${v.frequencyHz} / ${v.poles}`,
      resultLine: `ns ≈ ${r} min⁻¹`,
    }),
    source: SYNC_SPEED_SOURCE,
  },
  {
    output: "frequencyHz",
    inputs: ["nsRpm", "poles"],
    compute: ({ nsRpm, poles }) => (nsRpm * poles) / 120,
    describe: (v, r) => ({
      formula: "f = ns × p / 120",
      substituted: `f = ${v.nsRpm} × ${v.poles} / 120`,
      resultLine: `f ≈ ${r} Hz`,
    }),
    source: SYNC_SPEED_SOURCE,
  },
  {
    output: "poles",
    inputs: ["nsRpm", "frequencyHz"],
    compute: ({ nsRpm, frequencyHz }) => (120 * frequencyHz) / nsRpm,
    describe: (v, r) => ({
      formula: "p = 120 × f / ns",
      substituted: `p = 120 × ${v.frequencyHz} / ${v.nsRpm}`,
      resultLine: `p ≈ ${r}`,
    }),
    source: SYNC_SPEED_SOURCE,
  },
];
export function solveSyncSpeed(
  known: KnownValues<SyncSpeedVar>,
  target: SyncSpeedVar,
): SolveResult {
  const invalid = firstValidationError(
    requirePositive(known.frequencyHz, "周波数"),
    requirePositiveEvenInteger(known.poles, "極数"),
    requirePositive(known.nsRpm, "同期速度"),
  );
  if (invalid) return invalid;
  const result = solveByRules(syncSpeedRules, known, target);
  if (result.ok && target === "poles") {
    // f, ns can be any real motor's nameplate values, but a real pole count
    // must always be a positive even integer — a computed value like 5
    // (e.g. f=50, ns=1200) is not a valid motor and must be rejected, never
    // returned as if it were a legitimate pole count. Rounding-tolerant
    // (division can leave float noise like 3.9999999999996) but still
    // strict about actually being an even integer once rounded.
    const rounded = Math.round(result.value);
    const closeToInteger =
      Math.abs(result.value - rounded) <= Math.max(Math.abs(result.value), 1) * 1e-6;
    if (!closeToInteger || rounded <= 0 || rounded % 2 !== 0) {
      return invalidInput(
        `与えられた周波数・同期速度からは有効な極数（正の偶数）が求まりません（計算値: ${result.value}）`,
      );
    }
  }
  return result;
}

export type SlipVar = "nsRpm" | "actualRpm" | "slip";
export const slipRules: readonly Rule<SlipVar>[] = [
  {
    output: "slip",
    inputs: ["nsRpm", "actualRpm"],
    compute: ({ nsRpm, actualRpm }) => (nsRpm - actualRpm) / nsRpm,
    describe: (v, r) => ({
      formula: "s = (ns − nr) / ns",
      substituted: `s = (${v.nsRpm} − ${v.actualRpm}) / ${v.nsRpm}`,
      resultLine: `s ≈ ${r}`,
    }),
    source: SLIP_SOURCE,
  },
  {
    output: "actualRpm",
    inputs: ["nsRpm", "slip"],
    compute: ({ nsRpm, slip }) => nsRpm * (1 - slip),
    describe: (v, r) => ({
      formula: "nr = ns × (1 − s)",
      substituted: `nr = ${v.nsRpm} × (1 − ${v.slip})`,
      resultLine: `nr ≈ ${r} min⁻¹`,
    }),
    source: SLIP_SOURCE,
  },
  {
    output: "nsRpm",
    inputs: ["actualRpm", "slip"],
    compute: ({ actualRpm, slip }) => actualRpm / (1 - slip),
    describe: (v, r) => ({
      formula: "ns = nr / (1 − s)",
      substituted: `ns = ${v.actualRpm} / (1 − ${v.slip})`,
      resultLine: `ns ≈ ${r} min⁻¹`,
    }),
    source: SLIP_SOURCE,
  },
];
export function solveSlip(
  known: KnownValues<SlipVar>,
  target: SlipVar,
): SolveResult {
  const invalid = firstValidationError(
    requirePositive(known.nsRpm, "同期速度"),
    requireNonNegative(known.actualRpm, "実回転数"),
    requireRatio01Inclusive(known.slip, "すべり率"),
    // A normal (motoring) induction motor never spins faster than its own sync speed.
    requireLessOrEqual(known.actualRpm, known.nsRpm, "実回転数", "同期速度"),
  );
  if (invalid) return invalid;
  return solveByRules(slipRules, known, target);
}

export type MotorPowerVar =
  | "voltage"
  | "current"
  | "pf"
  | "eta"
  | "inputKw"
  | "outputKw";
export type MotorPhase = "single" | "three";

function motorPowerRules(phase: MotorPhase): readonly Rule<MotorPowerVar>[] {
  const isThree = phase === "three";
  const k = isThree ? Math.sqrt(3) : 1;
  return [
    {
      output: "inputKw",
      inputs: ["voltage", "current", "pf"],
      compute: ({ voltage, current, pf }) => (k * voltage * current * pf) / 1000,
      describe: (v, r) => ({
        formula: isThree
          ? "Pin = √3 × V × I × cosφ / 1000"
          : "Pin = V × I × cosφ / 1000",
        substituted: isThree
          ? `Pin = √3 × ${v.voltage} × ${v.current} × ${v.pf} / 1000`
          : `Pin = ${v.voltage} × ${v.current} × ${v.pf} / 1000`,
        resultLine: `Pin ≈ ${r} kW`,
      }),
      source: MOTOR_POWER_SOURCE,
    },
    {
      output: "current",
      inputs: ["inputKw", "voltage", "pf"],
      compute: ({ inputKw, voltage, pf }) => (inputKw * 1000) / (k * voltage * pf),
      describe: (v, r) => ({
        formula: isThree
          ? "I = Pin × 1000 / (√3 × V × cosφ)"
          : "I = Pin × 1000 / (V × cosφ)",
        substituted: isThree
          ? `I = ${v.inputKw} × 1000 / (√3 × ${v.voltage} × ${v.pf})`
          : `I = ${v.inputKw} × 1000 / (${v.voltage} × ${v.pf})`,
        resultLine: `I ≈ ${r} A`,
      }),
      source: MOTOR_POWER_SOURCE,
    },
    {
      output: "voltage",
      inputs: ["inputKw", "current", "pf"],
      compute: ({ inputKw, current, pf }) => (inputKw * 1000) / (k * current * pf),
      describe: (v, r) => ({
        formula: isThree
          ? "V = Pin × 1000 / (√3 × I × cosφ)"
          : "V = Pin × 1000 / (I × cosφ)",
        substituted: isThree
          ? `V = ${v.inputKw} × 1000 / (√3 × ${v.current} × ${v.pf})`
          : `V = ${v.inputKw} × 1000 / (${v.current} × ${v.pf})`,
        resultLine: `V ≈ ${r} V`,
      }),
      source: MOTOR_POWER_SOURCE,
    },
    {
      output: "pf",
      inputs: ["inputKw", "voltage", "current"],
      compute: ({ inputKw, voltage, current }) => (inputKw * 1000) / (k * voltage * current),
      describe: (v, r) => ({
        formula: isThree
          ? "cosφ = Pin × 1000 / (√3 × V × I)"
          : "cosφ = Pin × 1000 / (V × I)",
        substituted: isThree
          ? `cosφ = ${v.inputKw} × 1000 / (√3 × ${v.voltage} × ${v.current})`
          : `cosφ = ${v.inputKw} × 1000 / (${v.voltage} × ${v.current})`,
        resultLine: `cosφ ≈ ${r}`,
      }),
      source: MOTOR_POWER_SOURCE,
    },
    {
      output: "outputKw",
      inputs: ["inputKw", "eta"],
      compute: ({ inputKw, eta }) => inputKw * eta,
      describe: (v, r) => ({
        formula: "Pout = Pin × η",
        substituted: `Pout = ${v.inputKw} × ${v.eta}`,
        resultLine: `Pout ≈ ${r} kW`,
      }),
      source: EFFICIENCY_SOURCE,
    },
    {
      output: "inputKw",
      inputs: ["outputKw", "eta"],
      compute: ({ outputKw, eta }) => outputKw / eta,
      describe: (v, r) => ({
        formula: "Pin = Pout / η",
        substituted: `Pin = ${v.outputKw} / ${v.eta}`,
        resultLine: `Pin ≈ ${r} kW`,
      }),
      source: EFFICIENCY_SOURCE,
    },
    {
      output: "eta",
      inputs: ["outputKw", "inputKw"],
      compute: ({ outputKw, inputKw }) => outputKw / inputKw,
      describe: (v, r) => ({
        formula: "η = Pout / Pin",
        substituted: `η = ${v.outputKw} / ${v.inputKw}`,
        resultLine: `η ≈ ${r}`,
      }),
      source: EFFICIENCY_SOURCE,
    },
  ];
}
export function solveMotorPower(
  known: KnownValues<MotorPowerVar>,
  target: MotorPowerVar,
  phase: MotorPhase,
): SolveResult {
  const invalid = firstValidationError(
    requirePositive(known.voltage, "電圧"),
    requireNonNegative(known.current, "電流"),
    requireRatio01(known.pf, "力率cosφ"),
    requireRatio01(known.eta, "効率η"),
    requireNonNegative(known.inputKw, "入力電力"),
    requireNonNegative(known.outputKw, "出力電力"),
    requireLessOrEqual(known.outputKw, known.inputKw, "出力電力", "入力電力"),
  );
  if (invalid) return invalid;
  const result = solveByRules(motorPowerRules(phase), known, target);
  if (result.ok && target === "pf") {
    // A derived cosφ (from Pin, V, I) can come out > 1 for physically
    // inconsistent inputs — that is not a valid power factor and must be
    // rejected, never returned as if it were real.
    const err = requireRatio01(result.value, "力率cosφ");
    if (err) return invalidInput(`与えられた入力電力・電圧・電流からは有効な力率が求まりません（${err}）`);
  }
  return result;
}

/**
 * 50Hz/60Hzでの同期速度比較 — 「実回転数」ではなく「同期速度」のみの比較。
 * すべり・電動機設計により実回転数は50/60の単純比例にならないため、
 * 呼び出し側は必ずこの注記を表示すること。
 */
export interface SyncSpeedComparison {
  poles: number;
  ns50: number;
  ns60: number;
  note: string;
}
export function compareSyncSpeed(poles: number): SyncSpeedComparison | null {
  if (requirePositiveEvenInteger(poles, "極数") !== null) return null;
  return {
    poles,
    ns50: (120 * 50) / poles,
    ns60: (120 * 60) / poles,
    note:
      "これは同期速度 ns = 120f/p の比較であり、実際の電動機回転数（実回転数）の比較ではありません。" +
      "実回転数はすべり率・負荷・電動機設計により変化するため、50Hz/60Hzの比（5/6）にそのまま比例しません。" +
      "実回転数を求める場合は、対象電動機の定格すべり率を用いて別途計算してください。",
  };
}
