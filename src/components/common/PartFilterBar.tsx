"use client";

import { Search as SearchIcon } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { UNSET_FILTER_VALUE } from "@/lib/utils/partSearch";
import type { Manufacturer } from "@/lib/types";

export interface PartFilterBarValue {
  manufacturerId: string;
  category: string;
  keyword: string;
  specification: string;
}

interface PartFilterBarProps {
  value: PartFilterBarValue;
  onChange: (value: PartFilterBarValue) => void;
  manufacturers: Manufacturer[];
  categories: string[];
  locale: "ja" | "vi";
  /** Show "メーカー未設定" — only when at least one loaded record actually has a blank manufacturer (see spec #1). */
  showUnsetManufacturer?: boolean;
  /** Show "未分類" — only when at least one loaded record actually has a blank category. */
  showUncategorized?: boolean;
}

/**
 * The four-field search/filter bar shared by 部品データ and 部品製作: メーカー
 * and 分類 are plain selects limited to values that already exist (search
 * only ever narrows real data, never creates it — unlike Import's
 * creatable combobox), 品名・型式・記号 and 定格・仕様 are free-text and
 * combine with everything else via AND. No field is required — leaving all
 * four blank shows everything. メーカー/分類 stay compact (they never need
 * more than a manufacturer/category name) so 品名・型式・定格・仕様 get the
 * extra room on a desktop row, per spec #3.
 */
export function PartFilterBar({
  value,
  onChange,
  manufacturers,
  categories,
  locale,
  showUnsetManufacturer,
  showUncategorized,
}: PartFilterBarProps) {
  const { t } = useTranslation();

  function set(patch: Partial<PartFilterBarValue>) {
    onChange({ ...value, ...patch });
  }

  return (
    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-[minmax(160px,200px)_minmax(160px,200px)_minmax(200px,1fr)_minmax(220px,1.3fr)]">
      <div className="min-w-0">
        <label className="field-label">{t("common.manufacturer")}</label>
        <select
          value={value.manufacturerId}
          onChange={(e) => set({ manufacturerId: e.target.value })}
          className="field-input truncate"
        >
          <option value="">{t("common.allManufacturers")}</option>
          {showUnsetManufacturer && (
            <option value={UNSET_FILTER_VALUE}>
              {t("common.unsetManufacturer")}
            </option>
          )}
          {manufacturers.map((m) => (
            <option key={m.id} value={m.id}>
              {locale === "vi" && m.nameVi ? m.nameVi : m.name}
            </option>
          ))}
        </select>
      </div>
      <div className="min-w-0">
        <label className="field-label">{t("common.categoryFilterLabel")}</label>
        <select
          value={value.category}
          onChange={(e) => set({ category: e.target.value })}
          className="field-input truncate"
        >
          <option value="">{t("common.allCategories")}</option>
          {showUncategorized && (
            <option value={UNSET_FILTER_VALUE}>
              {t("common.uncategorized")}
            </option>
          )}
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <div className="min-w-0">
        <label className="field-label">{t("common.name")}</label>
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-2" />
          <input
            value={value.keyword}
            onChange={(e) => set({ keyword: e.target.value })}
            placeholder={t("common.keywordFilterPlaceholder")}
            className="field-input pl-8"
          />
        </div>
      </div>
      <div className="min-w-0">
        <label className="field-label">{t("common.specification")}</label>
        <input
          value={value.specification}
          onChange={(e) => set({ specification: e.target.value })}
          placeholder={t("common.specificationFilterPlaceholder")}
          className="field-input"
        />
      </div>
    </div>
  );
}
