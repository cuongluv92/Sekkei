"use client";

import { Loader2, Search as SearchIcon, Trash2, Upload } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { uploadPartFile } from "@/lib/services";
import { getManufacturerName, preloadManufacturers } from "@/lib/mock/manufacturers";
import { findFileByKind, openFileAsset } from "@/lib/utils/fileDownload";
import { useMockFeedback } from "@/lib/hooks/useMockFeedback";
import { DataTable, type DataTableColumn } from "@/components/common/DataTable";
import { FileActions } from "@/components/common/FileActions";
import { FilePreview } from "@/components/common/FilePreview";
import { PageHeader } from "@/components/common/PageHeader";
import type { FileAssetOwnerType } from "@/lib/services/fileAssetService";
import type { FileAsset } from "@/lib/types";

interface LibraryItem {
  id: string;
  symbol?: string;
  category: string;
  manufacturerId: string;
  model: string;
  specification: string;
  weight?: number;
  remarks?: string;
  quantity?: number;
  source: string;
  files: FileAsset[];
  updatedAt: string;
}

interface PartLibraryViewProps<T extends LibraryItem> {
  title: string;
  description: string;
  emptyMessage: string;
  fetchAll: () => Promise<T[]>;
  /** Which owner_type file_assets rows uploaded here get attached under. */
  ownerType: FileAssetOwnerType;
  /** Moves a row to ゴミ箱 (soft delete) — recoverable from the trash screen. */
  onDelete: (id: string) => Promise<void>;
  showQuantity?: boolean;
  /** 部品データ only: 記号・重量 columns/detail fields (部品図 has neither field). */
  showPartDataFields?: boolean;
}

/**
 * Shared screen shape for 部品データ and 部品図: search + category filter +
 * table + detail panel + file preview. The two pages differ only in which
 * repository they read from and whether 数量 applies, so both are thin
 * wrappers around this component instead of duplicated screens.
 */
