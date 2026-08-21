import type { SelectionInput, SelectionResultRow, SelectionRule } from "@/lib/types";

export interface ParsedSelectionInput {
  value: number;
  unit: string;
}

/** "15kW" / "20 A" / "15.5kw" -> { value, unit }. Returns null when the input isn't "<number><unit>". */
export function parseSelectionInput(rawValue: string): ParsedSelectionInput | null {
  const match = rawValue.trim().match(/^([\d.]+)\s*([^\d\s].*)$/);
  if (!match) return null;
  const value = Number(match[1]);
  if (Number.isNaN(value)) return null;
  return { value, unit: match[2].trim() };
}

/**
 * SelectionEngine — pure matching against the real rule table (RuleRepository
 * owns persistence, this only decides which rule wins). No product values
 * are invented here: an output with no matching enabled rule returns the
 * same explicit "not configured" row the app has always shown.
 */
export function evaluateSelection(
  input: SelectionInput,
  rules: SelectionRule[],
  outputLabels: Record<string, string>,
  notConfiguredLabel: (rawValue: string) => string,
): SelectionResultRow[] {
  const parsed = parseSelectionInput(input.rawValue);

  return input.outputs.map((key) => {
    const label = outputLabels[key] ?? key;
    if (!parsed) {
      return {
        id: `${key}-${input.rawValue}`,
        outputKey: key,
        label,
        value: "— (未設定)",
        remarks: notConfiguredLabel(input.rawValue),
      };
    }

    const candidates = rules
      .filter(
        (r) =>
          r.enabled &&
          r.outputKey === key &&
          r.unit.trim().toLowerCase() === parsed.unit.toLowerCase() &&
          parsed.value >= r.minValue &&
          parsed.value <= r.maxValue,
      )
      .sort((a, b) => a.maxValue - a.minValue - (b.maxValue - b.minValue));

    const match = candidates[0];
    if (!match) {
      return {
        id: `${key}-${input.rawValue}`,
        outputKey: key,
        label,
        value: "— (未設定)",
        remarks: notConfiguredLabel(input.rawValue),
      };
    }

    return {
      id: `${key}-${input.rawValue}`,
      outputKey: key,
      label,
      value: match.resultValue,
      remarks: match.remarks,
    };
  });
}
