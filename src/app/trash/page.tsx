"use client";

import { Loader2, RotateCcw, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { catalogService, partDataService, partDrawingService } from "@/lib/services";
import { getManufacturerName, preloadManufacturers } from "@/lib/mock/manufacturers";
import { useMockFeedback } from "@/lib/hooks/useMockFeedback";
import { DataTable, type DataTableColumn } from "@/components/common/DataTable";
import { PageHeader } from "@/components/common/PageHeader";
import type { Catalog, PartData, PartDrawing } from "@/lib/types";

interface TrashedItem {
  id: string;
  category: string;
  manufacturerId: string;
  model: string;
  specification?: string;
  fileName?: string;
  deletedAt?: string;
}

type TrashSection = "partData" | "partDrawing" | "catalog";

/**
 * ゴミ箱 — items removed (soft-deleted) from 部品データ・部品図 land here,
 * recoverable via 復元 or permanently removable via 完全に削除. Nothing here
 * is ever silently lost: purge is the only irreversible action, and it's
 * explicit per row.
 */
export default function TrashPage() {
  const { t, locale } = useTranslation();
  const [partDataTrash, setPartDataTrash] = useState<PartData[]>([]);
  const [partDrawingTrash, setPartDrawingTrash] = useState<PartDrawing[]>([]);
  const [catalogTrash, setCatalogTrash] = useState<Catalog[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const { message, show } = useMockFeedback();

  useEffect(() => {
    let active = true;
    Promise.all([
      preloadManufacturers(),
      partDataService.listTrashed(),
      partDrawingService.listTrashed(),
      catalogService.listTrashed(),
    ]).then(([, data, drawings, catalogs]) => {
      if (!active) return;
      setPartDataTrash(data);
      setPartDrawingTrash(drawings);
      setCatalogTrash(catalogs);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  async function handleRestore(section: TrashSection, item: TrashedItem) {
    setBusyId(item.id);
    try {
      if (section === "partData") {
        await partDataService.restore(item.id);
        setPartDataTrash((prev) => prev.filter((i) => i.id !== item.id));
      } else if (section === "partDrawing") {
        await partDrawingService.restore(item.id);
        setPartDrawingTrash((prev) => prev.filter((i) => i.id !== item.id));
      } else {
        await catalogService.restore(item.id);
        setCatalogTrash((prev) => prev.filter((i) => i.id !== item.id));
      }
      show(t("trash.restored"));
    } catch {
      show(t("trash.restoreError"));
    } finally {
      setBusyId(null);
    }
  }

  async function handlePurge(section: TrashSection, item: TrashedItem) {
    if (!window.confirm(t("trash.purgeConfirm", { model: item.model }))) return;
    setBusyId(item.id);
    try {
      if (section === "partData") {
        await partDataService.purge(item.id);
        setPartDataTrash((prev) => prev.filter((i) => i.id !== item.id));
      } else if (section === "partDrawing") {
        await partDrawingService.purge(item.id);
        setPartDrawingTrash((prev) => prev.filter((i) => i.id !== item.id));
      } else {
        await catalogService.purge(item.id);
        setCatalogTrash((prev) => prev.filter((i) => i.id !== item.id));
      }
      show(t("trash.purged"));
    } catch {
      show(t("trash.purgeError"));
    } finally {
      setBusyId(null);
    }
  }

  function columnsFor(section: TrashSection): DataTableColumn<TrashedItem>[] {
    return [
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
      section === "catalog"
        ? { key: "fileName", header: t("common.fileName"), render: (r) => r.fileName ?? "—" }
        : { key: "specification", header: t("common.specification") },
      { key: "deletedAt", header: t("trash.deletedAt"), width: "110px", render: (r) => r.deletedAt ?? "—" },
      {
        key: "actions",
        header: t("common.actions"),
        width: "200px",
        render: (r) => (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => handleRestore(section, r)}
              disabled={busyId === r.id}
              className="btn-secondary"
            >
              {busyId === r.id ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RotateCcw className="h-3.5 w-3.5" />
              )}
              {t("trash.restore")}
            </button>
            <button
              onClick={() => handlePurge(section, r)}
              disabled={busyId === r.id}
              className="btn-ghost text-danger hover:bg-danger/10"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {t("trash.purge")}
            </button>
          </div>
        ),
      },
    ];
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t("trash.title")} description={t("trash.description")} />

      <div className="panel overflow-hidden">
        <div className="panel-header">
          <span className="panel-title">{t("trash.partDataSection")}</span>
        </div>
        <DataTable
          columns={columnsFor("partData")}
          rows={partDataTrash}
          rowKey={(r) => r.id}
          loading={loading}
          emptyMessage={t("trash.tableEmpty")}
        />
      </div>

      <div className="panel overflow-hidden">
        <div className="panel-header">
          <span className="panel-title">{t("trash.partDrawingSection")}</span>
        </div>
        <DataTable
          columns={columnsFor("partDrawing")}
          rows={partDrawingTrash}
          rowKey={(r) => r.id}
          loading={loading}
          emptyMessage={t("trash.tableEmpty")}
        />
      </div>

      <div className="panel overflow-hidden">
        <div className="panel-header">
          <span className="panel-title">{t("trash.catalogSection")}</span>
        </div>
        <DataTable
          columns={columnsFor("catalog")}
          rows={catalogTrash}
          rowKey={(r) => r.id}
          loading={loading}
          emptyMessage={t("trash.tableEmpty")}
        />
      </div>

      {message && <div className="text-[12px] text-success">{message}</div>}
    </div>
  );
}