export function PartLibraryView<T extends LibraryItem>({
  title,
  description,
  emptyMessage,
  fetchAll,
  ownerType,
  onDelete,
  showQuantity,
  showPartDataFields,
}: PartLibraryViewProps<T>) {
  const { t, locale } = useTranslation();
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [selected, setSelected] = useState<T | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { message, show } = useMockFeedback();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // `fetchAll` identity is not meaningful across renders (it's a fresh closure
  // over a stable repository call on every parent render); only its value at
  // mount time matters, so it's captured once via lazy state instead of a
  // ref mutated during render.
  const [fetchAllOnce] = useState(() => fetchAll);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([preloadManufacturers(), fetchAllOnce()]).then(([, res]) => {
      if (!active) return;
      setItems(res);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [fetchAllOnce]);

  const categories = useMemo(() => Array.from(new Set(items.map((i) => i.category))), [items]);

  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return items.filter((i) => {
      const matchesKeyword =
        !q ||
        [i.symbol, i.model, i.category, i.specification, i.remarks]
          .filter(Boolean)
          .some((f) => f!.toLowerCase().includes(q));
      const matchesCategory = categoryFilter === "all" || i.category === categoryFilter;
      return matchesKeyword && matchesCategory;
    });
  }, [items, keyword, categoryFilter]);

  function handleDownload(item: T, kind: FileAsset["kind"]) {
    const file = findFileByKind(item.files, kind);
    if (file) openFileAsset(file);
  }

  async function handleUploadFile(file: File) {
    if (!selected) return;
    setUploading(true);
    try {
      const asset = await uploadPartFile(ownerType, selected.id, file);
      const withNewFile = (item: T) =>
        item.id === selected.id ? { ...item, files: [...item.files, asset] } : item;
      setItems((prev) => prev.map(withNewFile));
      setSelected((prev) => (prev ? { ...prev, files: [...prev.files, asset] } : prev));
      show(t("common.fileUploaded", { fileName: file.name }));
    } catch {
      show(t("common.uploadError"));
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(item: T) {
    if (!window.confirm(t("common.deleteToTrashConfirm", { model: item.model }))) return;
    setDeletingId(item.id);
    try {
      await onDelete(item.id);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      setSelected((prev) => (prev?.id === item.id ? null : prev));
      show(t("common.movedToTrash"));
    } catch {
      show(t("common.deleteError"));
    } finally {
      setDeletingId(null);
    }
  }

  const columns: DataTableColumn<T>[] = [
    ...(showPartDataFields
      ? [
          {
            key: "symbol",
            header: t("common.symbol"),
            width: "90px",
            render: (r: T) => r.symbol || "—",
          },
        ]
      : []),
    { key: "category", header: t("common.kind"), width: "140px" },
    {
      key: "manufacturer",
      header: t("common.manufacturer"),
      width: "150px",
      render: (r) => getManufacturerName(r.manufacturerId, locale),
    },
    {
      key: "model",
      header: t("common.model"),
      width: "140px",
      render: (r) => <span className="font-mono text-[12px]">{r.model}</span>,
    },
    { key: "specification", header: t("common.specification") },
    ...(showQuantity
      ? [
          {
            key: "quantity",
            header: t("common.quantity"),
            width: "70px",
            align: "right" as const,
            render: (r: T) => (r.quantity !== undefined ? String(r.quantity) : "—"),
          },
        ]
      : []),
    {
      key: "remarks",
      header: t("common.remarks"),
      width: "150px",
      render: (r) => r.remarks || "—",
    },
    ...(showPartDataFields
      ? [
          {
            key: "weight",
            header: t("common.weight"),
            width: "90px",
            align: "right" as const,
            render: (r: T) => (r.weight !== undefined ? `${r.weight} kg` : "—"),
          },
        ]
      : []),
    { key: "updatedAt", header: t("common.updatedAt"), width: "110px" },
    {
      key: "actions",
      header: t("common.actions"),
      width: "260px",
      render: (r) => (
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          <FileActions
            files={r.files}
            onView={() => setSelected(r)}
            onDownload={(kind) => handleDownload(r, kind)}
          />
          <button
            onClick={() => handleDelete(r)}
            disabled={deletingId === r.id}
            title={t("common.moveToTrash")}
            className="btn-ghost btn-icon text-danger hover:bg-danger/10"
          >
            {deletingId === r.id ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={title} description={description} />

      <div className="flex flex-wrap gap-2">
        <div className="relative max-w-xs flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-2" />
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder={t("common.search")}
            className="field-input pl-8"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="field-input max-w-[180px]"
        >
          <option value="all">{t("common.all")}</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="panel overflow-hidden">
          <DataTable
            columns={columns}
            rows={filtered}
            rowKey={(r) => r.id}
            loading={loading}
            onRowClick={setSelected}
            selectedRowKey={selected?.id ?? undefined}
            emptyMessage={emptyMessage}
          />
        </div>
        <FilePreview selectedKey={selected?.id ?? null} title={selected?.model} files={selected?.files ?? []} />
      </div>

      {selected && (
        <div className="panel">
          <div className="panel-header">
            <span className="panel-title">{t("common.detail")}</span>
            <div>
              <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="btn-secondary">
                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                {t("common.upload")}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".dwg,.dxf,.pdf,.jpg,.jpeg,.png,.gif,.webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleUploadFile(file);
                  e.target.value = "";
                }}
              />
            </div>
          </div>
          <div className="panel-body grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {showPartDataFields && (
              <DetailField label={t("common.symbol")} value={selected.symbol || "—"} />
            )}
            <DetailField label={t("common.kind")} value={selected.category} />
            <DetailField
              label={t("common.manufacturer")}
              value={getManufacturerName(selected.manufacturerId, locale)}
            />
            <DetailField label={t("common.model")} value={selected.model} />
            <DetailField label={t("common.specification")} value={selected.specification} />
            {showQuantity && (
              <DetailField
                label={t("common.quantity")}
                value={selected.quantity !== undefined ? String(selected.quantity) : "—"}
              />
            )}
            <DetailField label={t("common.remarks")} value={selected.remarks || "—"} />
            {showPartDataFields && (
              <DetailField
                label={t("common.weight")}
                value={selected.weight !== undefined ? `${selected.weight} kg` : "—"}
              />
            )}
            <DetailField label={t("common.source")} value={selected.source} />
            <DetailField label={t("common.updatedAt")} value={selected.updatedAt} />
          </div>
        </div>
      )}

      {message && <div className="text-[12px] text-success">{message}</div>}
    </div>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] tracking-wide text-muted uppercase">{label}</div>
      <div className="mt-0.5 text-[12.5px] text-foreground">{value}</div>
    </div>
  );
}
