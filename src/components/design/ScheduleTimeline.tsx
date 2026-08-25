"use client";

import { FileSpreadsheet, Loader2, Printer } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import {
  designCaseService,
  exportScheduleExcel,
  printSchedule,
  scheduleColorService,
  scheduleService,
} from "@/lib/services/design";
import { buildCaseDisplayLabel, buildProjectPanelLines } from "@/lib/utils/designNumbering";
import { DateInput } from "@/components/common/DateInput";
import {
  addMonths,
  buildJunColorLookupByRow,
  computeColoredSegments,
  JUN_BUCKETS,
  junCellKeyRow,
  PROCESS_ROWS,
} from "@/lib/utils/scheduleColoring";
import { applyCascade, applyCreationDefaults } from "@/lib/utils/schedule";
import { useMockFeedback } from "@/lib/hooks/useMockFeedback";
import type {
  CaseSchedule,
  DesignCaseWithPanels,
  ScheduleColorConfig,
} from "@/lib/types/design";

const MILESTONE_FIELDS: {
  key: keyof CaseSchedule;
  labelKey: string;
  quickJun: "start" | "end";
}[] = [
  { key: "sheetMetalOrderDate", labelKey: "sheetMetalOrder", quickJun: "start" },
  { key: "sheetMetalDeliveryDate", labelKey: "sheetMetalDelivery", quickJun: "end" },
  { key: "boxOrderDate", labelKey: "boxOrder", quickJun: "start" },
  { key: "boxDeliveryDate", labelKey: "boxDelivery", quickJun: "end" },
  { key: "accessoryOrderDate", labelKey: "accessoryOrder", quickJun: "start" },
  { key: "accessoryDeliveryDate", labelKey: "accessoryDelivery", quickJun: "end" },
  { key: "productionStartDate", labelKey: "productionStart", quickJun: "start" },
  { key: "productionEndDate", labelKey: "productionEnd", quickJun: "end" },
  { key: "inspectionStartDate", labelKey: "inspectionStart", quickJun: "start" },
  { key: "inspectionEndDate", labelKey: "inspectionEnd", quickJun: "end" },
  { key: "witnessStartDate", labelKey: "witnessStart", quickJun: "start" },
  { key: "witnessEndDate", labelKey: "witnessEnd", quickJun: "end" },
  { key: "shippingStartDate", labelKey: "shippingStart", quickJun: "start" },
  { key: "shippingEndDate", labelKey: "shippingEnd", quickJun: "end" },
  { key: "deliveryDate", labelKey: "delivery", quickJun: "end" },
];

// "box"(BOX納入) は実テンプレートの凡例上「鈑金・BOX納入」の1色見本に含まれる
// ため、凡例には独立した見本を出さない (色設定自体はsheetMetal/box別々のまま — 表示だけ統合)。
const CATEGORY_KEYS: ScheduleColorConfig["category"][] = [
  "sheetMetal",
  "accessory",
  "production",
  "inspection",
  "witness",
  "shipping",
];

// 実テンプレート(⑤工程表 Excel)は「作成月の3ヶ月前」から始まり13ヶ月分
// (3ヶ月前+当月+9ヶ月後) しか列を持たない — A3用紙に収まる範囲。画面表示
// もこの範囲に合わせる (それより広い範囲を見せても実際は出力できない)。
const MONTHS_BEFORE = 3;
const MONTHS_AFTER = 9;
const SEGMENT_WIDTH = 40;
const DRAWING_COL_WIDTH = 130;
const LABEL_COL_WIDTH = 200;

/**
 * 工程表 — full system-wide timeline (not scoped to any one 案件, matching
 * 図面管理台帳/目次/原価工数). Dates are the only stored data; every colored
 * cell is recomputed on render via scheduleColoring utils, so re-uploading a
 * template and changing 工程色設定 changes colors without touching a single
 * date record.
 */
