"use client";

import { CheckCircle2, Loader2, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { importService, partDataService, partDrawingService, catalogService } from "@/lib/services";
import { listManufacturers, preloadManufacturers } from "@/lib/mock/manufacturers";
import { distinctCategories } from "@/lib/utils/partSearch";
import { Combobox } from "@/components/common/Combobox";
import { ImportPreview } from "@/components/import/ImportPreview";
import { PageHeader } from "@/components/common/PageHeader";
import type { ImportFileType, ImportRow, ImportTargetCategory } from "@/lib/types";

const TARGET_OPTIONS: { value: ImportTargetCategory; labelKey: string }[] = [
  { value: "part-data", labelKey: "importPage.targets.partData" },
  { value: "part-drawing", labelKey: "importPage.targets.partDrawing" },
  { value: "catalog", labelKey: "importPage.targets.catalog" },
];

function inferFileType(fileName: string): ImportFileType {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (["xlsx", "xls", "csv"].includes(ext)) return "excel";
  if (ext === "dwg") return "dwg";
  if (ext === "pdf") return "pdf";
  return "image";
}

type Step = "select" | "analyzing" | "preview" | "confirming" | "done";

export default function ImportPage() {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [target, setTarget] = useState<ImportTargetCategory>("part-data");
  const [fallbackManufacturer, setFallbackManufacturer] = useState("");
  const [fallbackCategory, setFallbackCategory] = useState("");
  const [categoryOptions, setCategoryOptions] = useState<string[]>([]);
  const [step, setStep] = useState<Step>("select");
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, forceRerender] = useState(0);

  useEffect(() => {
    preloadManufacturers().then(() => forceRerender((v) => v + 1));
    Promise.all([partDataService.list(), partDrawingService.list(), catalogService.list()]).then(
      ([dataRows, drawingRows, catalogRows]) => {
        setCategoryOptions(distinctCategories([...dataRows, ...drawingRows, ...catalogRows]));
      },
    );
  }, []);

  async function handleAnalyze() {
    if (!file) return;
    setStep("analyzing");
    setError(null);
    try {
      const analyzed = await importService.analyze(file, inferFileType(file.name), target, {
        manufacturer: fallbackManufacturer || undefined,
        category: fallbackCategory || undefined,
      });
      setRows(analyzed);
      setStep("preview");
    } catch {
      setError(t("common.error"));
      setStep("select");
    }
  }

  async function handleConfirm() {
    setStep("confirming");
    setError(null);
    try {
      const res = await importService.confirmImport(rows);
      setResult(res);
      setStep("done");
    } catch {
      setError(t("common.error"));
      setStep("preview");
    }
  }

  function handleReset() {
    setFile(null);
    setRows([]);
    setResult(null);
    setError(null);
    setStep("select");
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t("importPage.title")} description={t("importPage.description")} />

      <StepBar current={step} />

      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">{t("importPage.step1")}</span>
        </div>
        <div className="panel-body flex flex-col gap-4">
          <div className="max-w-xs">
            <label className="field-label">{t("importPage.targetLabel")}</label>
            <select
              value={target}
              onChange={(e) => setTarget(e.target.value as ImportTargetCategory)}
              disabled={step !== "select"}
              className="field-input"
            >
              {TARGET_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {t(opt.labelKey)}
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-md border border-border bg-surface-2 p-3">
            <p className="mb-2.5 text-[12px] text-muted">{t("importPage.fallbackSectionTitle")}</p>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <div>
                <label className="field-label">{t("common.manufacturer")}</label>
                <Combobox
                  options={listManufacturers().map((m) => m.name)}
                  value={fallbackManufacturer}
                  onChange={setFallbackManufacturer}
                  placeholder={t("importPage.fallbackManufacturerPlaceholder")}
                />
              </div>
              <div>
                <label className="field-label">{t("common.categoryFilterLabel")}</label>
                <Combobox
                  options={categoryOptions}
                  value={fallbackCategory}
                  onChange={setFallbackCategory}
                  placeholder={t("importPage.fallbackCategoryPlaceholder")}
                />
              </div>
            </div>
          </div>

          <button
            onClick={() => inputRef.current?.click()}
            disabled={step !== "select"}
            className="flex flex-col items-center gap-2 rounded-md border border-dashed border-border-strong bg-surface-2 px-6 py-8 text-center text-muted transition-colors hover:border-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Upload className="h-6 w-6" />
            <span className="text-[12.5px]">{file ? file.name : t("importPage.dropHint")}</span>
            <span className="text-[11px] text-muted-2">Excel / DWG / PDF / 画像</span>
          </button>
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            accept=".xlsx,.xls,.csv,.dwg,.pdf,.png,.jpg,.jpeg"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />

          <div>
            <button
              onClick={handleAnalyze}
              disabled={!file || step !== "select"}
              className="btn-primary"
            >
              {step === "analyzing" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {step === "analyzing" ? t("importPage.analyzing") : t("importPage.analyzeButton")}
            </button>
          </div>
        </div>
      </div>

      {error && <p className="text-[12.5px] text-danger">{error}</p>}

      {(step === "preview" || step === "confirming" || step === "done") && (
        <div className="panel">
          <div className="panel-header">
            <span className="panel-title">{t("importPage.step3")}</span>
          </div>
          <div className="panel-body">
            {step === "done" ? (
              <div className="flex items-center gap-2 text-success">
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-[12.5px]">
                  {t("importPage.importDone")}
                  {result ? `（${t("importPage.statusNew")}: ${result.imported} / ${t("importPage.statusSkip")}: ${result.skipped}）` : ""}
                </span>
              </div>
            ) : (
              <ImportPreview
                rows={rows}
                onRowsChange={setRows}
                onConfirm={handleConfirm}
                confirming={step === "confirming"}
              />
            )}
          </div>
        </div>
      )}

      {step === "done" && (
        <div>
          <button onClick={handleReset} className="btn-secondary">
            {t("common.back")}
          </button>
        </div>
      )}
    </div>
  );
}

function StepBar({ current }: { current: Step }) {
  const { t } = useTranslation();
  const steps: { key: Step; labelKey: string }[] = [
    { key: "select", labelKey: "importPage.step1" },
    { key: "analyzing", labelKey: "importPage.step2" },
    { key: "preview", labelKey: "importPage.step3" },
    { key: "done", labelKey: "importPage.step4" },
  ];
  const order: Step[] = ["select", "analyzing", "preview", "done"];
  const currentIndex = order.indexOf(current === "confirming" ? "preview" : current);

  return (
    <div className="flex flex-wrap items-center gap-2 text-[11.5px]">
      {steps.map((s, i) => (
        <span
          key={s.key}
          className={`rounded-md border px-2.5 py-1 ${
            i <= currentIndex
              ? "border-accent/50 bg-accent/10 text-accent"
              : "border-border text-muted-2"
          }`}
        >
          {t(s.labelKey)}
        </span>
      ))}
    </div>
  );
}
