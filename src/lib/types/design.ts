/**
 * 設計管理 (Design Management) domain types.
 *
 * Architecture per spec: one 案件 (`DesignCase`) is THE single root record
 * for a job — not a child of some separate "Project" grouping table. Every
 * other module's data (部品製作, 重量計算, 母線銅帯, and every future
 * calculation) hangs off this same `DesignCase.id` directly. 設計依頼・製作依頼・
 * 工程・原価工数 are different *slices of data* on that same record (or its
 * child 盤/panels) — never copies of the same fields spread across separate
 * tables that need to be kept in sync. `DesignCase` itself holds every
 * 設計依頼 field directly; 製作依頼/工程/原価工数 (Phase 2-4) will add their own
 * child tables (`CaseSchedule`, `CaseCostLabor`) keyed by the same
 * `caseId`, and per-panel production fields live directly on `CasePanel` —
 * nothing here is denormalized data that must be re-synced.
 */

/**
 * The 16 spec items from 設計依頼書 (外形仕様: 箱体/塗装/ハンドル/その他,
 * 結線仕様: 電気方式/電源/電圧/端子台), confirmed against the real template.
 * Each has independent 仕様Ⅰ・Ⅱ・Ⅲ values, and each key is also a
 * `MasterListKey` — the candidate list for its comboboxes is *not*
 * hard-coded in the component, it comes from `masterListService`.
 */
export const SPEC_FIELD_KEYS = [
  "location",
  "installation",
  "structure",
  "material",
  "color",
  "gloss",
  "handleLocation",
  "handleType",
  "keyNo",
  "wireEntry",
  "opening",
  "blankPlate",
  "electricalMethod",
  "powerSource",
  "voltage",
  "terminalBlock",
] as const;

export type SpecFieldKey = (typeof SPEC_FIELD_KEYS)[number];

/** Visual grouping only (mirrors the real 設計依頼書 layout) — does not change the data shape. */
export const SPEC_GROUPS: { group: string; fields: SpecFieldKey[] }[] = [
  {
    group: "box",
    fields: ["location", "installation", "structure", "material"],
  },
  { group: "paint", fields: ["color", "gloss"] },
  { group: "handle", fields: ["handleLocation", "handleType", "keyNo"] },
  { group: "other", fields: ["wireEntry", "opening", "blankPlate"] },
];

export const WIRING_SPEC_FIELDS: SpecFieldKey[] = [
  "electricalMethod",
  "powerSource",
  "voltage",
  "terminalBlock",
];

export interface SpecEntry {
  spec1: string;
  spec2: string;
  spec3: string;
}

export type SpecValues = Partial<Record<SpecFieldKey, SpecEntry>>;

/**
 * 案件 — the one central record. Panels (`case_panels`) are a genuine 1-to-many
 * relation (a case legitimately has multiple 盤), not duplicated data.
 */
/**
 * Row-color legend from the real ②図面管理台帳 template (cell H1): two states
 * get a background color, a third ("完", manufacturing complete) is a plain
 * text marker tracked separately via `manufacturingComplete`. "" means no
 * color yet (design still in progress).
 */
export const CASE_STATUS_VALUES = [
  "",
  "design_pending_approval",
  "production_requested",
] as const;
export type CaseStatus = (typeof CASE_STATUS_VALUES)[number];

/** Which 設計依頼書目次 (③京王 / ④その他) a 案件 is listed under — an explicit choice, never guessed from 注文先 text. */
export const INDEX_CATEGORY_VALUES = ["keio", "other"] as const;
export type IndexCategory = (typeof INDEX_CATEGORY_VALUES)[number];

export interface DesignCase {
  id: string;
  year: number; // full 4-digit year, e.g. 2026
  sequenceNo: number; // per-year sequence, e.g. 4 -> "26-004"
  drawingNumber: string; // formatted cache of year+sequenceNo, immutable after creation
  requestType: string; // 設計依頼区分
  managementNumber: string; // 管理番号 = 見積番号
  constructionNumber: string; // 工事番号
  orderer: string; // 注文先
  customerContact: string; // 客先担当
  projectName: string; // 件名
  specs: SpecValues;
  designRemarks: string; // 設計備考欄 (distinct from 製作注意事項)
  indexCategory: IndexCategory; // 設計依頼書目次・京王 or ・その他
  assignee: string; // 担当 (③④設計依頼書目次)
  caseStatus: CaseStatus; // ②図面管理台帳 H1 legend row color
  manufacturingComplete: boolean; // 製造完了 (②図面管理台帳 column J, "完")
  createdAt: string;
  updatedAt: string;
  /** Archived (soft-deleted) via 保存済み案件's 削除 action — excluded from every listing/search unless explicitly requested. Never a hard delete: recoverable. */
  deletedAt: string | null;
}

