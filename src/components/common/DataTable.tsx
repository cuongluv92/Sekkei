"use client";

import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "@/lib/i18n";

export interface DataTableColumn<T> {
  key: string;
  header: string;
  width?: string;
  align?: "left" | "right" | "center";
  render?: (row: T) => ReactNode;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  onRowDoubleClick?: (row: T) => void;
  selectedRowKey?: string | null;
  loading?: boolean;
  emptyMessage?: string;
}

/**
 * Generic dense table used across 部品データ / 部品図 / カタログ / 部品製作 /
 * 検索 and calculation result screens. Column rendering is fully delegated
 * via `render`, so callers decide how each cell (badges, action buttons,
 * editable inputs) looks without this component knowing about domain data.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  onRowDoubleClick,
  selectedRowKey,
  loading,
  emptyMessage,
}: DataTableProps<T>) {
  const { t } = useTranslation();
  const minWidth = columns.reduce((sum, col) => sum + (parseInt(col.width ?? "", 10) || 180), 0);

  return (
    <div className="data-table-wrap">
      <table className="data-table" style={{ minWidth }}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key} style={{ width: col.width }} className={alignClass(col.align)}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={columns.length} className="py-8 text-center text-muted">
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {t("common.loading")}
                </span>
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="py-8 text-center text-muted-2">
                {emptyMessage ?? t("common.noResults")}
              </td>
            </tr>
          ) : (
            rows.map((row) => {
              const key = rowKey(row);
              return (
                <tr
                  key={key}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  onDoubleClick={onRowDoubleClick ? () => onRowDoubleClick(row) : undefined}
                  className={`${onRowClick ? "cursor-pointer" : ""} ${
                    selectedRowKey === key ? "is-selected" : ""
                  }`}
                >
                  {columns.map((col) => (
                    <td key={col.key} className={alignClass(col.align)}>
                      {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? "")}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

function alignClass(align?: "left" | "right" | "center") {
  if (align === "right") return "text-right";
  if (align === "center") return "text-center";
  return "text-left";
}
