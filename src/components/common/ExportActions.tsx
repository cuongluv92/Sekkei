"use client";

import { FileSpreadsheet, FileText, Layers, Loader2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { exportService, type ExportFormat } from "@/lib/services";
import { useMockFeedback } from "@/lib/hooks/useMockFeedback";

/** ExportActions only ever triggers generated-file exports, never raw asset downloads. */
type ExportButtonFormat = Exclude<ExportFormat, "image">;

const ICONS: Record<ExportButtonFormat, typeof FileSpreadsheet> = {
  excel: FileSpreadsheet,
  pdf: FileText,
  dwg: Layers,
};

const LABEL_KEYS: Record<ExportButtonFormat, string> = {
  excel: "common.excelExport",
  pdf: "common.pdfExport",
  dwg: "common.dwgExport",
};

interface ExportActionsProps {
  /** Base name used for the (mock) exported file, e.g. "選定結果". */
  context: string;
  formats?: ExportButtonFormat[];
}

/**
 * Excel出力 / PDF出力 (/ DWG出力) button row shared by 選定, 部品製作 and every
 * calculation page. No real file is produced yet — `exportService` resolves
 * with a fake file name after a short delay so the buttons demonstrate real
 * loading/success feedback.
 */
export function ExportActions({ context, formats = ["excel", "pdf"] }: ExportActionsProps) {
  const { t } = useTranslation();
  const { message, show } = useMockFeedback();
  const [pending, setPending] = useState<ExportButtonFormat | null>(null);

  async function handleExport(format: ExportButtonFormat) {
    setPending(format);
    try {
      const { fileName } = await exportService.export(format, context);
      show(`${fileName} を出力しました（モック）`);
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {formats.map((format) => {
        const Icon = ICONS[format];
        const isPending = pending === format;
        return (
          <button
            key={format}
            onClick={() => handleExport(format)}
            disabled={pending !== null}
            className="btn-secondary"
          >
            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}
            {t(LABEL_KEYS[format])}
          </button>
        );
      })}
      {message && <span className="text-[12px] text-success">{message}</span>}
    </div>
  );
}
