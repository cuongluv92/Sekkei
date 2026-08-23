/**
 * 三相・Y/Δ結線 — 線間電圧⇔相電圧、線電流⇔相電流 の √3 関係。
 *
 * Y結線: 線間電圧 = √3 × 相電圧、線電流 = 相電流
 * Δ結線: 線間電圧 = 相電圧、線電流 = √3 × 相電流
 *
 * 線間 (line-to-line) と 相 (phase) は別々の変数として扱い、絶対に混同しない
 * — Y結線の「相電圧」を Δ結線の「相電圧」と同じ意味で扱う呼び出し側の誤りを
 * 防ぐため、`solveThreePhaseConnection` は必ず `connection` を要求する。
 */
import { engineeringFundamentalSource } from "@/lib/calc/technicalSource";
import { solveByRules, type Rule } from "./ruleSolver";
import type { KnownValues, SolveResult } from "./types";

export type ThreePhaseConnection = "Y" | "Delta";
export type ThreePhaseVar =
  | "lineVoltage"
  | "phaseVoltage"
  | "lineCurrent"
  | "phaseCurrent";

const Y_VOLTAGE_SOURCE = engineeringFundamentalSource(
  "Y結線の線間電圧と相電圧の関係 V_line = √3 × V_phase",
  "対称三相交流・Y（スター）結線",
);
const Y_CURRENT_SOURCE = engineeringFundamentalSource(
  "Y結線の線電流と相電流の関係 I_line = I_phase",
  "対称三相交流・Y（スター）結線",
);
const DELTA_VOLTAGE_SOURCE = engineeringFundamentalSource(
  "Δ結線の線間電圧と相電圧の関係 V_line = V_phase",
  "対称三相交流・Δ（デルタ）結線",
);
const DELTA_CURRENT_SOURCE = engineeringFundamentalSource(
  "Δ結線の線電流と相電流の関係 I_line = √3 × I_phase",
  "対称三相交流・Δ（デルタ）結線",
);

const SQRT3 = Math.sqrt(3);

function rulesFor(connection: ThreePhaseConnection): readonly Rule<ThreePhaseVar>[] {
  if (connection === "Y") {
    return [
      {
        output: "lineVoltage",
        inputs: ["phaseVoltage"],
        compute: ({ phaseVoltage }) => SQRT3 * phaseVoltage,
        describe: (v, r) => ({
          formula: "V_line = √3 × V_phase",
          substituted: `V_line = √3 × ${v.phaseVoltage}`,
          resultLine: `V_line ≈ ${r} V`,
        }),
        source: Y_VOLTAGE_SOURCE,
      },
      {
        output: "phaseVoltage",
        inputs: ["lineVoltage"],
        compute: ({ lineVoltage }) => lineVoltage / SQRT3,
        describe: (v, r) => ({
          formula: "V_phase = V_line / √3",
          substituted: `V_phase = ${v.lineVoltage} / √3`,
          resultLine: `V_phase ≈ ${r} V`,
        }),
        source: Y_VOLTAGE_SOURCE,
      },
      {
        output: "lineCurrent",
        inputs: ["phaseCurrent"],
        compute: ({ phaseCurrent }) => phaseCurrent,
        describe: (v, r) => ({
          formula: "I_line = I_phase",
          substituted: `I_line = ${v.phaseCurrent}`,
          resultLine: `I_line ≈ ${r} A`,
        }),
        source: Y_CURRENT_SOURCE,
      },
      {
        output: "phaseCurrent",
        inputs: ["lineCurrent"],
        compute: ({ lineCurrent }) => lineCurrent,
        describe: (v, r) => ({
          formula: "I_phase = I_line",
          substituted: `I_phase = ${v.lineCurrent}`,
          resultLine: `I_phase ≈ ${r} A`,
        }),
        source: Y_CURRENT_SOURCE,
      },
    ];
  }
  return [
    {
      output: "lineVoltage",
      inputs: ["phaseVoltage"],
      compute: ({ phaseVoltage }) => phaseVoltage,
      describe: (v, r) => ({
        formula: "V_line = V_phase",
        substituted: `V_line = ${v.phaseVoltage}`,
        resultLine: `V_line ≈ ${r} V`,
      }),
      source: DELTA_VOLTAGE_SOURCE,
    },
    {
      output: "phaseVoltage",
      inputs: ["lineVoltage"],
      compute: ({ lineVoltage }) => lineVoltage,
      describe: (v, r) => ({
        formula: "V_phase = V_line",
        substituted: `V_phase = ${v.lineVoltage}`,
        resultLine: `V_phase ≈ ${r} V`,
      }),
      source: DELTA_VOLTAGE_SOURCE,
    },
    {
      output: "lineCurrent",
      inputs: ["phaseCurrent"],
      compute: ({ phaseCurrent }) => SQRT3 * phaseCurrent,
      describe: (v, r) => ({
        formula: "I_line = √3 × I_phase",
        substituted: `I_line = √3 × ${v.phaseCurrent}`,
        resultLine: `I_line ≈ ${r} A`,
      }),
      source: DELTA_CURRENT_SOURCE,
    },
    {
      output: "phaseCurrent",
      inputs: ["lineCurrent"],
      compute: ({ lineCurrent }) => lineCurrent / SQRT3,
      describe: (v, r) => ({
        formula: "I_phase = I_line / √3",
        substituted: `I_phase = ${v.lineCurrent} / √3`,
        resultLine: `I_phase ≈ ${r} A`,
      }),
      source: DELTA_CURRENT_SOURCE,
    },
  ];
}

export function solveThreePhaseConnection(
  known: KnownValues<ThreePhaseVar>,
  target: ThreePhaseVar,
  connection: ThreePhaseConnection,
): SolveResult {
  return solveByRules(rulesFor(connection), known, target);
}