export const PANEL_NUMBERS = [1, 2, 3, 4, 5, 6, 7] as const;
export type PanelNo = (typeof PANEL_NUMBERS)[number];

/**
 * 盤①～⑦. Design-side hour fields are filled from Phase 1 (設計依頼書 has one
 * 見込時間/実動時間 pair). Production-side hours and the per-panel electrical
 * spec fields (confirmed from 製作依頼書: 電気方式/定格電圧/定格電流/定格短絡遮断容量/
 * 周波数/制御電圧/保護等級) are Phase 2 — the columns exist now so Phase 2 only
 * needs UI, not a schema change.
 */
export interface CasePanel {
  id: string;
  caseId: string;
  panelNo: PanelNo;
  panelName: string; // 盤名称
  panelStructure: string; // 盤構造
  faceCount: number | null; // 面数
  designDueDate: string | null; // 設計納期 (from 設計依頼書 panel row)
  designEstimatedHours: number | null; // 見込時間 (設計依頼書)
  designActualHours: number | null; // 実動時間 (設計依頼書)
  // --- Phase 2 (製作依頼書) — schema ready, no UI yet ---
  productionEstimatedHours: number | null; // 見込時間 (製作依頼書)
  productionActualHours: number | null; // 実動時間 (製作依頼書)
  electricalMethod: string;
  ratedVoltage: string;
  ratedCurrent: string;
  ratedBreakingCapacity: string;
  frequency: string;
  controlVoltage: string;
  protectionRating: string;
}

/**
 * Case-level 製作依頼 fields (confirmed from the real form: these appear once
 * per case, not once per panel, unlike the electrical fields above).
 * Phase 2 — schema only.
 */
export interface ProductionRequest {
  caseId: string;
  productionNotes: string; // 製作注意事項
  inspectionSheet: string; // 検査表
  filmThickness: string; // 膜厚
  earthLeakage: string; // 漏電
  earthLeakageAlarm: string; // 漏電アラーム
  withstandVoltage: string; // 耐圧
}

/**
 * 工程 milestones. 0029マイグレーションで各日付欄は自由記入テキスト
 * (「9月下旬」等)も許容する`text`型になった — 実日付`YYYY-MM-DD`とは限らない
 * (isIsoDateで判定)。Also the single source of truth for the real ⑧製作依頼書
 * template's ＢＯＸ/鈑金/部材/完成/出荷/納品/立会 date row (confirmed: those cells
 * are the same "予定日" concept as the matching end-date here — edited from
 * either 工程表 or 製作依頼書, never a separate copy) — boxManufacturer /
 * sheetMetalManufacturer are the vendor name shown above the date in that
 * template's BOX/鈑金 cells specifically.
 *
 * production/inspection/witness/shippingの各End*RefDateは、対応する完了日欄が
 * 自由記入テキストで色分け計算に使えない場合の補助入力(常に実日付のみ)。
 * 完了日欄が実日付ならそちらを優先し、Refは無視する(scheduleColoring.ts参照)。
 */
export interface CaseSchedule {
  caseId: string;
  sheetMetalOrderDate: string | null;
  sheetMetalDeliveryDate: string | null;
  sheetMetalManufacturer: string;
  boxOrderDate: string | null;
  boxDeliveryDate: string | null;
  boxManufacturer: string;
  accessoryOrderDate: string | null;
  accessoryDeliveryDate: string | null;
  productionStartDate: string | null;
  productionEndDate: string | null;
  productionEndRefDate: string | null;
  inspectionStartDate: string | null;
  inspectionEndDate: string | null;
  inspectionEndRefDate: string | null;
  witnessStartDate: string | null;
  witnessEndDate: string | null;
  witnessEndRefDate: string | null;
  shippingStartDate: string | null;
  shippingEndDate: string | null;
  shippingEndRefDate: string | null;
  deliveryDate: string | null;
}

export type ScheduleCategoryKey =
  | "sheetMetal"
  | "box"
  | "accessory"
  | "production"
  | "inspection"
  | "witness"
  | "shipping";

/** Timeline color per category — must come from the real ⑤工程表 template once uploaded, never hard-coded RGB. Phase 3/5. */
export interface ScheduleColorConfig {
  category: ScheduleCategoryKey;
  color: string; // hex, sourced from the uploaded template
}

