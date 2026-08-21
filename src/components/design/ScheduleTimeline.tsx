"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { designCaseService, scheduleColorService, scheduleService } from "@/lib/services/design";
import { buildCaseDisplayLabel } from "@/lib/utils/designNumbering";
import { SCHEDULE_SEGMENTS } from "@/lib/utils/schedule";
import {
  addMonths,
  buildColorLookup,
  computeColoredSegments,
  segmentCellKey,
} from "@/lib/utils/scheduleColoring";
import type { CaseSchedule, DesignCaseWithPanels, ScheduleColorConfig } from "@/lib/types/design";

const MILESTONE_FIELDS: { key: keyof CaseSchedule; labelKey: string }[] = [
  { key: "sheetMetalOrderDate", labelKey: "sheetMetalOrder" },
  { key: "sheetMetalDeliveryDate", labelKey: "sheetMetalDelivery" },
  { key: "boxOrderDate", labelKey: "boxOrder" },
  { key: "boxDeliveryDate", labelKey: "boxDelivery" },
  { key: "accessoryOrderDate", labelKey: "accessoryOrder" },
  { key: "accessoryDeliveryDate", labelKey: "accessoryDelivery" },
  { key: "productionStartDate", labelKey: "productionStart" },
  { key: "productionEndDate", labelKey: "productionEnd" },
  { key: "inspectionStartDate", labelKey: "inspectionStart" },
  { key: "inspectionEndDate", labelKey: "inspectionEnd" },
  { key: "witnessStartDate", labelKey: "witnessStart" },
  { key: "witnessEndDate", labelKey: "witnessEnd" },
  { key: "shippingStartDate", labelKey: "shippingStart" },
  { key: "shippingEndDate", labelKey: "shippingEnd" },
  { key: "deliveryDate", labelKey: "delivery" },
];

const CATEGORY_KEYS: ScheduleColorConfig["category"][] = [
  "sheetMetal",
  "box",
  "accessory",
  "production",
  "inspection",
  "witness",
  "shipping",
];

const MONTHS_BEFORE = 12;
const MONTHS_AFTER = 18;
const SEGMENT_WIDTH = 30;
const LABEL_COL_WIDTH = 260;

/**
 * 工程表 — full system-wide timeline (not scoped to a Project, matching
 * 図面管理台帳/目次/原価工数). Dates are the only stored data; every colored
 * cell is recomputed on render via scheduleColoring utils, so re-uploading a
 * template and changing 工程色設定 changes colors without touching a single
 * date record.
 */
