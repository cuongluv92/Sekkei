"use client";

import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { designCaseService } from "@/lib/services/design";
import { SpecCombobox } from "@/components/design/SpecCombobox";
import { PageHeader } from "@/components/common/PageHeader";

const currentYear = new Date().getFullYear();

export default function NewCasePage() {
  const { projectId } = useParams<{ projectId: string }>();
  const router = useRouter();
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
    router.push(`/design/${projectId}/case/${created.id}`);
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link
          href={`/design/${projectId}`}
          className="mb-2 inline-flex items-center gap-1.5 text-[12px] text-muted hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {t("design.cases.title")}
        </Link>
        <PageHeader title={t("design.newCaseForm.title")} />
      </div>

      <div className="panel">
        <div className="panel-body flex flex-col gap-4">
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

          <div className="border-t border-border pt-3">
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
      </div>
    </div>
  );
}