/** 原価・工数. Computed totals (設計実動合計 / 製作実動合計) are derived from panels at read time, never stored. Phase 4 — schema only. */
export interface CaseCostLabor {
  caseId: string;
  materialCost: number | null;
  outsourcingCost: number | null;
  otherCost: number | null;
  notes: string;
}

/** 履歴/backup snapshot. Phase 7 — schema only. */
export interface CaseVersion {
  id: string;
  caseId: string;
  version: number;
  snapshot: unknown;
  timestamp: string;
  user: string;
  reason: string;
}

/**
 * Master lists backing every dropdown/combobox in 設計管理 (設計依頼区分,
 * 盤構造, all 16 spec fields, electrical fields, schedule colors, ...). Never
 * hard-coded in a component — always read through `masterListService`.
 */
export interface MasterListItem {
  id: string;
  listKey: string;
  value: string;
  order: number;
  enabled: boolean;
}

export interface DesignCaseSearchQuery {
  year?: number;
  drawingNumber?: string;
  managementNumber?: string;
  constructionNumber?: string;
  orderer?: string;
  customerContact?: string;
  projectName?: string;
  panelName?: string;
}

export interface DesignCaseWithPanels {
  case: DesignCase;
  panels: CasePanel[];
}

/**
 * ②～⑧ Excel templates, plus 耐震計算/換気計算 report templates. Phase 5 —
 * schema only (settings UI/versioning not built yet).
 *
 * The 耐震計算/換気計算 kinds below reuse this same Storage-backed template
 * system (design_templates table, oku-pro-files bucket) even though they are
 * not part of 設計管理 — the underlying service/table/storage are already
 * generic (kind is a free-text column), and duplicating that machinery for a
 * second "calc template" system would add nothing. Each kind's uploaded file
 * is expected to be — or contain, as one named sheet in a multi-sheet
 * workbook — the real JSIA-T1018/JSIA-T1016 vendor Excel format:
 *   - seismicFreeStanding: 自立形 sheet (also used for キュービクル — see
 *     seismicExcelExport.ts for why they share one sheet/formula set)
 *   - seismicWallMounted: 壁掛形 sheet
 *   - ventilationOutdoor: 屋外フィルタ有り◯◯ sheet (the フィルタ有り layout
 *     is a strict superset of フィルタ無し — same row/column positions for
 *     every shared field, with 3 extra filter-only rows — so a フィルタ無し
 *     case is exported into this same sheet with the filter-only cells
 *     blanked out, rather than maintaining a second near-duplicate kind;
 *     see ventilationExcelExport.ts)
 *   - ventilationIndoor: 屋内フィルタ有り sheet, same reasoning
 */
export type DesignTemplateKind =
  | "drawingLedger" // ② 図面管理台帳 (one workbook, one sheet per year)
  | "designRequestIndexKeio" // ③ 設計依頼書目次・京王 (one workbook)
  | "designRequestIndexOther" // ④ 設計依頼書目次・その他 (one workbook)
  | "scheduleSheet" // ⑤ 工程表 (one workbook, one sheet per year.month)
  | "costLaborSheet" // ⑥ 仕入原価／工数一覧表 (one workbook)
  | "designRequestForm" // ⑦ 設計依頼書 (one file per year)
  | "productionRequestForm" // ⑧ 製作依頼書 (one file per year)
  | "dwgTemplate" // generic DWG starter template
  | "seismicFreeStanding" // 耐震計算書（自立形／キュービクル）
  | "seismicWallMounted" // 耐震計算書（壁掛形）
  | "ventilationOutdoor" // 換気計算書（屋外）
  | "ventilationIndoor"; // 換気計算書（屋内）

export const DESIGN_TEMPLATE_KINDS: DesignTemplateKind[] = [
  "designRequestForm",
  "productionRequestForm",
  "drawingLedger",
  "designRequestIndexKeio",
  "designRequestIndexOther",
  "scheduleSheet",
  "costLaborSheet",
  "dwgTemplate",
  "seismicFreeStanding",
  "seismicWallMounted",
  "ventilationOutdoor",
  "ventilationIndoor",
];

/** Stored in Supabase Storage (templates/<kind>/...), never bundled in the app — see designTemplateService. */
export interface DesignTemplateVersion {
  id: string;
  kind: DesignTemplateKind;
  version: number;
  fileName: string;
  storagePath: string;
  sizeBytes: number | null;
  active: boolean;
  uploadedAt: string;
}
