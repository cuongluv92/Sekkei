"use client";

import { ChevronDown, ChevronRight, FileSpreadsheet, Loader2, Printer } from "lucide-react";
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
  buildDayColorLookupByRow,
  buildMilestoneLabelsByRow,
  computeColoredDays,
  computeMilestones,
  dayCellKeyRow,
  daysInMonth,
  JUN_BUCKETS,
  SCREEN_PROCESS_ROWS,
} from "@/lib/utils/scheduleColoring";
import { applyCascade, applyTodayDefaults, formatJaDate, isIsoDate } from "@/lib/utils/schedule";
import { useMockFeedback } from "@/lib/hooks/useMockFeedback";
import type {
  CaseSchedule,
  DesignCaseWithPanels,
  ScheduleColorConfig,
} from "@/lib/types/design";

/**
 * 発注日→納入日 の対 — 発注日は案件を開くと当日の日付が自動で初期表示
 * される(applyTodayDefaults)ため、通常は見る必要が薄い。納入日を常時
 * 表示欄にし、発注日は製作/検査/立会/出荷の開始日と同じ折りたたみ表示
 * (expandedStarts/toggleStart)にして画面を縮める。
 */
const ORDER_DELIVERY_PAIRS: {
  orderKey: keyof CaseSchedule;
  orderLabelKey: string;
  deliveryKey: keyof CaseSchedule;
  deliveryLabelKey: string;
}[] = [
  { orderKey: "sheetMetalOrderDate", orderLabelKey: "sheetMetalOrder", deliveryKey: "sheetMetalDeliveryDate", deliveryLabelKey: "sheetMetalDelivery" },
  { orderKey: "boxOrderDate", orderLabelKey: "boxOrder", deliveryKey: "boxDeliveryDate", deliveryLabelKey: "boxDelivery" },
  { orderKey: "accessoryOrderDate", orderLabelKey: "accessoryOrder", deliveryKey: "accessoryDeliveryDate", deliveryLabelKey: "accessoryDelivery" },
];

/**
 * 開始日が前工程から自動計算される対 (製作/検査/立会/出荷) — 開始日は
 * 常時入力欄を出さず、完了日の横の小さな矢印をクリックしたときだけ
 * 手動上書き用の欄を出す (普段は自動値のプレビューのみ表示)。
 * endRefKey/endRefLabelKeyは完了日が自由記入テキスト(「9月下旬」等)の
 * 場合だけ表示する、色分け計算専用の実日付入力(scheduleColoring.ts参照)。
 */
const AUTO_START_PHASES: {
  startKey: keyof CaseSchedule;
  startLabelKey: string;
  endKey: keyof CaseSchedule;
  endLabelKey: string;
  endRefKey: keyof CaseSchedule;
  endRefLabelKey: string;
}[] = [
  { startKey: "productionStartDate", startLabelKey: "productionStart", endKey: "productionEndDate", endLabelKey: "productionEnd", endRefKey: "productionEndRefDate", endRefLabelKey: "productionEndRef" },
  { startKey: "inspectionStartDate", startLabelKey: "inspectionStart", endKey: "inspectionEndDate", endLabelKey: "inspectionEnd", endRefKey: "inspectionEndRefDate", endRefLabelKey: "inspectionEndRef" },
  { startKey: "witnessStartDate", startLabelKey: "witnessStart", endKey: "witnessEndDate", endLabelKey: "witnessEnd", endRefKey: "witnessEndRefDate", endRefLabelKey: "witnessEndRef" },
  { startKey: "shippingStartDate", startLabelKey: "shippingStart", endKey: "shippingEndDate", endLabelKey: "shippingEnd", endRefKey: "shippingEndRefDate", endRefLabelKey: "shippingEndRef" },
];

const FINAL_FIELD = { key: "deliveryDate" as const, labelKey: "delivery" };

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

