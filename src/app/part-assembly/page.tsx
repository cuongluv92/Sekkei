"use client";

import {
  CornerLeftDown,
  CornerLeftUp,
  FileSpreadsheet,
  GripVertical,
  Layers,
  Loader2,
  Plus,
  Settings,
  Trash2,
} from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslation } from "@/lib/i18n";
import {
  exportPartAssemblyDxf,
  exportPartAssemblyExcel,
  searchService,
} from "@/lib/services";
import {
  listManufacturers,
  preloadManufacturers,
} from "@/lib/mock/manufacturers";
import { findFileByKind, openFileAsset } from "@/lib/utils/fileDownload";
import { usePartAssembly } from "@/lib/store/PartAssemblyProvider";
import { useEffectiveCaseId } from "@/lib/store/ActiveCaseProvider";
import { useToast } from "@/lib/hooks/useToast";
import { InsertPartModal } from "@/components/common/InsertPartModal";
import { PartMasterSearch } from "@/components/common/PartMasterSearch";
import { ExportActions } from "@/components/common/ExportActions";
import { PageHeader } from "@/components/common/PageHeader";
import { CaseSelector } from "@/components/common/CaseSelector";
import { Modal } from "@/components/common/Modal";
import { Toast } from "@/components/common/Toast";
import { PartTemplateSettings } from "@/components/settings/PartTemplateSettings";
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
 * Builds a 案件側 部品リスト row from a picked 部品データ/部品図/カタログ
 * hit. 数量・備考 are per-案件 and always start blank/1 here — 部品データ's
 * own 数量・備考 (if any) describe the master record, not this 案件, so
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

function PartAssemblyView() {
  const { t, locale } = useTranslation();
  const {
    caseId: rawCaseId,
    setCaseId,
    caseLoading,
    rows,
    loading: rowsLoading,
    addRow,
    insertRowAt,
    removeRow,
    updateField,
    moveRow,
    clear,
  } = usePartAssembly();
  const searchParams = useSearchParams();
  // Unlike 設計管理/計算 modules, this screen does NOT suppress the already
  // -active 案件 on mount: every mutation here writes straight through via
  // partAssemblyService.saveRows (see PartAssemblyProvider), so there is no
  // unsaved-edit risk in resuming it immediately — suppressing just forced
  // an extra manual pick every time this page was opened, with the table
  // not rendering until then. An explicit `?case=` deep link (e.g. Global
  // Search's 部品製作 result) still wins over the active 案件.
  const effectiveActiveCaseId = useEffectiveCaseId(false);
  const caseIdParam = searchParams.get("case") ?? "";
  const caseId = caseIdParam || effectiveActiveCaseId;

  // Honors a `?case=<id>` deep link (e.g. from Global Search's 部品製作 result)
  // by resolving it as the app-wide active 案件 — never a page-local override,
  // so every other module stays in sync too.
  useEffect(() => {
    if (caseId && caseId !== rawCaseId) setCaseId(caseId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId]);
  const [masterItems, setMasterItems] = useState<SearchResultItem[]>([]);
  const [masterLoading, setMasterLoading] = useState(true);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [insertAt, setInsertAt] = useState<number | null>(null);
  const [, forceRerender] = useState(0);
  const { toast, showToast } = useToast();
  const [highlightedRowId, setHighlightedRowId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [exportingDxf, setExportingDxf] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);

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

  async function handleExportDxf() {
    setExportingDxf(true);
    try {
      const result = await exportPartAssemblyDxf(rows, locale);
      switch (result.status) {
        case "filled":
          showToast(
            result.rowsSkipped > 0
              ? t("partAssembly.dwgExportedPartial", {
                  fileName: result.fileName,
                  written: result.rowsWritten,
                  skipped: result.rowsSkipped,
                })
              : t("common.fileExported", { fileName: result.fileName }),
          );
          break;
        case "noPlaceholders":
          showToast(t("partAssembly.dwgNoPlaceholders"), "error");
          break;
        case "noTemplate":
          showToast(t("partAssembly.dwgTemplateMissing"), "error");
          break;
      }
    } catch {
      showToast(t("partAssembly.dwgExportError"), "error");
    } finally {
      setExportingDxf(false);
    }
  }

  async function handleExportExcel() {
    if (rows.length === 0) {
      showToast(t("partAssembly.exportEmpty"), "error");
      return;
    }
    setExportingExcel(true);
    try {
      const { fileName } = await exportPartAssemblyExcel(rows, locale);
      showToast(t("common.fileExported", { fileName }));
    } catch {
      showToast(t("partAssembly.excelExportError"), "error");
    } finally {
      setExportingExcel(false);
    }
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

      <CaseSelector suppress={false} />

      {!caseId && (
        <p className="text-[11px] text-warning">{t("caseSelector.draftNote")}</p>
      )}

      {caseLoading ? (
        <div className="panel">
          <div className="panel-body py-12 text-center text-[13px] text-muted-2">
            {t("common.loading")}
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
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleExportDxf}
                  disabled={exportingDxf}
                  className="btn-secondary"
                >
                  {exportingDxf ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Layers className="h-3.5 w-3.5" />
                  )}
                  {t("partAssembly.dxfExport")}
                </button>
                <button
                  onClick={handleExportExcel}
                  disabled={exportingExcel}
                  className="btn-secondary"
                >
                  {exportingExcel ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <FileSpreadsheet className="h-3.5 w-3.5" />
                  )}
                  {t("common.excelExport")}
                </button>
                <ExportActions context="部品製作リスト" formats={["pdf"]} />
              </div>
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

      {settingsOpen && (
        <Modal
          title={t("common.settings")}
          onClose={() => setSettingsOpen(false)}
          widthClassName="max-w-2xl"
        >
          <PartTemplateSettings />
        </Modal>
      )}
    </div>
  );
}

export default function PartAssemblyPage() {
  return (
    <Suspense fallback={null}>
      <PartAssemblyView />
    </Suspense>
  );
}
