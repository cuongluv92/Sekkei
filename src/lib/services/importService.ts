import { delay } from "@/lib/utils/async";
import { addManufacturer, findManufacturerByName, preloadManufacturers } from "@/lib/mock/manufacturers";
import { mapRowToRecord, parseTabularFile, type MappedImportRecord } from "@/lib/utils/importParsing";
import { partDataService } from "./partDataService";
import { partDrawingService } from "./partDrawingService";
import { catalogService } from "./catalogService";
import type { ImportFileType, ImportRow, ImportTargetCategory } from "@/lib/types";
import type { ImportRepository } from "./types";

type ImportRecord = NonNullable<ImportRow["record"]>;

async function resolveManufacturerId(name: string | undefined): Promise<string> {
  if (!name) return "";
  const existing = findManufacturerByName(name);
  if (existing) return existing.id;
  const created = await addManufacturer(name);
  return created.id;
}

async function findExisting(target: ImportTargetCategory, mapped: MappedImportRecord, manufacturerId: string) {
  if (target === "part-data") {
    return partDataService.findExisting({
      manufacturerId,
      category: mapped.category ?? "",
      model: mapped.model as string,
      specification: mapped.specification ?? "",
    });
  }
  if (target === "part-drawing") return partDrawingService.findByModel(mapped.model as string);
  return catalogService.findByModel(mapped.model as string);
}

/**
 * 型式 alone is not a unique key for 部品データ — the same 型式 legitimately
 * repeats with different 定格・仕様 (e.g. NF32-CVF at 3AT vs 5AT vs 30AT are
 * different parts), so its in-file dedupe key also folds in メーカー・品名・
 * 定格・仕様. 部品図/カタログ keep the simpler 型式-only key (unchanged).
 */
function dedupeKey(target: ImportTargetCategory, mapped: MappedImportRecord, manufacturerId: string): string {
  const model = (mapped.model as string).trim().toLowerCase();
  if (target !== "part-data") return model;
  const category = (mapped.category ?? "").trim().toLowerCase();
  const specification = (mapped.specification ?? "").trim().toLowerCase();
  return [manufacturerId, category, model, specification].join("␟");
}

function diffsFromExisting(record: ImportRecord, existing: Record<string, unknown>): boolean {
  return Object.entries(record).some(([key, value]) => value !== undefined && existing[key] !== value);
}

async function analyzeTabular(file: File, target: ImportTargetCategory): Promise<ImportRow[]> {
  await preloadManufacturers();
  const parsed = await parseTabularFile(file);
  const seenKeys = new Set<string>();
  const rows: ImportRow[] = [];

  for (let i = 0; i < parsed.length; i++) {
    const mapped = mapRowToRecord(parsed[i], target);
    const rowNumber = i + 2; // header is row 1
    if (!mapped.model) {
      rows.push({
        id: `imp-${i}-error`,
        label: `#${rowNumber}`,
        targetCategory: target,
        status: "error",
        detail: "型式を読み取れませんでした（列見出し「型式」が必要です）",
      });
      continue;
    }

    const manufacturerId = await resolveManufacturerId(mapped.manufacturer);
    const key = dedupeKey(target, mapped, manufacturerId);
    if (seenKeys.has(key)) {
      rows.push({
        id: `imp-${i}-dup`,
        label: mapped.model,
        targetCategory: target,
        status: "duplicate",
        detail:
          target === "part-data"
            ? "このファイル内でメーカー・品名・型式・定格仕様の組み合わせが重複しています"
            : "このファイル内で型式が重複しています",
      });
      continue;
    }
    seenKeys.add(key);

    const record: ImportRecord = {
      symbol: mapped.symbol,
      category: mapped.category ?? "",
      manufacturerId,
      model: mapped.model,
      specification: mapped.specification ?? "",
      weight: mapped.weight,
      quantity: mapped.quantity,
      remarks: mapped.remarks,
      fileName: mapped.fileName,
    };

    const existing = await findExisting(target, mapped, manufacturerId);
    if (!existing) {
      rows.push({
        id: `imp-${i}-new`,
        label: mapped.model,
        targetCategory: target,
        status: "new",
        detail: "新規データとして追加されます",
        record,
      });
      continue;
    }

    const existingRecord = existing as unknown as Record<string, unknown>;
    if (diffsFromExisting(record, existingRecord)) {
      rows.push({
        id: `imp-${i}-update`,
        label: mapped.model,
        targetCategory: target,
        status: "update",
        action: "skip",
        detail: "既存データと内容が異なります。更新する場合は選択してください",
        record,
        matchedId: (existing as { id: string }).id,
      });
    } else {
      rows.push({
        id: `imp-${i}-existing`,
        label: mapped.model,
        targetCategory: target,
        status: "existing",
        detail: "既存データと同一のため変更はありません",
        matchedId: (existing as { id: string }).id,
      });
    }
  }
  return rows;
}

