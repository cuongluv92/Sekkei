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
  symbol?: string; // 記号
  category: string; // 種類・品名
  manufacturerId: string;
  model: string; // 型式
  specification: string; // 定格・仕様
  weight?: number; // 重量 (kg)
  quantity?: number; // 数量
  remarks?: string; // 備考
  source: string; // データ source (社内DB, メーカーカタログ, etc.)
  files: FileAsset[];
  updatedAt: string;
  /** Set only on rows returned by listTrashed() — when this part was moved to ゴミ箱. */
  deletedAt?: string;
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
  /** Set only on rows returned by listTrashed() — when this drawing was moved to ゴミ箱. */
  deletedAt?: string;
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
  /** Set only on rows returned by listTrashed() — when this catalog entry was moved to ゴミ箱. */
  deletedAt?: string;
}

/** A row the user has picked into the 部品製作 assembly table. */
export interface PartAssemblyRow {
  id: string;
  symbol: string; // 記号
  name: string; // 品名
  manufacturerId: string;
  model: string; // 型式
  specification: string; // 走り・仕様
  weight?: number; // 重量
  quantity: number; // 数量
  remarks?: string; // 備考
  /** id of the PartData / PartDrawing / Catalog this row originated from, if any. */
  sourceRefId?: string;
  sourceType?: "part-data" | "part-drawing" | "catalog";
  /** Optional traceability back to 設計管理 (Phase 8 groundwork — not populated by any UI yet). */
  caseId?: string;
  panelId?: string;
}

/** A unified search hit combining 部品データ・部品図・カタログ. */
export interface SearchResultItem {
  id: string;
  source: "part-data" | "part-drawing" | "catalog";
  symbol?: string;
  category: string;
  manufacturerId: string;
  model: string;
  specification: string;
  weight?: number;
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
 * One row of the real 選定 rule table (SelectionEngine → RuleRepository).
 * `minValue`/`maxValue` are the input range (inclusive) this rule covers for
 * one output type + unit; `resultValue` is the real product/spec text the
 * engine returns when the input falls in range. Nothing here is invented —
 * this table starts empty and is populated only via 設定 > 選定設定 (manual
 * entry or a future rule import), never hard-coded in a component.
 */
export interface SelectionRule {
  id: string;
  outputKey: SelectionOutputKey;
  unit: string; // e.g. "kW", "A" — matched case-insensitively against the parsed input unit
  minValue: number;
  maxValue: number;
  resultValue: string;
  remarks?: string;
  order: number;
  enabled: boolean;
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

/**
 * 材質 master for 重量計算 > 基本重量計算 (材質 dropdown → auto-fills 比重). Starts
 * empty on purpose, same as selection_rules — every row is entered via
 * 設定 > 重量計算材質設定, never seeded with an invented density value.
 */
export interface WeightMaterial {
  id: string;
  name: string; // 材質名, e.g. "SS400"
  density: number; // 比重 (g/cm³)
  order: number;
}

/**
 * 銅帯選定マスタ — company-preferred copper busbar dimensions (社内選定マスタ,
 * see spec: this is company preference data, not a technical/standard
 * value, so it starts empty and is entered via 設定 > 銅帯選定マスタ, same
 * policy as WeightMaterial above). 母線銅帯's Auto mode searches this list
 * at 1..N parallel bars per phase to propose candidates — the master only
 * stores one bar's own dimensions, never a fixed 本数.
 */
export interface BusbarSize {
  id: string;
  thicknessMm: number; // 厚さ t (mm)
  widthMm: number; // 幅 W (mm)
  order: number;
}

/** 社内選定マスタ — company-used 接地線 (grounding wire) cross-section sizes. Starts empty; never pre-seeded with invented values (same rule as BusbarSize/WeightMaterial). */
export interface EarthWireSize {
  id: string;
  areaMm2: number; // 断面積 (mm²)
  order: number;
}

/** 社内選定マスタ — company-used アースバー (earth bar / 盤内接地母線) sizes, geometrically the same shape as busbar (t×W×n) but a separate master since it is a separate calculation/selection (never reuse busbar's master for this). */
export interface EarthBarSize {
  id: string;
  thicknessMm: number; // 厚さ t (mm)
  widthMm: number; // 幅 W (mm)
  order: number;
}

export type PartTemplateKind = "excel" | "dwg" | "dxf";

/** An uploaded export template for 部品製作 (Excel出力 / DWG出力), independent of the calculation templates above. Stored in Supabase Storage (part-templates/<kind>.<ext>), never bundled in the app. */
export interface PartTemplate {
  id: string;
  kind: PartTemplateKind;
  fileName: string;
  storagePath: string;
  uploadedAt?: string;
}

export type ImportFileType = "excel" | "dwg" | "pdf" | "image";
export type ImportTargetCategory = "part-data" | "part-drawing" | "catalog";

/**
 * User-chosen メーカー/分類 applied to a row only when the source file
 * doesn't supply that field itself — Excel's own per-row value always wins
 * when present. Both are plain names (not ids): メーカー gets resolved to a
 * manufacturer id (creating one if it's new) the same way an in-file value
 * would be; 分類/品名 has no master table, it's just text on the record.
 */
export interface ImportFallback {
  manufacturer?: string;
  category?: string;
}
/**
 * 新規 (new): key not found — will be created.
 * 既存 (existing): key found and every mapped field already matches — no action needed.
 * 更新 (update): key found but fields differ — needs the user to opt in (`action`), never auto-applied.
 * 重複 (duplicate): the same key appears more than once inside this one uploaded file.
 * スキップ (skip): user-excluded, or an unresolved "update" row (safe default).
 * エラー (error): a required field (型式) could not be read from the row.
 */
export type ImportRowStatus =
  | "new"
  | "existing"
  | "update"
  | "duplicate"
  | "skip"
  | "error";

/** One row analyzed from an imported file, before the user confirms. */
export interface ImportRow {
  id: string;
  label: string; // display name / model extracted from the source file
  targetCategory: ImportTargetCategory;
  status: ImportRowStatus;
  detail?: string;
  /** Only meaningful when status === "update": the user's explicit choice, never inferred. */
  action?: "update" | "skip";
  /** The parsed record to write on confirm (status "new" / "update" only). */
  record?: Record<string, string | number | undefined>;
  /** Existing record id this row matches, when status is "existing" or "update". */
  matchedId?: string;
}

export interface ImportedFile {
  id: string;
  fileName: string;
  fileType: ImportFileType;
  targetCategory: ImportTargetCategory;
  uploadedAt: string;
  rows: ImportRow[];
}
