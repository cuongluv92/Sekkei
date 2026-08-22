import { calculationDefinitions, getCalculationDefinition } from "@/lib/mock/calculationDefinitions";
import { delay } from "@/lib/utils/async";
import type { CalculationRepository } from "./types";

/**
 * Mock calculation engine shared by 換気計算 / 耐震計算 / 他計算 — modules that
 * still lack a real, standard-backed formula. `calculate()` never runs real
 * formulas here — it just echoes the submitted input back as a single
 * placeholder row so the result table has something to render. There is no
 * Settings UI to "register a formula" (that 計算設定 section was removed —
 * technical formulas are implemented in code with tests and a cited
 * standard/source, never user-entered; see `src/lib/calc/technicalSource.ts`).
 * A module with a real formula graduates out of this mock engine entirely
 * into its own bespoke component/page instead — see 重量計算, 母線銅帯, 接地線,
 * アースバー.
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
