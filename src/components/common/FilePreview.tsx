"use client";

import { AlertTriangle, FileQuestion, FileText, Image as ImageIcon, Layers, Loader2, RotateCw } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import type { FileAsset } from "@/lib/types";

type PreviewStatus = "idle" | "loading" | "error" | "ready";

/**
 * Drives the preview lifecycle for a selected record. No real DWG/PDF
 * rendering happens yet — `previewUrl` is never populated by the mock
 * services — so a "ready" result renders a placeholder explaining what will
 * eventually show there (an in-browser PDF viewer, a converted DWG preview)
 * while still exposing the file list and download actions. A record with no
 * attached files surfaces the error state, since there is genuinely nothing
 * to load for it.
 */
function useFilePreviewStatus(selectedKey: string | null, fileCount: number) {
  const [status, setStatus] = useState<PreviewStatus>("idle");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!selectedKey) {
      setStatus("idle");
      return;
    }
    setStatus("loading");
    const timer = setTimeout(() => {
      setStatus(fileCount > 0 ? "ready" : "error");
    }, 450);
    return () => clearTimeout(timer);
  }, [selectedKey, fileCount, attempt]);

  return { status, retry: () => setAttempt((a) => a + 1) };
}

interface FilePreviewProps {
  /** Unique key identifying the selected record, or null when nothing is selected. */
  selectedKey: string | null;
  title?: string;
  files: FileAsset[];
  onDownload: (kind: FileAsset["kind"]) => void;
}

function FileKindIcon({ kind }: { kind: FileAsset["kind"] }) {
  if (kind === "dwg") return <Layers className="h-3.5 w-3.5 shrink-0 text-muted" />;
  if (kind === "image") return <ImageIcon className="h-3.5 w-3.5 shrink-0 text-muted" />;
  return <FileText className="h-3.5 w-3.5 shrink-0 text-muted" />;
}

export function FilePreview({ selectedKey, title, files, onDownload }: FilePreviewProps) {
  const { t } = useTranslation();
  const { status, retry } = useFilePreviewStatus(selectedKey, files.length);

  return (
    <div className="panel flex h-full min-h-[280px] flex-col">
      <div className="panel-header">
        <span className="panel-title">{t("search.previewTitle")}</span>
        {title && <span className="truncate text-[12px] text-muted">{title}</span>}
      </div>
      <div className="flex flex-1 items-center justify-center p-4">
        {status === "idle" && (
          <div className="flex flex-col items-center gap-2 text-center text-muted-2">
            <FileQuestion className="h-8 w-8" />
            <p className="text-[12px]">{t("search.previewEmpty")}</p>
          </div>
        )}
        {status === "loading" && (
          <div className="flex flex-col items-center gap-2 text-center text-muted">
            <Loader2 className="h-6 w-6 animate-spin" />
            <p className="text-[12px]">{t("search.previewLoading")}</p>
          </div>
        )}
        {status === "error" && (
          <div className="flex flex-col items-center gap-2 text-center text-danger">
            <AlertTriangle className="h-7 w-7" />
            <p className="text-[12px]">{t("search.previewError")}</p>
            <button onClick={retry} className="btn-secondary mt-1">
              <RotateCw className="h-3.5 w-3.5" />
              {t("common.back")}
            </button>
          </div>
        )}
        {status === "ready" && (
          <div className="flex w-full flex-col items-center gap-3 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-md border border-border-strong bg-surface-2 text-muted">
              <FileText className="h-6 w-6" />
            </div>
            <p className="max-w-xs text-[12px] text-muted">{t("search.dwgNotice")}</p>
            <ul className="w-full max-w-xs divide-y divide-border rounded-md border border-border">
              {files.map((f) => (
                <li key={f.id} className="flex items-center justify-between gap-2 px-2.5 py-1.5">
                  <span className="flex min-w-0 items-center gap-1.5 truncate text-[12px] text-foreground">
                    <FileKindIcon kind={f.kind} />
                    <span className="truncate">{f.fileName}</span>
                  </span>
                  <button
                    onClick={() => onDownload(f.kind)}
                    className="btn-ghost btn-icon shrink-0"
                  >
                    {t("common.download")}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
