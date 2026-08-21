import ExcelJS from "exceljs";

/**
 * Backs up / restores the whole app's data by dumping every `sekkei.*`
 * localStorage key (Projects, 案件, 盤, 製作依頼, 工程, master lists, 部品データ/
 * 部品図/カタログ, 部品製作 rows, ...) — nothing is hand-picked or hardcoded per
 * entity, so a new module's storage key is automatically included without
 * touching this file. Each backup is one real, downloadable .xlsx (not a
 * screenshot or fake export); restoring never writes anything until every
 * row has been parsed successfully (all-or-nothing).
 */

const DATA_SHEET = "Data";
const SUMMARY_SHEET = "Summary";

function getAllSekkeiKeys(): string[] {
  const keys: string[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i);
    if (k && k.startsWith("sekkei.")) keys.push(k);
  }
  return keys.sort();
}

function countOf(json: string): number {
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.length : 1;
  } catch {
    return 0;
  }
}

function backupFileName(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `oku-pro_BACKUP_${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(
    date.getHours(),
  )}${pad(date.getMinutes())}.xlsx`;
}

export interface RestorePreviewEntry {
  key: string;
  count: number;
}

export const backupService = {
  /** Builds the backup workbook and triggers a real browser download — a new file every time, never overwriting a previous backup. */
  async createBackup(): Promise<{ fileName: string }> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "oku-pro";
    workbook.created = new Date();

    const summarySheet = workbook.addWorksheet(SUMMARY_SHEET);
    summarySheet.columns = [
      { header: "Storage Key", key: "key", width: 42 },
      { header: "Records", key: "count", width: 12 },
    ];

    const dataSheet = workbook.addWorksheet(DATA_SHEET);
    dataSheet.columns = [
      { header: "Storage Key", key: "key", width: 42 },
      { header: "JSON", key: "json", width: 120 },
    ];

    for (const key of getAllSekkeiKeys()) {
      const json = window.localStorage.getItem(key) ?? "null";
      summarySheet.addRow({ key, count: countOf(json) });
      dataSheet.addRow({ key, json });
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
      const key = String(row.getCell(1).value ?? "").trim();
      const json = String(row.getCell(2).value ?? "");
      if (!key) return;
      JSON.parse(json); // throws on malformed data, failing the whole preview
      entries.push({ key, count: countOf(json) });
    });
    if (entries.length === 0) throw new Error("invalid-backup-file");
    return entries;
  },

  /** Re-validates every row, then writes them all — never partially applies a restore. */
  async confirmRestore(file: File): Promise<void> {
    const buffer = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const sheet = workbook.getWorksheet(DATA_SHEET);
    if (!sheet) throw new Error("invalid-backup-file");

    const pending: { key: string; json: string }[] = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const key = String(row.getCell(1).value ?? "").trim();
      const json = String(row.getCell(2).value ?? "");
      if (!key) return;
      JSON.parse(json); // validate before any write
      pending.push({ key, json });
    });
    if (pending.length === 0) throw new Error("invalid-backup-file");

    for (const { key, json } of pending) {
      window.localStorage.setItem(key, json);
    }
  },
};
