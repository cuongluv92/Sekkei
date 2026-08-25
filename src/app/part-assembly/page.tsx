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
  Upload,
} from "lucide-react";
import { Fragment, Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslation } from "@/lib/i18n";
import {
  exportPartAssemblyDxf,
  exportPartAssemblyExcel,
  parsePartAssemblyImportFile,
  registerImportedPartsInMaster,
  searchService,
  type PartAssemblyImportRow,
} from "@/lib/services";
import {
  getManufacturerById,
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

function roundTo(n: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

/** 重量 is per-unit (1個あたり) — this is the ×数量 total shown next to it, kept in sync automatically. */
function rowWeightTotal(row: PartAssemblyRow): number | null {
  if (row.weight == null) return null;
  return row.weight * row.quantity;
}

/** "" clears 重量 back to unset; anything else parses as a number. Returns `false` for an unparseable in-progress keystroke, so the caller can skip updating rather than corrupt the stored value. */
function parseWeightInput(value: string): number | undefined | false {
  if (value.trim() === "") return undefined;
  const n = Number(value);
  return Number.isNaN(n) ? false : n;
}

/**
 * Builds a 案件側 部品リスト row from a picked 部品データ/部品図/カタログ
 * hit. 数量・備考 are per-案件 and always start blank/1 here — 部品データ's
 * own 数量・備考 (if any) describe the master record, not this 案件, so
 * they're intentionally never copied in. 重量 IS copied in when the master
 * record has one registered — saves re-typing it per 案件, and lets
 * 盤重量計算's 部品グループ pull a ready total straight from this table.
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
    weight: item.weight,
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
    addRows,
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
  const [activeTab, setActiveTab] = useState<"search" | "list">("search");
  const [, forceRerender] = useState(0);
  const { toast, showToast } = useToast();
  const [highlightedRowId, setHighlightedRowId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [exportingDxf, setExportingDxf] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [importPreview, setImportPreview] = useState<{ rows: PartAssemblyImportRow[]; fileName: string } | null>(null);
  const [importParsing, setImportParsing] = useState(false);
  const [importCommitting, setImportCommitting] = useState(false);
  /** 仕様が既存の 部品データ (型番違い) と重複する行だけ、確認画面で「別の部品として登録する」を選んだ index を持つ。 */
  const [registerAnywayRows, setRegisterAnywayRows] = useState<Set<number>>(new Set());
  const importFileInputRef = useRef<HTMLInputElement>(null);

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

  function handleImportButtonClick() {
    importFileInputRef.current?.click();
  }

  async function handleImportFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file next time
    if (!file) return;
    setImportParsing(true);
    try {
      const { rows: parsedRows, found } = await parsePartAssemblyImportFile(file);
      if (!found) {
        showToast(t("partAssembly.importDxfLayoutNotFound"), "error");
        return;
      }
      if (parsedRows.length === 0) {
        showToast(t("partAssembly.importEmpty"), "error");
        return;
      }
      // 重複の可能性がある行も、既定では「別の部品として登録する」— 黙って
      // 部品データ への登録をスキップすると (旧デフォルト) 実物には存在する
      // 部品が大量に部品データに反映されない事態になる (共通の定格・仕様の
      // 文字列を使う部品は現場では珍しくない)。チェックを外せば個別に除外できる。
      setRegisterAnywayRows(
        new Set(parsedRows.flatMap((r, i) => (r.masterDuplicate ? [i] : []))),
      );
      setImportPreview({ rows: parsedRows, fileName: file.name });
    } catch {
      showToast(t("partAssembly.importError"), "error");
    } finally {
      setImportParsing(false);
    }
  }

  async function handleImportConfirm() {
    if (!importPreview) return;
    setImportCommitting(true);
    try {
      await addRows(importPreview.rows);
      const { created, skipped } = await registerImportedPartsInMaster(importPreview.rows, registerAnywayRows);
      if (created > 0) {
        showToast(t("partAssembly.importedCountWithMaster", { count: importPreview.rows.length, created }));
      } else if (skipped > 0) {
        showToast(t("partAssembly.importedCountNoneRegistered", { count: importPreview.rows.length }));
      } else {
        showToast(t("partAssembly.importedCount", { count: importPreview.rows.length }));
      }
      setImportPreview(null);
    } catch {
      showToast(t("partAssembly.addError"), "error");
    } finally {
      setImportCommitting(false);
    }
  }

  function toggleRegisterAnyway(index: number) {
    setRegisterAnywayRows((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
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
      const newRow = rowFromMasterItem(item);
      const id = await addRow(newRow);
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
      const newRow = rowFromMasterItem(item);
      const id = await insertRowAt(insertAt, newRow);
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
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setActiveTab("search")}
                  className={
                    activeTab === "search"
                      ? "rounded-md bg-accent px-3 py-1.5 text-[12.5px] font-bold text-accent-foreground"
                      : "rounded-md px-3 py-1.5 text-[12.5px] font-semibold text-muted hover:text-foreground"
                  }
                >
                  {t("common.search")}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("list")}
                  className={
                    activeTab === "list"
                      ? "rounded-md bg-accent px-3 py-1.5 text-[12.5px] font-bold text-accent-foreground"
                      : "rounded-md px-3 py-1.5 text-[12.5px] font-semibold text-muted hover:text-foreground"
                  }
                >
                  {t("partAssembly.listTabLabel", { count: rows.length })}
                </button>
              </div>
              {activeTab === "list" && (
                <div className="flex items-center gap-2">
                  <span className="text-[12px] font-semibold text-muted">
                    {roundTo(rows.reduce((sum, r) => sum + (rowWeightTotal(r) ?? 0), 0), 2)} kg
                  </span>
                  <button onClick={addBlankRow} className="btn-ghost">
                    <Plus className="h-3.5 w-3.5" />
                    {t("partAssembly.addRow")}
                  </button>
                  <button
                    onClick={handleImportButtonClick}
                    className="btn-ghost"
                    disabled={importParsing}
                    title={t("partAssembly.importFileTitle")}
                  >
                    {importParsing ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Upload className="h-3.5 w-3.5" />
                    )}
                    {t("partAssembly.importFile")}
                  </button>
                  <input
                    ref={importFileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv,.dxf"
                    className="hidden"
                    onChange={handleImportFileSelected}
                  />
                  <button
                    onClick={clear}
                    className="btn-ghost"
                    disabled={rows.length === 0}
                  >
                    {t("common.clear")}
                  </button>
                </div>
              )}
            </div>

            <div className="panel-body" style={activeTab === "search" ? undefined : { display: "none" }}>
              <PartMasterSearch
                key={caseId}
                items={masterItems}
                loading={masterLoading}
                onDownload={handleDownload}
                onPick={handlePick}
              />
            </div>

            {activeTab === "list" && (
              <>
            <div className="data-table-wrap">
              <table className="data-table" style={{ minWidth: 1260 }}>
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
                    <th style={{ width: "80px" }} className="text-right">
                      {t("common.weight")}
                    </th>
                    <th style={{ width: "150px" }}>{t("common.remarks")}</th>
                    <th style={{ width: "40px" }} />
                  </tr>
                </thead>
                <tbody>
                  {rowsLoading ? (
                    <tr>
                      <td colSpan={11} className="py-8 text-center text-muted">
                        {t("common.loading")}
                      </td>
                    </tr>
                  ) : rows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={11}
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
                        <td className="text-right">
                          <input
                            type="number"
                            min={0}
                            step="any"
                            value={row.weight ?? ""}
                            onChange={(e) => {
                              const weight = parseWeightInput(e.target.value);
                              if (weight !== false) updateField(row.id, { weight });
                            }}
                            placeholder="kg"
                            title={t("partAssembly.weightPerUnitTitle")}
                            className="field-input w-[72px] py-1 text-right"
                          />
                          {row.weight != null && (
                            <div className="mt-0.5 text-[10.5px] text-muted-2">
                              ×{row.quantity}={roundTo(rowWeightTotal(row) ?? 0, 2)}
                            </div>
                          )}
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
              </>
            )}
          </div>
        </>
      )}

      <Toast toast={toast} />

      {insertAt !== null && (
        <InsertPartModal
          items={masterItems}
          loading={masterLoading}
          currentRows={rows}
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

      {importPreview && (
        <Modal
          title={t("partAssembly.importPreviewTitle", { fileName: importPreview.fileName })}
          onClose={() => setImportPreview(null)}
          widthClassName="max-w-3xl"
        >
          <div className="flex flex-col gap-3">
            <p className="text-[12px] text-muted">
              {t("partAssembly.importPreviewCount", { count: importPreview.rows.length })}
            </p>
            <div className="data-table-wrap max-h-[50vh]">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t("common.symbol")}</th>
                    <th>{t("common.name")}</th>
                    <th>{t("common.manufacturer")}</th>
                    <th>{t("common.model")}</th>
                    <th>{t("common.specification")}</th>
                    <th className="text-right">{t("common.quantity")}</th>
                    <th className="text-right">{t("common.weight")}</th>
                  </tr>
                </thead>
                <tbody>
                  {importPreview.rows.map((row, i) => (
                    <Fragment key={i}>
                      <tr>
                        <td>{row.symbol}</td>
                        <td>{row.name}</td>
                        <td>{row.manufacturerId ? getManufacturerById(row.manufacturerId)?.name ?? "" : ""}</td>
                        <td className="font-mono text-[12px]">{row.model}</td>
                        <td>{row.specification}</td>
                        <td className="text-right">{row.quantity}</td>
                        <td className="text-right">{row.weight ?? ""}</td>
                      </tr>
                      {row.masterDuplicate && (
                        <tr>
                          <td colSpan={7} className="bg-warning/10 px-2 py-1.5">
                            <label className="flex items-center gap-1.5 text-[11px] text-warning">
                              <input
                                type="checkbox"
                                checked={registerAnywayRows.has(i)}
                                onChange={() => toggleRegisterAnyway(i)}
                              />
                              {t(
                                row.masterDuplicate.exact
                                  ? "partAssembly.masterDuplicateExactWarning"
                                  : "partAssembly.masterDuplicateSpecWarning",
                                { model: row.masterDuplicate.model },
                              )}
                            </label>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end gap-2 border-t border-border pt-3">
              <button className="btn-ghost" onClick={() => setImportPreview(null)} disabled={importCommitting}>
                {t("common.cancel")}
              </button>
              <button className="btn-primary" onClick={handleImportConfirm} disabled={importCommitting}>
                {importCommitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                {t("partAssembly.importConfirm")}
              </button>
            </div>
          </div>
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
