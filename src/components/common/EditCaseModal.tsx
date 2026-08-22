"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { designCaseService } from "@/lib/services/design";
import { SpecCombobox } from "@/components/design/SpecCombobox";
import { Modal } from "@/components/common/Modal";
import {
  INDEX_CATEGORY_VALUES,
  type DesignCase,
  type IndexCategory,
} from "@/lib/types/design";

const INDEX_CATEGORY_LABEL_KEY: Record<IndexCategory, "keio" | "other"> = {
  keio: "keio",
  other: "other",
};

interface EditCaseModalProps {
  designCase: DesignCase;
  onClose: () => void;
  onUpdated: (updated: DesignCase) => void;
}

/**
 * 保存済み案件's 編集 action — edits a 案件's main identifying fields
 * (管理番号/工事番号/注文先/客先担当/件名/担当/目次区分). 図面番号 itself (year +
 * sequence) is immutable after creation, so it's shown read-only, not
 * editable here — the full 設計依頼書 spec-field form stays in 設計管理.
 */
export function EditCaseModal({
  designCase,
  onClose,
  onUpdated,
}: EditCaseModalProps) {
  const { t } = useTranslation();

  const [managementNumber, setManagementNumber] = useState(
    designCase.managementNumber,
  );
  const [constructionNumber, setConstructionNumber] = useState(
    designCase.constructionNumber,
  );
  const [orderer, setOrderer] = useState(designCase.orderer);
  const [customerContact, setCustomerContact] = useState(
    designCase.customerContact,
  );
  const [projectName, setProjectName] = useState(designCase.projectName);
  const [assignee, setAssignee] = useState(designCase.assignee);
  const [indexCategory, setIndexCategory] = useState<IndexCategory>(
    designCase.indexCategory,
  );
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!projectName.trim() || submitting) return;
    setSubmitting(true);
    try {
      const updated = await designCaseService.update(designCase.id, {
        managementNumber,
        constructionNumber,
        orderer,
        customerContact,
        projectName,
        assignee,
        indexCategory,
      });
      onUpdated(updated);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      title={t("caseSelector.editCaseModalTitle")}
      onClose={onClose}
      widthClassName="max-w-2xl"
    >
      <div className="flex flex-col gap-3.5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="field-label">
              {t("design.fields.drawingNumber")}
            </label>
            <div className="field-input flex items-center bg-surface-2 font-mono text-muted">
              {designCase.drawingNumber}
            </div>
          </div>
          <div>
            <label className="field-label">
              {t("design.fields.managementNumber")}
            </label>
            <input
              value={managementNumber}
              onChange={(e) => setManagementNumber(e.target.value)}
              className="field-input"
            />
          </div>
          <div>
            <label className="field-label">
              {t("design.fields.constructionNumber")}
            </label>
            <input
              value={constructionNumber}
              onChange={(e) => setConstructionNumber(e.target.value)}
              className="field-input"
            />
          </div>
          <div>
            <label className="field-label">{t("design.fields.orderer")}</label>
            <SpecCombobox
              listKey="orderer"
              value={orderer}
              onChange={setOrderer}
            />
          </div>
          <div>
            <label className="field-label">
              {t("design.fields.customerContact")}
            </label>
            <SpecCombobox
              listKey="customerContact"
              value={customerContact}
              onChange={setCustomerContact}
            />
          </div>
          <div>
            <label className="field-label">{t("design.fields.assignee")}</label>
            <input
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              className="field-input"
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <label className="field-label">
              {t("design.fields.projectName")}
            </label>
            <input
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="field-input"
            />
          </div>
          <div>
            <label className="field-label">
              {t("design.fields.indexCategory")}
            </label>
            <select
              value={indexCategory}
              onChange={(e) =>
                setIndexCategory(e.target.value as IndexCategory)
              }
              className="field-input"
            >
              {INDEX_CATEGORY_VALUES.map((v) => (
                <option key={v} value={v}>
                  {t(
                    `design.fields.indexCategoryOptions.${INDEX_CATEGORY_LABEL_KEY[v]}`,
                  )}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border pt-3">
          <button onClick={onClose} className="btn-secondary">
            {t("common.cancel")}
          </button>
          <button
            onClick={handleSubmit}
            disabled={!projectName.trim() || submitting}
            className="btn-primary"
          >
            {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {t("common.save")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
