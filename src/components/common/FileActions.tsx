"use client";

import { Eye, FileText, Layers } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import type { FileAsset } from "@/lib/types";

interface FileActionsProps {
  files: FileAsset[];
  onView: () => void;
  onDownload: (kind: "dwg" | "pdf") => void;
}

/** Renders the 表示 / DWG / PDF action trio used on search results, tables and detail panels. */
export function FileActions({ files, onView, onDownload }: FileActionsProps) {
  const { t } = useTranslation();
  const hasDwg = files.some((f) => f.kind === "dwg");
  const hasPdf = files.some((f) => f.kind === "pdf");

  return (
    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
      <button onClick={onView} className="btn-secondary">
        <Eye className="h-3.5 w-3.5" />
        {t("common.display")}
      </button>
      <button
        onClick={() => onDownload("dwg")}
        disabled={!hasDwg}
        title={hasDwg ? undefined : "DWGファイルなし"}
        className="btn-ghost"
      >
        <Layers className="h-3.5 w-3.5" />
        {t("common.dwg")}
      </button>
      <button
        onClick={() => onDownload("pdf")}
        disabled={!hasPdf}
        title={hasPdf ? undefined : "PDFファイルなし"}
        className="btn-ghost"
      >
        <FileText className="h-3.5 w-3.5" />
        {t("common.pdf")}
      </button>
    </div>
  );
}