export function ScheduleTimeline() {
  const { t } = useTranslation();
  const { message, show } = useMockFeedback();
  const [exportingExcel, setExportingExcel] = useState(false);
  const [printing, setPrinting] = useState(false);
  const now = new Date();
  const [focus, setFocus] = useState({
    year: now.getFullYear(),
    month: now.getMonth() + 1,
  });
  const [cases, setCases] = useState<DesignCaseWithPanels[]>([]);
  const [schedules, setSchedules] = useState<Record<string, CaseSchedule>>({});
  const [colors, setColors] = useState<ScheduleColorConfig[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedCaseId, setSelectedCaseId] = useState("");
  const [editingSchedule, setEditingSchedule] = useState<CaseSchedule | null>(
    null,
  );
  const [editLoading, setEditLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    async function loadAll() {
      setLoading(true);
      const [caseList, colorList, scheduleList] = await Promise.all([
        designCaseService.listAll(),
        scheduleColorService.list(),
        scheduleService.listAll(),
      ]);
      if (!active) return;
      setCases(caseList);
      setColors(colorList);
      const map: Record<string, CaseSchedule> = {};
      for (const s of scheduleList) map[s.caseId] = s;
      setSchedules(map);
      setLoading(false);
    }
    loadAll();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedCaseId) {
      setEditingSchedule(null);
      return;
    }
    let active = true;
    setEditLoading(true);
    scheduleService.getByCase(selectedCaseId).then((s) => {
      if (active) {
        const createdAt = cases.find((x) => x.case.id === selectedCaseId)?.case.createdAt;
        setEditingSchedule(applyCreationDefaults(s, createdAt));
        setEditLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [selectedCaseId, cases]);

  const months = useMemo(() => {
    const list: { year: number; month: number }[] = [];
    for (let i = -MONTHS_BEFORE; i <= MONTHS_AFTER; i++) {
      list.push(addMonths(focus.year, focus.month, i));
    }
    return list;
  }, [focus]);

  useEffect(() => {
    if (loading) return;
    const target = addMonths(focus.year, focus.month, -3);
    const index = months.findIndex(
      (m) => m.year === target.year && m.month === target.month,
    );
    if (index >= 0 && scrollContainerRef.current) {
      scrollContainerRef.current.scrollLeft =
        index * SEGMENT_WIDTH * JUN_BUCKETS.length;
    }
  }, [focus, loading, months]);

  function goToCurrentMonth() {
    const n = new Date();
    setFocus({ year: n.getFullYear(), month: n.getMonth() + 1 });
  }

  function updateEditingField(key: keyof CaseSchedule, value: string) {
    setEditingSchedule((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, [key]: value || null };
      return value ? applyCascade(updated, key) : updated;
    });
  }

  async function handleSaveSchedule() {
    if (!editingSchedule) return;
    setSaving(true);
    setSaveError(null);
    try {
      const saved = await scheduleService.save(editingSchedule);
      setSchedules((prev) => ({ ...prev, [saved.caseId]: saved }));
      setSavedMessage(t("design.savedMessage"));
      setTimeout(() => setSavedMessage(null), 2500);
    } catch {
      setSaveError(t("common.error"));
    } finally {
      setSaving(false);
    }
  }

  const colorByCategory = useMemo(
    () => new Map(colors.map((c) => [c.category, c.color])),
    [colors],
  );

  // 工程表は「製作依頼済み」の案件のみを対象とする（設計依頼段階のものは
  // まだ工程が確定していない）。製造完了になった案件は工程管理の対象外に
  // なるため自動的に一覧から外れる。表示順は出荷（納品）日の早い順 — 未入力
  // (null) は常に最後に回す。
  const visibleCases = useMemo(() => {
    return cases
      .filter(({ case: c }) => c.caseStatus === "production_requested" && !c.manufacturingComplete)
      .slice()
      .sort((a, b) => {
        const da = schedules[a.case.id]?.deliveryDate;
        const db = schedules[b.case.id]?.deliveryDate;
        if (!da && !db) return 0;
        if (!da) return 1;
        if (!db) return -1;
        return da.localeCompare(db);
      });
  }, [cases, schedules]);

  async function handleExportExcel() {
    setExportingExcel(true);
    try {
      const { fileName } = await exportScheduleExcel(visibleCases, schedules);
      show(t("design.exportedMessage", { fileName }));
    } catch {
      show(t("design.exportError"));
    } finally {
      setExportingExcel(false);
    }
  }

  async function handlePrint() {
    setPrinting(true);
    try {
      await printSchedule(visibleCases, schedules);
    } catch {
      show(t("design.exportError"));
    } finally {
      setPrinting(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="panel">
        <div className="panel-header-compact">
          <span className="panel-title">
            {t("design.schedule.milestonesTitle")}
          </span>
        </div>
        <div className="panel-body-compact flex flex-col gap-2.5">
          <div className="max-w-sm">
            <label className="field-label">
              {t("design.workspaceBar.caseLabel")}
            </label>
            <select
              value={selectedCaseId}
              onChange={(e) => setSelectedCaseId(e.target.value)}
              className="field-input"
            >
              <option value="">
                {t("design.workspaceBar.casePlaceholder")}
              </option>
              {visibleCases.map(({ case: c, panels }) => (
                <option key={c.id} value={c.id}>
                  {buildCaseDisplayLabel(c, panels)}
                </option>
              ))}
            </select>
          </div>

          {selectedCaseId &&
            (editLoading || !editingSchedule ? (
              <p className="text-[12.5px] text-muted">{t("common.loading")}</p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
                  {MILESTONE_FIELDS.map(({ key, labelKey, quickJun }) => (
                    <div key={key}>
                      <label className="field-label">
                        {t(`design.schedule.milestones.${labelKey}`)}
                      </label>
                      <DateInput
                        value={editingSchedule[key] as string | null}
                        onChange={(v) => updateEditingField(key, v ?? "")}
                        className="field-input"
                        quickJun={quickJun}
                      />
                    </div>
                  ))}
                </div>
                {saveError && (
                  <p className="text-[12.5px] text-danger">{saveError}</p>
                )}
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSaveSchedule}
                    disabled={saving}
                    className="btn-primary"
                  >
                    {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    {t("design.saveButton")}
                  </button>
                  {savedMessage && (
                    <span className="text-[12.5px] text-success">
                      {savedMessage}
                    </span>
                  )}
                </div>
              </>
            ))}
        </div>
      </div>

      <div className="panel">
        <div className="panel-header-compact flex-wrap gap-2">
          <span className="panel-title">
            {t("design.schedule.timelineTitle")}
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            <select
              value={focus.year}
              onChange={(e) =>
                setFocus((f) => ({ ...f, year: Number(e.target.value) }))
              }
              className="field-input w-auto py-1.5"
            >
              {Array.from(
                { length: 7 },
                (_, i) => now.getFullYear() - 3 + i,
              ).map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <select
              value={focus.month}
              onChange={(e) =>
                setFocus((f) => ({ ...f, month: Number(e.target.value) }))
              }
              className="field-input w-auto py-1.5"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <button onClick={goToCurrentMonth} className="btn-secondary">
              {t("design.schedule.goToCurrentMonth")}
            </button>
            <button
              onClick={handleExportExcel}
              disabled={exportingExcel}
              className="btn-ghost"
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
              className="btn-ghost"
            >
              {printing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Printer className="h-3.5 w-3.5" />
              )}
              {t("design.printButton")}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-b border-border px-3.5 py-2">
          <span className="text-[11px] font-semibold tracking-wide text-muted uppercase">
            {t("design.schedule.legendTitle")}
          </span>
          {CATEGORY_KEYS.map((cat) => (
            <span
              key={cat}
              className="flex items-center gap-1.5 text-[12px] text-muted"
            >
              <span
                className="h-3 w-3 rounded-sm border border-border-strong"
                style={{
                  backgroundColor: colorByCategory.get(cat) ?? "transparent",
                }}
              />
              {t(`design.schedule.categories.${cat}`)}
            </span>
          ))}
        </div>

        {loading ? (
          <p className="p-6 text-center text-[13px] text-muted">
            {t("common.loading")}
          </p>
        ) : visibleCases.length === 0 ? (
          <p className="p-8 text-center text-[13px] text-muted-2">
            {t("design.ledger.empty")}
          </p>
        ) : (
          <div ref={scrollContainerRef} className="overflow-x-auto">
            <table
              className="border-collapse text-[12px]"
              style={{ tableLayout: "fixed" }}
            >
              <thead>
                <tr>
                  <th
                    rowSpan={2}
                    className="sticky left-0 z-20 border-b border-border-strong bg-surface-2 px-3 py-2 text-left whitespace-pre-line"
                    style={{ width: DRAWING_COL_WIDTH, minWidth: DRAWING_COL_WIDTH }}
                  >
                    {t("design.ledger.columns.drawingNumber")}
                    {"\n"}
                    {t("design.ledger.columns.managementNumber")}
                  </th>
                  <th
                    rowSpan={2}
                    className="sticky z-20 border-b border-border-strong bg-surface-2 px-3 py-2 text-left"
                    style={{ left: DRAWING_COL_WIDTH, width: LABEL_COL_WIDTH, minWidth: LABEL_COL_WIDTH }}
                  >
                    {t("design.ledger.columns.projectName")}／{t("design.ledger.columns.panelNames")}
                  </th>
                  {months.map((m) => (
                    <th
                      key={`y-${m.year}-${m.month}`}
                      colSpan={JUN_BUCKETS.length}
                      className="border-b border-l border-border-strong bg-surface-2 px-1 py-1 text-center text-[11px] font-semibold whitespace-nowrap text-muted"
                    >
                      {m.year}/{String(m.month).padStart(2, "0")}
                    </th>
                  ))}
                </tr>
                <tr>
                  {months.map((m) =>
                    JUN_BUCKETS.map((bucket, i) => (
                      <th
                        key={`h-${m.year}-${m.month}-${bucket}`}
                        className={`border-b border-border bg-surface-2 py-1 text-center text-[10px] text-muted-2 ${i === 0 ? "border-l border-border-strong" : ""}`}
                        style={{
                          width: SEGMENT_WIDTH,
                          minWidth: SEGMENT_WIDTH,
                        }}
                      >
                        {bucket}
                      </th>
                    )),
                  )}
                </tr>
              </thead>
              <tbody>
                {visibleCases.map(({ case: c, panels }) => {
                  const schedule = schedules[c.id];
                  const lookup = schedule
                    ? buildJunColorLookupByRow(computeColoredSegments(schedule), colors)
                    : new Map<string, string>();
                  const { projectName, panelNames } = buildProjectPanelLines(c, panels);
                  const faceCount = panels[0]?.faceCount;
                  return PROCESS_ROWS.map((_, rowIndex) => (
                    <tr
                      key={`${c.id}-${rowIndex}`}
                      className={c.id === selectedCaseId ? "bg-accent/10" : ""}
                    >
                      {rowIndex === 0 && (
                        <>
                          <td
                            rowSpan={PROCESS_ROWS.length}
                            className="sticky left-0 z-10 border-b border-border bg-surface px-3 py-1.5 text-[12px] whitespace-pre-line align-top"
                            style={{ width: DRAWING_COL_WIDTH, minWidth: DRAWING_COL_WIDTH }}
                          >
                            <button
                              onClick={() => setSelectedCaseId(c.id)}
                              className="w-full text-left text-foreground hover:text-accent"
                              title={buildCaseDisplayLabel(c, panels)}
                            >
                              {c.drawingNumber}
                              {"\n"}
                              {c.managementNumber}
                              {"\n\n"}
                              {c.constructionNumber}
                            </button>
                          </td>
                          <td
                            rowSpan={PROCESS_ROWS.length}
                            className="sticky z-10 border-b border-border bg-surface px-3 py-1.5 text-[12px] whitespace-pre-line align-top"
                            style={{ left: DRAWING_COL_WIDTH, width: LABEL_COL_WIDTH, minWidth: LABEL_COL_WIDTH }}
                          >
                            <span className="text-foreground" title={buildCaseDisplayLabel(c, panels)}>
                              {projectName}
                              {"\n"}
                              {panelNames}
                              {"\n\n"}
                              {faceCount != null ? `${faceCount}面` : ""}
                            </span>
                          </td>
                        </>
                      )}
                      {months.map((m) =>
                        JUN_BUCKETS.map((bucket, i) => {
                          const color = lookup.get(
                            junCellKeyRow(m.year, m.month, bucket, rowIndex),
                          );
                          return (
                            <td
                              key={`c-${c.id}-${rowIndex}-${m.year}-${m.month}-${bucket}`}
                              className={`border-b border-border py-1 ${i === 0 ? "border-l border-border-strong" : ""} ${rowIndex === PROCESS_ROWS.length - 1 ? "border-b-2 border-b-border-strong" : ""}`}
                              style={{
                                width: SEGMENT_WIDTH,
                                minWidth: SEGMENT_WIDTH,
                                backgroundColor: color,
                              }}
                            />
                          );
                        }),
                      )}
                    </tr>
                  ));
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {message && <div className="text-[12px] text-success">{message}</div>}
    </div>
  );
}
