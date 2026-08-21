"use client";

import { GripVertical, Plus, Search as SearchIcon, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { searchService, exportService } from "@/lib/services";
import { getManufacturerName } from "@/lib/mock/manufacturers";
import { usePartAssembly } from "@/lib/store/PartAssemblyProvider";
import { SearchResultList } from "@/components/common/SearchResultList";
import { ExportActions } from "@/components/common/ExportActions";
import { useMockFeedback } from "@/lib/hooks/useMockFeedback";
import type { SearchResultItem } from "@/lib/types";

export default function PartAssemblyPage() {
  const { t, locale } = useTranslation();
  const { rows, addRow, removeRow, updateQuantity, updateRemarks, moveRow, clear } =
    usePartAssembly();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const { message, show } = useMockFeedback();

  async function runSearch() {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    const res = await searchService.search(query);
    setResults(res);
    setLoading(false);
  }

  function handleAdd(item: SearchResultItem) {
    addRow({
      symbol: "",
      name: item.category,
      manufacturerId: item.manufacturerId,
      model: item.model,
      specification: item.specification,
      quantity: item.quantity ?? 1,
      remarks: item.remarks,
      sourceRefId: item.id,
      sourceType: item.source,
    });
  }

  async function handleDownload(item: SearchResultItem, kind: "dwg" | "pdf") {
    const { fileName } = await exportService.export(kind, item.model);
    show(`${fileName} をダウンロードしました（モック）`);
  }

  function addBlankRow() {
    addRow({
      symbol: "",
      name: "",
      manufacturerId: "",
      model: "",
      specification: "",
      quantity: 1,
      remarks: "",
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-[15px] font-semibold text-foreground">{t("partAssembly.title")}</h1>
        <p className="mt-0.5 text-[12px] text-muted">{t("partAssembly.description")}</p>
      </div>

      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">{t("common.search")}</span>
        </div>
        <div className="panel-body flex flex-col gap-3">
          <div className="flex gap-2">
            <div className="relative max-w-md flex-1">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-2" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") runSearch();
                }}
                placeholder={t("partAssembly.searchPlaceholder")}
                className="field-input pl-8"
              />
            </div>
            <button onClick={runSearch} className="btn-primary">
              {t("common.search")}
            </button>
          </div>
          {(loading || results.length > 0) && (
            <div className="panel overflow-hidden">
              <SearchResultList
                results={results}
                loading={loading}
                onSelect={handleAdd}
                onDownload={handleDownload}
                emptyMessage={t("common.noResults")}
              />
            </div>
          )}
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">{t("partAssembly.tableTitle")}</span>
          <div className="flex items-center gap-2">
            <button onClick={addBlankRow} className="btn-ghost">
              <Plus className="h-3.5 w-3.5" />
              {t("partAssembly.addRow")}
            </button>
            <button onClick={clear} className="btn-ghost" disabled={rows.length === 0}>
              {t("common.clear")}
            </button>
          </div>
        </div>

        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: "28px" }} />
                <th style={{ width: "100px" }}>{t("common.symbol")}</th>
                <th style={{ width: "160px" }}>{t("common.name")}</th>
                <th style={{ width: "150px" }}>{t("common.manufacturer")}</th>
                <th style={{ width: "130px" }}>{t("common.model")}</th>
                <th>{t("common.specification")}</th>
                <th style={{ width: "80px" }} className="text-right">
                  {t("common.quantity")}
                </th>
                <th style={{ width: "160px" }}>{t("common.remarks")}</th>
                <th style={{ width: "40px" }} />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-muted-2">
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
                    className={dragIndex === index ? "opacity-50" : ""}
                  >
                    <td className="cursor-grab text-muted-2" title={t("partAssembly.reorderHint")}>
                      <GripVertical className="h-3.5 w-3.5" />
                    </td>
                    <td>{row.symbol || "—"}</td>
                    <td>{row.name || "—"}</td>
                    <td>{row.manufacturerId ? getManufacturerName(row.manufacturerId, locale) : "—"}</td>
                    <td className="font-mono text-[12px]">{row.model || "—"}</td>
                    <td>{row.specification || "—"}</td>
                    <td className="text-right">
                      <input
                        type="number"
                        min={0}
                        value={row.quantity}
                        onChange={(e) => updateQuantity(row.id, Number(e.target.value))}
                        className="field-input w-16 py-1 text-right"
                      />
                    </td>
                    <td>
                      <input
                        value={row.remarks ?? ""}
                        onChange={(e) => updateRemarks(row.id, e.target.value)}
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
          <span className="text-[11px] text-muted-2">{t("partAssembly.reorderHint")}</span>
          <ExportActions context="部品製作リスト" formats={["dwg", "excel", "pdf"]} />
        </div>
      </div>
      {message && <div className="text-[12px] text-success">{message}</div>}
    </div>
  );
}
