/**
 * Core domain entities for Sekkei.
 *
 * These types describe the shape of data the app will eventually load from a
 * real database / file storage / calculation backend. For now every service
 * that returns these types is backed by in-memory mock data (see
 * `src/lib/mock`), but pages and components only ever depend on these
 * interfaces, so swapping the implementation later does not require UI
 * changes.
 */

/** A downloadable/viewable file attached to a part, drawing or catalog entry. */
export interface FileAsset {
  id: string;
  kind: "dwg" | "pdf" | "image";
  fileName: string;
  /** Origin file URL (DWG original, PDF, image). Not resolved in mock mode. */
  url?: string;
  /**
   * Browser-viewable preview URL. For PDFs this can be the PDF itself; for
   * DWG this will later point at a converted raster/vector preview. Left
   * undefined in mock mode so components fall through to their empty state.
   */
  previewUrl?: string;
  sizeBytes?: number;
  updatedAt?: string;
}

export interface Manufacturer {
  id: string;
  name: string;
  nameVi?: string;
}

/** 部品データ */
export interface PartData {
  id: string;
  category: string; // 種類
  manufacturerId: string;
  model: string; // 型式
  specification: string; // 走り・仕様
  quantity?: number; // 数量
  remarks?: string; // 備考
  source: string; // データ source (社内DB, メーカーカタログ, etc.)
  files: FileAsset[];
  updatedAt: string;
}

/** 部品図 */
export interface PartDrawing {
  id: string;
  category: string;
  manufacturerId: string;
  model: string;
  specification: string;
  remarks?: string;
  source: string;
  files: FileAsset[];
  updatedAt: string;
}

/** カタログ */
export interface Catalog {
  id: string;
  manufacturerId: string;
  category: string;
  model: string;
  fileName: string;
  updatedAt: string;
  files: FileAsset[];
}

/** A row the user has picked into the 部品製作 assembly table. */
export interface PartAssemblyRow {
  id: string;
  symbol: string; // 記号
  name: string; // 品名
  manufacturerId: string;
  model: string; // 型式
  specification: string; // 走り・仕様
  quantity: number; // 数量
  remarks?: string; // 備考
  /** id of the PartData / PartDrawing this row originated from, if any. */
  sourceRefId?: string;
  sourceType?: "part-data" | "part-drawing";
}

/** A unified search hit combining 部品データ and 部品図. */
export interface SearchResultItem {
  id: string;
  source: "part-data" | "part-drawing";
  category: string;
  manufacturerId: string;
  model: string;
  specification: string;
  quantity?: number;
  remarks?: string;
  sourceLabel: string;
  files: FileAsset[];
}

/** 選定 output target keys. */
export type SelectionOutputKey =
  | "breaker"
  | "am"
  | "magneticContactor"
  | "wireSize"
  | "terminalBlock"
  | "other";

export interface SelectionInput {
  rawValue: string; // e.g. "15 kW" or "20 A"
  outputs: SelectionOutputKey[];
}

/** A single computed row in the 選定 result table. Values are placeholders until real rules are supplied. */
export interface SelectionResultRow {
  id: string;
  outputKey: SelectionOutputKey;
  label: string;
  value: string;
  remarks?: string;
}

/**
 * Describes the selection logic for a given input/output combination. The
 * `evaluate` field is intentionally left as a stub — real formulas / lookup
 * tables will be provided later and plugged in without touching the UI.
 */
export interface SelectionRule {
  id: string;
  name: string;
  inputPattern: RegExp;
  supportedOutputs: SelectionOutputKey[];
}

/** Generic calculation field definition, used to render input forms. */
export interface CalculationFieldDef {
  key: string;
  label: string;
  labelVi?: string;
  unit?: string;
  type: "number" | "text" | "select";
  options?: { label: string; labelVi?: string; value: string }[];
  placeholder?: string;
}

export interface CalculationResultColumn {
  key: string;
  label: string;
  labelVi?: string;
  unit?: string;
}

/**
 * Describes one calculation module (重量計算, 換気計算, 耐震計算, 母線銅帯, ...).
 * `hasFormula` is false for every module in this phase — the calculate()
 * implementation in the service layer only returns a placeholder result.
 */
export interface CalculationDefinition {
  id: string;
  key: string; // "weight" | "ventilation" | "seismic" | "busbar" | "earth-wire" | ...
  name: string;
  nameVi?: string;
  description?: string;
  descriptionVi?: string;
  inputFields: CalculationFieldDef[];
  resultColumns: CalculationResultColumn[];
  hasFormula: boolean;
  templateId?: string;
}

/** An uploaded Excel export template bound to a calculation module. */
export interface CalculationTemplate {
  id: string;
  calculationKey: string;
  fileName: string;
  uploadedAt?: string;
  fileUrl?: string;
}

export type PartTemplateKind = "excel" | "dwg";

/** An uploaded export template for 部品製作 (Excel出力 / DWG出力), independent of the calculation templates above. */
export interface PartTemplate {
  id: string;
  kind: PartTemplateKind;
  fileName: string;
  uploadedAt?: string;
}

export type ImportFileType = "excel" | "dwg" | "pdf" | "image";
export type ImportTargetCategory = "part-data" | "part-drawing" | "catalog";
export type ImportRowStatus = "new" | "existing" | "skip" | "error";

/** One row analyzed from an imported file, before the user confirms. */
export interface ImportRow {
  id: string;
  label: string; // display name / model extracted from the source file
  targetCategory: ImportTargetCategory;
  status: ImportRowStatus;
  detail?: string;
}

export interface ImportedFile {
  id: string;
  fileName: string;
  fileType: ImportFileType;
  targetCategory: ImportTargetCategory;
  uploadedAt: string;
  rows: ImportRow[];
}
