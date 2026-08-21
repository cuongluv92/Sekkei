"use client";

import { Loader2 } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { DataTable, type DataTableColumn } from "@/components/common/DataTable";
import { StatusBadge } from "@/components/common/StatusBadge";
import type { ImportRow, ImportRowStatus } from "@/lib/types";

const STATUS_LABEL_KEY: Record<ImportRowStatus, string> = {
  new: "importPage.statusNew",
  existing: "importPage.statusExisting",
  update: "importPage.statusUpdate",
  duplicate: "importPage.statusDuplicate",
  skip: "importPage.statusSkip",
  error: "importPage.statusError",
};

const TARGET_LABEL_KEY = {
  "part-data": "importPage.targets.partData",
  "part-drawing": "importPage.targets.partDrawing",
  catalog: "importPage.targets.catalog",
} as const;

interface ImportPreviewProps {
  rows: ImportRow[];
  onRowsChange: (rows: ImportRow[]) => void;
  onConfirm: () => void;
  confirming?: boolean;
}

/**
 * Every row here is a proposal, not a write — nothing reaches the database
 * until 確定. "更新候補" rows default to `action: "skip"` (never auto-applied);
 * the user must explicitly flip each one to 更新する before confirming,
 * matching "conflict → the user chooses, never guessed".
 */
export function ImportPreview({ rows, onRowsChange, onConfirm, confirming }: ImportPreviewProps) {
  const { t } = useTranslation();

  const counts = rows.reduce(
    (acc, r) => ({ ...acc, [r.status]: acc[r.status] + 1 }),
    { new: 0, existing: 0, update: 0, duplicate: 0, skip: 0, error: 0 } as Record<ImportRowStatus, number>,
  );

  const willImport = rows.filter(
    (r) => r.status === "new" || (r.status === "update" && r.action === "update"),
  ).length;

  function setAction(id: string, action: "update" | "skip") {
    onRowsChange(rows.map((r) => (r.id === id ? { ...r, action } : r)));
  }

  const columns: DataTableColumn<ImportRow>[] = [
    { key: "label", header: t("common.model") },
    { key: "target", header: t("importPage.targetLabel"), render: (r) => t(TARGET_LABEL_KEY[r.targetCategory]) },
    {
      key: "status",
      header: t("common.status"),
      width: "130px",
      render: (r) => <StatusBadge status={r.status} label={t(STATUS_LABEL_KEY[r.status])} />,
    },
    {
      key: "action",
      header: t("importPage.updateActionLabel"),
      width: "140px",
      render: (r) =>
        r.status === "update" ? (
          <select
            value={r.action ?? "skip"}
            onChange={(e) => setAction(r.id, e.target.value as "update" | "skip")}
            className="field-input w-auto py-1"
          >
            <option value="skip">{t("importPage.skipOption")}</option>
            <option value="update">{t("importPage.applyUpdateOption")}</option>
          </select>
        ) : (
          "—"
        ),
    },
    { key: "detail", header: t("common.remarks"), render: (r) => r.detail ?? "" },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status="new" label={`${t("importPage.statusNew")} ${counts.new}`} />
        <StatusBadge status="existing" label={`${t("importPage.statusExisting")} ${counts.existing}`} />
        <StatusBadge status="update" label={`${t("importPage.statusUpdate")} ${counts.update}`} />
        <StatusBadge status="duplicate" label={`${t("importPage.statusDuplicate")} ${counts.duplicate}`} />
        <StatusBadge status="error" label={`${t("importPage.statusError")} ${counts.error}`} />
      </div>
      <p className="text-[12px] text-muted">{t("importPage.dedupeNotice")}</p>
      <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} />
      <div>
        <button onClick={onConfirm} disabled={confirming || willImport === 0} className="btn-primary">
          {confirming && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {t("importPage.confirmButton")}
        </button>
      </div>
    </div>
  );
}
