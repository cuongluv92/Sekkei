"use client";

import { useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { NewCaseModal } from "@/components/common/NewCaseModal";
import { SavedCasesModal } from "@/components/common/SavedCasesModal";
import type { DesignCase } from "@/lib/types/design";

/**
 * Shared "which 案件 should this be saved to" prompt for every module that
 * lets the user work without a 案件 first and only asks at save time (盤重量
 * 計算, 基本重量計算, 換気計算/耐震計算, 部品製作 — the localStorage-draft-until-save
 * pattern). Offers 保存済み案件から選ぶ (SavedCasesModal) or 新規案件を作成
 * (NewCaseModal); either path resolves to `onAttach(caseId)`, which the
 * caller uses to `setCaseId` + persist its in-progress data + clear its
 * local draft — this component only handles the picking UI, never the
 * persistence itself (that's caller-specific).
 */
export function CaseAttachPrompt({
  open,
  onClose,
  onAttach,
  titleKey = "caseSelector.attachPrompt.title",
  messageKey = "caseSelector.attachPrompt.message",
}: {
  open: boolean;
  onClose: () => void;
  onAttach: (caseId: string) => void;
  titleKey?: string;
  messageKey?: string;
}) {
  const { t } = useTranslation();
  const [showNewCaseModal, setShowNewCaseModal] = useState(false);
  const [showSavedCasesModal, setShowSavedCasesModal] = useState(false);

  if (!open && !showNewCaseModal && !showSavedCasesModal) return null;

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={onClose}
        >
          <div
            className="w-full max-w-sm rounded-lg border border-border bg-surface p-4 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-1.5 text-[14px] font-bold text-foreground">{t(titleKey)}</h3>
            <p className="mb-3 text-[12.5px] text-muted">{t(messageKey)}</p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setShowSavedCasesModal(true)}
                className="btn-secondary w-full justify-center"
              >
                {t("caseSelector.savedCasesButton")}
              </button>
              <button
                type="button"
                onClick={() => setShowNewCaseModal(true)}
                className="btn-primary w-full justify-center"
              >
                {t("caseSelector.newCaseButton")}
              </button>
              <button type="button" onClick={onClose} className="btn-ghost w-full justify-center">
                {t("common.cancel")}
              </button>
            </div>
          </div>
        </div>
      )}

      {showNewCaseModal && (
        <NewCaseModal
          onClose={() => setShowNewCaseModal(false)}
          onCreated={(created: DesignCase) => {
            setShowNewCaseModal(false);
            onAttach(created.id);
          }}
        />
      )}
      {showSavedCasesModal && (
        <SavedCasesModal
          onClose={() => setShowSavedCasesModal(false)}
          onOpen={(id) => {
            setShowSavedCasesModal(false);
            onAttach(id);
          }}
        />
      )}
    </>
  );
}
