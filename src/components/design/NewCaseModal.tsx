"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { designCaseService } from "@/lib/services/design";
import { SpecCombobox } from "@/components/design/SpecCombobox";
import { Modal } from "@/components/common/Modal";
import type { DesignCase } from "@/lib/types/design";

const currentYear = new Date().getFullYear();

interface NewCaseModalProps {
  projectId: string;
  onClose: () => void;
  onCreated: (createdCase: DesignCase) => void;
}

/**
 * 新規案件 as a compact modal instead of a dedicated page — triggered from the
 * CaseWorkspaceBar on either 設計依頼書 or 製作依頼書. Same create logic/fields
 * as before (incl. live 図面番号 auto-numbering preview), just relocated.
 */
export function NewCaseModal({ projectId, onClose, onCreated }: NewCaseModalProps) {
  const { t } = useTranslation();

  const [year, setYear] = useState(currentYear);
  const [drawingNumberPreview, setDrawingNumberPreview] = useState("");
  const [requestType, setRequestType] = useState("");
  const [managementNumber, setManagementNumber] = useState("");
  const [constructionNumber, setConstructionNumber] = useState("");
  const [orderer, setOrderer] = useState("");
  const [customerContact, setCustomerContact] = useState("");
  const [projectName, setProjectName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    designCaseService.previewNextDrawingNumber(year).then(setDrawingNumberPreview);
  }, [year]);

  async function handleSubmit() {
    if (!projectName.trim()) return;
    setSubmitting(true);
    const created = await designCaseService.create({
      projectId,
      year,
      requestType,
      managementNumber,
      constructionNumber,
      orderer,
      customerContact,
      projectName,
    });
    setSubmitting(false);
    onCreated(created);
  }

  return (
    <Modal title={t("design.newCaseForm.title")} onClose={onClose} widthClassName="max-w-2xl">
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
            <label className="field-label">{t("design.newCaseForm.drawingNumberPreview")}</label>
            <div className="field-input flex items-center bg-surface-2 font-mono text-muted">
              {drawingNumberPreview || "—"}
            </div>
          </div>
          <div>
            <label className="field-label">{t("design.fields.requestType")}</label>
            <SpecCombobox listKey="requestType" value={requestType} onChange={setRequestType} />
          </div>
          <div>
            <label className="field-label">{t("design.fields.managementNumber")}</label>
            <input
              value={managementNumber}
              onChange={(e) => setManagementNumber(e.target.value)}
              className="field-input"
            />
          </div>
          <div>
            <label className="field-label">{t("design.fields.constructionNumber")}</label>
            <input
              value={constructionNumber}
              onChange={(e) => setConstructionNumber(e.target.value)}
              className="field-input"
            />
          </div>
          <div>
            <label className="field-label">{t("design.fields.orderer")}</label>
            <SpecCombobox listKey="orderer" value={orderer} onChange={setOrderer} />
          </div>
          <div>
            <label className="field-label">{t("design.fields.customerContact")}</label>
            <SpecCombobox
              listKey="customerContact"
              value={customerContact}
              onChange={setCustomerContact}
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <label className="field-label">{t("design.fields.projectName")}</label>
            <input
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="field-input"
            />
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
            {t("design.newCaseForm.submitButton")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
