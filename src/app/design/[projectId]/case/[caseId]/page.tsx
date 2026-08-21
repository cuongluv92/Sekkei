"use client";

import { ArrowLeft, Loader2, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { designCaseService } from "@/lib/services/design";
import { SpecCombobox } from "@/components/design/SpecCombobox";
import { PageHeader } from "@/components/common/PageHeader";
import { useMockFeedback } from "@/lib/hooks/useMockFeedback";
import {
  PANEL_NUMBERS,
  SPEC_GROUPS,
  WIRING_SPEC_FIELDS,
  type CasePanel,
  type DesignCase,
  type PanelNo,
  type SpecFieldKey,
} from "@/lib/types/design";

type TabKey = "designRequest" | "productionRequest" | "schedule" | "costLabor" | "history";
const TABS: TabKey[] = ["designRequest", "productionRequest", "schedule", "costLabor", "history"];

const SPEC_GROUP_LABEL_KEY: Record<string, "groupBox" | "groupPaint" | "groupHandle" | "groupOther"> = {
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

export default function CaseDetailPage() {
  const { caseId } = useParams<{ projectId: string; caseId: string }>();
  const { t } = useTranslation();
  const { message, show } = useMockFeedback();

  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>("designRequest");
  const [designCase, setDesignCase] = useState<DesignCase | null>(null);
  const [panels, setPanels] = useState<CasePanel[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
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

  function updateField<K extends keyof DesignCase>(key: K, value: DesignCase[K]) {
    setDesignCase((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  function updateSpec(fieldKey: SpecFieldKey, column: "spec1" | "spec2" | "spec3", value: string) {
    setDesignCase((prev) => {
      if (!prev) return prev;
      const current = prev.specs[fieldKey] ?? { spec1: "", spec2: "", spec3: "" };
      return {
        ...prev,
        specs: { ...prev.specs, [fieldKey]: { ...current, [column]: value } },
      };
    });
  }

  function updatePanel(id: string, patch: Partial<CasePanel>) {
    setPanels((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
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

  if (loading || !designCase) {
    return <p className="text-[12px] text-muted">{t("common.loading")}</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link
          href={`/design/${designCase.projectId}`}
          className="mb-2 inline-flex items-center gap-1.5 text-[12px] text-muted hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {t("design.cases.title")}
        </Link>
        <PageHeader
          title={`${designCase.drawingNumber}　${designCase.projectName || ""}`}
          description={designCase.managementNumber}
          actions={
            <button onClick={handleSave} disabled={saving} className="btn-primary">
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {t("design.saveButton")}
            </button>
          }
        />
      </div>

      <div className="flex flex-wrap gap-1 border-b border-border pb-2">
        {TABS.map((key) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={
              tab === key
                ? "rounded-md border border-accent bg-accent/10 px-3 py-1.5 text-[12.5px] font-semibold text-accent"
                : "rounded-md border border-transparent px-3 py-1.5 text-[12.5px] text-muted hover:bg-surface-2 hover:text-foreground"
            }
          >
            {t(`design.tabs.${key}`)}
          </button>
        ))}
      </div>

      {tab === "designRequest" && (
        <div className="flex flex-col gap-4">
          <div className="panel">
            <div className="panel-header">
              <span className="panel-title">{t("design.tabs.designRequest")}</span>
            </div>
            <div className="panel-body grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="field-label">{t("design.fields.year")}</label>
                <div className="field-input bg-surface-2 text-muted">{designCase.year}</div>
              </div>
              <div>
                <label className="field-label">{t("design.fields.drawingNumber")}</label>
                <div className="field-input bg-surface-2 font-mono text-muted">
                  {designCase.drawingNumber}
                </div>
              </div>
              <div>
                <label className="field-label">{t("design.fields.requestType")}</label>
                <SpecCombobox
                  listKey="requestType"
                  value={designCase.requestType}
                  onChange={(v) => updateField("requestType", v)}
                />
              </div>
              <div>
                <label className="field-label">{t("design.fields.managementNumber")}</label>
                <input
                  value={designCase.managementNumber}
                  onChange={(e) => updateField("managementNumber", e.target.value)}
                  className="field-input"
                />
              </div>
              <div>
                <label className="field-label">{t("design.fields.constructionNumber")}</label>
                <input
                  value={designCase.constructionNumber}
                  onChange={(e) => updateField("constructionNumber", e.target.value)}
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
                <label className="field-label">{t("design.fields.customerContact")}</label>
                <SpecCombobox
                  listKey="customerContact"
                  value={designCase.customerContact}
                  onChange={(v) => updateField("customerContact", v)}
                />
              </div>
              <div className="sm:col-span-2 lg:col-span-2">
                <label className="field-label">{t("design.fields.projectName")}</label>
                <input
                  value={designCase.projectName}
                  onChange={(e) => updateField("projectName", e.target.value)}
                  className="field-input"
                />
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">
              <span className="panel-title">{t("design.panels.title")}</span>
              <button onClick={addPanel} disabled={panels.length >= 7} className="btn-ghost">
                <Plus className="h-3.5 w-3.5" />
                {t("design.panels.addPanel")}
              </button>
            </div>
            <div className="data-table-wrap">
              <table className="data-table" style={{ minWidth: 900 }}>
                <thead>
                  <tr>
                    <th style={{ width: "40px" }}>{t("design.panels.panelNo")}</th>
                    <th style={{ width: "160px" }}>{t("design.panels.panelName")}</th>
                    <th style={{ width: "150px" }}>{t("design.panels.panelStructure")}</th>
                    <th style={{ width: "70px" }}>{t("design.panels.faceCount")}</th>
                    <th style={{ width: "140px" }}>{t("design.panels.designDueDate")}</th>
                    <th style={{ width: "110px" }}>{t("design.panels.designEstimatedHours")}</th>
                    <th style={{ width: "110px" }}>{t("design.panels.designActualHours")}</th>
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
                              onChange={(e) => updatePanel(panel.id, { panelName: e.target.value })}
                              className="field-input py-1"
                            />
                          </td>
                          <td>
                            <SpecCombobox
                              listKey="panelStructure"
                              value={panel.panelStructure}
                              onChange={(v) => updatePanel(panel.id, { panelStructure: v })}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              value={panel.faceCount ?? ""}
                              onChange={(e) =>
                                updatePanel(panel.id, {
                                  faceCount: e.target.value === "" ? null : Number(e.target.value),
                                })
                              }
                              className="field-input py-1"
                            />
                          </td>
                          <td>
                            <input
                              type="date"
                              value={panel.designDueDate ?? ""}
                              onChange={(e) =>
                                updatePanel(panel.id, { designDueDate: e.target.value || null })
                              }
                              className="field-input py-1"
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              value={panel.designEstimatedHours ?? ""}
                              onChange={(e) =>
                                updatePanel(panel.id, {
                                  designEstimatedHours:
                                    e.target.value === "" ? null : Number(e.target.value),
                                })
                              }
                              className="field-input py-1"
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              value={panel.designActualHours ?? ""}
                              onChange={(e) =>
                                updatePanel(panel.id, {
                                  designActualHours:
                                    e.target.value === "" ? null : Number(e.target.value),
                                })
                              }
                              className="field-input py-1"
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
            <div className="panel-header">
              <span className="panel-title">{t("design.specs.exteriorTitle")}</span>
            </div>
            <div className="panel-body flex flex-col gap-4">
              {SPEC_GROUPS.map(({ group, fields }) => (
                <div key={group} className="flex flex-col gap-2">
                  <span className="text-[11px] font-semibold tracking-wide text-muted uppercase">
                    {t(`design.specs.${SPEC_GROUP_LABEL_KEY[group]}`)}
                  </span>
                  <div className="data-table-wrap">
                    <table className="data-table" style={{ minWidth: 560 }}>
                      <thead>
                        <tr>
                          <th style={{ width: "160px" }} />
                          <th>{t("design.specs.spec1")}</th>
                          <th>{t("design.specs.spec2")}</th>
                          <th>{t("design.specs.spec3")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fields.map((fieldKey) => {
                          const entry = designCase.specs[fieldKey] ?? {
                            spec1: "",
                            spec2: "",
                            spec3: "",
                          };
                          return (
                            <tr key={fieldKey}>
                              <td className="text-muted">{t(`design.specs.fields.${fieldKey}`)}</td>
                              {(["spec1", "spec2", "spec3"] as const).map((col) => (
                                <td key={col}>
                                  <SpecCombobox
                                    listKey={fieldKey}
                                    value={entry[col]}
                                    onChange={(v) => updateSpec(fieldKey, col, v)}
                                  />
                                </td>
                              ))}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">
              <span className="panel-title">{t("design.specs.wiringTitle")}</span>
            </div>
            <div className="panel-body">
              <div className="data-table-wrap">
                <table className="data-table" style={{ minWidth: 560 }}>
                  <thead>
                    <tr>
                      <th style={{ width: "160px" }} />
                      <th>{t("design.specs.spec1")}</th>
                      <th>{t("design.specs.spec2")}</th>
                      <th>{t("design.specs.spec3")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {WIRING_SPEC_FIELDS.map((fieldKey) => {
                      const entry = designCase.specs[fieldKey] ?? { spec1: "", spec2: "", spec3: "" };
                      return (
                        <tr key={fieldKey}>
                          <td className="text-muted">{t(`design.specs.fields.${fieldKey}`)}</td>
                          {(["spec1", "spec2", "spec3"] as const).map((col) => (
                            <td key={col}>
                              <SpecCombobox
                                listKey={fieldKey}
                                value={entry[col]}
                                onChange={(v) => updateSpec(fieldKey, col, v)}
                              />
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">
              <span className="panel-title">{t("design.fields.designRemarks")}</span>
            </div>
            <div className="panel-body">
              <textarea
                value={designCase.designRemarks}
                onChange={(e) => updateField("designRemarks", e.target.value)}
                rows={4}
                className="field-input resize-y"
              />
            </div>
          </div>
        </div>
      )}

      {tab !== "designRequest" && (
        <div className="panel">
          <div className="panel-body py-12 text-center text-[12.5px] text-muted">
            {t("design.comingSoon")}
          </div>
        </div>
      )}

      {message && <div className="text-[12px] text-success">{message}</div>}
    </div>
  );
}
