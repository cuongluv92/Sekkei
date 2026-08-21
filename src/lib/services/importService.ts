import { delay } from "@/lib/utils/async";
import type { ImportFileType, ImportRow, ImportTargetCategory } from "@/lib/types";
import type { ImportRepository } from "./types";

/**
 * Mock import analyzer. A real implementation will parse the uploaded
 * Excel/DWG/PDF/image file and diff it against the existing 部品データ /
 * 部品図 / カタログ tables. For now it deterministically fabricates one row
 * of each status (新規 / 既存 / スキップ / エラー) so the review screen and
 * its dedupe messaging can be exercised end to end.
 */
class MockImportRepository implements ImportRepository {
  async analyze(
    fileName: string,
    _fileType: ImportFileType,
    targetCategory: ImportTargetCategory,
  ): Promise<ImportRow[]> {
    const base = fileName.replace(/\.[^./]+$/, "") || "IMPORTED-ITEM";

    const rows: ImportRow[] = [
      {
        id: `imp-${base}-new`,
        label: base,
        targetCategory,
        status: "new",
        detail: "新規データとして追加されます",
      },
      {
        id: `imp-${base}-existing`,
        label: "NF63-CV",
        targetCategory,
        status: "existing",
        detail: "同一型式が既存データに存在するため上書きされません",
      },
      {
        id: `imp-${base}-skip`,
        label: `${base}-DUPLICATE`,
        targetCategory,
        status: "skip",
        detail: "ファイル内に重複する行があるためスキップされます",
      },
      {
        id: `imp-${base}-error`,
        label: `${base}-UNKNOWN`,
        targetCategory,
        status: "error",
        detail: "必須項目（型式）を読み取れませんでした",
      },
    ];

    return delay(rows, 900);
  }

  async confirmImport(rows: ImportRow[]) {
    const imported = rows.filter((r) => r.status === "new").length;
    const skipped = rows.length - imported;
    return delay({ imported, skipped }, 600);
  }
}

export const importService: ImportRepository = new MockImportRepository();
