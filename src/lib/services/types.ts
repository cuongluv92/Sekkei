import type {
  Catalog,
  CalculationDefinition,
  CalculationTemplate,
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
}

export interface PartDrawingRepository {
  search(query: string): Promise<PartDrawing[]>;
  list(): Promise<PartDrawing[]>;
  getById(id: string): Promise<PartDrawing | null>;
}

export interface CatalogRepository {
  search(query: string): Promise<Catalog[]>;
  list(): Promise<Catalog[]>;
}

export interface ManufacturerRepository {
  list(): Promise<Manufacturer[]>;
  getById(id: string): Promise<Manufacturer | null>;
}

export interface SearchRepository {
  /** Searches 部品データ and 部品図 together, exact-match style on model/keyword. */
  search(query: string): Promise<SearchResultItem[]>;
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
  upload(kind: PartTemplateKind, fileName: string): Promise<PartTemplate>;
}

export interface ImportRepository {
  /** Stub analyzer: in real life this parses Excel/DWG/PDF/image content. */
  analyze(
    fileName: string,
    fileType: ImportFileType,
    targetCategory: ImportTargetCategory,
  ): Promise<ImportRow[]>;
  confirmImport(rows: ImportRow[]): Promise<{ imported: number; skipped: number }>;
}

export type ExportFormat = "excel" | "pdf" | "dwg" | "image";

export interface ExportRepository {
  /** Stub: triggers a mock export and resolves with the (fake) output file name. */
  export(format: ExportFormat, context: string, payload?: unknown): Promise<{ fileName: string }>;
}
