"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { designCaseService, projectService } from "@/lib/services/design";
import type { CasePanel, DesignCaseWithPanels, Project } from "@/lib/types/design";

function sumHours(panels: CasePanel[], key: keyof CasePanel): number {
  return panels.reduce((total, p) => total + (typeof p[key] === "number" ? (p[key] as number) : 0), 0);
}

/**
 * 仕入原価・工数一覧表 — system-wide, computed at read time from
 * DesignCase/CasePanel (設計実動合計/製作実動合計/... are sums over panels,
 * never stored as their own duplicated field). Project is a filter here, not
 * a required parent — matches 図面管理台帳/目次/工程表.
 */
export function CostLaborTable() {
  const { t } = useTranslation();
  const [items, setItems] = useState<DesignCaseWithPanels[] | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [year, setYear] = useState("");
  const [projectId, setProjectId] = useState("");
  const [query, setQuery] = useState("");

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

  const years = useMemo(() => {
    if (!items) return [];
    return Array.from(new Set(items.map((i) => i.case.year))).sort((a, b) => b - a);
  }, [items]);

  const rows = useMemo(() => {
    if (!items) return null;
    const q = query.trim().toLowerCase();
    return items.filter(({ case: c }) => {
      if (year && c.year !== Number(year)) return false;
      if (projectId && c.projectId !== projectId) return false;
      if (
        q &&
        !c.drawingNumber.toLowerCase().includes(q) &&
        !c.managementNumber.toLowerCase().includes(q) &&
        !c.projectName.toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [items, year, projectId, query]);

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

  return (
    <div className="flex flex-col gap-3">
      <div className="panel">
        <div className="panel-body-compact flex flex-wrap items-end gap-2.5">
          <div>
            <label className="field-label">{t("design.costLabor.filterYear")}</label>
            <select value={year} onChange={(e) => setYear(e.target.value)} className="field-input w-auto py-1.5">
              <option value="">{t("design.ledger.allYears")}</option>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
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

      <div className="panel">
        <div className="data-table-wrap">
          <table className="data-table" style={{ minWidth: 900 }}>
            <thead>
              <tr>
                <th style={{ width: "110px" }}>{t("design.costLabor.columns.drawingNumber")}</th>
                <th>{t("design.costLabor.columns.projectName")}</th>
                <th style={{ width: "70px" }}>{t("design.costLabor.columns.panelCount")}</th>
                <th style={{ width: "100px" }}>{t("design.costLabor.columns.designEstimated")}</th>
                <th style={{ width: "100px" }}>{t("design.costLabor.columns.designActual")}</th>
                <th style={{ width: "110px" }}>{t("design.costLabor.columns.productionEstimated")}</th>
                <th style={{ width: "110px" }}>{t("design.costLabor.columns.productionActual")}</th>
              </tr>
            </thead>
            <tbody>
              {rows === null ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted">
                    {t("common.loading")}
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted-2">
                    {t("design.ledger.noResults")}
                  </td>
                </tr>
              ) : (
                rows.map(({ case: c, panels }) => (
                  <tr key={c.id}>
                    <td className="font-mono">
                      <Link
                        href={`/design?tab=designRequest&project=${c.projectId}&case=${c.id}`}
                        className="text-accent hover:underline"
                      >
                        {c.drawingNumber}
                      </Link>
                    </td>
                    <td className="truncate">{c.projectName}</td>
                    <td>{panels.length}</td>
                    <td>{sumHours(panels, "designEstimatedHours")}</td>
                    <td>{sumHours(panels, "designActualHours")}</td>
                    <td>{sumHours(panels, "productionEstimatedHours")}</td>
                    <td>{sumHours(panels, "productionActualHours")}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
