/**
 * JSIA-T1018:2012「配電盤類の耐震設計マニュアル」表1 — 局部震度法による
 * 建築設備機器の設計用標準震度（KS）。
 *
 * 設置階 × (耐震安全性の分類=施設の種類 × 機器の重要度) の組み合わせで
 * 4通りの値を持つ — 特定の施設(災害応急対策活動に必要な施設・避難所・
 * 人命/物品の安全性確保が特に必要な施設)かどうか、重要機器(災害応急対策
 * 用・危険物施設用・防災機能維持用・二次災害を引き起こす恐れのある設備用
 * など)かどうかで、同じ設置階でも最大2倍の差が付く。取り込み元の
 * Excel テンプレートは「一般の施設・一般機器」の1通りしか選べなかったが、
 * これは表1の中で最も緩い(震度が最も小さい)組み合わせにすぎない —
 * 実際の盤がどれかに該当するなら、必ずその区分で計算しないと地震力を
 * 過小評価してしまう。
 */
export const SEISMIC_FACILITY_CATEGORIES = ["specific", "general"] as const;
export type SeismicFacilityCategoryValue = (typeof SEISMIC_FACILITY_CATEGORIES)[number];

export const SEISMIC_EQUIPMENT_IMPORTANCE = ["important", "general"] as const;
export type SeismicEquipmentImportanceValue = (typeof SEISMIC_EQUIPMENT_IMPORTANCE)[number];

export const SEISMIC_FLOOR_POSITIONS = ["upper", "middle", "groundOrFirst"] as const;
export type SeismicFloorPositionValue = (typeof SEISMIC_FLOOR_POSITIONS)[number];

/** [facilityCategory][importance][floorPosition] → KS。JSIA-T1018:2012 表1 (p.3) の数値そのまま。 */
const KS_TABLE: Record<
  SeismicFacilityCategoryValue,
  Record<SeismicEquipmentImportanceValue, Record<SeismicFloorPositionValue, number>>
> = {
  specific: {
    important: { upper: 2.0, middle: 1.5, groundOrFirst: 1.0 },
    general: { upper: 1.5, middle: 1.0, groundOrFirst: 0.6 },
  },
  general: {
    important: { upper: 1.5, middle: 1.0, groundOrFirst: 0.6 },
    general: { upper: 1.0, middle: 0.6, groundOrFirst: 0.4 },
  },
};

export function getStandardSeismicIntensity(
  facilityCategory: SeismicFacilityCategoryValue,
  importance: SeismicEquipmentImportanceValue,
  floorPosition: SeismicFloorPositionValue,
): number {
  return KS_TABLE[facilityCategory][importance][floorPosition];
}