// 画面表示は「作成月の2ヶ月前〜4ヶ月後」(計7ヶ月・約半年分)に絞り、横
// スクロールを減らして各月の表示幅を広く取る。Excel出力(⑤工程表)は実
// テンプレート側の実際のヘッダー行をそのまま読むため、この画面表示範囲
// とは独立している(scheduleExport.ts参照)。
const MONTHS_BEFORE = 2;
const MONTHS_AFTER = 4;
// 1日あたりの列幅(px) — 各月の実際の日数(28〜31)分だけ列を持たせることで、
// 旬(初/中/下)の途中で工程が切り替わっても正確な日で色が変わるようにする
// (列同士の境界線は表示しない — あくまで内部的な精度のため)。
const DAY_WIDTH = 4;
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
  const [expandedStarts, setExpandedStarts] = useState<Set<keyof CaseSchedule>>(new Set());

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
    setExpandedStarts(new Set());
    scheduleService.getByCase(selectedCaseId).then((s) => {
      if (active) {
        setEditingSchedule(applyTodayDefaults(s));
        setEditLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [selectedCaseId]);

  const months = useMemo(() => {
    const list: { year: number; month: number }[] = [];
    for (let i = -MONTHS_BEFORE; i <= MONTHS_AFTER; i++) {
      list.push(addMonths(focus.year, focus.month, i));
    }
    return list;
  }, [focus]);

  useEffect(() => {
    if (loading) return;
    const target = addMonths(focus.year, focus.month, -MONTHS_BEFORE);
    const index = months.findIndex(
      (m) => m.year === target.year && m.month === target.month,
    );
    if (index >= 0 && scrollContainerRef.current) {
      const offset = months
        .slice(0, index)
        .reduce((sum, m) => sum + daysInMonth(m.year, m.month) * DAY_WIDTH, 0);
      scrollContainerRef.current.scrollLeft = offset;
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

  function toggleStart(key: keyof CaseSchedule) {
    setExpandedStarts((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
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
                  {ORDER_DELIVERY_PAIRS.map(({ orderKey, orderLabelKey, deliveryKey, deliveryLabelKey }) => {
                    const orderValue = editingSchedule[orderKey] as string | null;
                    const expanded = expandedStarts.has(orderKey);
                    return (
                      <div key={deliveryKey}>
                        <label className="field-label">
                          {t(`design.schedule.milestones.${deliveryLabelKey}`)}
                        </label>
                        <DateInput
                          value={editingSchedule[deliveryKey] as string | null}
                          onChange={(v) => updateEditingField(deliveryKey, v ?? "")}
                          className="field-input"
                        />
                        <button
                          type="button"
                          onClick={() => toggleStart(orderKey)}
                          className="mt-1 inline-flex items-center gap-0.5 text-[10.5px] text-muted-2 hover:text-accent"
                        >
                          {expanded ? (
                            <ChevronDown className="h-3 w-3" />
                          ) : (
                            <ChevronRight className="h-3 w-3" />
                          )}
                          {t(`design.schedule.milestones.${orderLabelKey}`)}
                          {orderValue ? `: ${formatJaDate(orderValue)}` : ""}
                        </button>
                        {expanded && (
                          <div className="mt-1">
                            <DateInput
                              value={orderValue}
                              onChange={(v) => updateEditingField(orderKey, v ?? "")}
                              className="field-input"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {AUTO_START_PHASES.map(({ startKey, startLabelKey, endKey, endLabelKey, endRefKey, endRefLabelKey }) => {
                    const startValue = editingSchedule[startKey] as string | null;
                    const expanded = expandedStarts.has(startKey);
                    const endValue = editingSchedule[endKey] as string | null;
                    const endIsFreeText = !!endValue && !isIsoDate(endValue);
                    const refValue = editingSchedule[endRefKey] as string | null;
                    const refExpanded = expandedStarts.has(endRefKey);
                    return (
                      <div key={endKey}>
                        <label className="field-label">
                          {t(`design.schedule.milestones.${endLabelKey}`)}
                        </label>
                        <DateInput
                          value={endValue}
                          onChange={(v) => updateEditingField(endKey, v ?? "")}
                          className="field-input"
                        />
                        <button
                          type="button"
                          onClick={() => toggleStart(startKey)}
                          className="mt-1 inline-flex items-center gap-0.5 text-[10.5px] text-muted-2 hover:text-accent"
                        >
                          {expanded ? (
                            <ChevronDown className="h-3 w-3" />
                          ) : (
                            <ChevronRight className="h-3 w-3" />
                          )}
                          {t(`design.schedule.milestones.${startLabelKey}`)}
                          {startValue
                            ? `: ${formatJaDate(startValue)}`
                            : ` (${t("design.schedule.autoLabel")})`}
                        </button>
                        {expanded && (
                          <div className="mt-1">
                            <DateInput
                              value={startValue}
                              onChange={(v) => updateEditingField(startKey, v ?? "")}
                              className="field-input"
                            />
                          </div>
                        )}
                        {endIsFreeText && (
                          <>
                            <button
                              type="button"
                              onClick={() => toggleStart(endRefKey)}
                              className="mt-1 inline-flex items-center gap-0.5 text-[10.5px] text-warning hover:text-accent"
                            >
                              {refExpanded ? (
                                <ChevronDown className="h-3 w-3" />
                              ) : (
                                <ChevronRight className="h-3 w-3" />
                              )}
                              {t(`design.schedule.milestones.${endRefLabelKey}`)}
                              {refValue ? `: ${formatJaDate(refValue)}` : ""}
                            </button>
                            {refExpanded && (
                              <div className="mt-1">
                                <DateInput
                                  value={refValue}
                                  onChange={(v) => updateEditingField(endRefKey, v ?? "")}
                                  className="field-input"
                                />
                                <p className="mt-0.5 text-[10px] text-muted-2">
                                  {t("design.schedule.endRefHint")}
                                </p>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}
                  <div>
                    <label className="field-label">
                      {t(`design.schedule.milestones.${FINAL_FIELD.labelKey}`)}
                    </label>
                    <DateInput
                      value={editingSchedule[FINAL_FIELD.key] as string | null}
                      onChange={(v) => updateEditingField(FINAL_FIELD.key, v ?? "")}
                      className="field-input"
                    />
                  </div>
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
                  {months.map((m) => {
                    const dim = daysInMonth(m.year, m.month);
                    return (
                      <th
                        key={`y-${m.year}-${m.month}`}
                        colSpan={dim}
                        className="border-b border-l border-border-strong bg-surface-2 px-1 py-1 text-center text-[11px] font-semibold whitespace-nowrap text-muted"
                      >
                        {m.year}/{String(m.month).padStart(2, "0")}
                      </th>
                    );
                  })}
                </tr>
                <tr>
                  {months.map((m) => {
                    const dim = daysInMonth(m.year, m.month);
                    // 初=1〜10日, 中=11〜20日, 下=21日〜月末 — 列幅は実際の日数分に比例させる。
                    const bucketDays = [10, 10, dim - 20];
                    return JUN_BUCKETS.map((bucket, i) => (
                      <th
                        key={`h-${m.year}-${m.month}-${bucket}`}
                        colSpan={bucketDays[i]}
                        className={`border-b border-border bg-surface-2 py-1 text-center text-[10px] text-muted-2 ${i === 0 ? "border-l border-border-strong" : ""}`}
                        style={{
                          width: bucketDays[i] * DAY_WIDTH,
                          minWidth: bucketDays[i] * DAY_WIDTH,
                        }}
                      >
                        {bucket}
                      </th>
                    ));
                  })}
                </tr>
              </thead>
              <tbody>
                {visibleCases.map(({ case: c, panels }) => {
                  const schedule = schedules[c.id];
                  const lookup = schedule
                    ? buildDayColorLookupByRow(computeColoredDays(schedule), colors)
                    : new Map<string, string>();
                  const labels = schedule
                    ? buildMilestoneLabelsByRow(computeMilestones(schedule))
                    : new Map<string, string>();
                  const { projectName, panelNames } = buildProjectPanelLines(c, panels);
                  const faceCount = panels[0]?.faceCount;
                  return SCREEN_PROCESS_ROWS.map((_, rowIndex) => (
                    <tr
                      key={`${c.id}-${rowIndex}`}
                      className={c.id === selectedCaseId ? "bg-accent/10" : ""}
                    >
                      {rowIndex === 0 && (
                        <>
                          <td
                            rowSpan={SCREEN_PROCESS_ROWS.length}
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
                            rowSpan={SCREEN_PROCESS_ROWS.length}
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
                      {months.map((m) => {
                        const dim = daysInMonth(m.year, m.month);
                        return Array.from({ length: dim }, (_, dayIdx) => {
                          const day = dayIdx + 1;
                          const key = dayCellKeyRow(m.year, m.month, day, rowIndex);
                          const color = lookup.get(key);
                          const label = labels.get(key);
                          return (
                            <td
                              key={`c-${c.id}-${rowIndex}-${m.year}-${m.month}-${day}`}
                              className={`relative border-b border-border py-1 ${day === 1 ? "border-l border-border-strong" : ""} ${rowIndex === SCREEN_PROCESS_ROWS.length - 1 ? "border-b-2 border-b-border-strong" : ""}`}
                              style={{
                                width: DAY_WIDTH,
                                minWidth: DAY_WIDTH,
                                backgroundColor: color,
                              }}
                            >
                              {label && (
                                <span
                                  className="pointer-events-none absolute top-1/2 left-1/2 z-10 -translate-x-1/2 -translate-y-1/2 text-[9px] font-bold whitespace-nowrap text-white"
                                  style={{
                                    textShadow:
                                      "0 0 2px rgba(0,0,0,0.9), 0 0 2px rgba(0,0,0,0.9), 0 0 3px rgba(0,0,0,0.9)",
                                  }}
                                >
                                  {label}
                                </span>
                              )}
                            </td>
                          );
                        });
                      })}
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
