import type {
  Catalog,
  CalculationDefinition,
  CalculationTemplate,
  ImportFallback,
  ImportFileType,
  ImportRow,
  ImportTargetCategory,
  Manufacturer,
  PartData,
  PartDrawing,
  PartTemplate,
  PartTemplateKind,
  SearchResultItem,
  SelectionInput,
  SelectionResultRow,
} from "@/lib/types";

/**
 * Repository-style interfaces for every data source the app needs. Every
 * implementation in this folder is currently backed by in-memory mock data,
 * but pages only ever import the *Service singletons below, never the mock
 * modules directly — so switching to a real API/database/file-storage
 * backend later means swapping the implementation of these interfaces, not
 * rewriting the UI.
 */

export interface PartDataRepository {
  search(query: string): Promise<PartData[]>;
  list(): Promise<PartData[]>;
  getById(id: string): Promise<PartData | null>;
  /**
   * Looks up an existing 部品データ row by identity, not by 型式 alone — the
   * same 型式 legitimately repeats with different 定格・仕様 (e.g. NF32-CVF
   * at 3AT vs 5AT vs 30AT are different parts), so メーカー・品名・型式・
   * 定格・仕様 together form the match key.
   */
  findExisting(criteria: {
    manufacturerId: string;
    category: string;
    model: string;
    specification: string;
  }): Promise<PartData | null>;
  create(input: Omit<PartData, "id" | "updatedAt">): Promise<PartData>;
  update(id: string, patch: Partial<PartData>): Promise<PartData>;
  /** Moves a row to ゴミ箱 (sets deleted_at) — recoverable via restore(), not a hard delete. */
  moveToTrash(id: string): Promise<void>;
  /** Lists only trashed rows (deleted_at is not null), newest deletion first. */
  listTrashed(): Promise<PartData[]>;
  /** Clears deleted_at, returning the row to normal listing. */
  restore(id: string): Promise<void>;
  /** Permanently deletes a trashed row — cannot be undone. */
  purge(id: string): Promise<void>;
}

export interface PartDrawingRepository {
  search(query: string): Promise<PartDrawing[]>;
  list(): Promise<PartDrawing[]>;
  getById(id: string): Promise<PartDrawing | null>;
  findByModel(model: string): Promise<PartDrawing | null>;
  create(input: Omit<PartDrawing, "id" | "updatedAt">): Promise<PartDrawing>;
  update(id: string, patch: Partial<PartDrawing>): Promise<PartDrawing>;
  /** Moves a row to ゴミ箱 (sets deleted_at) — recoverable via restore(), not a hard delete. */
  moveToTrash(id: string): Promise<void>;
  /** Lists only trashed rows (deleted_at is not null), newest deletion first. */
  listTrashed(): Promise<PartDrawing[]>;
  /** Clears deleted_at, returning the row to normal listing. */
  restore(id: string): Promise<void>;
  /** Permanently deletes a trashed row — cannot be undone. */
  purge(id: string): Promise<void>;
}

export interface CatalogRepository {
  search(query: string): Promise<Catalog[]>;
  list(): Promise<Catalog[]>;
  findByModel(model: string): Promise<Catalog | null>;
  create(input: Omit<Catalog, "id" | "updatedAt">): Promise<Catalog>;
  update(id: string, patch: Partial<Catalog>): Promise<Catalog>;
}

export interface ManufacturerRepository {
  list(): Promise<Manufacturer[]>;
  getById(id: string): Promise<Manufacturer | null>;
  create(name: string): Promise<Manufacturer>;
}

export interface SearchRepository {
  /** Searches 部品データ・部品図・カタログ together, exact-match style on model/keyword. */
  search(query: string): Promise<SearchResultItem[]>;
  /** Every non-trashed row across 部品データ・部品図・カタログ, unfiltered — for client-side filter bars (メーカー/分類/仕様 combined with AND). */
  listAll(): Promise<SearchResultItem[]>;
}

export interface SelectionRepository {
  /** Stub: real selection rules/formulas will be supplied later. */
  evaluate(input: SelectionInput): Promise<SelectionResultRow[]>;
}

export interface CalculationRepository {
  listDefinitions(): Promise<CalculationDefinition[]>;
  getDefinition(key: string): Promise<CalculationDefinition | null>;
  /** Stub: returns an empty/placeholder result until formulas are registered. */
  calculate(
    key: string,
    values: Record<string, string | number>,
  ): Promise<Record<string, string>[]>;
}

export interface CalculationTemplateRepository {
  list(): Promise<CalculationTemplate[]>;
  getByCalculationKey(calculationKey: string): Promise<CalculationTemplate | null>;
  upload(calculationKey: string, fileName: string): Promise<CalculationTemplate>;
}

export interface PartTemplateRepository {
  list(): Promise<PartTemplate[]>;
  getByKind(kind: PartTemplateKind): Promise<PartTemplate | null>;
  upload(kind: PartTemplateKind, file: File): Promise<PartTemplate>;
}

export interface ImportRepository {
  /**
   * Parses the real uploaded file (Excel/CSV rows via header matching;
   * DWG/PDF/image register one row from the filename) and diffs it against
   * the real part-data/part-drawing/catalog repositories. Never writes
   * anything — that only happens in `confirmImport`.
   */
  analyze(
    file: File,
    fileType: ImportFileType,
    targetCategory: ImportTargetCategory,
    fallback?: ImportFallback,
  ): Promise<ImportRow[]>;
  confirmImport(rows: ImportRow[]): Promise<{ imported: number; skipped: number }>;
}

export type ExportFormat = "excel" | "pdf" | "dwg" | "image";

export interface ExportRepository {
  /** Stub: triggers a mock export and resolves with the (fake) output file name. */
  export(format: ExportFormat, context: string, payload?: unknown): Promise<{ fileName: string }>;
}
