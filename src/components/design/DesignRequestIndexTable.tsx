"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { designCaseService } from "@/lib/services/design";
import type { DesignCaseWithPanels } from "@/lib/types/design";

interface DesignRequestIndexTableProps {
  /** e.g. orderer contains "京王" — the underlying data is always the whole system-wide list, never scoped to one Project. */
  filter?: (item: DesignCaseWithPanels) => boolean;
}

/**
 * 設計依頼書目次・京王 / ・その他 (③④) — a different real template from
 * ②図面管理台帳. Confirmed against the actual ③④ workbooks: 図番/管理番号(見積番号)/
 * 件名/担当/備考, where 件名 is really a combined 件名／盤名称 field — shown here
 * as a separate 盤名称 column for readability. The real workbook lays each
 * year out as its own titled block ("設計依頼書　目次　20XX年度") placed side by
 * side on the same sheet, oldest on the left — reproduced here as one panel
 * per year in a horizontally-scrolling row instead of a single table with a
 * year dropdown.
 */
export function DesignRequestIndexTable({ filter }: DesignRequestIndexTableProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const [items, setItems] = useState<DesignCaseWithPanels[] | null>(null);
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

  const filtered = useMemo(() => {
    if (!scoped) return null;
    const q = query.trim().toLowerCase();
    if (!q) return scoped;
    return scoped.filter(({ case: c, panels }) => {
      const haystack = [c.drawingNumber, c.managementNumber, c.projectName, c.assignee, ...panels.map((p) => p.panelName)]
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

  return (
    <div className="flex flex-col gap-3">
      <div className="panel">
        <div className="panel-body-compact">
          <label className="field-label">{t("common.search")}</label>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("design.index.searchPlaceholder")}
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
          <div className="panel-body py-8 text-center text-[13px] text-muted-2">{t("design.index.empty")}</div>
        </div>
      ) : (
        <div className="flex items-start gap-3 overflow-x-auto pb-1">
          {yearBlocks.map(({ year, cases }) => (
            <div key={year} className="panel shrink-0" style={{ width: 680 }}>
              <div className="panel-header-compact">
                <span className="panel-title">{t("design.index.yearBlockTitle", { year })}</span>
              </div>
              <div className="data-table-wrap">
                <table className="data-table" style={{ minWidth: 660 }}>
                  <thead>
                    <tr>
                      <th style={{ width: "90px" }}>{t("design.index.columns.drawingNumber")}</th>
                      <th style={{ width: "120px" }}>{t("design.index.columns.managementNumber")}</th>
                      <th>{t("design.index.columns.projectName")}</th>
                      <th style={{ width: "110px" }}>{t("design.index.columns.panelNames")}</th>
                      <th style={{ width: "70px" }}>{t("design.index.columns.assignee")}</th>
                      <th style={{ width: "70px" }}>{t("design.index.columns.remarks")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cases.map(({ case: c, panels }) => (
                      <tr
                        key={c.id}
                        onClick={() => router.push(`/design?tab=designRequest&project=${c.projectId}&case=${c.id}`)}
                        className="cursor-pointer"
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
                        <td className="truncate">{c.projectName}</td>
                        <td className="truncate text-muted">
                          {panels
                            .map((p) => p.panelName)
                            .filter(Boolean)
                            .join("・")}
                        </td>
                        <td>{c.assignee}</td>
                        <td className="truncate text-muted">{c.designRemarks}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
