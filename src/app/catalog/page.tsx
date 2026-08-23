"use client";

import {
  Download,
  Eye,
  Loader2,
  Search as SearchIcon,
  Settings,
  Trash2,
  Upload,
} from "lucide-react";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslation } from "@/lib/i18n";
import { catalogService, uploadPartFile } from "@/lib/services";
import {
  getManufacturerName,
  preloadManufacturers,
} from "@/lib/mock/manufacturers";
import { openFileAsset } from "@/lib/utils/fileDownload";
import { useMockFeedback } from "@/lib/hooks/useMockFeedback";
import { DataTable, type DataTableColumn } from "@/components/common/DataTable";
import { FilePreview } from "@/components/common/FilePreview";
import { Modal } from "@/components/common/Modal";
import { PageHeader } from "@/components/common/PageHeader";
import { PartMasterSettings } from "@/components/settings/PartMasterSettings";
import { distinctCategories } from "@/lib/utils/partSearch";
import type { Catalog } from "@/lib/types";

function CatalogView() {
  const { t, locale } = useTranslation();
  const searchParams = useSearchParams();
  const [items, setItems] = useState<Catalog[]>([]);
  const [loading, setLoading] = useState(true);
  // Honors a `?q=<text>` deep link (e.g. from Global Search's カタログ result).
  const [keyword, setKeyword] = useState(searchParams.get("q") ?? "");
  const [manufacturerFilter, setManufacturerFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [selected, setSelected] = useState<Catalog | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { message, show } = useMockFeedback();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    Promise.all([preloadManufacturers(), catalogService.list()]).then(
      ([, res]) => {
        if (!active) return;
        setItems(res);
        setLoading(false);
      },
    );
    return () => {
      active = false;
    };
  }, []);

  const manufacturerIds = useMemo(
    () => Array.from(new Set(items.map((i) => i.manufacturerId))),
    [items],
  );
  const categories = useMemo(() => distinctCategories(items), [items]);

  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return items.filter((i) => {
      const matchesKeyword =
        !q ||
        [i.model, i.category, i.fileName].some((f) =>
          f.toLowerCase().includes(q),
        );
      const matchesManufacturer =
        manufacturerFilter === "all" || i.manufacturerId === manufacturerFilter;
      const matchesCategory =
        categoryFilter === "all" || i.category === categoryFilter;
      return matchesKeyword && matchesManufacturer && matchesCategory;
    });
  }, [items, keyword, manufacturerFilter, categoryFilter]);

  function handleDownload(item: Catalog) {
    const file = item.files[0];
    if (file) openFileAsset(file);
  }

  async function handleDelete(item: Catalog) {
    if (
      !window.confirm(t("common.deleteToTrashConfirm", { model: item.model }))
    )
      return;
    setDeletingId(item.id);
    try {
      await catalogService.moveToTrash(item.id);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      setSelected((prev) => (prev?.id === item.id ? null : prev));
      show(t("common.movedToTrash"));
    } catch {
      show(t("common.deleteError"));
    } finally {
      setDeletingId(null);
    }
  }

  // Deletes every row currently shown by the table — the button only
  // appears once a specific 分類 is chosen, so the visible table is exactly
  // "this whole 分類 group" (e.g. 漏電遮断機) at that point.
  async function handleBulkDeleteCategory() {
    const targets = filtered;
    if (targets.length === 0) return;
    if (
      !window.confirm(
        t("common.bulkDeleteCategoryConfirm", {
          category: categoryFilter,
          count: targets.length,
        }),
      )
    )
      return;
    setBulkDeleting(true);
    try {
      for (const item of targets) {
        await catalogService.moveToTrash(item.id);
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

  async function handleUploadFile(file: File) {
    if (!selected) return;
    setUploading(true);
    try {
      const asset = await uploadPartFile("catalog", selected.id, file);
      const withNewFile = (item: Catalog) =>
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

  const columns: DataTableColumn<Catalog>[] = [
    {
      key: "manufacturer",
      header: t("common.manufacturer"),
      width: "150px",
      render: (r) => getManufacturerName(r.manufacturerId, locale),
    },
    { key: "category", header: t("common.category"), width: "150px" },
    { key: "model", header: t("common.model"), width: "160px" },
    { key: "fileName", header: t("common.fileName") },
    { key: "updatedAt", header: t("common.updatedAt"), width: "110px" },
    {
      key: "actions",
      header: t("common.actions"),
      width: "210px",
      render: (r) => (
        <div
          className="flex items-center gap-1.5"
          onClick={(e) => e.stopPropagation()}
        >
          <button onClick={() => setSelected(r)} className="btn-secondary">
            <Eye className="h-3.5 w-3.5" />
            {t("common.display")}
          </button>
          <button
            onClick={() => handleDownload(r)}
            disabled={r.files.length === 0}
            className="btn-ghost"
          >
            <Download className="h-3.5 w-3.5" />
            {t("common.download")}
          </button>
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
        title={t("catalog.title")}
        description={t("catalog.description")}
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
          value={manufacturerFilter}
          onChange={(e) => setManufacturerFilter(e.target.value)}
          className="field-input max-w-[180px]"
        >
          <option value="all">{t("common.all")}</option>
          {manufacturerIds.map((id) => (
            <option key={id} value={id}>
              {getManufacturerName(id, locale)}
            </option>
          ))}
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="field-input max-w-[180px]"
        >
          <option value="all">{t("common.allCategories")}</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {categoryFilter !== "all" && (
        <div className="flex justify-end">
          <button
            onClick={handleBulkDeleteCategory}
            disabled={bulkDeleting || filtered.length === 0}
            className="btn-ghost text-danger hover:bg-danger/10"
          >
            {bulkDeleting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
            {t("common.bulkDeleteCategory", {
              category: categoryFilter,
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
            emptyMessage={t("catalog.tableEmpty")}
          />
        </div>
        <FilePreview
          selectedKey={selected?.id ?? null}
          title={selected?.fileName}
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
                accept=".pdf,.jpg,.jpeg,.png,.gif,.webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleUploadFile(file);
                  e.target.value = "";
                }}
              />
            </div>
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

export default function CatalogPage() {
  return (
    <Suspense fallback={null}>
      <CatalogView />
    </Suspense>
  );
}
