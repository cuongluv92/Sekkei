"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { selectionService } from "@/lib/services";
import { DataTable, type DataTableColumn } from "@/components/common/DataTable";
import { ExportActions } from "@/components/common/ExportActions";
import type { SelectionOutputKey, SelectionResultRow } from "@/lib/types";

const OUTPUT_KEYS: SelectionOutputKey[] = [
  "breaker",
  "am",
  "magneticContactor",
  "wireSize",
  "terminalBlock",
  "other",
];

export default function SelectionPage() {
  const { t } = useTranslation();
  const [rawValue, setRawValue] = useState("");
  const [outputs, setOutputs] = useState<Set<SelectionOutputKey>>(
    new Set(["breaker", "wireSize"]),
  );
  const [results, setResults] = useState<SelectionResultRow[] | null>(null);
  const [loading, setLoading] = useState(false);

  function toggleOutput(key: SelectionOutputKey) {
    setOutputs((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleCalculate() {
    setLoading(true);
    const rows = await selectionService.evaluate({
      rawValue,
      outputs: Array.from(outputs),
    });
    setResults(rows);
    setLoading(false);
  }

  function handleClear() {
    setRawValue("");
    setOutputs(new Set());
    setResults(null);
  }

  const columns: DataTableColumn<SelectionResultRow>[] = [
    { key: "label", header: t("selection.outputLabel"), width: "180px" },
    { key: "value", header: t("common.result"), width: "160px" },
    { key: "remarks", header: t("common.remarks") },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-[15px] font-semibold text-foreground">{t("selection.title")}</h1>
        <p className="mt-0.5 text-[12px] text-muted">{t("selection.description")}</p>
      </div>

      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">{t("selection.inputLabel")}</span>
        </div>
        <div className="panel-body flex flex-col gap-4">
          <div className="max-w-xs">
            <label className="field-label">{t("selection.inputLabel")}</label>
            <input
              value={rawValue}
              onChange={(e) => setRawValue(e.target.value)}
              placeholder={t("selection.inputPlaceholder")}
              className="field-input"
            />
            <p className="mt-1 text-[11px] text-muted-2">{t("selection.inputHint")}</p>
          </div>

          <div>
            <label className="field-label">{t("selection.outputLabel")}</label>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {OUTPUT_KEYS.map((key) => (
                <label key={key} className="checkbox-row cursor-pointer">
                  <input
                    type="checkbox"
                    checked={outputs.has(key)}
                    onChange={() => toggleOutput(key)}
                    className="h-3.5 w-3.5 accent-[var(--accent)]"
                  />
                  {t(`selection.outputs.${key}`)}
                </label>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
            <button
              onClick={handleCalculate}
              disabled={loading || !rawValue || outputs.size === 0}
              className="btn-primary"
            >
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {t("common.calculate")}
            </button>
            <button onClick={handleClear} className="btn-secondary">
              {t("common.clear")}
            </button>
            <div className="ml-auto">
              <ExportActions context="選定結果" />
            </div>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">{t("selection.resultTitle")}</span>
        </div>
        {results && results.length > 0 && (
          <p className="border-b border-border px-4 py-2 text-[11px] text-warning">
            {t("selection.ruleNotice")}
          </p>
        )}
        <DataTable
          columns={columns}
          rows={results ?? []}
          rowKey={(r) => r.id}
          loading={loading}
          emptyMessage={t("selection.resultEmpty")}
        />
      </div>
    </div>
  );
}
