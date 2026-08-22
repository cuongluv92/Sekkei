"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileSpreadsheet, Loader2, Printer } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { designCaseService, exportDrawingLedgerExcel, printDrawingLedger } from "@/lib/services/design";
import { useMockFeedback } from "@/lib/hooks/useMockFeedback";
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
 * template (図面番号/管理番号/工事番号/客先名/客先担当/件名/盤名称/製造完了). The real
 * workbook is literally one sheet per year ("２０２６年　図面管理台帳"); reproduced
 * here as one panel per year in a horizontally-scrolling row instead of a
 * single table behind a year dropdown, oldest year on the left — same
 * pattern as DesignRequestIndexTable/CostLaborTable.
 */
export function CaseLedgerTable({ filter }: CaseLedgerTableProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const { message, show } = useMockFeedback();
  const [items, setItems] = useState<DesignCaseWithPanels[] | null>(null);
  const [query, setQuery] = useState("");
  const [exportingKey, setExportingKey] = useState<string | null>(null);

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

  const filtered = useMemo(() => {
    if (!scoped) return null;
    const q = query.trim().toLowerCase();
    if (!q) return scoped;
    return scoped.filter(({ case: c, panels }) => {
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
  }, [scoped, query]);

  const yearBlocks = useMemo(() => {
    if (!filtered) return null;
    const byYear = new Map<number, DesignCaseWithPanels[]>();
    for (const item of filtered) {
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
  }, [filtered]);

  async function handleExportExcel(year: number, cases: DesignCaseWithPanels[]) {
    setExportingKey(`${year}-excel`);
    try {
      const { fileName } = await exportDrawingLedgerExcel(year, cases);
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
      await printDrawingLedger(year, cases);
    } catch {
      show(t("design.exportError"));
    } finally {
      setExportingKey(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="panel">
        <div className="panel-body-compact">
          <label className="field-label">{t("common.search")}</label>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("design.ledger.searchPlaceholder")}
            className="field-input max-w-md"
          />
        </div>
      </div>

      {yearBlocks === null ? (
        <div className="panel">
          <div className="panel-body py-8 text-center text-[13px] text-muted">{t("common.loading")}</div>
        </div>
      ) : yearBlocks.length === 0 ? (
        <div className="panel">
          <div className="panel-body py-8 text-center text-[13px] text-muted-2">{t("design.ledger.empty")}</div>
        </div>
      ) : (
        <div className="flex items-start gap-3 overflow-x-auto pb-1">
          {yearBlocks.map(({ year, cases }) => (
            <div key={year} className="panel shrink-0" style={{ width: 1120 }}>
              <div className="panel-header-compact">
                <span className="panel-title">{t("design.ledger.yearBlockTitle", { year })}</span>
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
                <table className="data-table" style={{ minWidth: 1080 }}>
                  <thead>
                    <tr>
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
                    {cases.map(({ case: c, panels }) => (
                      <tr
                        key={c.id}
                        onClick={() => router.push(`/design?tab=designRequest&project=${c.projectId}&case=${c.id}`)}
                        className={`cursor-pointer ${CASE_STATUS_ROW_CLASS[c.caseStatus]}`}
                      >
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
