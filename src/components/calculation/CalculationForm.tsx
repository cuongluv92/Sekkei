"use client";

import { useTranslation } from "@/lib/i18n";
import type { CalculationDefinition } from "@/lib/types";

interface CalculationFormProps {
  definition: CalculationDefinition;
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
}

/**
 * Renders an input form purely from a `CalculationDefinition`. Every
 * calculation page (重量/換気/耐震/母線銅帯/アース電線サイズ) reuses this same
 * component — adding a new calculation module later only means adding a new
 * definition (see `lib/mock/calculationDefinitions.ts`), not a new form.
 */
export function CalculationForm({ definition, values, onChange }: CalculationFormProps) {
  const { locale } = useTranslation();

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {definition.inputFields.map((field) => {
        const label = locale === "vi" && field.labelVi ? field.labelVi : field.label;
        return (
          <div key={field.key}>
            <label className="field-label">
              {label}
              {field.unit ? ` (${field.unit})` : ""}
            </label>
            {field.type === "select" ? (
              <select
                className="field-input"
                value={values[field.key] ?? ""}
                onChange={(e) => onChange(field.key, e.target.value)}
              >
                <option value="">—</option>
                {field.options?.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {locale === "vi" && opt.labelVi ? opt.labelVi : opt.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type={field.type === "number" ? "number" : "text"}
                className="field-input"
                placeholder={field.placeholder}
                value={values[field.key] ?? ""}
                onChange={(e) => onChange(field.key, e.target.value)}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
