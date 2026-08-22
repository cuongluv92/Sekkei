"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { projectService } from "@/lib/services/design";
import { Modal } from "@/components/common/Modal";
import type { Project } from "@/lib/types/design";

interface NewProjectModalProps {
  onClose: () => void;
  onCreated: (project: Project) => void;
}

/**
 * The entire 新規Project flow — `Project` only stores a name, so this modal
 * is deliberately just that one field, shared by every module (設計管理,
 * 部品製作, all calculation modules) instead of each rolling its own inline
 * "+Project追加" input. Creates into the same `projects` table 設計管理 uses,
 * so the result is immediately visible everywhere else too.
 */
export function NewProjectModal({ onClose, onCreated }: NewProjectModalProps) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    const trimmed = name.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    try {
      const created = await projectService.create(trimmed);
      onCreated(created);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      title={t("design.workspaceBar.newProjectModalTitle")}
      onClose={onClose}
      widthClassName="max-w-md"
    >
      <div className="flex flex-col gap-3.5">
        <div>
          <label className="field-label">
            {t("design.workspaceBar.projectNamePlaceholder")}
          </label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSubmit();
            }}
            placeholder={t("design.workspaceBar.projectNamePlaceholder")}
            className="field-input"
          />
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border pt-3">
          <button onClick={onClose} className="btn-secondary">
            {t("common.cancel")}
          </button>
          <button
            onClick={handleSubmit}
            disabled={!name.trim() || submitting}
            className="btn-primary"
          >
            {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {t("design.workspaceBar.createButton")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
