"use client";

import { Loader2, Pencil, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { designCaseService } from "@/lib/services/design";
import { calculationRecordService, partAssemblyService } from "@/lib/services";
import {
  buildCaseOptionLabel,
  buildCaseOptions,
  type CaseOption,
} from "@/lib/utils/caseSearch";
import { Modal } from "@/components/common/Modal";
import { EditCaseModal } from "@/components/common/EditCaseModal";
import type { DesignCase } from "@/lib/types/design";

interface SavedCasesListProps {
  /** 開く — resolves this 案件 as the new 現在の案件. */
  onOpen: (caseId: string) => void;
  /** Autofocus the search box on mount — on for the modal usage, off for the inline tab usage (refocusing every tab switch would be intrusive). */
  autoFocusSearch?: boolean;
}

/**
 * The actual 保存済み案件 list — every 案件 app-wide, searchable, with
 * 開く/編集/削除 per row. Extracted out of `SavedCasesModal` so the same
 * browse/reopen/edit UI can also be embedded directly as an inline tab
 * (他計算's 保存済み tab) instead of only being reachable through a modal —
 * a modal-only "✓ 保存済み" badge doesn't give the user anywhere to actually
 * go back and review or edit a past 案件's calculations.
 */
export function SavedCasesList({
  onOpen,
  autoFocusSearch = false,
}: SavedCasesListProps) {
  const { t } = useTranslation();
  const [options, setOptions] = useState<CaseOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<DesignCase | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{
    caseId: string;
    label: string;
    partCount: number;
    calcCount: number;
  } | null>(null);
  const [checkingImpact, setCheckingImpact] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  function reload() {
    setLoading(true);
    designCaseService.listAll().then((all) => {
      setOptions(buildCaseOptions(all));
      setLoading(false);
    });
  }

  useEffect(reload, []);

  const filtered = query.trim()
    ? options.filter((o) =>
        buildCaseOptionLabel(o)
          .toLowerCase()
          .includes(query.trim().toLowerCase()),
      )
    : options;

  async function handleDeleteClick(option: CaseOption) {
    setCheckingImpact(option.caseId);
    const [parts, calcs] = await Promise.all([
      partAssemblyService.listByCase(option.caseId),
      calculationRecordService.listByCase(option.caseId),
    ]);
    setCheckingImpact(null);
    setConfirmDelete({
      caseId: option.caseId,
      label: buildCaseOptionLabel(option),
      partCount: parts.length,
      calcCount: calcs.length,
    });
  }

  async function handleConfirmDelete() {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await designCaseService.archive(confirmDelete.caseId);
      setConfirmDelete(null);
      reload();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <input
        autoFocus={autoFocusSearch}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t("caseSelector.searchPlaceholder")}
        className="field-input"
      />
      <div className="max-h-[28rem] overflow-y-auto rounded-md border border-border-strong">
        {loading ? (
          <div className="px-3 py-8 text-center text-[12.5px] text-muted-2">
            {t("common.loading")}
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-3 py-8 text-center text-[12.5px] text-muted-2">
            {t("caseSelector.noCases")}
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((option) => (
              <li
                key={option.caseId}
                className="flex items-center justify-between gap-3 px-3 py-2.5"
              >
                <span className="truncate text-[13px] text-foreground">
                  {buildCaseOptionLabel(option)}
                </span>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    onClick={() => onOpen(option.caseId)}
                    className="btn-secondary !py-1"
                  >
                    {t("caseSelector.openButton")}
                  </button>
                  <button
                    onClick={() => setEditing(option.case)}
                    className="btn-ghost btn-icon !p-1.5"
                    title={t("common.edit")}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteClick(option)}
                    disabled={checkingImpact === option.caseId}
                    className="btn-ghost btn-icon !p-1.5 text-danger hover:bg-danger/10"
                    title={t("common.delete")}
                  >
                    {checkingImpact === option.caseId ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {editing && (
        <EditCaseModal
          designCase={editing}
          onClose={() => setEditing(null)}
          onUpdated={() => {
            setEditing(null);
            reload();
          }}
        />
      )}

      {confirmDelete && (
        <Modal
          title={t("caseSelector.deleteConfirmTitle")}
          onClose={() => setConfirmDelete(null)}
          widthClassName="max-w-md"
        >
          <div className="flex flex-col gap-3.5">
            <p className="text-[13px] text-foreground">{confirmDelete.label}</p>
            {(confirmDelete.partCount > 0 || confirmDelete.calcCount > 0) && (
              <p className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-[12px] text-warning">
                {t("caseSelector.deleteImpactWarning", {
                  partCount: String(confirmDelete.partCount),
                  calcCount: String(confirmDelete.calcCount),
                })}
              </p>
            )}
            <p className="text-[11.5px] text-muted-2">
              {t("caseSelector.deleteArchiveNote")}
            </p>
            <div className="flex items-center justify-end gap-2 border-t border-border pt-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="btn-secondary"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="btn-primary bg-danger hover:bg-danger/90"
              >
                {deleting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {t("common.delete")}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
