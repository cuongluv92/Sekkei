"use client";

import { useTranslation } from "@/lib/i18n";
import { getManufacturerName } from "@/lib/mock/manufacturers";
import { DataTable, type DataTableColumn } from "@/components/common/DataTable";
import { FileActions } from "@/components/common/FileActions";
import type { SearchResultItem } from "@/lib/types";

interface SearchResultListProps {
  results: SearchResultItem[];
  loading?: boolean;
  selectedKey?: string | null;
  onSelect: (item: SearchResultItem) => void;
  onDownload: (item: SearchResultItem, kind: "dwg" | "pdf") => void;
  emptyMessage?: string;
}

/**
 * Renders 部品データ + 部品図 search hits in one table. Used by 検索 today; the
 * same shape (`SearchResultItem`) also backs the search box on 部品製作, so
 * this component is not 検索-specific.
 */
export function SearchResultList({
  results,
  loading,
  selectedKey,
  onSelect,
  onDownload,
  emptyMessage,
}: SearchResultListProps) {
  const { t, locale } = useTranslation();

  const columns: DataTableColumn<SearchResultItem>[] = [
    {
      key: "sourceType",
      header: t("common.source"),
      width: "110px",
      render: (row) => (
        <span
          className={
            row.source === "part-data"
              ? "badge-info"
              : row.source === "part-drawing"
                ? "badge-neutral"
                : "badge-success"
          }
        >
          {row.source === "part-data"
            ? t("search.fromPartData")
            : row.source === "part-drawing"
              ? t("search.fromPartDrawing")
              : t("search.fromCatalog")}
        </span>
      ),
    },
    { key: "category", header: t("common.kind"), width: "140px" },
    {
      key: "manufacturer",
      header: t("common.manufacturer"),
      width: "150px",
      render: (row) => getManufacturerName(row.manufacturerId, locale),
    },
    { key: "model", header: t("common.model"), width: "140px" },
    { key: "specification", header: t("common.specification") },
    {
      key: "quantity",
      header: t("common.quantity"),
      width: "70px",
      align: "right",
      render: (row) => (row.quantity !== undefined ? String(row.quantity) : "—"),
    },
    { key: "remarks", header: t("common.remarks"), width: "160px", render: (row) => row.remarks || "—" },
    { key: "sourceLabel", header: t("partData.title"), width: "150px" },
    {
      key: "actions",
      header: t("common.actions"),
      width: "220px",
      render: (row) => (
        <FileActions
          files={row.files}
          onView={() => onSelect(row)}
          onDownload={(kind) => onDownload(row, kind)}
        />
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={results}
      rowKey={(row) => `${row.source}-${row.id}`}
      onRowClick={onSelect}
      selectedRowKey={selectedKey ?? undefined}
      loading={loading}
      emptyMessage={emptyMessage}
    />
  );
}
