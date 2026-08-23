"use client";

import { Loader2, Save } from "lucide-react";
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslation } from "@/lib/i18n";
import { formatJaTime } from "@/lib/utils/dateFormat";
import {
  calculationRecordService,
  calculationService,
  calculationTemplateService,
} from "@/lib/services";
import { CalculationForm } from "@/components/calculation/CalculationForm";
import { CalculationResult } from "@/components/calculation/CalculationResult";
import { ExportActions } from "@/components/common/ExportActions";
import { PageHeader } from "@/components/common/PageHeader";
import { CaseSelector } from "@/components/common/CaseSelector";
import { useActiveCase } from "@/lib/store/ActiveCaseProvider";
import type { CalculationDefinition, CalculationTemplate } from "@/lib/types";

interface CalculationPageViewProps {
  calculationKey: string;
  title: string;
  description: string;
}

/**
 * Generic 案件 → 入力 → 計算 → 保存 screen shared by every calculation module
 * (換気計算, 耐震計算, and the 他計算 modules — 重量計算/母線銅帯 have their own
 * bespoke persistence). Everything the page renders comes from the module's
 * `CalculationDefinition`, so adding a new calculation later means
 * registering a new definition, not a new page. Saved state
 * (`values`/`results`) is keyed by (案件, calculationKey) via
 * `calculation_records` — reopening a 案件 restores it for editing,
 * recalculating, and re-saving.
 */
function CalculationPageViewInner({
  calculationKey,
  title,
  description,
}: CalculationPageViewProps) {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const {
    caseId,
    setCaseId,
    loading: caseLoading,
    registerSaveHandler,
  } = useActiveCase();

  // Honors a `?case=<id>` deep link (e.g. from Global Search's 計算 result)
  // by resolving it as the app-wide active 案件.
  useEffect(() => {
    const fromUrl = searchParams.get("case");
    if (fromUrl && fromUrl !== caseId) setCaseId(fromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);
  const [definition, setDefinition] = useState<CalculationDefinition | null>(
    null,
  );
  const [template, setTemplate] = useState<CalculationTemplate | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [results, setResults] = useState<Record<string, string>[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const loadTokenRef = useRef(0);

  useEffect(() => {
    setDefinition(null);
    setValues({});
    setResults([]);
    calculationService.getDefinition(calculationKey).then(setDefinition);
    calculationTemplateService
      .getByCalculationKey(calculationKey)
      .then(setTemplate);
  }, [calculationKey]);

  useEffect(() => {
    const token = ++loadTokenRef.current;
    setSavedAt(null);
    registerSaveHandler(calculationKey, null);
    if (!caseId) return;
    calculationRecordService.get(caseId, calculationKey).then((record) => {
      if (loadTokenRef.current !== token) return; // a newer (case/calculationKey) fetch already applied
      if (record) {
        setValues((record.input as Record<string, string>) ?? {});
        const rows = record.result?.rows;
        setResults(
          Array.isArray(rows) ? (rows as Record<string, string>[]) : [],
        );
        setSavedAt(record.updatedAt);
      } else {
        setValues({});
        setResults([]);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId, calculationKey]);

  // Unregister this module's save handler on unmount so a stale handler
  // pointing at an old case's data can never be invoked by the switch
  // confirmation later.
  useEffect(
    () => () => registerSaveHandler(calculationKey, null),
    [calculationKey, registerSaveHandler],
  );

  async function handleCalculate() {
    if (!definition) return;
    setLoading(true);
    const rows = await calculationService.calculate(calculationKey, values);
    setResults(rows);
    setLoading(false);
    registerSaveHandler(calculationKey, handleSave);
  }

  function handleClear() {
    setValues({});
    setResults([]);
  }

  async function handleSave() {
    if (!caseId || saving) return;
    setSaving(true);
    try {
      const saved = await calculationRecordService.save(
        caseId,
        calculationKey,
        values,
        { rows: results },
      );
      setSavedAt(saved.updatedAt);
      registerSaveHandler(calculationKey, null);
    } finally {
      setSaving(false);
    }
  }

  if (!definition) {
    return <div className="text-[12px] text-muted">{t("common.loading")}</div>;
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={title} description={description} />

      <CaseSelector />

      {caseLoading ? (
        <div className="panel">
          <div className="panel-body py-12 text-center text-[13px] text-muted-2">
            {t("common.loading")}
          </div>
        </div>
      ) : !caseId ? (
        <div className="panel">
          <div className="panel-body py-12 text-center text-[13px] text-muted-2">
            {t("caseSelector.selectCaseFirst")}
          </div>
        </div>
      ) : (
        <>
          <div className="panel">
            <div className="panel-header">
              <span className="panel-title">{t("calculation.inputTitle")}</span>
            </div>
            <div className="panel-body flex flex-col gap-4">
              <CalculationForm
                definition={definition}
                values={values}
                onChange={(key, value) => {
                  setValues((prev) => ({ ...prev, [key]: value }));
                  registerSaveHandler(calculationKey, handleSave);
                }}
              />
              <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
                <button
                  onClick={handleCalculate}
                  disabled={loading}
                  className="btn-primary"
                >
                  {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {t("common.calculate")}
                </button>
                <button onClick={handleClear} className="btn-secondary">
                  {t("common.clear")}
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="btn-secondary"
                >
                  {saving ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                  {t("common.save")}
                </button>
                {savedAt && (
                  <span className="text-[11px] text-muted-2">
                    {t("weightCalc.basic.saved")}{" "}
                    {formatJaTime(savedAt)}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">
              <span className="panel-title">
                {t("calculation.resultTitle")}
              </span>
            </div>
            {results.length > 0 && (
              <p className="border-b border-border px-4 py-2 text-[11px] text-warning">
                {t("calculation.formulaPending")}
              </p>
            )}
            <CalculationResult
              definition={definition}
              rows={results}
              loading={loading}
            />
          </div>

          <div className="panel">
            <div className="panel-header">
              <span className="panel-title">
                {t("calculation.outputTitle")}
              </span>
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
        </>
      )}
    </div>
  );
}

export function CalculationPageView(props: CalculationPageViewProps) {
  return (
    <Suspense fallback={null}>
      <CalculationPageViewInner {...props} />
    </Suspense>
  );
}