/** DWG/PDF/image cannot be parsed for structured fields client-side — register one row from the filename (型式 candidate) instead of guessing content. */
async function analyzeFile(file: File, target: ImportTargetCategory): Promise<ImportRow[]> {
  const base = file.name.replace(/\.[^./]+$/, "").trim();
  if (!base) {
    return [
      {
        id: "imp-file-error",
        label: file.name,
        targetCategory: target,
        status: "error",
        detail: "ファイル名から型式を判定できません",
      },
    ];
  }

  const record: ImportRecord = {
    category: "",
    manufacturerId: "",
    model: base,
    specification: "",
    fileName: file.name,
  };

  const existing = await findExisting(target, { model: base, category: "", specification: "" }, "");
  if (!existing) {
    return [
      {
        id: "imp-file-new",
        label: base,
        targetCategory: target,
        status: "new",
        detail: "新規データとして追加されます（ファイル名から型式を推定）",
        record,
      },
    ];
  }
  return [
    {
      id: "imp-file-existing",
      label: base,
      targetCategory: target,
      status: "existing",
      detail: "同一の型式が既存データに存在します",
      matchedId: (existing as { id: string }).id,
    },
  ];
}

async function createRecord(target: ImportTargetCategory, record: ImportRecord) {
  if (target === "part-data") {
    await partDataService.create({
      symbol: record.symbol as string | undefined,
      category: (record.category as string) || "",
      manufacturerId: (record.manufacturerId as string) || "",
      model: record.model as string,
      specification: (record.specification as string) || "",
      weight: record.weight as number | undefined,
      quantity: record.quantity as number | undefined,
      remarks: record.remarks as string | undefined,
      source: "インポート",
      files: [],
    });
  } else if (target === "part-drawing") {
    await partDrawingService.create({
      category: (record.category as string) || "",
      manufacturerId: (record.manufacturerId as string) || "",
      model: record.model as string,
      specification: (record.specification as string) || "",
      remarks: record.remarks as string | undefined,
      source: "インポート",
      files: [],
    });
  } else {
    await catalogService.create({
      manufacturerId: (record.manufacturerId as string) || "",
      category: (record.category as string) || "",
      model: record.model as string,
      fileName: (record.fileName as string) || `${record.model}.pdf`,
      files: [],
    });
  }
}

async function updateRecord(target: ImportTargetCategory, id: string, record: ImportRecord) {
  if (target === "part-data") {
    await partDataService.update(id, {
      symbol: record.symbol as string | undefined,
      category: record.category as string | undefined,
      manufacturerId: record.manufacturerId as string | undefined,
      specification: record.specification as string | undefined,
      weight: record.weight as number | undefined,
      quantity: record.quantity as number | undefined,
      remarks: record.remarks as string | undefined,
    });
  } else if (target === "part-drawing") {
    await partDrawingService.update(id, {
      category: record.category as string | undefined,
      manufacturerId: record.manufacturerId as string | undefined,
      specification: record.specification as string | undefined,
      remarks: record.remarks as string | undefined,
    });
  } else {
    await catalogService.update(id, {
      category: record.category as string | undefined,
      manufacturerId: record.manufacturerId as string | undefined,
      fileName: record.fileName as string | undefined,
    });
  }
}

class RealImportRepository implements ImportRepository {
  async analyze(
    file: File,
    fileType: ImportFileType,
    targetCategory: ImportTargetCategory,
  ): Promise<ImportRow[]> {
    if (fileType === "excel") {
      return analyzeTabular(file, targetCategory);
    }
    return analyzeFile(file, targetCategory);
  }

  async confirmImport(rows: ImportRow[]): Promise<{ imported: number; skipped: number }> {
    let imported = 0;
    let skipped = 0;
    for (const row of rows) {
      if (row.status === "new" && row.record) {
        await createRecord(row.targetCategory, row.record);
        imported++;
      } else if (row.status === "update" && row.action === "update" && row.record && row.matchedId) {
        await updateRecord(row.targetCategory, row.matchedId, row.record);
        imported++;
      } else {
        skipped++;
      }
    }
    return delay({ imported, skipped }, 300);
  }
}

export const importService: ImportRepository = new RealImportRepository();
