"use client";

import {
  Download,
  Eye,
  Loader2,
  Search as SearchIcon,
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
import { PageHeader } from "@/components/common/PageHeader";
import type { Catalog } from "@/lib/types";

function CatalogView() {
  const { t, locale } = useTranslation();
  const searchParams = useSearchParams();
  const [items, setItems] = useState<Catalog[]>([]);
  const [loading, setLoading] = useState(true);
  // Honors a `?q=<text>` deep link (e.g. from Global Search's カタログ result).
  const [keyword, setKeyword] = useState(searchParams.get("q") ?? "");
  const [manufacturerFilter, setManufacturerFilter] = useState("all");
  const [selected, setSelected] = useState<Catalog | null>(null);
  const [uploading, setUploading] = useState(false);
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
      return matchesKeyword && matchesManufacturer;
    });
  }, [items, keyword, manufacturerFilter]);

  function handleDownload(item: Catalog) {
    const file = item.files[0];
    if (file) openFileAsset(file);
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
      width: "170px",
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
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t("catalog.title")}
        description={t("catalog.description")}
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
