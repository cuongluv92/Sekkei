/**
 * 選定 > 分岐(電動機回路) のマッチングエンジン — kW または A を入力すると、
 * メーカー・電圧クラス・回路方式が一致する motor_starter_selections の中から
 * 「入力値以上で最小」の行を選ぶ (次の標準サイズに切り上げる、という現場の
 * 選び方をそのまま再現)。一致する行が無ければ null を返す — 値を捏造したり
 * 一番近い行を無理やり使ったりしない (社内選定マスタが空欄/不足しているだけ
 * なら、そのまま「未設定」として設定画面への追加を促す)。
 */
import type { MainBreakerSelection, MotorStarterSelection, SelectionCircuitType, SelectionVoltageClass } from "@/lib/types";

export interface MotorBranchQuery {
  manufacturerId: string;
  voltageClass: SelectionVoltageClass;
  circuitType: SelectionCircuitType;
  inputUnit: "kW" | "A";
  inputValue: number;
}

/** 入力値以上で最小の行を返す (キー昇順に走査し最初に条件を満たした行)。 */
function pickNextSizeUp<T>(rows: T[], keyOf: (row: T) => number, target: number): T | null {
  const sorted = [...rows].sort((a, b) => keyOf(a) - keyOf(b));
  return sorted.find((row) => keyOf(row) >= target) ?? null;
}

export function matchMotorStarterSelection(
  query: MotorBranchQuery,
  master: MotorStarterSelection[],
): MotorStarterSelection | null {
  const candidates = master.filter(
    (row) =>
      row.manufacturerId === query.manufacturerId &&
      row.voltageClass === query.voltageClass &&
      row.circuitType === query.circuitType,
  );
  if (candidates.length === 0) return null;
  const keyOf = query.inputUnit === "kW" ? (r: MotorStarterSelection) => r.motorKw : (r: MotorStarterSelection) => r.ratedCurrent;
  return pickNextSizeUp(candidates, keyOf, query.inputValue);
}

export interface MainBreakerQuery {
  manufacturerId: string;
  voltageClass: SelectionVoltageClass;
  totalCurrent: number; // A
}

export function matchMainBreakerSelection(
  query: MainBreakerQuery,
  master: MainBreakerSelection[],
): MainBreakerSelection | null {
  const candidates = master.filter(
    (row) => row.manufacturerId === query.manufacturerId && row.voltageClass === query.voltageClass,
  );
  if (candidates.length === 0) return null;
  return pickNextSizeUp(candidates, (r) => r.ratedCurrent, query.totalCurrent);
}
