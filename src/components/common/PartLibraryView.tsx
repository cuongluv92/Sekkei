"use client";

import { Loader2, Settings, Trash2, Upload } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslation } from "@/lib/i18n";
import { uploadPartFile } from "@/lib/services";
import {
  getManufacturerName,
  listManufacturers,
  preloadManufacturers,
} from "@/lib/mock/manufacturers";
import { findFileByKind, openFileAsset } from "@/lib/utils/fileDownload";
import { useMockFeedback } from "@/lib/hooks/useMockFeedback";
import { DataTable, type DataTableColumn } from "@/components/common/DataTable";
import { FileActions } from "@/components/common/FileActions";
import { FilePreview } from "@/components/common/FilePreview";
import { Modal } from "@/components/common/Modal";
import { PageHeader } from "@/components/common/PageHeader";
import {
  PartFilterBar,
  type PartFilterBarValue,
} from "@/components/common/PartFilterBar";
import { PartMasterSettings } from "@/components/settings/PartMasterSettings";
import {
  distinctCategories,
  distinctManufacturerIds,
  hasUncategorizedItem,
  hasUnsetManufacturer,
  matchesPartFilters,
  UNSET_FILTER_VALUE,
} from "@/lib/utils/partSearch";
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
  const searchParams = useSearchParams();
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<PartFilterBarValue>(() => {
    // Honors a `?q=<text>&spec=<text>` deep link (e.g. from Global Search's
    // 部品データ/部品図 result) by prefilling both filters — read once at
    // mount, the user's own typing takes over after that. Global Search's
    // 定格・仕様 field maps straight onto 定格・仕様 here (the strict
    // technical-token matcher, matchesSpecificationQuery, applies), and both
    // can be set together to narrow results the same way they did there.
    return {
      manufacturerId: "",
      category: "",
      keyword: searchParams.get("q") ?? "",
      specification: searchParams.get("spec") ?? "",
    };
  });
  const [sourceFilter, setSourceFilter] = useState("");
  const [selected, setSelected] = useState<T | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
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

  // メーカー options are limited to manufacturers that actually have ≥1 active record here — never the
  // full manufacturer master (see spec #1). 分類 narrows to the selected メーカー's own categories when one
  // is chosen (spec #2), and "未設定"/"未分類" only appear when a real record is actually missing that field.
  const activeManufacturerIds = useMemo(
    () => new Set(distinctManufacturerIds(items)),
    [items],
  );
  const manufacturers = useMemo(
    () => listManufacturers().filter((m) => activeManufacturerIds.has(m.id)),
    [activeManufacturerIds],
  );
  const categoryScopeItems = useMemo(
    () =>
      filters.manufacturerId
        ? items.filter((i) =>
            matchesPartFilters(i, { manufacturerId: filters.manufacturerId }),
          )
        : items,
    [items, filters.manufacturerId],
  );
  const categories = useMemo(
    () => distinctCategories(categoryScopeItems),
    [categoryScopeItems],
  );

  // 部品製作 の取込から自動登録された部品 (自作/手配品) は、インポート画面や
  // カタログ由来の部品と source が違う — メーカーの正式カタログ品と混ざって
  // 見えないよう、この一覧だけで絞り込めるようにする (spec: 部品6要望)。
  const sources = useMemo(
    () => Array.from(new Set(items.map((i) => i.source).filter(Boolean))),
    [items],
  );
  const filtered = useMemo(
    () =>
      items.filter(
        (i) => matchesPartFilters(i, filters) && (!sourceFilter || i.source === sourceFilter),
      ),
    [items, filters, sourceFilter],
  );

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
        item.id === selected.id
          ? { ...item, files: [...item.files, asset] }
          : item;
      setItems((prev) => prev.map(withNewFile));
      setSelected((prev) =>
        prev ? { ...prev, files: [...prev.files, asset] } : prev,
      );
      show(t("common.fileUploaded", { fileName: file.name }));
    } catch {
      show(t("common.uploadError"));
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(item: T) {
    if (
      !window.confirm(t("common.deleteToTrashConfirm", { model: item.model }))
    )
      return;
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

  // メーカー・分類 (種類・品名)・source のどれか1つでも絞り込まれていれば
  // 「このグループをまとめて削除」を出す — 分類だけに限定すると、メーカー
  // 単位や自動登録品(source)単位でまとめて消したいときに使えなかったため。
  // キーワード検索だけでは出さない(誤字で意図せず広い範囲を消しかねない)。
  const hasGroupFilter = Boolean(filters.manufacturerId || filters.category || sourceFilter);
  function activeFilterSummary(): string {
    const parts: string[] = [];
    if (filters.manufacturerId) {
      parts.push(
        filters.manufacturerId === UNSET_FILTER_VALUE
          ? t("common.unsetManufacturer")
          : getManufacturerName(filters.manufacturerId, locale),
      );
    }
    if (filters.category) {
      parts.push(filters.category === UNSET_FILTER_VALUE ? t("common.uncategorized") : filters.category);
    }
    if (sourceFilter) parts.push(sourceFilter);
    return parts.join(" / ");
  }

  // 表示中の一覧 (filtered = 全アクティブフィルタを反映済み) をまとめてゴミ箱へ
  // 移動する。Sequential awaits (not Promise.all) so a mid-batch failure
  // leaves `items`/`deletingId`-free rows in a known, inspectable state
  // rather than a partial concurrent mess.
  async function handleBulkDeleteFiltered() {
    const targets = filtered;
    if (targets.length === 0) return;
    if (
      !window.confirm(
        t("common.bulkDeleteFilteredConfirm", {
          summary: activeFilterSummary(),
          count: targets.length,
        }),
      )
    )
      return;
    setBulkDeleting(true);
    try {
      for (const item of targets) {
        await onDelete(item.id);
      }
      const deletedIds = new Set(targets.map((i) => i.id));
      setItems((prev) => prev.filter((i) => !deletedIds.has(i.id)));
      setSelected((prev) => (prev && deletedIds.has(prev.id) ? null : prev));
      show(t("common.bulkDeletedToTrash", { count: targets.length }));
    } catch {
      show(t("common.bulkDeleteError"));
    } finally {
      setBulkDeleting(false);
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
    {
      key: "category",
      header: t("common.kind"),
      width: "140px",
      render: (r) => r.category || t("common.uncategorized"),
    },
    {
      key: "manufacturer",
      header: t("common.manufacturer"),
      width: "150px",
      render: (r) =>
        r.manufacturerId
          ? getManufacturerName(r.manufacturerId, locale)
          : t("common.unsetManufacturer"),
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
            render: (r: T) =>
              r.quantity !== undefined ? String(r.quantity) : "—",
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
        <div
          className="flex items-center gap-1.5"
          onClick={(e) => e.stopPropagation()}
        >
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
      <PageHeader
        title={title}
        description={description}
        actions={
          <button
            onClick={() => setSettingsOpen(true)}
            className="btn-secondary"
          >
            <Settings className="h-3.5 w-3.5" />
            {t("common.settings")}
          </button>
        }
      />

      {sources.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setSourceFilter("")}
            className={
              sourceFilter === ""
                ? "rounded-md bg-accent px-3 py-1.5 text-[12px] font-bold text-accent-foreground"
                : "rounded-md border border-border-strong px-3 py-1.5 text-[12px] font-semibold text-muted hover:text-foreground"
            }
          >
            {t("common.all")}
          </button>
          {sources.map((source) => (
            <button
              key={source}
              type="button"
              onClick={() => setSourceFilter(source)}
              className={
                sourceFilter === source
                  ? "rounded-md bg-accent px-3 py-1.5 text-[12px] font-bold text-accent-foreground"
                  : "rounded-md border border-border-strong px-3 py-1.5 text-[12px] font-semibold text-muted hover:text-foreground"
              }
            >
              {source}
            </button>
          ))}
        </div>
      )}

      <PartFilterBar
        value={filters}
        onChange={setFilters}
        manufacturers={manufacturers}
        categories={categories}
        locale={locale}
        showUnsetManufacturer={hasUnsetManufacturer(items)}
        showUncategorized={hasUncategorizedItem(items)}
      />

      {hasGroupFilter && (
        <div className="flex justify-end">
          <button
            onClick={handleBulkDeleteFiltered}
            disabled={bulkDeleting || filtered.length === 0}
            className="btn-ghost text-danger hover:bg-danger/10"
          >
            {bulkDeleting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
            {t("common.bulkDeleteFiltered", {
              summary: activeFilterSummary(),
              count: filtered.length,
            })}
          </button>
        </div>
      )}

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
        <FilePreview
          selectedKey={selected?.id ?? null}
          title={selected?.model}
          files={selected?.files ?? []}
        />
      </div>

      {selected && (
        <div className="panel">
          <div className="panel-header">
            <span className="panel-title">{t("common.detail")}</span>
            <div>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="btn-secondary"
              >
                {uploading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Upload className="h-3.5 w-3.5" />
                )}
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
              <DetailField
                label={t("common.symbol")}
                value={selected.symbol || "—"}
              />
            )}
            <DetailField
              label={t("common.kind")}
              value={selected.category || t("common.uncategorized")}
            />
            <DetailField
              label={t("common.manufacturer")}
              value={
                selected.manufacturerId
                  ? getManufacturerName(selected.manufacturerId, locale)
                  : t("common.unsetManufacturer")
              }
            />
            <DetailField label={t("common.model")} value={selected.model} />
            <DetailField
              label={t("common.specification")}
              value={selected.specification}
            />
            {showQuantity && (
              <DetailField
                label={t("common.quantity")}
                value={
                  selected.quantity !== undefined
                    ? String(selected.quantity)
                    : "—"
                }
              />
            )}
            <DetailField
              label={t("common.remarks")}
              value={selected.remarks || "—"}
            />
            {showPartDataFields && (
              <DetailField
                label={t("common.weight")}
                value={
                  selected.weight !== undefined ? `${selected.weight} kg` : "—"
                }
              />
            )}
            <DetailField label={t("common.source")} value={selected.source} />
            <DetailField
              label={t("common.updatedAt")}
              value={selected.updatedAt}
            />
          </div>
        </div>
      )}

      {message && <div className="text-[12px] text-success">{message}</div>}

      {settingsOpen && (
        <Modal
          title={t("common.settings")}
          onClose={() => setSettingsOpen(false)}
          widthClassName="max-w-3xl"
        >
          <PartMasterSettings />
        </Modal>
      )}
    </div>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] tracking-wide text-muted uppercase">
        {label}
      </div>
      <div className="mt-0.5 text-[12.5px] text-foreground">{value}</div>
    </div>
  );
}
