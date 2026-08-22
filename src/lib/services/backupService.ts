import ExcelJS from "exceljs";
import { requireSupabase } from "@/lib/supabase/client";

/**
 * Backs up / restores the whole Supabase database (every table below) as
 * one real, downloadable .xlsx — not localStorage. Each backup is a new
 * timestamped file; restoring never writes anything until every table's
 * rows have been parsed successfully (all-or-nothing), and always deletes
 * child tables before parents / inserts parents before children so foreign
 * keys never fail mid-restore.
 */

const DATA_SHEET = "Data";
const SUMMARY_SHEET = "Summary";

// Parent -> child order for INSERT during restore (and DELETE runs in the
// reverse of this order). Keep in sync with supabase/migrations/0001_init.sql.
// `design_cases` is a root table (案件 is the whole app's root record — see
// 0018_case_is_root.sql, which retired the old `projects` parent table).
const TABLES_IN_DEPENDENCY_ORDER = [
  "manufacturers",
  "design_cases",
  "case_panels",
  "production_requests",
  "case_schedules",
  "schedule_colors",
  "master_list_items",
  "part_data",
  "part_drawings",
  "catalogs",
  "file_assets",
  "selection_rules",
  "part_assembly_rows",
] as const;

function backupFileName(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `oku-pro_BACKUP_${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(
    date.getHours(),
  )}${pad(date.getMinutes())}.xlsx`;
}

export interface RestorePreviewEntry {
  table: string;
  count: number;
}

export const backupService = {
  /** Reads every table and triggers a real browser download — a new file every time, never overwriting a previous backup. */
  async createBackup(): Promise<{ fileName: string }> {
    const client = requireSupabase();
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "oku-pro";
    workbook.created = new Date();

    const summarySheet = workbook.addWorksheet(SUMMARY_SHEET);
    summarySheet.columns = [
      { header: "Table", key: "table", width: 30 },
      { header: "Records", key: "count", width: 12 },
    ];
    const dataSheet = workbook.addWorksheet(DATA_SHEET);
    dataSheet.columns = [
      { header: "Table", key: "table", width: 30 },
      { header: "JSON", key: "json", width: 120 },
    ];

    for (const table of TABLES_IN_DEPENDENCY_ORDER) {
      const { data, error } = await client.from(table).select("*");
      if (error) throw error;
      const rows = data ?? [];
      summarySheet.addRow({ table, count: rows.length });
      dataSheet.addRow({ table, json: JSON.stringify(rows) });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const fileName = backupFileName();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    return { fileName };
  },

  /** Parses and validates a backup file (throws on anything malformed) without writing anything — used for the required preview step. */
  async previewRestore(file: File): Promise<RestorePreviewEntry[]> {
    const buffer = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const sheet = workbook.getWorksheet(DATA_SHEET);
    if (!sheet) throw new Error("invalid-backup-file");

    const entries: RestorePreviewEntry[] = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const table = String(row.getCell(1).value ?? "").trim();
      const json = String(row.getCell(2).value ?? "");
      if (!table) return;
      const parsed = JSON.parse(json); // throws on malformed data, failing the whole preview
      if (!Array.isArray(parsed)) throw new Error("invalid-backup-file");
      entries.push({ table, count: parsed.length });
    });
    if (entries.length === 0) throw new Error("invalid-backup-file");
    return entries;
  },

  /** Re-validates every table, then deletes (children→parents) and re-inserts (parents→children) — never partially applies a restore. */
  async confirmRestore(file: File): Promise<void> {
    const buffer = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const sheet = workbook.getWorksheet(DATA_SHEET);
    if (!sheet) throw new Error("invalid-backup-file");

    const rowsByTable = new Map<string, Record<string, unknown>[]>();
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const table = String(row.getCell(1).value ?? "").trim();
      const json = String(row.getCell(2).value ?? "");
      if (!table) return;
      const parsed = JSON.parse(json);
      if (!Array.isArray(parsed)) throw new Error("invalid-backup-file");
      rowsByTable.set(table, parsed);
    });
    if (rowsByTable.size === 0) throw new Error("invalid-backup-file");

    const client = requireSupabase();

    // Most tables use `id` as their primary key; these three don't (see 0001_init.sql).
    const DELETE_KEY_COLUMN: Partial<
      Record<(typeof TABLES_IN_DEPENDENCY_ORDER)[number], string>
    > = {
      production_requests: "case_id",
      case_schedules: "case_id",
      schedule_colors: "category",
    };

    for (const table of [...TABLES_IN_DEPENDENCY_ORDER].reverse()) {
      if (!rowsByTable.has(table)) continue;
      const keyColumn = DELETE_KEY_COLUMN[table] ?? "id";
      const { error } = await client
        .from(table)
        .delete()
        .not(keyColumn, "is", null);
      if (error) throw error;
    }

    for (const table of TABLES_IN_DEPENDENCY_ORDER) {
      const rows = rowsByTable.get(table);
      if (!rows || rows.length === 0) continue;
      const { error } = await client.from(table).insert(rows);
      if (error) throw error;
    }
  },
};
