/**
 * 短絡電流・%Z — 変圧器の定格電流、%Zベースの簡易短絡電流、%Zのベース容量
 * 換算。
 *
 * ⚠ ここで求める短絡電流は「変圧器の%Zのみ」から求めた簡易値であり、
 * 上位系統インピーダンス・ケーブル/母線インピーダンス・電動機の逆流
 * 電流などは一切考慮していない。遮断器の遮断容量選定・保護協調の
 * 「OK/NG」判定に使ってはならない — 必ず `warnings` を表示し、詳細検討
 * が必要な旨を明示すること。
 */
import { engineeringFundamentalSource } from "@/lib/calc/technicalSource";
import { solveByRules, type Rule } from "./ruleSolver";
import { firstValidationError, requirePositive } from "./validation";
import type { AcPhase } from "./ohmsLaw";
import type { KnownValues, SolveResult, SolveSuccess } from "./types";

const RATED_CURRENT_SOURCE = engineeringFundamentalSource(
  "変圧器の定格電流 In = kVA × 1000 / V（単相）、In = kVA × 1000 / (√3 × V)（三相）",
  "変圧器の一次または二次側、定格電圧V・定格容量kVAが既知の場合",
);
const SIMPLIFIED_SHORT_CIRCUIT_SOURCE = engineeringFundamentalSource(
  "%Zによる簡易短絡電流 Isc = In × 100 / %Z（変圧器単体、上位系統・ケーブル等のインピーダンスは含まない）",
  "変圧器単体の二次側端子における概算値。上位系統インピーダンス・ケーブル/母線インピーダンス・" +
    "電動機の逆流電流を含む詳細検討には使用不可（簡易計算）",
);
const PERCENT_Z_BASE_CONVERSION_SOURCE = engineeringFundamentalSource(
  "%Zのベース容量換算（電圧ベース一定の場合のみ） %Z_new = %Z_old × (kVA_new / kVA_old)" +
    "（パーユニット法の基本式。電圧ベースも変える場合は別途 (V_old / V_new)² の項が必要— 本ツールは未対応）",
  "同一電圧ベース内で基準容量（ベースkVA）のみを変更する場合に限る。" +
    "一次・二次で電圧ベースが異なる換算（電圧ベースも同時に変える場合）は本ツールの対象外 — " +
    "その場合は %Z_new = %Z_old × (kVA_new/kVA_old) × (V_old/V_new)² を用いること。",
);

export const SHORT_CIRCUIT_SIMPLIFIED_WARNING =
  "これは変圧器単体の%Zのみに基づく簡易計算です。上位系統インピーダンス・ケーブル/母線インピーダンス・" +
  "電動機からの逆流電流などは考慮していません。遮断器の遮断容量選定や保護協調の可否判定には、" +
  "詳細な系統計算（上位系統・ケーブル等を含む）が別途必要です。この値だけで「OK/NG」を判断しないでください。";