export function ScheduleTimeline() {
  const { t } = useTranslation();
  const now = new Date();
  const [focus, setFocus] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 });
  const [cases, setCases] = useState<DesignCaseWithPanels[]>([]);
  const [schedules, setSchedules] = useState<Record<string, CaseSchedule>>({});
  const [colors, setColors] = useState<ScheduleColorConfig[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedCaseId, setSelectedCaseId] = useState("");
  const [editingSchedule, setEditingSchedule] = useState<CaseSchedule | null>(null);
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
        setEditingSchedule(s);
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
    const target = addMonths(focus.year, focus.month, -3);
    const index = months.findIndex((m) => m.year === target.year && m.month === target.month);
    if (index >= 0 && scrollContainerRef.current) {
      scrollContainerRef.current.scrollLeft = index * SEGMENT_WIDTH * SCHEDULE_SEGMENTS.length;
    }
  }, [focus, loading, months]);

  function goToCurrentMonth() {
    const n = new Date();
    setFocus({ year: n.getFullYear(), month: n.getMonth() + 1 });
  }

  function updateEditingField(key: keyof CaseSchedule, value: string) {
    setEditingSchedule((prev) => (prev ? { ...prev, [key]: value || null } : prev));
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

  const colorByCategory = useMemo(() => new Map(colors.map((c) => [c.category, c.color])), [colors]);

  return (
    <div className="flex flex-col gap-3">
      <div className="panel">
        <div className="panel-header-compact">
          <span className="panel-title">{t("design.schedule.milestonesTitle")}</span>
        </div>
        <div className="panel-body-compact flex flex-col gap-2.5">
          <div className="max-w-sm">
            <label className="field-label">{t("design.workspaceBar.caseLabel")}</label>
            <select
              value={selectedCaseId}
              onChange={(e) => setSelectedCaseId(e.target.value)}
              className="field-input"
            >
              <option value="">{t("design.workspaceBar.casePlaceholder")}</option>
              {cases.map(({ case: c, panels }) => (
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
                  {MILESTONE_FIELDS.map(({ key, labelKey }) => (
                    <div key={key}>
                      <label className="field-label">{t(`design.schedule.milestones.${labelKey}`)}</label>
                      <input
                        type="date"
                        value={(editingSchedule[key] as string | null) ?? ""}
                        onChange={(e) => updateEditingField(key, e.target.value)}
                        className="field-input"
                      />
                    </div>
                  ))}
                </div>
                {saveError && <p className="text-[12.5px] text-danger">{saveError}</p>}
                <div className="flex items-center gap-2">
                  <button onClick={handleSaveSchedule} disabled={saving} className="btn-primary">
                    {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    {t("design.saveButton")}
                  </button>
                  {savedMessage && <span className="text-[12.5px] text-success">{savedMessage}</span>}
                </div>
              </>
            ))}
        </div>
      </div>

      <div className="panel">
        <div className="panel-header-compact flex-wrap gap-2">
          <span className="panel-title">{t("design.schedule.timelineTitle")}</span>
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
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-b border-border px-3.5 py-2">
          <span className="text-[11px] font-semibold tracking-wide text-muted uppercase">
            {t("design.schedule.legendTitle")}
          </span>
          {CATEGORY_KEYS.map((cat) => (
            <span key={cat} className="flex items-center gap-1.5 text-[12px] text-muted">
              <span
                className="h-3 w-3 rounded-sm border border-border-strong"
                style={{ backgroundColor: colorByCategory.get(cat) ?? "transparent" }}
              />
              {t(`design.schedule.categories.${cat}`)}
            </span>
          ))}
        </div>

        {loading ? (
          <p className="p-6 text-center text-[13px] text-muted">{t("common.loading")}</p>
        ) : cases.length === 0 ? (
          <p className="p-8 text-center text-[13px] text-muted-2">{t("design.ledger.empty")}</p>
        ) : (
          <div ref={scrollContainerRef} className="overflow-x-auto">
            <table className="border-collapse text-[12px]" style={{ tableLayout: "fixed" }}>
              <thead>
                <tr>
                  <th
                    className="sticky left-0 z-20 border-b border-border-strong bg-surface-2 px-3 py-2 text-left"
                    style={{ width: LABEL_COL_WIDTH, minWidth: LABEL_COL_WIDTH }}
                  />
                  {months.map((m) => (
                    <th
                      key={`y-${m.year}-${m.month}`}
                      colSpan={SCHEDULE_SEGMENTS.length}
                      className="border-b border-l border-border-strong bg-surface-2 px-1 py-1 text-center text-[11px] font-semibold whitespace-nowrap text-muted"
                    >
                      {m.year}/{String(m.month).padStart(2, "0")}
                    </th>
                  ))}
                </tr>
                <tr>
                  <th
                    className="sticky left-0 z-20 border-b border-border-strong bg-surface-2 px-3 py-1.5 text-left text-[11px] text-muted"
                    style={{ width: LABEL_COL_WIDTH, minWidth: LABEL_COL_WIDTH }}
                  >
                    {t("design.ledger.columns.drawingNumber")} / {t("design.ledger.columns.projectName")}
                  </th>
                  {months.map((m) =>
                    SCHEDULE_SEGMENTS.map((seg, i) => (
                      <th
                        key={`h-${m.year}-${m.month}-${seg}`}
                        className={`border-b border-border bg-surface-2 py-1 text-center text-[9.5px] text-muted-2 ${i === 0 ? "border-l border-border-strong" : ""}`}
                        style={{ width: SEGMENT_WIDTH, minWidth: SEGMENT_WIDTH }}
                      >
                        {seg}
                      </th>
                    )),
                  )}
                </tr>
              </thead>
              <tbody>
                {cases.map(({ case: c, panels }) => {
                  const schedule = schedules[c.id];
                  const lookup = schedule
                    ? buildColorLookup(computeColoredSegments(schedule), colors)
                    : new Map<string, string>();
                  return (
                    <tr key={c.id} className={c.id === selectedCaseId ? "bg-accent/10" : ""}>
                      <td
                        className="sticky left-0 z-10 border-b border-border bg-surface px-3 py-1.5 text-[12px]"
                        style={{ width: LABEL_COL_WIDTH, minWidth: LABEL_COL_WIDTH }}
                      >
                        <button
                          onClick={() => setSelectedCaseId(c.id)}
                          className="w-full truncate text-left text-foreground hover:text-accent"
                          title={buildCaseDisplayLabel(c, panels)}
                        >
                          {buildCaseDisplayLabel(c, panels)}
                        </button>
                      </td>
                      {months.map((m) =>
                        SCHEDULE_SEGMENTS.map((seg, i) => {
                          const color = lookup.get(segmentCellKey(m.year, m.month, seg));
                          return (
                            <td
                              key={`c-${c.id}-${m.year}-${m.month}-${seg}`}
                              className={`border-b border-border py-1.5 ${i === 0 ? "border-l border-border-strong" : ""}`}
                              style={{ width: SEGMENT_WIDTH, minWidth: SEGMENT_WIDTH, backgroundColor: color }}
                            />
                          );
                        }),
                      )}
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
