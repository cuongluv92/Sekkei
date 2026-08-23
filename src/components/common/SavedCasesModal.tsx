"use client";

import { useTranslation } from "@/lib/i18n";
import { Modal } from "@/components/common/Modal";
import { SavedCasesList } from "@/components/common/SavedCasesList";

interface SavedCasesModalProps {
  onClose: () => void;
  /** 開く — resolves this 案件 as the new 現在の案件. */
  onOpen: (caseId: string) => void;
}

/**
 * 保存済み案件 modal, reachable from the shared CaseSelector's 保存済み案件
 * button (not a 部品製作-specific list). The actual list/開く/編集/削除 UI
 * lives in `SavedCasesList` — this component only supplies the Modal
 * chrome and closes on 開く. The same list is also embedded directly
 * (without a modal) as 他計算's 保存済み tab, for browsing/reopening past
 * 案件 without going through a popup.
 */
export function SavedCasesModal({ onClose, onOpen }: SavedCasesModalProps) {
  const { t } = useTranslation();
  return (
    <Modal
      title={t("caseSelector.savedCasesTitle")}
      onClose={onClose}
      widthClassName="max-w-3xl"
    >
      <SavedCasesList
        autoFocusSearch
        onOpen={(caseId) => {
          onOpen(caseId);
        }}
      />
    </Modal>
  );
}