export type RatedCurrentVar = "kva" | "voltage" | "current";
function ratedCurrentRules(phase: AcPhase): readonly Rule<RatedCurrentVar>[] {
  const k = phase === "three" ? Math.sqrt(3) : 1;
  return [
    {
      output: "current",
      inputs: ["kva", "voltage"],
      compute: ({ kva, voltage }) => (kva * 1000) / (k * voltage),
      describe: (v, r) => ({
        formula: phase === "three" ? "In = kVA × 1000 / (√3 × V)" : "In = kVA × 1000 / V",
        substituted:
          phase === "three"
            ? `In = ${v.kva} × 1000 / (√3 × ${v.voltage})`
            : `In = ${v.kva} × 1000 / ${v.voltage}`,
        resultLine: `In ≈ ${r} A`,
      }),
      source: RATED_CURRENT_SOURCE,
    },
    {
      output: "kva",
      inputs: ["current", "voltage"],
      compute: ({ current, voltage }) => (k * voltage * current) / 1000,
      describe: (v, r) => ({
        formula: phase === "three" ? "kVA = √3 × V × In / 1000" : "kVA = V × In / 1000",
        substituted:
          phase === "three"
            ? `kVA = √3 × ${v.voltage} × ${v.current} / 1000`
            : `kVA = ${v.voltage} × ${v.current} / 1000`,
        resultLine: `kVA ≈ ${r} kVA`,
      }),
      source: RATED_CURRENT_SOURCE,
    },
    {
      output: "voltage",
      inputs: ["kva", "current"],
      compute: ({ kva, current }) => (kva * 1000) / (k * current),
      describe: (v, r) => ({
        formula: phase === "three" ? "V = kVA × 1000 / (√3 × In)" : "V = kVA × 1000 / In",
        substituted:
          phase === "three"
            ? `V = ${v.kva} × 1000 / (√3 × ${v.current})`
            : `V = ${v.kva} × 1000 / ${v.current}`,
        resultLine: `V ≈ ${r} V`,
      }),
      source: RATED_CURRENT_SOURCE,
    },
  ];
}
export function solveTransformerRatedCurrent(
  known: KnownValues<RatedCurrentVar>,
  target: RatedCurrentVar,
  phase: AcPhase,
): SolveResult {
  const invalid = firstValidationError(
    requirePositive(known.kva, "容量"),
    requirePositive(known.voltage, "電圧"),
    requirePositive(known.current, "定格電流"),
  );
  if (invalid) return invalid;
  return solveByRules(ratedCurrentRules(phase), known, target);
}
export type ShortCircuitVar = "ratedCurrentA" | "percentZ" | "shortCircuitCurrentA";
export const shortCircuitRules: readonly Rule<ShortCircuitVar>[] = [
  {
    output: "shortCircuitCurrentA",
    inputs: ["ratedCurrentA", "percentZ"],
    compute: ({ ratedCurrentA, percentZ }) => (ratedCurrentA * 100) / percentZ,
    describe: (v, r) => ({
      formula: "Isc = In × 100 / %Z",
      substituted: `Isc = ${v.ratedCurrentA} × 100 / ${v.percentZ}`,
      resultLine: `Isc ≈ ${r} A（簡易値）`,
    }),
    source: SIMPLIFIED_SHORT_CIRCUIT_SOURCE,
  },
  {
    output: "percentZ",
    inputs: ["ratedCurrentA", "shortCircuitCurrentA"],
    compute: ({ ratedCurrentA, shortCircuitCurrentA }) =>
      (ratedCurrentA * 100) / shortCircuitCurrentA,
    describe: (v, r) => ({
      formula: "%Z = In × 100 / Isc",
      substituted: `%Z = ${v.ratedCurrentA} × 100 / ${v.shortCircuitCurrentA}`,
      resultLine: `%Z ≈ ${r} %`,
    }),
    source: SIMPLIFIED_SHORT_CIRCUIT_SOURCE,
  },
  {
    output: "ratedCurrentA",
    inputs: ["shortCircuitCurrentA", "percentZ"],
    compute: ({ shortCircuitCurrentA, percentZ }) => (shortCircuitCurrentA * percentZ) / 100,
    describe: (v, r) => ({
      formula: "In = Isc × %Z / 100",
      substituted: `In = ${v.shortCircuitCurrentA} × ${v.percentZ} / 100`,
      resultLine: `In ≈ ${r} A`,
    }),
    source: SIMPLIFIED_SHORT_CIRCUIT_SOURCE,
  },
];
export function solveSimplifiedShortCircuit(
  known: KnownValues<ShortCircuitVar>,
  target: ShortCircuitVar,
): SolveResult {
  const invalid = firstValidationError(
    requirePositive(known.ratedCurrentA, "定格電流"),
    requirePositive(known.percentZ, "%インピーダンス"),
    requirePositive(known.shortCircuitCurrentA, "短絡電流"),
  );
  if (invalid) return invalid;
  const result = solveByRules(shortCircuitRules, known, target);
  if (result.ok && target === "shortCircuitCurrentA") {
    (result as SolveSuccess).warnings = [SHORT_CIRCUIT_SIMPLIFIED_WARNING];
  }
  return result;
}

