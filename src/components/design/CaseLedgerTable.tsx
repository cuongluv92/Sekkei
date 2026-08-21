"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { designCaseService } from "@/lib/services/design";
import type { CaseStatus, DesignCaseWithPanels } from "@/lib/types/design";

/** Row background per ②図面管理台帳 H1 legend — real colors from the template, not invented. */
const CASE_STATUS_ROW_CLASS: Record<CaseStatus, string> = {
  "": "",
  design_pending_approval: "bg-warning/10",
  production_requested: "bg-accent/10",
};

interface CaseLedgerTableProps {
  /** Optional filter — the underlying data is always the whole system-wide ledger, never scoped to one Project. */
  filter?: (item: DesignCaseWithPanels) => boolean;
}

/**
 * ②図面管理台帳 — read-only, database-driven aggregate view across every
 * Project (never requires picking a Project first). Columns match the real
 * template (図面番号/管理番号/工事番号/客先名/客先担当/件名/盤名称/製造完了); a 年
 * filter and free-text search are added conveniences, and each row opens
 * the matching 案件 directly. 設計依頼書目次・京王/その他 (③④) are a different
 * template with different columns — see DesignRequestIndexTable.
 */
export function CaseLedgerTable({ filter }: CaseLedgerTableProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const [items, setItems] = useState<DesignCaseWithPanels[] | null>(null);
  const [year, setYear] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    let active = true;
    designCaseService.listAll().then((list) => {
      if (active) setItems(list);
    });
    return () => {
      active = false;
    };
  }, []);

  const scoped = useMemo(() => {
    if (!items) return null;
    return filter ? items.filter(filter) : items;
  }, [items, filter]);

  const years = useMemo(() => {
    if (!scoped) return [];
    return Array.from(new Set(scoped.map((i) => i.case.year))).sort((a, b) => b - a);
  }, [scoped]);

  const rows = useMemo(() => {
    if (!scoped) return null;
    const q = query.trim().toLowerCase();
    return scoped.filter(({ case: c, panels }) => {
      if (year && c.year !== Number(year)) return false;
      if (!q) return true;
      const haystack = [
        c.drawingNumber,
        c.managementNumber,
        c.constructionNumber,
        c.orderer,
        c.customerContact,
        c.projectName,
        ...panels.map((p) => p.panelName),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [scoped, year, query]);

  return (
    <div className="flex flex-col gap-3">
      <div className="panel">
        <div className="panel-body-compact flex flex-wrap items-end gap-2.5">
          <div>
            <label className="field-label">{t("design.ledger.yearFilterLabel")}</label>
            <select value={year} onChange={(e) => setYear(e.target.value)} className="field-input w-auto py-1.5">
              <option value="">{t("design.ledger.allYears")}</option>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[260px] flex-1">
            <label className="field-label">{t("common.search")}</label>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("design.ledger.searchPlaceholder")}
              className="field-input"
            />
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="data-table-wrap">
          <table className="data-table" style={{ minWidth: 1120 }}>
            <thead>
              <tr>
                <th style={{ width: "60px" }}>{t("design.ledger.columns.year")}</th>
                <th style={{ width: "110px" }}>{t("design.ledger.columns.drawingNumber")}</th>
                <th style={{ width: "120px" }}>{t("design.ledger.columns.managementNumber")}</th>
                <th style={{ width: "120px" }}>{t("design.ledger.columns.constructionNumber")}</th>
                <th>{t("design.ledger.columns.orderer")}</th>
                <th style={{ width: "100px" }}>{t("design.ledger.columns.customerContact")}</th>
                <th>{t("design.ledger.columns.projectName")}</th>
                <th>{t("design.ledger.columns.panelNames")}</th>
                <th style={{ width: "80px" }} className="text-center">
                  {t("design.ledger.columns.manufacturingComplete")}
                </th>
                <th style={{ width: "100px" }}>{t("design.ledger.columns.updatedAt")}</th>
              </tr>
            </thead>
            <tbody>
              {rows === null ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-muted">
                    {t("common.loading")}
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-muted-2">
                    {t("design.ledger.empty")}
                  </td>
                </tr>
              ) : (
                rows.map(({ case: c, panels }) => (
                  <tr
                    key={c.id}
                    onClick={() => router.push(`/design?tab=designRequest&project=${c.projectId}&case=${c.id}`)}
                    className={`cursor-pointer ${CASE_STATUS_ROW_CLASS[c.caseStatus]}`}
                  >
                    <td>{c.year}</td>
                    <td className="font-mono">
                      <Link
                        href={`/design?tab=designRequest&project=${c.projectId}&case=${c.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-accent hover:underline"
                      >
                        {c.drawingNumber}
                      </Link>
                    </td>
                    <td className="font-mono">{c.managementNumber}</td>
                    <td>{c.constructionNumber}</td>
                    <td className="truncate">{c.orderer}</td>
                    <td>{c.customerContact}</td>
                    <td className="truncate">{c.projectName}</td>
                    <td className="truncate text-muted">
                      {panels
                        .map((p) => p.panelName)
                        .filter(Boolean)
                        .join("・")}
                    </td>
                    <td className="text-center">{c.manufacturingComplete ? "完" : ""}</td>
                    <td className="text-muted-2">{c.updatedAt}</td>
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
