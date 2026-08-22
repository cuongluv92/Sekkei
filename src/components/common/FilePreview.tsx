"use client";

import { FileQuestion, FileText, Image as ImageIcon, Layers } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { openFileAsset } from "@/lib/utils/fileDownload";
import type { FileAsset } from "@/lib/types";

interface FilePreviewProps {
  /** Unique key identifying the selected record, or null when nothing is selected. */
  selectedKey: string | null;
  title?: string;
  files: FileAsset[];
}

function FileKindIcon({ kind }: { kind: FileAsset["kind"] }) {
  if (kind === "dwg") return <Layers className="h-3.5 w-3.5 shrink-0 text-muted" />;
  if (kind === "image") return <ImageIcon className="h-3.5 w-3.5 shrink-0 text-muted" />;
  return <FileText className="h-3.5 w-3.5 shrink-0 text-muted" />;
}

/**
 * Shows the real attached files (Supabase Storage) for the selected record.
 * Images/PDFs render inline via their real previewUrl; DWG has no in-browser
 * renderer (a real DWG viewer would need a conversion service this app
 * doesn't have) so it stays download-only, honestly labeled as such — never
 * a fake "loading" delay pretending to render something it can't.
 */
export function FilePreview({ selectedKey, title, files }: FilePreviewProps) {
  const { t } = useTranslation();
  const previewable = files.find((f) => (f.kind === "image" || f.kind === "pdf") && f.previewUrl);

  return (
    <div className="panel flex h-full min-h-[280px] flex-col">
      <div className="panel-header">
        <span className="panel-title">{t("search.previewTitle")}</span>
        {title && <span className="truncate text-[12px] text-muted">{title}</span>}
      </div>
      <div className="flex flex-1 flex-col">
        {!selectedKey ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 p-4 text-center text-muted-2">
            <FileQuestion className="h-8 w-8" />
            <p className="text-[12px]">{t("search.previewEmpty")}</p>
          </div>
        ) : files.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 p-4 text-center text-muted-2">
            <FileQuestion className="h-8 w-8" />
            <p className="text-[12px]">{t("search.previewNoFile")}</p>
          </div>
        ) : (
          <div className="flex flex-1 flex-col gap-3 p-3">
            {previewable ? (
              previewable.kind === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element -- real Storage URL, not a static asset next/image can optimize
                <img
                  src={previewable.previewUrl}
                  alt={previewable.fileName}
                  className="max-h-56 w-full rounded-md border border-border object-contain"
                />
              ) : (
                <iframe
                  src={previewable.previewUrl}
                  title={previewable.fileName}
                  className="h-56 w-full rounded-md border border-border bg-white"
                />
              )
            ) : (
              <p className="text-center text-[12px] text-muted">{t("search.dwgNotice")}</p>
            )}
            <ul className="w-full divide-y divide-border rounded-md border border-border">
              {files.map((f) => (
                <li key={f.id} className="flex items-center justify-between gap-2 px-2.5 py-1.5">
                  <span className="flex min-w-0 items-center gap-1.5 truncate text-[12px] text-foreground">
                    <FileKindIcon kind={f.kind} />
                    <span className="truncate">{f.fileName}</span>
                  </span>
                  <button onClick={() => openFileAsset(f)} className="btn-ghost btn-icon shrink-0">
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
