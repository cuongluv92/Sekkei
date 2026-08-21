"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { calculationService, calculationTemplateService } from "@/lib/services";
import { CalculationForm } from "@/components/calculation/CalculationForm";
import { CalculationResult } from "@/components/calculation/CalculationResult";
import { ExportActions } from "@/components/common/ExportActions";
import { PageHeader } from "@/components/common/PageHeader";
import type { CalculationDefinition, CalculationTemplate } from "@/lib/types";

interface CalculationPageViewProps {
  calculationKey: string;
  title: string;
  description: string;
}

/**
 * Generic 入力 → 計算 → 結果 → ファイル出力 screen shared by every calculation
 * module (重量計算, 換気計算, 耐震計算, and the 他計算 modules). Everything the
 * page renders comes from the module's `CalculationDefinition`, so adding a
 * new calculation later means registering a new definition, not a new page.
 */
export function CalculationPageView({ calculationKey, title, description }: CalculationPageViewProps) {
  const { t } = useTranslation();
  const [definition, setDefinition] = useState<CalculationDefinition | null>(null);
  const [template, setTemplate] = useState<CalculationTemplate | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [results, setResults] = useState<Record<string, string>[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setDefinition(null);
    setValues({});
    setResults([]);
    calculationService.getDefinition(calculationKey).then(setDefinition);
    calculationTemplateService.getByCalculationKey(calculationKey).then(setTemplate);
  }, [calculationKey]);

  async function handleCalculate() {
    if (!definition) return;
    setLoading(true);
    const rows = await calculationService.calculate(calculationKey, values);
    setResults(rows);
    setLoading(false);
  }

  function handleClear() {
    setValues({});
    setResults([]);
  }

  if (!definition) {
    return <div className="text-[12px] text-muted">{t("common.loading")}</div>;
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={title} description={description} />

      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">{t("calculation.inputTitle")}</span>
        </div>
        <div className="panel-body flex flex-col gap-4">
          <CalculationForm
            definition={definition}
            values={values}
            onChange={(key, value) => setValues((prev) => ({ ...prev, [key]: value }))}
          />
          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
            <button onClick={handleCalculate} disabled={loading} className="btn-primary">
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {t("common.calculate")}
            </button>
            <button onClick={handleClear} className="btn-secondary">
              {t("common.clear")}
            </button>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">{t("calculation.resultTitle")}</span>
        </div>
        {results.length > 0 && (
          <p className="border-b border-border px-4 py-2 text-[11px] text-warning">
            {t("calculation.formulaPending")}
          </p>
        )}
        <CalculationResult definition={definition} rows={results} loading={loading} />
      </div>

      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">{t("calculation.outputTitle")}</span>
        </div>
        <div className="panel-body flex flex-col gap-2">
          <p className="text-[11px] text-muted-2">
            {template
              ? `${t("settings.templateSection")}: ${template.fileName}`
              : t("calculation.templateNotice")}
          </p>
          <ExportActions context={title} />
        </div>
      </div>
    </div>
  );
}
