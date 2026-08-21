import { delay } from "@/lib/utils/async";
import type { SelectionInput, SelectionResultRow, SelectionOutputKey } from "@/lib/types";
import type { SelectionRepository } from "./types";

const OUTPUT_LABELS: Record<SelectionOutputKey, string> = {
  breaker: "ブレーカー",
  am: "AM",
  magneticContactor: "電磁開閉器",
  wireSize: "電線サイズ",
  terminalBlock: "端子台",
  other: "その他",
};

/**
 * Mock selection engine. No real selection rules/formulas exist yet, so this
 * only echoes back one placeholder row per requested output item. Once real
 * `SelectionRule`s are registered (via 設定), this class's `evaluate` method
 * is the only place that needs to change — every page consuming
 * `selectionService` stays untouched.
 */
class MockSelectionRepository implements SelectionRepository {
  async evaluate(input: SelectionInput): Promise<SelectionResultRow[]> {
    const rows: SelectionResultRow[] = input.outputs.map((key) => ({
      id: `${key}-${input.rawValue}`,
      outputKey: key,
      label: OUTPUT_LABELS[key],
      value: "— (未設定)",
      remarks: `入力値「${input.rawValue}」に対する選定ルールは未登録です`,
    }));
    return delay(rows, 400);
  }
}

export const selectionService: SelectionRepository = new MockSelectionRepository();
