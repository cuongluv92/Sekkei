"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { designCaseService } from "@/lib/services/design";
import type { DesignCaseWithPanels } from "@/lib/types/design";

interface CaseLedgerTableProps {
  /** Optional filter (e.g. orderer contains "京王") — the underlying data is always the whole system-wide ledger, never scoped to one Project. */
  filter?: (item: DesignCaseWithPanels) => boolean;
}

/**
 * Read-only, database-driven ledger view shared by 図面管理台帳 /
 * 設計依頼書目次・京王 / 設計依頼書目次・その他 — these are aggregate views across
 * every Project (never require picking a Project first). Excel cell mapping
 * for the real ②/③/④ templates is intentionally not implemented yet; this
 * only reads the same DesignCase/CasePanel data already backing 設計依頼書.
 */
export function CaseLedgerTable({ filter }: CaseLedgerTableProps) {
  const { t } = useTranslation();
  const [items, setItems] = useState<DesignCaseWithPanels[] | null>(null);

  useEffect(() => {
    let active = true;
    designCaseService.listAll().then((list) => {
      if (active) setItems(list);
    });
    return () => {
      active = false;
    };
  }, []);

  const rows = items ? (filter ? items.filter(filter) : items) : null;

  return (
    <div className="panel">
      <div className="data-table-wrap">
        <table className="data-table" style={{ minWidth: 980 }}>
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
              <th style={{ width: "100px" }}>{t("design.ledger.columns.updatedAt")}</th>
            </tr>
          </thead>
          <tbody>
            {rows === null ? (
              <tr>
                <td colSpan={9} className="py-8 text-center text-muted">
                  {t("common.loading")}
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-8 text-center text-muted-2">
                  {t("design.ledger.empty")}
                </td>
              </tr>
            ) : (
              rows.map(({ case: c, panels }) => (
                <tr key={c.id}>
                  <td>{c.year}</td>
                  <td className="font-mono">{c.drawingNumber}</td>
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
                  <td className="text-muted-2">{c.updatedAt}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
