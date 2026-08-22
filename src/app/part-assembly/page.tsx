"use client";

import {
  CornerLeftDown,
  CornerLeftUp,
  GripVertical,
  Plus,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { searchService } from "@/lib/services";
import {
  listManufacturers,
  preloadManufacturers,
} from "@/lib/mock/manufacturers";
import { findFileByKind, openFileAsset } from "@/lib/utils/fileDownload";
import { usePartAssembly } from "@/lib/store/PartAssemblyProvider";
import { useToast } from "@/lib/hooks/useToast";
import { InsertPartModal } from "@/components/common/InsertPartModal";
import { PartMasterSearch } from "@/components/common/PartMasterSearch";
import { ExportActions } from "@/components/common/ExportActions";
import { PageHeader } from "@/components/common/PageHeader";
import { ProjectSelector } from "@/components/common/ProjectSelector";
import { Toast } from "@/components/common/Toast";
import type { PartAssemblyRow, SearchResultItem } from "@/lib/types";

const BLANK_ROW: Omit<PartAssemblyRow, "id"> = {
  symbol: "",
  name: "",
  manufacturerId: "",
  model: "",
  specification: "",
  quantity: 1,
  remarks: "",
};

/**
 * Builds a Project-side 部品リスト row from a picked 部品データ/部品図/カタログ
 * hit. 数量・備考 are per-project and always start blank/1 here — 部品データ's
 * own 数量・備考 (if any) describe the master record, not this project, so
 * they're intentionally never copied in. 重量 isn't copied in either (not
 * used or shown here); sourceRefId keeps the link back to the master row so
 * 盤重量計算 can look weight up from there later.
 */
function rowFromMasterItem(
  item: SearchResultItem,
): Omit<PartAssemblyRow, "id"> {
  return {
    symbol: item.symbol ?? "",
    name: item.category,
    manufacturerId: item.manufacturerId,
    model: item.model,
    specification: item.specification,
    quantity: 1,
    remarks: "",
    sourceRefId: item.id,
    sourceType: item.source,
  };
}

export default function PartAssemblyPage() {
  const { t, locale } = useTranslation();
  const {
    projectId,
    setProjectId,
    projectLoading,
    rows,
    loading: rowsLoading,
    addRow,
    insertRowAt,
    removeRow,
    updateField,
    moveRow,
    clear,
  } = usePartAssembly();
  const [masterItems, setMasterItems] = useState<SearchResultItem[]>([]);
  const [masterLoading, setMasterLoading] = useState(true);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [insertAt, setInsertAt] = useState<number | null>(null);
  const [, forceRerender] = useState(0);
  const { toast, showToast } = useToast();
  const [highlightedRowId, setHighlightedRowId] = useState<string | null>(null);

  useEffect(() => {
    preloadManufacturers().then(() => forceRerender((v) => v + 1));
    searchService.listAll().then((list) => {
      setMasterItems(list);
      setMasterLoading(false);
    });
  }, []);

  function handleDownload(item: SearchResultItem, kind: "dwg" | "pdf") {
    const file = findFileByKind(item.files, kind);
    if (file) openFileAsset(file);
  }

  function flashRow(id: string) {
    setHighlightedRowId(id);
    setTimeout(
      () => setHighlightedRowId((current) => (current === id ? null : current)),
      1000,
    );
  }

  async function handlePick(item: SearchResultItem) {
    try {
      const id = await addRow(rowFromMasterItem(item));
      showToast(
        item.model
          ? t("partAssembly.addedToListWithModel", { model: item.model })
          : t("partAssembly.addedToList"),
      );
      flashRow(id);
    } catch {
      showToast(t("partAssembly.addError"), "error");
    }
  }

  async function handleInsertPick(item: SearchResultItem) {
    if (insertAt === null) return;
    try {
      const id = await insertRowAt(insertAt, rowFromMasterItem(item));
      showToast(
        item.model
          ? t("partAssembly.addedToListWithModel", { model: item.model })
          : t("partAssembly.addedToList"),
      );
      flashRow(id);
    } catch {
      showToast(t("partAssembly.addError"), "error");
    } finally {
      setInsertAt(null);
    }
  }

  async function handleInsertBlank() {
    if (insertAt === null) return;
    try {
      const id = await insertRowAt(insertAt, BLANK_ROW);
      showToast(t("partAssembly.addedToList"));
      flashRow(id);
    } catch {
      showToast(t("partAssembly.addError"), "error");
    } finally {
      setInsertAt(null);
    }
  }

  async function addBlankRow() {
    try {
      const id = await addRow(BLANK_ROW);
      showToast(t("partAssembly.addedToList"));
      flashRow(id);
    } catch {
      showToast(t("partAssembly.addError"), "error");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t("partAssembly.title")}
        description={t("partAssembly.description")}
      />

      <ProjectSelector projectId={projectId} onProjectChange={setProjectId} />

      {projectLoading ? (
        <div className="panel">
          <div className="panel-body py-12 text-center text-[13px] text-muted-2">
            {t("common.loading")}
          </div>
        </div>
      ) : !projectId ? (
        <div className="panel">
          <div className="panel-body py-12 text-center text-[13px] text-muted-2">
            {t("design.workspaceBar.selectProjectFirst")}
          </div>
        </div>
      ) : (
        <>
          <div className="panel">
            <div className="panel-header">
              <span className="panel-title">{t("common.search")}</span>
            </div>
            <div className="panel-body">
              <PartMasterSearch
                items={masterItems}
                loading={masterLoading}
                onDownload={handleDownload}
                onPick={handlePick}
              />
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">
              <span className="panel-title">
                {t("partAssembly.tableTitle")}
              </span>
              <div className="flex items-center gap-2">
                <button onClick={addBlankRow} className="btn-ghost">
                  <Plus className="h-3.5 w-3.5" />
                  {t("partAssembly.addRow")}
                </button>
                <button
                  onClick={clear}
                  className="btn-ghost"
                  disabled={rows.length === 0}
                >
                  {t("common.clear")}
                </button>
              </div>
            </div>

            <div className="data-table-wrap">
              <table className="data-table" style={{ minWidth: 1180 }}>
                <thead>
                  <tr>
                    <th style={{ width: "28px" }} />
                    <th style={{ width: "56px" }} />
                    <th style={{ width: "90px" }}>{t("common.symbol")}</th>
                    <th style={{ width: "150px" }}>{t("common.name")}</th>
                    <th style={{ width: "150px" }}>
                      {t("common.manufacturer")}
                    </th>
                    <th style={{ width: "120px" }}>{t("common.model")}</th>
                    <th style={{ width: "190px" }}>
                      {t("common.specification")}
                    </th>
                    <th style={{ width: "70px" }} className="text-right">
                      {t("common.quantity")}
                    </th>
                    <th style={{ width: "150px" }}>{t("common.remarks")}</th>
                    <th style={{ width: "40px" }} />
                  </tr>
                </thead>
                <tbody>
                  {rowsLoading ? (
                    <tr>
                      <td colSpan={10} className="py-8 text-center text-muted">
                        {t("common.loading")}
                      </td>
                    </tr>
                  ) : rows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={10}
                        className="py-8 text-center text-muted-2"
                      >
                        {t("partAssembly.tableEmpty")}
                      </td>
                    </tr>
                  ) : (
                    rows.map((row, index) => (
                      <tr
                        key={row.id}
                        draggable
                        onDragStart={() => setDragIndex(index)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => {
                          if (dragIndex !== null) moveRow(dragIndex, index);
                          setDragIndex(null);
                        }}
                        className={
                          dragIndex === index
                            ? "opacity-50"
                            : highlightedRowId === row.id
                              ? "animate-row-added"
                              : ""
                        }
                      >
                        <td
                          className="cursor-grab text-muted-2"
                          title={t("partAssembly.reorderHint")}
                        >
                          <GripVertical className="h-3.5 w-3.5" />
                        </td>
                        <td>
                          <div className="flex items-center gap-0.5">
                            <button
                              type="button"
                              onClick={() => setInsertAt(index)}
                              title={t("partAssembly.insertAbove")}
                              className="btn-ghost btn-icon !p-1"
                            >
                              <CornerLeftUp className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setInsertAt(index + 1)}
                              title={t("partAssembly.insertBelow")}
                              className="btn-ghost btn-icon !p-1"
                            >
                              <CornerLeftDown className="h-3 w-3" />
                            </button>
                          </div>
                        </td>
                        <td>
                          <input
                            value={row.symbol}
                            onChange={(e) =>
                              updateField(row.id, { symbol: e.target.value })
                            }
                            className="field-input py-1"
                          />
                        </td>
                        <td>
                          <input
                            value={row.name}
                            onChange={(e) =>
                              updateField(row.id, { name: e.target.value })
                            }
                            className="field-input py-1"
                          />
                        </td>
                        <td>
                          <select
                            value={row.manufacturerId}
                            onChange={(e) =>
                              updateField(row.id, {
                                manufacturerId: e.target.value,
                              })
                            }
                            className="field-input py-1"
                          >
                            <option value="">
                              {t("common.unsetManufacturer")}
                            </option>
                            {listManufacturers().map((m) => (
                              <option key={m.id} value={m.id}>
                                {locale === "vi" && m.nameVi
                                  ? m.nameVi
                                  : m.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input
                            value={row.model}
                            onChange={(e) =>
                              updateField(row.id, { model: e.target.value })
                            }
                            className="field-input py-1 font-mono text-[12px]"
                          />
                        </td>
                        <td>
                          <input
                            value={row.specification}
                            onChange={(e) =>
                              updateField(row.id, {
                                specification: e.target.value,
                              })
                            }
                            className="field-input py-1"
                          />
                        </td>
                        <td className="text-right">
                          <input
                            type="number"
                            min={0}
                            value={row.quantity}
                            onChange={(e) =>
                              updateField(row.id, {
                                quantity: Number(e.target.value),
                              })
                            }
                            className="field-input w-16 py-1 text-right"
                          />
                        </td>
                        <td>
                          <input
                            value={row.remarks ?? ""}
                            onChange={(e) =>
                              updateField(row.id, { remarks: e.target.value })
                            }
                            className="field-input py-1"
                          />
                        </td>
                        <td>
                          <button
                            onClick={() => removeRow(row.id)}
                            className="btn-ghost btn-icon text-danger hover:bg-danger/10"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between border-t border-border px-4 py-3">
              <span className="text-[11px] text-muted-2">
                {t("partAssembly.reorderHint")}
              </span>
              <ExportActions
                context="部品製作リスト"
                formats={["dwg", "excel", "pdf"]}
              />
            </div>
          </div>
        </>
      )}

      <Toast toast={toast} />

      {insertAt !== null && (
        <InsertPartModal
          items={masterItems}
          loading={masterLoading}
          onClose={() => setInsertAt(null)}
          onInsertBlank={handleInsertBlank}
          onPick={handleInsertPick}
        />
      )}
    </div>
  );
}
