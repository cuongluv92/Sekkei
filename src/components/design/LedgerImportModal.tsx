"use client";

import { Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { commitLedgerImportRows, type LedgerImportRow } from "@/lib/services/design";
import { Modal } from "@/components/common/Modal";

interface LedgerImportModalProps {
  rows: LedgerImportRow[];
  onClose: () => void;
  onImported: (count: number) => void;
}

/**
 * ②図面管理台帳 ファイル取込 — preview of every row parsed from the uploaded
 * file before anything is written. A row whose 図面番号 already matches an
 * existing 案件 starts unchecked (still selectable — 図面番号 isn't a
 * DB-unique key — but re-importing it by accident should never be the
 * default).
 */
export function LedgerImportModal({ rows, onClose, onImported }: LedgerImportModalProps) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<Set<number>>(
    () => new Set(rows.map((_, i) => i).filter((i) => !rows[i].isDuplicate)),
  );
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedCount = selected.size;
  const duplicateCount = useMemo(() => rows.filter((r) => r.isDuplicate).length, [rows]);

  function toggle(i: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => (prev.size === rows.length ? new Set() : new Set(rows.map((_, i) => i))));
  }

  async function handleImport() {
    setError(null);
    setImporting(true);
    try {
      const targetRows = rows.filter((_, i) => selected.has(i));
      const count = await commitLedgerImportRows(targetRows);
      onImported(count);
    } catch {
      setError(t("design.ledger.importParseError"));
    } finally {
      setImporting(false);
    }
  }

  return (
    <Modal title={t("design.ledger.importModalTitle")} onClose={onClose} widthClassName="max-w-6xl">
      <div className="flex flex-col gap-3">
        <p className="text-[12px] text-muted">{t("design.ledger.importModalDescription")}</p>
        {duplicateCount > 0 && (
          <p className="text-[11.5px] text-warning">
            {t("design.ledger.importDuplicateHint", { count: duplicateCount })}
          </p>
        )}

        <div className="data-table-wrap max-h-[50vh]">
          <table className="data-table" style={{ minWidth: 1180 }}>
            <thead>
              <tr>
                <th style={{ width: "36px" }}>
                  <input
                    type="checkbox"
                    checked={selected.size === rows.length && rows.length > 0}
                    onChange={toggleAll}
                  />
                </th>
                <th style={{ width: "70px" }}>{t("design.ledger.columns.year")}</th>
                <th style={{ width: "100px" }}>{t("design.ledger.columns.drawingNumber")}</th>
                <th style={{ width: "110px" }}>{t("design.ledger.columns.managementNumber")}</th>
                <th style={{ width: "110px" }}>{t("design.ledger.columns.constructionNumber")}</th>
                <th>{t("design.ledger.columns.orderer")}</th>
                <th>{t("design.ledger.columns.projectName")}</th>
                <th>{t("design.ledger.columns.panelNames")}</th>
                <th style={{ width: "70px" }} className="text-right">
                  {t("design.ledger.importColumns.faceCount")}
                </th>
                <th style={{ width: "80px" }} className="text-center">
                  {t("design.ledger.columns.manufacturingComplete")}
                </th>
                <th style={{ width: "100px" }}>{t("design.ledger.importColumns.deliveryDate")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={`${row.sheetName}-${row.excelRowNumber}`} className={row.isDuplicate ? "opacity-60" : ""}>
                  <td>
                    <input type="checkbox" checked={selected.has(i)} onChange={() => toggle(i)} />
                  </td>
                  <td className="font-mono">{row.year}</td>
                  <td className="font-mono">
                    {row.drawingNumber}
                    {row.isDuplicate && (
                      <span className="ml-1.5 rounded border border-warning/40 px-1 py-0.5 text-[10px] text-warning">
                        {t("design.ledger.importDuplicateBadge")}
                      </span>
                    )}
                  </td>
                  <td className="font-mono">{row.managementNumber}</td>
                  <td>{row.constructionNumber}</td>
                  <td className="truncate">{row.orderer}</td>
                  <td className="truncate">{row.projectName}</td>
                  <td className="truncate text-muted">{row.panelNames.join("・")}</td>
                  <td className="text-right font-mono">{row.faceCount ?? "—"}</td>
                  <td className="text-center">{row.manufacturingComplete ? "完" : ""}</td>
                  <td className="font-mono text-muted-2">{row.deliveryDate ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {error && <p className="text-[12px] text-danger">{error}</p>}

        <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
          <span className="text-[12px] text-muted">
            {t("design.ledger.importSelectedCount", { count: selectedCount, total: rows.length })}
          </span>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="btn-secondary">
              {t("common.cancel")}
            </button>
            <button onClick={handleImport} disabled={selectedCount === 0 || importing} className="btn-primary">
              {importing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {t("design.ledger.importConfirmButton")}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
