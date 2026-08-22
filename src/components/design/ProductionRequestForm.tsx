"use client";

import { FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import {
  designCaseService,
  exportProductionRequestExcel,
  exportProductionRequestPdf,
  productionRequestService,
  scheduleService,
} from "@/lib/services/design";
import { SpecCombobox } from "@/components/design/SpecCombobox";
import { useMockFeedback } from "@/lib/hooks/useMockFeedback";
import type { CasePanel, CaseSchedule, DesignCase, ProductionRequest } from "@/lib/types/design";

type ScheduleDateKey =
  | "boxDeliveryDate"
  | "sheetMetalDeliveryDate"
  | "accessoryDeliveryDate"
  | "productionEndDate"
  | "shippingEndDate"
  | "deliveryDate"
  | "witnessEndDate";
type ScheduleManufacturerKey = "boxManufacturer" | "sheetMetalManufacturer";

/** ＢＯＸ/鈑金/部材/完成/出荷/納品/立会 — same case_schedules end-date fields 工程表 edits, never a separate copy (confirmed). */
const SCHEDULE_DATE_FIELDS: {
  key: ScheduleDateKey;
  manufacturerKey?: ScheduleManufacturerKey;
  labelKey: "box" | "sheetMetal" | "accessory" | "productionEnd" | "shipping" | "delivery" | "witness";
}[] = [
  { key: "boxDeliveryDate", manufacturerKey: "boxManufacturer", labelKey: "box" },
  { key: "sheetMetalDeliveryDate", manufacturerKey: "sheetMetalManufacturer", labelKey: "sheetMetal" },
  { key: "accessoryDeliveryDate", labelKey: "accessory" },
  { key: "productionEndDate", labelKey: "productionEnd" },
  { key: "shippingEndDate", labelKey: "shipping" },
  { key: "deliveryDate", labelKey: "delivery" },
  { key: "witnessEndDate", labelKey: "witness" },
];

const PANEL_ELECTRICAL_FIELDS: {
  key: keyof CasePanel;
  listKey: string;
  labelKey: "electricalMethod" | "ratedVoltage" | "ratedCurrent" | "ratedBreakingCapacity" | "frequency" | "controlVoltage" | "protectionRating";
}[] = [
  { key: "electricalMethod", listKey: "electricalMethod", labelKey: "electricalMethod" },
  { key: "ratedVoltage", listKey: "voltage", labelKey: "ratedVoltage" },
  { key: "ratedCurrent", listKey: "current", labelKey: "ratedCurrent" },
  { key: "ratedBreakingCapacity", listKey: "breakingCapacity", labelKey: "ratedBreakingCapacity" },
  { key: "frequency", listKey: "frequency", labelKey: "frequency" },
  { key: "controlVoltage", listKey: "controlVoltage", labelKey: "controlVoltage" },
  { key: "protectionRating", listKey: "protectionRating", labelKey: "protectionRating" },
];

const CASE_TEXT_FIELDS: (keyof Omit<ProductionRequest, "caseId" | "productionNotes">)[] = [
  "inspectionSheet",
  "filmThickness",
  "earthLeakage",
  "earthLeakageAlarm",
  "withstandVoltage",
];

/**
 * 製作依頼書 for the selected 案件. Shared fields (年/図面番号/管理番号/工事番号/
 * 注文先/客先担当/件名/盤名称/盤構造/面数) are read directly off the same
 * DesignCase/CasePanel records used by 設計依頼書 — never re-entered, never
 * copied into a separate table. Only the 製作依頼-specific columns are
 * editable here and persisted via productionRequestService (case-level) and
 * designCaseService.savePanels (per-panel electrical fields, same panels
 * 設計依頼書 edits).
 */
export function ProductionRequestForm({ caseId }: { caseId: string }) {
  const { t } = useTranslation();
  const { message, show } = useMockFeedback();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [designCase, setDesignCase] = useState<DesignCase | null>(null);
  const [panels, setPanels] = useState<CasePanel[]>([]);
  const [request, setRequest] = useState<ProductionRequest | null>(null);
  const [schedule, setSchedule] = useState<CaseSchedule | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    Promise.all([
      designCaseService.getDetail(caseId),
      productionRequestService.getByCase(caseId),
      scheduleService.getByCase(caseId),
    ])
      .then(([detail, req, sched]) => {
        if (!active) return;
        if (!detail) {
          setError(t("common.error"));
          setLoading(false);
          return;
        }
        setDesignCase(detail.case);
        setPanels(detail.panels);
        setRequest(req);
        setSchedule(sched);
        setLoading(false);
      })
      .catch(() => {
        if (active) {
          setError(t("common.error"));
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [caseId, t]);

  function updatePanel(id: string, patch: Partial<CasePanel>) {
    setPanels((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  function updateRequest<K extends keyof ProductionRequest>(key: K, value: ProductionRequest[K]) {
    setRequest((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  function updateSchedule<K extends keyof CaseSchedule>(key: K, value: CaseSchedule[K]) {
    setSchedule((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function handleSave() {
    if (!designCase || !request || !schedule || panels.length === 0) {
      setSaveError(t("design.panels.empty"));
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      await designCaseService.savePanels(designCase.id, panels);
      await productionRequestService.save(request);
      await scheduleService.save(schedule);
      show(t("design.savedMessage"));
    } catch {
      setSaveError(t("common.error"));
    } finally {
      setSaving(false);
    }
  }

  async function handleExportExcel() {
    setExportError(null);
    setExportingExcel(true);
    try {
      const { fileName } = await exportProductionRequestExcel(caseId);
      show(t("design.exportedMessage", { fileName }));
    } catch {
      setExportError(t("design.exportError"));
    } finally {
      setExportingExcel(false);
    }
  }

  async function handleExportPdf() {
    setExportError(null);
    setExportingPdf(true);
    try {
      const { fileName } = await exportProductionRequestPdf(caseId);
      show(t("design.exportedMessage", { fileName }));
    } catch {
      setExportError(t("design.exportError"));
    } finally {
      setExportingPdf(false);
    }
  }

  if (loading) {
    return <p className="p-6 text-center text-[13px] text-muted">{t("common.loading")}</p>;
  }
  if (error || !designCase || !request || !schedule) {
    return <p className="p-6 text-center text-[13px] text-danger">{error ?? t("common.error")}</p>;
  }

  const sortedPanels = panels.slice().sort((a, b) => a.panelNo - b.panelNo);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div>
          <h2 className="text-[18px] font-bold tracking-tight text-foreground">
            {designCase.drawingNumber}　{designCase.projectName || ""}
          </h2>
          <p className="text-[13px] text-muted">{designCase.managementNumber}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExportExcel} disabled={exportingExcel} className="btn-secondary">
            {exportingExcel ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FileSpreadsheet className="h-3.5 w-3.5" />
            )}
            {t("design.exportExcelButton")}
          </button>
          <button onClick={handleExportPdf} disabled={exportingPdf} className="btn-secondary">
            {exportingPdf ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
            {t("design.exportPdfButton")}
          </button>
          <button onClick={handleSave} disabled={saving} className="btn-primary">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {t("design.saveButton")}
          </button>
        </div>
      </div>
      {exportError && <p className="text-[12.5px] text-danger">{exportError}</p>}

      {saveError && <p className="text-[12.5px] text-danger">{saveError}</p>}

      <div className="panel">
        <div className="panel-header-compact">
          <span className="panel-title">{t("design.production.sharedInfoTitle")}</span>
        </div>
        <div className="panel-body-compact flex flex-col gap-2.5">
          <p className="text-[12px] text-muted-2">{t("design.production.sharedInfoHint")}</p>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
            <div>
              <label className="field-label">{t("design.fields.year")}</label>
              <div className="field-input bg-surface-2 text-muted">{designCase.year}</div>
            </div>
            <div>
              <label className="field-label">{t("design.fields.drawingNumber")}</label>
              <div className="field-input bg-surface-2 font-mono text-muted">{designCase.drawingNumber}</div>
            </div>
            <div>
              <label className="field-label">{t("design.fields.managementNumber")}</label>
              <div className="field-input bg-surface-2 text-muted">{designCase.managementNumber}</div>
            </div>
            <div>
              <label className="field-label">{t("design.fields.constructionNumber")}</label>
              <div className="field-input bg-surface-2 text-muted">{designCase.constructionNumber}</div>
            </div>
            <div>
              <label className="field-label">{t("design.fields.orderer")}</label>
              <div className="field-input bg-surface-2 text-muted">{designCase.orderer}</div>
            </div>
            <div>
              <label className="field-label">{t("design.fields.customerContact")}</label>
              <div className="field-input bg-surface-2 text-muted">{designCase.customerContact}</div>
            </div>
            <div className="col-span-2">
              <label className="field-label">{t("design.fields.projectName")}</label>
              <div className="field-input bg-surface-2 text-muted">{designCase.projectName}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header-compact">
          <span className="panel-title">{t("design.production.panelsTitle")}</span>
        </div>
        <div className="data-table-wrap">
          <table className="data-table" style={{ minWidth: 1180 }}>
            <thead>
              <tr>
                <th style={{ width: "36px" }}>{t("design.panels.panelNo")}</th>
                <th style={{ width: "130px" }}>{t("design.panels.panelName")}</th>
                <th style={{ width: "110px" }}>{t("design.panels.panelStructure")}</th>
                <th style={{ width: "60px" }}>{t("design.panels.faceCount")}</th>
                {PANEL_ELECTRICAL_FIELDS.map((f) => (
                  <th key={f.key} style={{ width: "120px" }}>
                    {t(`design.production.panelColumns.${f.labelKey}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedPanels.map((panel) => (
                <tr key={panel.id}>
                  <td className="text-center">{panel.panelNo}</td>
                  <td className="text-muted">{panel.panelName || "—"}</td>
                  <td className="text-muted">{panel.panelStructure || "—"}</td>
                  <td className="text-muted">{panel.faceCount ?? "—"}</td>
                  {PANEL_ELECTRICAL_FIELDS.map((f) => (
                    <td key={f.key}>
                      <SpecCombobox
                        listKey={f.listKey}
                        value={(panel[f.key] as string) ?? ""}
                        onChange={(v) => updatePanel(panel.id, { [f.key]: v } as Partial<CasePanel>)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header-compact">
          <span className="panel-title">{t("design.production.scheduleTitle")}</span>
        </div>
        <div className="panel-body-compact">
          <p className="mb-2.5 text-[12px] text-muted-2">{t("design.production.scheduleHint")}</p>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-7">
            {SCHEDULE_DATE_FIELDS.map((f) => (
              <div key={f.key} className="flex flex-col gap-1.5">
                <label className="field-label">{t(`design.production.scheduleColumns.${f.labelKey}`)}</label>
                {f.manufacturerKey && (
                  <input
                    value={schedule[f.manufacturerKey]}
                    onChange={(e) => updateSchedule(f.manufacturerKey as ScheduleManufacturerKey, e.target.value)}
                    placeholder={t("design.production.manufacturerPlaceholder")}
                    className="field-input py-1.5"
                  />
                )}
                <input
                  type="date"
                  value={schedule[f.key] ?? ""}
                  onChange={(e) => updateSchedule(f.key, e.target.value || null)}
                  className="field-input py-1.5"
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header-compact">
          <span className="panel-title">{t("design.production.caseFieldsTitle")}</span>
        </div>
        <div className="panel-body-compact flex flex-col gap-2.5">
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
            {CASE_TEXT_FIELDS.map((key) => (
              <div key={key}>
                <label className="field-label">{t(`design.production.fields.${key}`)}</label>
                <input
                  value={request[key]}
                  onChange={(e) => updateRequest(key, e.target.value)}
                  className="field-input"
                />
              </div>
            ))}
          </div>
          <div>
            <label className="field-label">{t("design.production.fields.productionNotes")}</label>
            <textarea
              value={request.productionNotes}
              onChange={(e) => updateRequest("productionNotes", e.target.value)}
              rows={3}
              className="field-input resize-y"
            />
          </div>
        </div>
      </div>

      {message && <div className="text-[12.5px] text-success">{message}</div>}
    </div>
  );
}
