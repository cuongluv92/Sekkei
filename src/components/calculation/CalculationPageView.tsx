"use client";

import { Loader2, Save, Settings } from "lucide-react";
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslation } from "@/lib/i18n";
import { formatJaTime } from "@/lib/utils/dateFormat";
import { loadFromStorage, saveToStorage } from "@/lib/utils/localStore";
import {
  calculationRecordService,
  calculationService,
  calculationTemplateService,
} from "@/lib/services";
import { CalculationForm } from "@/components/calculation/CalculationForm";
import { CalculationResult } from "@/components/calculation/CalculationResult";
import { CaseAttachPrompt } from "@/components/common/CaseAttachPrompt";
import { ExportActions } from "@/components/common/ExportActions";
import { Modal } from "@/components/common/Modal";
import { PageHeader } from "@/components/common/PageHeader";
import { CaseSelector } from "@/components/common/CaseSelector";
import { CalculationTemplateSettings } from "@/components/settings/CalculationTemplateSettings";
import { useActiveCase, useEffectiveCaseId } from "@/lib/store/ActiveCaseProvider";
import type { CalculationDefinition, CalculationTemplate } from "@/lib/types";

interface CalculationDraft {
  values: Record<string, string>;
  results: Record<string, string>[];
}

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
    caseId: activeCaseId,
    setCaseId: setActiveCaseId,
    loading: caseLoading,
    registerSaveHandler,
  } = useActiveCase();
  // This screen is usable the instant it opens, with no forced 案件選択
  // first — so it does NOT suppress the already-active 案件, and stays
  // usable even with caseId === "" (see the localStorage-draft mode below).
  // An explicit `?case=` deep link (e.g. Global Search's 計算 result) always
  // wins, exactly like DesignView.
  const effectiveActiveCaseId = useEffectiveCaseId(false);
  const caseIdParam = searchParams.get("case") ?? "";
  const caseId = caseIdParam || effectiveActiveCaseId;
  const draftStorageKey = `sekkei.calcDraft.${calculationKey}`;

  // Broadcast the effective 案件 (URL-provided or a genuine pick here) up
  // to the app-wide active 案件 so it's what other modules resume.
  useEffect(() => {
    if (caseId && caseId !== activeCaseId) setActiveCaseId(caseId);
  }, [caseId, activeCaseId, setActiveCaseId]);
  const [definition, setDefinition] = useState<CalculationDefinition | null>(
    null,
  );
  const [template, setTemplate] = useState<CalculationTemplate | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [results, setResults] = useState<Record<string, string>[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [caseAttachPromptOpen, setCaseAttachPromptOpen] = useState(false);
  const loadTokenRef = useRef(0);
  const initializedRef = useRef(false);

  useEffect(() => {
    setDefinition(null);
    setValues({});
    setResults([]);
    calculationService.getDefinition(calculationKey).then(setDefinition);
    calculationTemplateService
      .getByCalculationKey(calculationKey)
      .then(setTemplate);
  }, [calculationKey]);

  // 案件 未選択のときは calculation_records ではなくローカル下書き (localStorage)
  // から読み込む — 案件 を選ぶ/作るまでブロックしない。
  useEffect(() => {
    const token = ++loadTokenRef.current;
    setSavedAt(null);
    initializedRef.current = false;
    registerSaveHandler(calculationKey, null);
    if (!caseId) {
      const draft = loadFromStorage<CalculationDraft | null>(draftStorageKey, null);
      setValues(draft?.values ?? {});
      setResults(draft?.results ?? []);
      initializedRef.current = true;
      return;
    }
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
      initializedRef.current = true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId, calculationKey]);

  // 案件 未選択の間は、編集/計算のたびにローカル下書きへ即保存。
  useEffect(() => {
    if (caseId || !initializedRef.current) return;
    saveToStorage(draftStorageKey, { values, results });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId, values, results]);

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
    if (caseId) registerSaveHandler(calculationKey, () => handleSave());
  }

  function handleClear() {
    setValues({});
    setResults([]);
  }

  /** 案件 が付いていればそのまま保存、なければ「既存の案件を選ぶ/新規案件を作成」を先に聞く。 */
  function handleSaveClick() {
    if (!caseId) {
      setCaseAttachPromptOpen(true);
      return;
    }
    handleSave();
  }

  async function handleSave(targetCaseId: string = caseId) {
    if (!targetCaseId || saving) return;
    setSaving(true);
    try {
      const saved = await calculationRecordService.save(
        targetCaseId,
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

  /** 保存時に選んだ/作った 案件 に、今入力中の内容をそのまま紐付ける。 */
  async function attachToCase(newCaseId: string) {
    setActiveCaseId(newCaseId);
    setCaseAttachPromptOpen(false);
    await handleSave(newCaseId);
    saveToStorage(draftStorageKey, null);
  }

  if (!definition) {
    return <div className="text-[12px] text-muted">{t("common.loading")}</div>;
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={title}
        description={description}
        actions={
          <button
            onClick={() => setSettingsOpen(true)}
            className="btn-secondary"
          >
            <Settings className="h-3.5 w-3.5" />
            {t("common.settings")}
          </button>
        }
      />

      <CaseSelector suppress={false} />

      {caseLoading ? (
        <div className="panel">
          <div className="panel-body py-12 text-center text-[13px] text-muted-2">
            {t("common.loading")}
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
                  if (caseId) registerSaveHandler(calculationKey, () => handleSave());
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
                  onClick={handleSaveClick}
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
                {caseId && savedAt && (
                  <span className="text-[11px] text-muted-2">
                    {t("weightCalc.basic.saved")}{" "}
                    {formatJaTime(savedAt)}
                  </span>
                )}
                {!caseId && (
                  <span className="text-[11px] text-warning">{t("caseSelector.draftNote")}</span>
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

      {settingsOpen && (
        <Modal
          title={t("common.settings")}
          onClose={() => setSettingsOpen(false)}
          widthClassName="max-w-2xl"
        >
          <CalculationTemplateSettings keys={[calculationKey]} />
        </Modal>
      )}

      <CaseAttachPrompt
        open={caseAttachPromptOpen}
        onClose={() => setCaseAttachPromptOpen(false)}
        onAttach={attachToCase}
      />
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
