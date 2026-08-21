"use client";

import { CheckCircle2, Loader2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { importService } from "@/lib/services";
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

type Step = "select" | "analyzing" | "preview" | "done";

export default function ImportPage() {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [target, setTarget] = useState<ImportTargetCategory>("part-data");
  const [step, setStep] = useState<Step>("select");
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null);

  async function handleAnalyze() {
    if (!file) return;
    setStep("analyzing");
    const analyzed = await importService.analyze(file.name, inferFileType(file.name), target);
    setRows(analyzed);
    setStep("preview");
  }

  async function handleConfirm() {
    const res = await importService.confirmImport(rows);
    setResult(res);
    setStep("done");
  }

  function handleReset() {
    setFile(null);
    setRows([]);
    setResult(null);
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

      {(step === "preview" || step === "done") && (
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
              <ImportPreview rows={rows} onConfirm={handleConfirm} />
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
  const currentIndex = order.indexOf(current);

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
