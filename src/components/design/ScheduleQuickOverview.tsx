"use client";

import { FileSpreadsheet, Loader2, Plus, Printer } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import {
  constructionScheduleService,
  designCaseService,
  exportScheduleExcel,
  printSchedule,
  scheduleService,
  type ConstructionScheduleEntryInput,
} from "@/lib/services/design";
import { buildProjectPanelLines } from "@/lib/utils/designNumbering";
import { computeMilestones, SCREEN_PROCESS_ROWS } from "@/lib/utils/scheduleColoring";
import { DateInput } from "@/components/common/DateInput";
import { useMockFeedback } from "@/lib/hooks/useMockFeedback";
import type {
  CaseSchedule,
  ConstructionScheduleEntry,
  DesignCaseWithPanels,
  ScheduleCategoryKey,
} from "@/lib/types/design";

/**
 * 工程表(簡易) — 実日カレンダー(通常は今日を起点に約1.5ヶ月分・日付が
 * 進めば自動でずれる。過去/未来の月へ移動した場合はその月の1日が起点)で、
 * 色分けの代わりに各マイルストーン当日のセルにカテゴリ名を直接文字で書く
 * 軽量版。行構成は既存のSCREEN_PROCESS_ROWS(鈑金・BOX納入/アクセサリー納入/
 * 製作・検査/立会・出荷)をそのまま使うが、表示する値は板金納入/BOX納入/
 * 完成/出荷/立会の5種類のみに絞る(アクセサリー納入・検査はこの簡易表では
 * 出さない)。年月選択・Excel出力・印刷は既存の工程表(ScheduleTimeline)と
 * 同じ操作感にする — 表示月を過去に戻しても、日付データ自体は消えずに
 * 保持されている実日付から毎回再計算されるので、過去のマイルストーンも
 * そのまま確認できる。案件・工程データ自体は既存の納入工程(旧⑤工程表)と
 * 共通。
 */
const QUICK_CATEGORY_LABEL: Partial<Record<ScheduleCategoryKey, string>> = {
  sheetMetal: "板入",
  box: "BOX入",
  production: "完成",
  witness: "立会",
  shipping: "出荷",
};

const WEEKDAY_KANJI = ["日", "月", "火", "水", "木", "金", "土"];
const DAYS_SPAN = 45; // 約1.5ヶ月分
const DAY_WIDTH = 34;
const DRAWING_COL_WIDTH = 130;
const LABEL_COL_WIDTH = 200;

interface DayInfo {
  year: number;
  month: number;
  day: number;
  weekday: number;
}

function toIso(year: number, month: number, day: number): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${year}-${pad(month)}-${pad(day)}`;
}

/**
 * focus年月からDAYS_SPAN日分(約1.5ヶ月)の実日を並べる。表示中がまさに
 * 今月(=ナビゲーションしていない通常状態)なら起点は今日 — 日付が進めば
 * 自動でウィンドウも今日基準にずれていく。過去/未来の月に移動した場合は
 * その月の1日を起点にする(1日より前は表示しようがないため)。
 */
function buildDayList(focus: { year: number; month: number }): DayInfo[] {
  const now = new Date();
  const isCurrentMonth = focus.year === now.getFullYear() && focus.month === now.getMonth() + 1;
  const start = isCurrentMonth ? new Date(now.getFullYear(), now.getMonth(), now.getDate()) : new Date(focus.year, focus.month - 1, 1);
  const days: DayInfo[] = [];
  const cursor = new Date(start);
  for (let i = 0; i < DAYS_SPAN; i++) {
    days.push({
      year: cursor.getFullYear(),
      month: cursor.getMonth() + 1,
      day: cursor.getDate(),
      weekday: cursor.getDay(),
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

/** 月ごとにまとめた列範囲(月ヘッダーのセル結合用)。 */
function buildMonthSpans(days: DayInfo[]): { year: number; month: number; span: number }[] {
  const spans: { year: number; month: number; span: number }[] = [];
  for (const d of days) {
    const last = spans[spans.length - 1];
    if (last && last.year === d.year && last.month === d.month) last.span++;
    else spans.push({ year: d.year, month: d.month, span: 1 });
  }
  return spans;
}

function dayKey(year: number, month: number, day: number, rowIndex: number) {
  return `${year}-${month}-${day}-${rowIndex}`;
}

/** "YYYY-MM-DD" -> "YYYY-M-D" 形式(buildDayList/dayIndexByKeyのキーと同じ、ゼロ埋めなし)。 */
function isoToDayIndexKey(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${y}-${m}-${d}`;
}

