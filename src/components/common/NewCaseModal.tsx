"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
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

const currentYear = new Date().getFullYear();

interface NewCaseModalProps {
  onClose: () => void;
  onCreated: (createdCase: DesignCase) => void;
  /**
   * True only for 設計依頼's own 新規案件 flow (設計管理) — shows the live
   * auto-numbering preview and lets the server derive 図面番号 from
   * year+sequence. Every other entry point (the shared CaseSelector used
   * from 部品製作, 計算 modules, ...) defaults to false: 図面番号 becomes a
   * plain required text field the user fills in themselves, since only
   * 設計依頼 is allowed to auto-assign a new number (spec: e.g. 26-003
   * existing must never silently offer 26-004 outside that flow).
   */
  autoNumberDrawingNumber?: boolean;
}

/**
 * ＋新規案件 — the one shared 案件 creation flow used everywhere a 案件 can be
 * created (the shared CaseSelector, 設計管理). 案件 is the root record for the
 * whole app, so creating one here needs no Project to attach it to.
 */
export function NewCaseModal({
  onClose,
  onCreated,
  autoNumberDrawingNumber = false,
}: NewCaseModalProps) {
  const { t } = useTranslation();

  const [year, setYear] = useState(currentYear);
  const [drawingNumberPreview, setDrawingNumberPreview] = useState("");
  const [drawingNumberManual, setDrawingNumberManual] = useState("");
  const [managementNumber, setManagementNumber] = useState("");
  const [constructionNumber, setConstructionNumber] = useState("");
  const [orderer, setOrderer] = useState("");
  const [customerContact, setCustomerContact] = useState("");
  const [projectName, setProjectName] = useState("");
  const [indexCategory, setIndexCategory] = useState<IndexCategory>("other");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!autoNumberDrawingNumber) return;
    designCaseService
      .previewNextDrawingNumber(year)
      .then(setDrawingNumberPreview);
  }, [year, autoNumberDrawingNumber]);

  const canSubmit =
    projectName.trim() !== "" &&
    (autoNumberDrawingNumber || drawingNumberManual.trim() !== "");

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    const created = await designCaseService.create({
      year,
      requestType: "", // 新規作成時点では常に空 — 設計依頼書タブで後から編集可能
      managementNumber,
      constructionNumber,
      orderer,
      customerContact,
      projectName,
      indexCategory,
      drawingNumber: autoNumberDrawingNumber
        ? undefined
        : drawingNumberManual.trim(),
    });
    setSubmitting(false);
    onCreated(created);
  }

  return (
    <Modal
      title={t("caseSelector.newCaseModalTitle")}
      onClose={onClose}
      widthClassName="max-w-2xl"
    >
      <div className="flex flex-col gap-3.5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="field-label">{t("design.fields.year")}</label>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(Number(e.target.value) || currentYear)}
              className="field-input"
            />
          </div>
          <div>
            {autoNumberDrawingNumber ? (
              <>
                <label className="field-label">
                  {t("design.newCaseForm.drawingNumberPreview")}
                </label>
                <div className="field-input flex items-center bg-surface-2 font-mono text-muted">
                  {drawingNumberPreview || "—"}
                </div>
              </>
            ) : (
              <>
                <label className="field-label">
                  {t("design.newCaseForm.drawingNumberManualLabel")}
                </label>
                <input
                  value={drawingNumberManual}
                  onChange={(e) => setDrawingNumberManual(e.target.value)}
                  placeholder="26-004"
                  className="field-input font-mono"
                />
              </>
            )}
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
          <div className="sm:col-span-2 lg:col-span-3">
            <label htmlFor="new-case-project-name" className="field-label">
              {t("design.fields.projectName")}
            </label>
            <input
              id="new-case-project-name"
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
            disabled={!canSubmit || submitting}
            className="btn-primary"
          >
            {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {t("design.newCaseForm.submitButton")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
