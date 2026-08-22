"use client";

import Link from "next/link";
import { FileSpreadsheet, Loader2, Printer } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import {
  designCaseService,
  exportCostLaborExcel,
  printCostLabor,
  projectService,
} from "@/lib/services/design";
import { useMockFeedback } from "@/lib/hooks/useMockFeedback";
import type { CasePanel, DesignCaseWithPanels, Project } from "@/lib/types/design";

function sumHours(panels: CasePanel[], key: keyof CasePanel): number {
  return panels.reduce((total, p) => total + (typeof p[key] === "number" ? (p[key] as number) : 0), 0);
}

/**
 * 仕入原価・工数一覧表 (⑥) — system-wide, computed at read time from
 * DesignCase/CasePanel (設計実動合計/製作実動合計/... are sums over panels,
 * never stored as their own duplicated field). Project is a filter here, not
 * a required parent — matches 図面管理台帳/目次/工程表. The real 工数データ sheet
 * has one tab per year with a combined 件名／盤名称 column (no per-part 単価/
 * 合計 — pricing was explicitly excluded from this app, only hours are
 * tracked); reproduced here as one panel per year, oldest on the left,
 * matching 設計依頼書目次's layout.
 */
export function CostLaborTable() {
  const { t } = useTranslation();
  const { message, show } = useMockFeedback();
  const [items, setItems] = useState<DesignCaseWithPanels[] | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [query, setQuery] = useState("");
  const [exportingKey, setExportingKey] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([designCaseService.listAll(), projectService.list()]).then(([cases, projs]) => {
      if (!active) return;
      setItems(cases);
      setProjects(projs);
    });
    return () => {
      active = false;
    };
  }, []);

  const rows = useMemo(() => {
    if (!items) return null;
    const q = query.trim().toLowerCase();
    return items.filter(({ case: c, panels }) => {
      if (projectId && c.projectId !== projectId) return false;
      if (!q) return true;
      const haystack = [c.drawingNumber, c.managementNumber, c.projectName, ...panels.map((p) => p.panelName)]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [items, projectId, query]);

  const grandTotals = useMemo(() => {
    if (!rows) return null;
    return rows.reduce(
      (acc, { panels }) => ({
        designEstimated: acc.designEstimated + sumHours(panels, "designEstimatedHours"),
        designActual: acc.designActual + sumHours(panels, "designActualHours"),
        productionEstimated: acc.productionEstimated + sumHours(panels, "productionEstimatedHours"),
        productionActual: acc.productionActual + sumHours(panels, "productionActualHours"),
      }),
      { designEstimated: 0, designActual: 0, productionEstimated: 0, productionActual: 0 },
    );
  }, [rows]);

  const yearBlocks = useMemo(() => {
    if (!rows) return null;
    const byYear = new Map<number, DesignCaseWithPanels[]>();
    for (const item of rows) {
      const list = byYear.get(item.case.year) ?? [];
      list.push(item);
      byYear.set(item.case.year, list);
    }
    return Array.from(byYear.entries())
      .sort(([a], [b]) => a - b) // oldest first (left), newest last (right)
      .map(([year, cases]) => ({
        year,
        cases: cases.sort((a, b) => a.case.sequenceNo - b.case.sequenceNo),
      }));
  }, [rows]);

  async function handleExportExcel(year: number, cases: DesignCaseWithPanels[]) {
    setExportingKey(`${year}-excel`);
    try {
      const { fileName } = await exportCostLaborExcel(year, cases);
      show(t("design.exportedMessage", { fileName }));
    } catch {
      show(t("design.exportError"));
    } finally {
      setExportingKey(null);
    }
  }

  async function handlePrint(year: number, cases: DesignCaseWithPanels[]) {
    setExportingKey(`${year}-print`);
    try {
      await printCostLabor(cases);
    } catch {
      show(t("design.exportError"));
    } finally {
      setExportingKey(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="panel">
        <div className="panel-body-compact flex flex-wrap items-end gap-2.5">
          <div>
            <label className="field-label">{t("design.costLabor.filterProject")}</label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="field-input w-auto py-1.5"
            >
              <option value="">{t("design.search.allProjects")}</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[220px]">
            <label className="field-label">{t("common.search")}</label>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("design.costLabor.searchPlaceholder")}
              className="field-input"
            />
          </div>
        </div>
      </div>

      {grandTotals && (
        <div className="panel">
          <div className="panel-header-compact">
            <span className="panel-title">{t("design.costLabor.totalsTitle")}</span>
          </div>
          <div className="panel-body-compact grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <div className="rounded-lg border border-border bg-surface-2 px-3 py-2.5">
              <div className="text-[11px] text-muted uppercase">{t("design.costLabor.designEstimatedTotal")}</div>
              <div className="text-[19px] font-bold text-foreground">{grandTotals.designEstimated}</div>
            </div>
            <div className="rounded-lg border border-border bg-surface-2 px-3 py-2.5">
              <div className="text-[11px] text-muted uppercase">{t("design.costLabor.designActualTotal")}</div>
              <div className="text-[19px] font-bold text-foreground">{grandTotals.designActual}</div>
            </div>
            <div className="rounded-lg border border-border bg-surface-2 px-3 py-2.5">
              <div className="text-[11px] text-muted uppercase">{t("design.costLabor.productionEstimatedTotal")}</div>
              <div className="text-[19px] font-bold text-foreground">{grandTotals.productionEstimated}</div>
            </div>
            <div className="rounded-lg border border-border bg-surface-2 px-3 py-2.5">
              <div className="text-[11px] text-muted uppercase">{t("design.costLabor.productionActualTotal")}</div>
              <div className="text-[19px] font-bold text-foreground">{grandTotals.productionActual}</div>
            </div>
          </div>
        </div>
      )}

      {yearBlocks === null ? (
        <div className="panel">
          <div className="panel-body py-8 text-center text-[13px] text-muted">{t("common.loading")}</div>
        </div>
      ) : yearBlocks.length === 0 ? (
        <div className="panel">
          <div className="panel-body py-8 text-center text-[13px] text-muted-2">{t("design.ledger.noResults")}</div>
        </div>
      ) : (
        <div className="flex items-start gap-3 overflow-x-auto pb-1">
          {yearBlocks.map(({ year, cases }) => (
            <div key={year} className="panel shrink-0" style={{ width: 890 }}>
              <div className="panel-header-compact">
                <span className="panel-title">{t("design.costLabor.yearBlockTitle", { year })}</span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleExportExcel(year, cases)}
                    disabled={exportingKey === `${year}-excel`}
                    className="btn-ghost"
                  >
                    {exportingKey === `${year}-excel` ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <FileSpreadsheet className="h-3.5 w-3.5" />
                    )}
                    {t("design.exportExcelButton")}
                  </button>
                  <button
                    onClick={() => handlePrint(year, cases)}
                    disabled={exportingKey === `${year}-print`}
                    className="btn-ghost"
                  >
                    {exportingKey === `${year}-print` ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Printer className="h-3.5 w-3.5" />
                    )}
                    {t("design.printButton")}
                  </button>
                </div>
              </div>
              <div className="data-table-wrap">
                <table className="data-table" style={{ minWidth: 870 }}>
                  <thead>
                    <tr>
                      <th style={{ width: "90px" }}>{t("design.costLabor.columns.drawingNumber")}</th>
                      <th style={{ width: "110px" }}>{t("design.costLabor.columns.managementNumber")}</th>
                      <th>{t("design.costLabor.columns.projectName")}</th>
                      <th style={{ width: "120px" }}>{t("design.costLabor.columns.panelNames")}</th>
                      <th style={{ width: "90px" }}>{t("design.costLabor.columns.designEstimated")}</th>
                      <th style={{ width: "90px" }}>{t("design.costLabor.columns.designActual")}</th>
                      <th style={{ width: "90px" }}>{t("design.costLabor.columns.productionEstimated")}</th>
                      <th style={{ width: "90px" }}>{t("design.costLabor.columns.productionActual")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cases.map(({ case: c, panels }) => (
                      <tr key={c.id}>
                        <td className="font-mono">
                          <Link
                            href={`/design?tab=designRequest&project=${c.projectId}&case=${c.id}`}
                            className="text-accent hover:underline"
                          >
                            {c.drawingNumber}
                          </Link>
                        </td>
                        <td className="font-mono">{c.managementNumber}</td>
                        <td className="truncate">{c.projectName}</td>
                        <td className="truncate text-muted">
                          {panels
                            .map((p) => p.panelName)
                            .filter(Boolean)
                            .join("・")}
                        </td>
                        <td>{sumHours(panels, "designEstimatedHours")}</td>
                        <td>{sumHours(panels, "designActualHours")}</td>
                        <td>{sumHours(panels, "productionEstimatedHours")}</td>
                        <td>{sumHours(panels, "productionActualHours")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
      {message && <div className="text-[12px] text-success">{message}</div>}
    </div>
  );
}
