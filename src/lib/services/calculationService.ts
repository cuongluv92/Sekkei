import { calculationDefinitions, getCalculationDefinition } from "@/lib/mock/calculationDefinitions";
import { delay } from "@/lib/utils/async";
import type { CalculationRepository } from "./types";

/**
 * Mock calculation engine shared by 重量計算 / 換気計算 / 耐震計算 / 他計算.
 * `calculate()` never runs real formulas in this phase — it just echoes the
 * submitted input back as a single placeholder row so the result table has
 * something to render. Real formulas will be registered per
 * `CalculationDefinition.key` later (see 設定 > 計算設定) and plugged in here
 * without any page needing to change.
 */
class MockCalculationRepository implements CalculationRepository {
  async listDefinitions() {
    return delay(calculationDefinitions);
  }

  async getDefinition(key: string) {
    return delay(getCalculationDefinition(key) ?? null);
  }

  async calculate(key: string, values: Record<string, string | number>) {
    const def = getCalculationDefinition(key);
    if (!def) return delay([]);

    const row: Record<string, string> = {};
    for (const col of def.resultColumns) {
      row[col.key] = "—";
    }
    row[def.resultColumns[0]?.key ?? "item"] = "計算式未設定";
    row.remarks = Object.entries(values)
      .filter(([, v]) => v !== "" && v !== undefined)
      .map(([k, v]) => `${k}=${v}`)
      .join(", ");

    return delay([row], 500);
  }
}

export const calculationService: CalculationRepository = new MockCalculationRepository();
