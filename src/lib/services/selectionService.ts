import { delay } from "@/lib/utils/async";
import { selectionRuleService } from "./selectionRuleService";
import { evaluateSelection } from "@/lib/utils/selectionEngine";
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
 * SelectionService → RuleRepository (selectionRuleService) → SelectionEngine
 * (evaluateSelection). No breaker/wire/contactor values are hard-coded here
 * — every result comes from a real `SelectionRule` row entered via 設定 >
 * 選定設定. With no matching rule (the rule table starts empty), this
 * returns the same explicit "未登録" row it always has, never a guess.
 */
class RealSelectionRepository implements SelectionRepository {
  async evaluate(input: SelectionInput): Promise<SelectionResultRow[]> {
    const rules = await selectionRuleService.list();
    const rows = evaluateSelection(
      input,
      rules,
      OUTPUT_LABELS,
      (rawValue) => `入力値「${rawValue}」に対する選定ルールは未登録です`,
    );
    return delay(rows, 300);
  }
}

export const selectionService: SelectionRepository = new RealSelectionRepository();