function emptyEntryForm(): ConstructionScheduleEntryInput {
  const today = new Date();
  const iso = toIso(today.getFullYear(), today.getMonth() + 1, today.getDate());
  return {
    managementNumber: "",
    constructionNumber: "",
    projectName: "",
    workContent: "",
    worker: "",
    startDate: iso,
    endDate: iso,
  };
}

export function ScheduleQuickOverview() {
  const { t } = useTranslation();
  const { message, show } = useMockFeedback();
  const now = new Date();
  const [focus, setFocus] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 });
  const [exportingExcel, setExportingExcel] = useState(false);
  const [printing, setPrinting] = useState(false);
  const days = useMemo(() => buildDayList(focus), [focus]);
  const monthSpans = useMemo(() => buildMonthSpans(days), [days]);
  const dayIndexByKey = useMemo(() => {
    const map = new Map<string, number>();
    days.forEach((d, i) => map.set(`${d.year}-${d.month}-${d.day}`, i));
    return map;
  }, [days]);

  const [loading, setLoading] = useState(true);
  const [cases, setCases] = useState<DesignCaseWithPanels[]>([]);
  const [schedules, setSchedules] = useState<Record<string, CaseSchedule>>({});

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      const [caseList, scheduleList] = await Promise.all([
        designCaseService.listAll(),
        scheduleService.listAll(),
      ]);
      if (!active) return;
      setCases(caseList);
      const map: Record<string, CaseSchedule> = {};
      for (const s of scheduleList) map[s.caseId] = s;
      setSchedules(map);
      setLoading(false);
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  const visibleCases = useMemo(
    () =>
      cases
        .filter(({ case: c }) => c.caseStatus === "production_requested" && !c.manufacturingComplete)
        .slice()
        .sort((a, b) => {
          const da = schedules[a.case.id]?.deliveryDate;
          const db = schedules[b.case.id]?.deliveryDate;
          if (!da && !db) return 0;
          if (!da) return 1;
          if (!db) return -1;
          return da.localeCompare(db);
        }),
    [cases, schedules],
  );

  // 簡易カレンダーの表(下記テーブル)には、今表示中の期間(days)に該当する
  // マイルストーンが1つも無い案件は出さない — Excel出力/印刷は表示期間に
  // 関係なく全案件を対象にするため、そちらはvisibleCasesをそのまま使う
  // (ここで絞り込むのは画面表示専用)。
  const quickTableCases = useMemo(
    () =>
      visibleCases.filter(({ case: c }) => {
        const schedule = schedules[c.id];
        if (!schedule) return false;
        return computeMilestones(schedule).some(
          ({ year, month, day, category }) => QUICK_CATEGORY_LABEL[category] && dayIndexByKey.has(`${year}-${month}-${day}`),
        );
      }),
    [visibleCases, schedules, dayIndexByKey],
  );

  function goToCurrentMonth() {
    const n = new Date();
    setFocus({ year: n.getFullYear(), month: n.getMonth() + 1 });
  }

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

  // 工事工程(手入力ログ) — 案件・工程データとは完全に独立。
  const [entries, setEntries] = useState<ConstructionScheduleEntry[]>([]);
  const [entriesLoading, setEntriesLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<ConstructionScheduleEntryInput>(emptyEntryForm());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    constructionScheduleService.list().then((list) => {
      if (active) {
        setEntries(list);
        setEntriesLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  async function handleAddEntry() {
    if (!form.workContent.trim()) return;
    setSaving(true);
    try {
      const created = await constructionScheduleService.create(form);
      setEntries((prev) => [...prev, created]);
      setForm(emptyEntryForm());
      setFormOpen(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleRemoveEntry(id: string) {
    await constructionScheduleService.remove(id);
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  const totalCols = days.length;

  return (
    <div className="flex flex-col gap-3">
      {/* 上段: 案件工程(実日・色なし・マイルストーンは文字で表示) */}
      <div className="panel">
        <div className="panel-header-compact flex-wrap gap-2">
          <span className="panel-title">{t("design.scheduleQuick.title")}</span>
          <div className="flex flex-wrap items-center gap-1.5">
            <select
              value={focus.year}
              onChange={(e) => setFocus((f) => ({ ...f, year: Number(e.target.value) }))}
              className="field-input w-auto py-1.5"
            >
              {Array.from({ length: 7 }, (_, i) => now.getFullYear() - 3 + i).map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <select
              value={focus.month}
              onChange={(e) => setFocus((f) => ({ ...f, month: Number(e.target.value) }))}
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
            <button onClick={handleExportExcel} disabled={exportingExcel} className="btn-ghost">
              {exportingExcel ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileSpreadsheet className="h-3.5 w-3.5" />}
              {t("design.exportExcelButton")}
            </button>
            <button onClick={handlePrint} disabled={printing} className="btn-ghost">
              {printing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Printer className="h-3.5 w-3.5" />}
              {t("design.printButton")}
            </button>
          </div>
        </div>
        {message && <div className="border-b border-border px-3.5 py-1.5 text-[12px] text-success">{message}</div>}
        {loading ? (
          <p className="p-6 text-center text-[13px] text-muted">{t("common.loading")}</p>
        ) : quickTableCases.length === 0 ? (
          <p className="p-8 text-center text-[13px] text-muted-2">{t("design.ledger.empty")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="border-collapse text-[12px]" style={{ tableLayout: "fixed" }}>
              <colgroup>
                <col style={{ width: DRAWING_COL_WIDTH }} />
                <col style={{ width: LABEL_COL_WIDTH }} />
                {days.map((_, i) => (
                  <col key={i} style={{ width: DAY_WIDTH }} />
                ))}
              </colgroup>
              <thead>
                <tr>
                  <th
                    rowSpan={3}
                    className="sticky left-0 z-20 border-b border-border-strong bg-surface-2 px-3 py-2 text-left whitespace-pre-line"
                    style={{ width: DRAWING_COL_WIDTH, minWidth: DRAWING_COL_WIDTH }}
                  >
                    {t("design.ledger.columns.drawingNumber")}
                    {"\n"}
                    {t("design.ledger.columns.managementNumber")}
                  </th>
                  <th
                    rowSpan={3}
                    className="sticky z-20 border-b border-border-strong bg-surface-2 px-3 py-2 text-left"
                    style={{ left: DRAWING_COL_WIDTH, width: LABEL_COL_WIDTH, minWidth: LABEL_COL_WIDTH }}
                  >
                    {t("design.ledger.columns.projectName")}／{t("design.ledger.columns.panelNames")}
                  </th>
                  {monthSpans.map((m) => (
                    <th
                      key={`m-${m.year}-${m.month}`}
                      colSpan={m.span}
                      className="border-b border-l border-border-strong bg-surface-2 px-1 py-1 text-center text-[11px] font-semibold whitespace-nowrap text-muted"
                    >
                      {m.year}/{String(m.month).padStart(2, "0")}
                    </th>
                  ))}
                </tr>
                <tr>
                  {days.map((d, i) => (
                    <th
                      key={`wd-${i}`}
                      className={`border-b border-l border-border bg-surface-2 py-0.5 text-center text-[10px] text-muted-2 ${d.day === 1 ? "border-l-border-strong" : ""}`}
                      style={{ width: DAY_WIDTH, minWidth: DAY_WIDTH }}
                    >
                      {WEEKDAY_KANJI[d.weekday]}
                    </th>
                  ))}
                </tr>
                <tr>
                  {days.map((d, i) => (
                    <th
                      key={`d-${i}`}
                      className={`border-b border-l border-border border-b-border-strong bg-surface-2 py-0.5 text-center text-[10px] font-semibold tabular-nums ${d.day === 1 ? "border-l-border-strong" : ""} ${d.weekday === 0 ? "text-danger" : d.weekday === 6 ? "text-accent" : "text-muted"}`}
                      style={{ width: DAY_WIDTH, minWidth: DAY_WIDTH }}
                    >
                      {d.day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {quickTableCases.map(({ case: c, panels }) => {
                  const schedule = schedules[c.id];
                  const labels = schedule
                    ? new Map(
                        computeMilestones(schedule).flatMap(({ year, month, day, category }) => {
                          const label = QUICK_CATEGORY_LABEL[category];
                          if (!label) return [];
                          const rowIndex = SCREEN_PROCESS_ROWS.findIndex((cats) => cats.includes(category));
                          if (rowIndex < 0) return [];
                          return [[dayKey(year, month, day, rowIndex), label] as const];
                        }),
                      )
                    : new Map<string, string>();
                  const { projectName, panelNames } = buildProjectPanelLines(c, panels);
                  const faceCount = panels[0]?.faceCount;
                  return SCREEN_PROCESS_ROWS.map((_, rowIndex) => (
                    <tr key={`${c.id}-${rowIndex}`}>
                      {rowIndex === 0 && (
                        <>
                          <td
                            rowSpan={SCREEN_PROCESS_ROWS.length}
                            className="sticky left-0 z-10 border-b border-border bg-surface px-3 py-1.5 text-[12px] whitespace-pre-line align-top"
                            style={{ width: DRAWING_COL_WIDTH, minWidth: DRAWING_COL_WIDTH }}
                          >
                            {c.drawingNumber}
                            {"\n"}
                            {c.managementNumber}
                          </td>
                          <td
                            rowSpan={SCREEN_PROCESS_ROWS.length}
                            className="sticky z-10 border-b border-border bg-surface px-3 py-1.5 text-[12px] whitespace-pre-line align-top"
                            style={{ left: DRAWING_COL_WIDTH, width: LABEL_COL_WIDTH, minWidth: LABEL_COL_WIDTH }}
                          >
                            {projectName}
                            {"\n"}
                            {panelNames}
                            {"\n\n"}
                            {faceCount != null ? `${faceCount}面` : ""}
                          </td>
                        </>
                      )}
                      {days.map((d, i) => {
                        const label = labels.get(dayKey(d.year, d.month, d.day, rowIndex));
                        return (
                          <td
                            key={`c-${c.id}-${rowIndex}-${i}`}
                            className={`overflow-hidden border-b border-l border-border py-1 text-center text-[10px] font-bold text-ellipsis whitespace-nowrap text-foreground ${d.day === 1 ? "border-l-border-strong" : ""} ${rowIndex === SCREEN_PROCESS_ROWS.length - 1 ? "border-b-2 border-b-border-strong" : ""}`}
                            style={{ width: DAY_WIDTH, minWidth: DAY_WIDTH, maxWidth: DAY_WIDTH }}
                          >
                            {label}
                          </td>
                        );
                      })}
                    </tr>
                  ));
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 下段: 工事工程(手入力ログ) — 案件データとは独立 */}
      <div className="panel">
        <div className="panel-header-compact flex items-center justify-between">
          <span className="panel-title">{t("design.scheduleQuick.constructionTitle")}</span>
          <button className="btn-secondary" onClick={() => setFormOpen((v) => !v)}>
            <Plus className="h-3.5 w-3.5" />
            {t("design.scheduleQuick.addEntryButton")}
          </button>
        </div>

        {formOpen && (
          <div className="panel-body-compact grid grid-cols-2 gap-2.5 border-b border-border sm:grid-cols-4">
            <div>
              <label className="field-label">{t("design.scheduleQuick.form.managementNumber")}</label>
              <input
                className="field-input"
                value={form.managementNumber}
                onChange={(e) => setForm((f) => ({ ...f, managementNumber: e.target.value }))}
              />
            </div>
            <div>
              <label className="field-label">{t("design.scheduleQuick.form.constructionNumber")}</label>
              <input
                className="field-input"
                value={form.constructionNumber}
                onChange={(e) => setForm((f) => ({ ...f, constructionNumber: e.target.value }))}
              />
            </div>
            <div>
              <label className="field-label">{t("design.scheduleQuick.form.projectName")}</label>
              <input
                className="field-input"
                value={form.projectName}
                onChange={(e) => setForm((f) => ({ ...f, projectName: e.target.value }))}
              />
            </div>
            <div>
              <label className="field-label">{t("design.scheduleQuick.form.worker")}</label>
              <input
                className="field-input"
                value={form.worker}
                onChange={(e) => setForm((f) => ({ ...f, worker: e.target.value }))}
              />
            </div>
            <div className="col-span-2">
              <label className="field-label">{t("design.scheduleQuick.form.workContent")}</label>
              <input
                className="field-input"
                value={form.workContent}
                onChange={(e) => setForm((f) => ({ ...f, workContent: e.target.value }))}
              />
            </div>
            <div>
              <label className="field-label">{t("design.scheduleQuick.form.startDate")}</label>
              <DateInput
                value={form.startDate}
                onChange={(v) => setForm((f) => ({ ...f, startDate: v ?? f.startDate }))}
              />
            </div>
            <div>
              <label className="field-label">{t("design.scheduleQuick.form.endDate")}</label>
              <DateInput
                value={form.endDate}
                onChange={(v) => setForm((f) => ({ ...f, endDate: v ?? f.endDate }))}
              />
            </div>
            <div className="col-span-2 flex items-end sm:col-span-4">
              <button className="btn-primary" disabled={saving} onClick={handleAddEntry}>
                {t("common.save")}
              </button>
            </div>
          </div>
        )}

        {entriesLoading ? (
          <p className="p-6 text-center text-[13px] text-muted">{t("common.loading")}</p>
        ) : entries.length === 0 ? (
          <p className="p-8 text-center text-[13px] text-muted-2">{t("design.scheduleQuick.constructionEmpty")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="border-collapse text-[12px]" style={{ tableLayout: "fixed" }}>
              <colgroup>
                <col style={{ width: DRAWING_COL_WIDTH }} />
                <col style={{ width: LABEL_COL_WIDTH }} />
                {days.map((_, i) => (
                  <col key={i} style={{ width: DAY_WIDTH }} />
                ))}
              </colgroup>
              <thead>
                <tr>
                  <th
                    rowSpan={3}
                    className="sticky left-0 z-20 border-b border-border-strong bg-surface-2 px-3 py-2 text-left whitespace-pre-line"
                    style={{ width: DRAWING_COL_WIDTH, minWidth: DRAWING_COL_WIDTH }}
                  >
                    {t("design.ledger.columns.managementNumber")}
                    {"\n"}
                    {t("design.scheduleQuick.form.constructionNumber")}
                  </th>
                  <th
                    rowSpan={3}
                    className="sticky z-20 border-b border-border-strong bg-surface-2 px-3 py-2 text-left"
                    style={{ left: DRAWING_COL_WIDTH, width: LABEL_COL_WIDTH, minWidth: LABEL_COL_WIDTH }}
                  >
                    {t("design.ledger.columns.projectName")}／{t("design.scheduleQuick.form.worker")}
                  </th>
                  {monthSpans.map((m) => (
                    <th
                      key={`m2-${m.year}-${m.month}`}
                      colSpan={m.span}
                      className="border-b border-l border-border-strong bg-surface-2 px-1 py-1 text-center text-[11px] font-semibold whitespace-nowrap text-muted"
                    >
                      {m.year}/{String(m.month).padStart(2, "0")}
                    </th>
                  ))}
                </tr>
                <tr>
                  {days.map((d, i) => (
                    <th
                      key={`wd2-${i}`}
                      className={`border-b border-l border-border bg-surface-2 py-0.5 text-center text-[10px] text-muted-2 ${d.day === 1 ? "border-l-border-strong" : ""}`}
                      style={{ width: DAY_WIDTH, minWidth: DAY_WIDTH }}
                    >
                      {WEEKDAY_KANJI[d.weekday]}
                    </th>
                  ))}
                </tr>
                <tr>
                  {days.map((d, i) => (
                    <th
                      key={`d2-${i}`}
                      className={`border-b border-l border-border border-b-border-strong bg-surface-2 py-0.5 text-center text-[10px] font-semibold tabular-nums ${d.day === 1 ? "border-l-border-strong" : ""} ${d.weekday === 0 ? "text-danger" : d.weekday === 6 ? "text-accent" : "text-muted"}`}
                      style={{ width: DAY_WIDTH, minWidth: DAY_WIDTH }}
                    >
                      {d.day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => {
                  // 表示中の2ヶ月ウィンドウと日付範囲が重なっているかを判定し、範囲が
                  // ウィンドウの外側にはみ出す場合はウィンドウの端で切り詰める(部分的に
                  // 重なっているだけの案件も表示されるように)。
                  const firstIso = toIso(days[0].year, days[0].month, days[0].day);
                  const lastIso = toIso(days[totalCols - 1].year, days[totalCols - 1].month, days[totalCols - 1].day);
                  const overlaps = entry.startDate <= lastIso && entry.endDate >= firstIso;
                  const clippedStart = overlaps
                    ? entry.startDate <= firstIso
                      ? 0
                      : (dayIndexByKey.get(isoToDayIndexKey(entry.startDate)) ?? 0)
                    : 0;
                  const clippedEnd = overlaps
                    ? entry.endDate >= lastIso
                      ? totalCols - 1
                      : (dayIndexByKey.get(isoToDayIndexKey(entry.endDate)) ?? totalCols - 1)
                    : -1;
                  const cells = [];
                  let i = 0;
                  while (i < totalCols) {
                    const d = days[i];
                    if (overlaps && i === clippedStart && clippedEnd >= clippedStart) {
                      const span = clippedEnd - clippedStart + 1;
                      cells.push(
                        <td
                          key={`e-${entry.id}-${i}`}
                          colSpan={span}
                          className={`border border-border-strong px-1 py-1 text-center text-[10px] font-bold text-foreground ${d.day === 1 ? "border-l-2" : ""}`}
                          style={{ width: DAY_WIDTH * span, minWidth: DAY_WIDTH * span }}
                          title={entry.workContent}
                        >
                          {entry.workContent}
                        </td>,
                      );
                      i = clippedEnd + 1;
                      continue;
                    }
                    cells.push(
                      <td
                        key={`e-${entry.id}-${i}`}
                        className={`border-b border-l border-border py-1 ${d.day === 1 ? "border-l-border-strong" : ""}`}
                        style={{ width: DAY_WIDTH, minWidth: DAY_WIDTH }}
                      />,
                    );
                    i++;
                  }
                  return (
                    <tr key={entry.id} className="group">
                      <td
                        className="sticky left-0 z-10 border-b border-border-strong bg-surface px-3 py-1.5 text-[12px] whitespace-pre-line align-top"
                        style={{ width: DRAWING_COL_WIDTH, minWidth: DRAWING_COL_WIDTH }}
                      >
                        {entry.managementNumber}
                        {"\n"}
                        {entry.constructionNumber}
                      </td>
                      <td
                        className="sticky z-10 border-b border-border-strong bg-surface px-3 py-1.5 text-[12px] whitespace-pre-line align-top"
                        style={{ left: DRAWING_COL_WIDTH, width: LABEL_COL_WIDTH, minWidth: LABEL_COL_WIDTH }}
                      >
                        <div className="flex items-start justify-between gap-1">
                          <span>
                            {entry.projectName}
                            {"\n"}
                            {entry.worker}
                          </span>
                          <button
                            onClick={() => handleRemoveEntry(entry.id)}
                            className="shrink-0 text-[10px] text-muted-2 opacity-0 hover:text-danger group-hover:opacity-100"
                          >
                            {t("common.delete")}
                          </button>
                        </div>
                      </td>
                      {cells}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