export type PercentZBaseVar = "percentZOld" | "kvaOld" | "percentZNew" | "kvaNew";
export const percentZBaseRules: readonly Rule<PercentZBaseVar>[] = [
  {
    output: "percentZNew",
    inputs: ["percentZOld", "kvaOld", "kvaNew"],
    compute: ({ percentZOld, kvaOld, kvaNew }) => (percentZOld * kvaNew) / kvaOld,
    describe: (v, r) => ({
      formula: "%Z_new = %Z_old × (kVA_new / kVA_old)",
      substituted: `%Z_new = ${v.percentZOld} × (${v.kvaNew} / ${v.kvaOld})`,
      resultLine: `%Z_new ≈ ${r} %`,
    }),
    source: PERCENT_Z_BASE_CONVERSION_SOURCE,
  },
  {
    output: "percentZOld",
    inputs: ["percentZNew", "kvaOld", "kvaNew"],
    compute: ({ percentZNew, kvaOld, kvaNew }) => (percentZNew * kvaOld) / kvaNew,
    describe: (v, r) => ({
      formula: "%Z_old = %Z_new × (kVA_old / kVA_new)",
      substituted: `%Z_old = ${v.percentZNew} × (${v.kvaOld} / ${v.kvaNew})`,
      resultLine: `%Z_old ≈ ${r} %`,
    }),
    source: PERCENT_Z_BASE_CONVERSION_SOURCE,
  },
  {
    output: "kvaNew",
    inputs: ["percentZOld", "percentZNew", "kvaOld"],
    compute: ({ percentZOld, percentZNew, kvaOld }) => (percentZNew * kvaOld) / percentZOld,
    describe: (v, r) => ({
      formula: "kVA_new = %Z_new × kVA_old / %Z_old",
      substituted: `kVA_new = ${v.percentZNew} × ${v.kvaOld} / ${v.percentZOld}`,
      resultLine: `kVA_new ≈ ${r} kVA`,
    }),
    source: PERCENT_Z_BASE_CONVERSION_SOURCE,
  },
  {
    output: "kvaOld",
    inputs: ["percentZOld", "percentZNew", "kvaNew"],
    compute: ({ percentZOld, percentZNew, kvaNew }) => (percentZOld * kvaNew) / percentZNew,
    describe: (v, r) => ({
      formula: "kVA_old = %Z_old × kVA_new / %Z_new",
      substituted: `kVA_old = ${v.percentZOld} × ${v.kvaNew} / ${v.percentZNew}`,
      resultLine: `kVA_old ≈ ${r} kVA`,
    }),
    source: PERCENT_Z_BASE_CONVERSION_SOURCE,
  },
];
export function solvePercentZBaseConversion(
  known: KnownValues<PercentZBaseVar>,
  target: PercentZBaseVar,
): SolveResult {
  const invalid = firstValidationError(
    requirePositive(known.percentZOld, "%Z（変換前）"),
    requirePositive(known.kvaOld, "ベース容量（変換前）"),
    requirePositive(known.percentZNew, "%Z（変換後）"),
    requirePositive(known.kvaNew, "ベース容量（変換後）"),
  );
  if (invalid) return invalid;
  return solveByRules(percentZBaseRules, known, target);
}

// ---- 遮断容量チェック（純粋な算術比較のみ） ----

export interface BreakingCapacityCheck {
  shortCircuitCurrentA: number;
  breakerRatedBreakingCapacityA: number;
  sufficient: boolean;
  /** rated − short-circuit（正なら余裕、負なら不足）。 */
  marginA: number;
}

/**
 * 計算された短絡電流Iscと、ユーザー自身が入力した遮断器の定格遮断容量とを
 * 比較するだけの単純な算術判定。上記の通りIsc自体が変圧器%Zのみの簡易値
 * （上位系統・ケーブル等未考慮）であるため、この判定だけで遮断器選定の
 * 最終「OK/NG」を決めてはならない — 必ず詳細検討・メーカー資料で確認する
 * こと。遮断容量の基準値そのものを本システムが規定・推測することはない。
 */
export function checkBreakingCapacity(
  shortCircuitCurrentA: number,
  breakerRatedBreakingCapacityA: number,
): BreakingCapacityCheck | null {
  if (!Number.isFinite(shortCircuitCurrentA) || shortCircuitCurrentA <= 0) return null;
  if (
    !Number.isFinite(breakerRatedBreakingCapacityA) ||
    breakerRatedBreakingCapacityA <= 0
  ) {
    return null;
  }
  return {
    shortCircuitCurrentA,
    breakerRatedBreakingCapacityA,
    sufficient: breakerRatedBreakingCapacityA >= shortCircuitCurrentA,
    marginA: breakerRatedBreakingCapacityA - shortCircuitCurrentA,
  };
}
