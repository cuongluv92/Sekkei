"use client";

import { FileSpreadsheet, Loader2, Plus, Printer, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import {
  designCaseService,
  exportDesignRequestExcel,
  printDesignRequestForm,
} from "@/lib/services/design";
import { SpecCombobox } from "@/components/design/SpecCombobox";
import { useMockFeedback } from "@/lib/hooks/useMockFeedback";
import {
  CASE_STATUS_VALUES,
  INDEX_CATEGORY_VALUES,
  PANEL_NUMBERS,
  SPEC_GROUPS,
  WIRING_SPEC_FIELDS,
  type CasePanel,
  type CaseStatus,
  type DesignCase,
  type IndexCategory,
  type PanelNo,
  type SpecFieldKey,
  type SpecValues,
} from "@/lib/types/design";

const CASE_STATUS_LABEL_KEY: Record<
  CaseStatus,
  "none" | "designPendingApproval" | "productionRequested"
> = {
  "": "none",
  design_pending_approval: "designPendingApproval",
  production_requested: "productionRequested",
};

const INDEX_CATEGORY_LABEL_KEY: Record<IndexCategory, "keio" | "other"> = {
  keio: "keio",
  other: "other",
};

const SPEC_GROUP_LABEL_KEY: Record<
  string,
  "groupBox" | "groupPaint" | "groupHandle" | "groupOther"
> = {
  box: "groupBox",
  paint: "groupPaint",
  handle: "groupHandle",
  other: "groupOther",
};

function emptyPanel(caseId: string, panelNo: PanelNo): CasePanel {
  return {
    id: `panel-${caseId}-${panelNo}-${Date.now()}`,
    caseId,
    panelNo,
    panelName: "",
    panelStructure: "",
    faceCount: null,
    designDueDate: null,
    designEstimatedHours: null,
    designActualHours: null,
    productionEstimatedHours: null,
    productionActualHours: null,
    electricalMethod: "",
    ratedVoltage: "",
    ratedCurrent: "",
    ratedBreakingCapacity: "",
    frequency: "",
    controlVoltage: "",
    protectionRating: "",
  };
}

/** 項目｜仕様Ⅰ｜仕様Ⅱ｜仕様Ⅲ mini-table shared by every spec group (外形仕様 sub-groups + 結線仕様). */
function SpecFieldTable({
  fields,
  entries,
  onChange,
  minWidth = 420,
}: {
  fields: SpecFieldKey[];
  entries: SpecValues;
  onChange: (
    fieldKey: SpecFieldKey,
    column: "spec1" | "spec2" | "spec3",
    value: string,
  ) => void;
  minWidth?: number;
}) {
  const { t } = useTranslation();
  return (
    <div className="data-table-wrap">
      <table className="data-table" style={{ minWidth }}>
        <thead>
          <tr>
            <th style={{ width: "120px" }} />
            <th>{t("design.specs.spec1")}</th>
            <th>{t("design.specs.spec2")}</th>
            <th>{t("design.specs.spec3")}</th>
          </tr>
        </thead>
        <tbody>
          {fields.map((fieldKey) => {
            const entry = entries[fieldKey] ?? {
              spec1: "",
              spec2: "",
              spec3: "",
            };
            return (
              <tr key={fieldKey}>
                <td className="text-muted">
                  {t(`design.specs.fields.${fieldKey}`)}
                </td>
                {(["spec1", "spec2", "spec3"] as const).map((col) => (
                  <td key={col}>
                    <SpecCombobox
                      listKey={fieldKey}
                      value={entry[col]}
                      onChange={(v) => onChange(fieldKey, col, v)}
                    />
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * 設計依頼書 — the primary data-entry screen for one 案件 (案件 → 盤).
 * Restyled for data density: compact panel padding, small row gaps, and
 * その他/結線仕様 (plus 塗装/ハンドル) placed side by side on desktop instead of
 * stacking every group full-width.
 */
export function DesignRequestForm({ caseId }: { caseId: string }) {
  const { t } = useTranslation();
  const { message, show } = useMockFeedback();

  const [loading, setLoading] = useState(true);
  const [designCase, setDesignCase] = useState<DesignCase | null>(null);
  const [panels, setPanels] = useState<CasePanel[]>([]);
  const [saving, setSaving] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    designCaseService.getDetail(caseId).then((detail) => {
      if (!active || !detail) return;
      setDesignCase(detail.case);
      setPanels(detail.panels);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [caseId]);

  function updateField<K extends keyof DesignCase>(
    key: K,
    value: DesignCase[K],
  ) {
    setDesignCase((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  function updateSpec(
    fieldKey: SpecFieldKey,
    column: "spec1" | "spec2" | "spec3",
    value: string,
  ) {
    setDesignCase((prev) => {
      if (!prev) return prev;
      const current = prev.specs[fieldKey] ?? {
        spec1: "",
        spec2: "",
        spec3: "",
      };
      return {
        ...prev,
        specs: { ...prev.specs, [fieldKey]: { ...current, [column]: value } },
      };
    });
  }

  function updatePanel(id: string, patch: Partial<CasePanel>) {
    setPanels((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    );
  }

  function addPanel() {
    if (!designCase || panels.length >= 7) return;
    const usedNos = new Set(panels.map((p) => p.panelNo));
    const nextNo = PANEL_NUMBERS.find((n) => !usedNos.has(n));
    if (!nextNo) return;
    setPanels((prev) => [...prev, emptyPanel(designCase.id, nextNo)]);
  }

  function removePanel(id: string) {
    setPanels((prev) => prev.filter((p) => p.id !== id));
  }

  async function handleSave() {
    if (!designCase) return;
    setSaving(true);
    await designCaseService.update(designCase.id, designCase);
    await designCaseService.savePanels(designCase.id, panels);
    setSaving(false);
    show(t("design.savedMessage"));
  }

  async function handleExportExcel() {
    setExportError(null);
    setExportingExcel(true);
    try {
      const { fileName } = await exportDesignRequestExcel(caseId);
      show(t("design.exportedMessage", { fileName }));
    } catch {
      setExportError(t("design.exportError"));
    } finally {
      setExportingExcel(false);
    }
  }

  async function handlePrint() {
    setExportError(null);
    setPrinting(true);
    try {
      await printDesignRequestForm(caseId);
    } catch {
      setExportError(t("design.exportError"));
    } finally {
      setPrinting(false);
    }
  }

  if (loading || !designCase) {
    return (
      <p className="p-6 text-center text-[13px] text-muted">
        {t("common.loading")}
      </p>
    );
  }

  const otherGroup = SPEC_GROUPS.find((g) => g.group === "other");
  const boxGroup = SPEC_GROUPS.find((g) => g.group === "box");
  const paintGroup = SPEC_GROUPS.find((g) => g.group === "paint");
  const handleGroup = SPEC_GROUPS.find((g) => g.group === "handle");

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div>
          <h2 className="text-[18px] font-bold tracking-tight text-foreground">
            {designCase.drawingNumber}　{designCase.projectName || ""}
          </h2>
          <p className="text-[13px] text-muted">
            {designCase.managementNumber}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportExcel}
            disabled={exportingExcel}
            className="btn-secondary"
          >
            {exportingExcel ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FileSpreadsheet className="h-3.5 w-3.5" />
            )}
            {t("design.exportExcelButton")}
          </button>
          <button
            onClick={handlePrint}
            disabled={printing}
            className="btn-secondary"
          >
            {printing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Printer className="h-3.5 w-3.5" />
            )}
            {t("design.printButton")}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {t("design.saveButton")}
          </button>
        </div>
      </div>
      {exportError && (
        <p className="text-[12.5px] text-danger">{exportError}</p>
      )}

      <div className="panel">
        <div className="panel-header-compact">
          <span className="panel-title">
            {t("design.topTabs.designRequest")}
          </span>
        </div>
        <div className="panel-body-compact grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
          <div>
            <label className="field-label">{t("design.fields.year")}</label>
            <div className="field-input bg-surface-2 text-muted">
              {designCase.year}
            </div>
          </div>
          <div>
            <label className="field-label">
              {t("design.fields.drawingNumber")}
            </label>
            <div className="field-input bg-surface-2 font-mono text-muted">
              {designCase.drawingNumber}
            </div>
          </div>
          <div>
            <label className="field-label">
              {t("design.fields.requestType")}
            </label>
            <SpecCombobox
              listKey="requestType"
              value={designCase.requestType}
              onChange={(v) => updateField("requestType", v)}
            />
          </div>
          <div>
            <label className="field-label">
              {t("design.fields.managementNumber")}
            </label>
            <input
              value={designCase.managementNumber}
              onChange={(e) => updateField("managementNumber", e.target.value)}
              className="field-input"
            />
          </div>
          <div>
            <label className="field-label">
              {t("design.fields.constructionNumber")}
            </label>
            <input
              value={designCase.constructionNumber}
              onChange={(e) =>
                updateField("constructionNumber", e.target.value)
              }
              className="field-input"
            />
          </div>
          <div>
            <label className="field-label">{t("design.fields.orderer")}</label>
            <SpecCombobox
              listKey="orderer"
              value={designCase.orderer}
              onChange={(v) => updateField("orderer", v)}
            />
          </div>
          <div>
            <label className="field-label">
              {t("design.fields.customerContact")}
            </label>
            <SpecCombobox
              listKey="customerContact"
              value={designCase.customerContact}
              onChange={(v) => updateField("customerContact", v)}
            />
          </div>
          <div className="col-span-2">
            <label className="field-label">
              {t("design.fields.projectName")}
            </label>
            <input
              value={designCase.projectName}
              onChange={(e) => updateField("projectName", e.target.value)}
              className="field-input"
            />
          </div>
          <div>
            <label className="field-label">{t("design.fields.assignee")}</label>
            <SpecCombobox
              listKey="assignee"
              value={designCase.assignee}
              onChange={(v) => updateField("assignee", v)}
            />
          </div>
          <div>
            <label className="field-label">
              {t("design.fields.indexCategory")}
            </label>
            <select
              value={designCase.indexCategory}
              onChange={(e) =>
                updateField("indexCategory", e.target.value as IndexCategory)
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
          <div>
            <label className="field-label">
              {t("design.fields.caseStatus")}
            </label>
            <select
              value={designCase.caseStatus}
              onChange={(e) =>
                updateField("caseStatus", e.target.value as CaseStatus)
              }
              className="field-input"
            >
              {CASE_STATUS_VALUES.map((s) => (
                <option key={s} value={s}>
                  {t(
                    `design.fields.caseStatusOptions.${CASE_STATUS_LABEL_KEY[s]}`,
                  )}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end pb-1.5">
            <label className="flex items-center gap-1.5 text-[13px] text-foreground">
              <input
                type="checkbox"
                checked={designCase.manufacturingComplete}
                onChange={(e) =>
                  updateField("manufacturingComplete", e.target.checked)
                }
                className="h-3.5 w-3.5"
              />
              {t("design.fields.manufacturingComplete")}
            </label>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header-compact">
          <span className="panel-title">{t("design.panels.title")}</span>
          <button
            onClick={addPanel}
            disabled={panels.length >= 7}
            className="btn-ghost"
          >
            <Plus className="h-3.5 w-3.5" />
            {t("design.panels.addPanel")}
          </button>
        </div>
        <div className="data-table-wrap">
          <table className="data-table" style={{ minWidth: 900 }}>
            <thead>
              <tr>
                <th style={{ width: "40px" }}>{t("design.panels.panelNo")}</th>
                <th style={{ width: "160px" }}>
                  {t("design.panels.panelName")}
                </th>
                <th style={{ width: "150px" }}>
                  {t("design.panels.panelStructure")}
                </th>
                <th style={{ width: "70px" }}>
                  {t("design.panels.faceCount")}
                </th>
                <th style={{ width: "140px" }}>
                  {t("design.panels.designDueDate")}
                </th>
                <th style={{ width: "110px" }}>
                  {t("design.panels.designEstimatedHours")}
                </th>
                <th style={{ width: "110px" }}>
                  {t("design.panels.designActualHours")}
                </th>
                <th style={{ width: "40px" }} />
              </tr>
            </thead>
            <tbody>
              {panels.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-muted-2">
                    {t("design.panels.empty")}
                  </td>
                </tr>
              ) : (
                panels
                  .slice()
                  .sort((a, b) => a.panelNo - b.panelNo)
                  .map((panel) => (
                    <tr key={panel.id}>
                      <td className="text-center">{panel.panelNo}</td>
                      <td>
                        <input
                          value={panel.panelName}
                          onChange={(e) =>
                            updatePanel(panel.id, { panelName: e.target.value })
                          }
                          className="field-input py-1.5"
                        />
                      </td>
                      <td>
                        <SpecCombobox
                          listKey="panelStructure"
                          value={panel.panelStructure}
                          onChange={(v) =>
                            updatePanel(panel.id, { panelStructure: v })
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          value={panel.faceCount ?? ""}
                          onChange={(e) =>
                            updatePanel(panel.id, {
                              faceCount:
                                e.target.value === ""
                                  ? null
                                  : Number(e.target.value),
                            })
                          }
                          className="field-input py-1.5"
                        />
                      </td>
                      <td>
                        <input
                          type="date"
                          value={panel.designDueDate ?? ""}
                          onChange={(e) =>
                            updatePanel(panel.id, {
                              designDueDate: e.target.value || null,
                            })
                          }
                          className="field-input py-1.5"
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          value={panel.designEstimatedHours ?? ""}
                          onChange={(e) =>
                            updatePanel(panel.id, {
                              designEstimatedHours:
                                e.target.value === ""
                                  ? null
                                  : Number(e.target.value),
                            })
                          }
                          className="field-input py-1.5"
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          value={panel.designActualHours ?? ""}
                          onChange={(e) =>
                            updatePanel(panel.id, {
                              designActualHours:
                                e.target.value === ""
                                  ? null
                                  : Number(e.target.value),
                            })
                          }
                          className="field-input py-1.5"
                        />
                      </td>
                      <td>
                        <button
                          onClick={() => removePanel(panel.id)}
                          className="btn-ghost btn-icon text-danger hover:bg-danger/10"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header-compact">
          <span className="panel-title">{t("design.specs.exteriorTitle")}</span>
        </div>
        <div className="panel-body-compact flex flex-col gap-3">
          {boxGroup && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[11.5px] font-semibold tracking-wide text-muted uppercase">
                {t(`design.specs.${SPEC_GROUP_LABEL_KEY[boxGroup.group]}`)}
              </span>
              <SpecFieldTable
                fields={boxGroup.fields}
                entries={designCase.specs}
                onChange={updateSpec}
                minWidth={520}
              />
            </div>
          )}
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {paintGroup && (
              <div className="flex flex-col gap-1.5">
                <span className="text-[11.5px] font-semibold tracking-wide text-muted uppercase">
                  {t(`design.specs.${SPEC_GROUP_LABEL_KEY[paintGroup.group]}`)}
                </span>
                <SpecFieldTable
                  fields={paintGroup.fields}
                  entries={designCase.specs}
                  onChange={updateSpec}
                />
              </div>
            )}
            {handleGroup && (
              <div className="flex flex-col gap-1.5">
                <span className="text-[11.5px] font-semibold tracking-wide text-muted uppercase">
                  {t(`design.specs.${SPEC_GROUP_LABEL_KEY[handleGroup.group]}`)}
                </span>
                <SpecFieldTable
                  fields={handleGroup.fields}
                  entries={designCase.specs}
                  onChange={updateSpec}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {otherGroup && (
          <div className="panel">
            <div className="panel-header-compact">
              <span className="panel-title">
                {t("design.specs.groupOther")}
              </span>
            </div>
            <div className="panel-body-compact">
              <SpecFieldTable
                fields={otherGroup.fields}
                entries={designCase.specs}
                onChange={updateSpec}
              />
            </div>
          </div>
        )}
        <div className="panel">
          <div className="panel-header-compact">
            <span className="panel-title">{t("design.specs.wiringTitle")}</span>
          </div>
          <div className="panel-body-compact">
            <SpecFieldTable
              fields={WIRING_SPEC_FIELDS}
              entries={designCase.specs}
              onChange={updateSpec}
            />
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header-compact">
          <span className="panel-title">
            {t("design.fields.designRemarks")}
          </span>
        </div>
        <div className="panel-body-compact">
          <textarea
            value={designCase.designRemarks}
            onChange={(e) => updateField("designRemarks", e.target.value)}
            rows={3}
            className="field-input resize-y"
          />
        </div>
      </div>

      {message && <div className="text-[12.5px] text-success">{message}</div>}
    </div>
  );
}
