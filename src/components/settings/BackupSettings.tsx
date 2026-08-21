"use client";

import { AlertCircle, Download, Loader2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { backupService, type RestorePreviewEntry } from "@/lib/services/backupService";

type RestoreStep = "idle" | "preview" | "restoring" | "done";

/** Real Excel backup/restore — every backup is a new timestamped file (never overwritten); restore requires an explicit preview + confirm before anything is written. */
export function BackupSettings() {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState(false);
  const [exportedName, setExportedName] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState<RestoreStep>("idle");
  const [preview, setPreview] = useState<RestorePreviewEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleBackup() {
    setExporting(true);
    setExportedName(null);
    try {
      const { fileName } = await backupService.createBackup();
      setExportedName(fileName);
    } finally {
      setExporting(false);
    }
  }

  async function handleFileSelected(f: File | null) {
    setFile(f);
    setPreview(null);
    setError(null);
    setStep("idle");
    if (!f) return;
    try {
      const entries = await backupService.previewRestore(f);
      setPreview(entries);
      setStep("preview");
    } catch {
      setError(t("backupSettings.invalidFile"));
    }
  }

  async function handleConfirmRestore() {
    if (!file) return;
    setStep("restoring");
    setError(null);
    try {
      await backupService.confirmRestore(file);
      setStep("done");
    } catch {
      setError(t("backupSettings.invalidFile"));
      setStep("preview");
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2.5">
        <p className="text-[12px] text-muted">{t("backupSettings.exportDescription")}</p>
        <div className="flex items-center gap-2">
          <button onClick={handleBackup} disabled={exporting} className="btn-primary">
            {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            {t("backupSettings.createButton")}
          </button>
          {exportedName && <span className="text-[12.5px] text-success">{exportedName}</span>}
        </div>
      </div>

      <div className="flex flex-col gap-2.5 border-t border-border pt-4">
        <p className="text-[12px] text-muted">{t("backupSettings.restoreDescription")}</p>
        <button
          onClick={() => inputRef.current?.click()}
          className="flex flex-col items-center gap-2 rounded-md border border-dashed border-border-strong bg-surface-2 px-6 py-6 text-center text-muted transition-colors hover:border-accent hover:text-foreground"
        >
          <Upload className="h-5 w-5" />
          <span className="text-[12.5px]">{file ? file.name : t("backupSettings.uploadHint")}</span>
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx"
          className="hidden"
          onChange={(e) => handleFileSelected(e.target.files?.[0] ?? null)}
        />

        {error && (
          <p className="flex items-center gap-1.5 text-[12.5px] text-danger">
            <AlertCircle className="h-3.5 w-3.5" />
            {error}
          </p>
        )}

        {preview && step !== "done" && (
          <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface-2 p-3">
            <span className="text-[12px] font-semibold text-muted uppercase">
              {t("backupSettings.previewTitle")}
            </span>
            <ul className="flex flex-col gap-1 text-[12.5px] text-foreground">
              {preview.map((entry) => (
                <li key={entry.table} className="flex justify-between gap-3">
                  <span className="truncate font-mono text-muted">{entry.table}</span>
                  <span>{entry.count}</span>
                </li>
              ))}
            </ul>
            <button
              onClick={handleConfirmRestore}
              disabled={step === "restoring"}
              className="btn-danger mt-1 w-fit"
            >
              {step === "restoring" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {t("backupSettings.confirmRestoreButton")}
            </button>
          </div>
        )}

        {step === "done" && (
          <div className="flex items-center gap-2">
            <p className="text-[12.5px] text-success">{t("backupSettings.restoreDone")}</p>
            <button onClick={() => window.location.reload()} className="btn-secondary">
              {t("backupSettings.reloadButton")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
