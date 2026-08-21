"use client";

import { useTranslation } from "@/lib/i18n";
import { DataTable, type DataTableColumn } from "@/components/common/DataTable";
import type { CalculationDefinition } from "@/lib/types";

interface CalculationResultProps {
  definition: CalculationDefinition;
  rows: Record<string, string>[];
  loading?: boolean;
}

export function CalculationResult({ definition, rows, loading }: CalculationResultProps) {
  const { t, locale } = useTranslation();

  const columns: DataTableColumn<Record<string, string>>[] = definition.resultColumns.map(
    (col) => ({
      key: col.key,
      header: (locale === "vi" && col.labelVi ? col.labelVi : col.label) + (col.unit ? ` (${col.unit})` : ""),
      render: (row) => row[col.key] ?? "",
    }),
  );

  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(row) => JSON.stringify(row)}
      loading={loading}
      emptyMessage={t("calculation.resultEmpty")}
    />
  );
}
