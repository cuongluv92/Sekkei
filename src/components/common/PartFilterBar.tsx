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
}

/**
 * The four-field search/filter bar shared by 部品データ and 部品製作: メーカー
 * and 分類 are plain selects limited to values that already exist (search
 * only ever narrows real data, never creates it — unlike Import's
 * creatable combobox), 品名・型式・記号 and 定格・仕様 are free-text and
 * combine with everything else via AND. No field is required — leaving all
 * four blank shows everything.
 */
export function PartFilterBar({ value, onChange, manufacturers, categories, locale }: PartFilterBarProps) {
  const { t } = useTranslation();

  function set(patch: Partial<PartFilterBarValue>) {
    onChange({ ...value, ...patch });
  }

  return (
    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
      <div>
        <label className="field-label">{t("common.manufacturer")}</label>
        <select
          value={value.manufacturerId}
          onChange={(e) => set({ manufacturerId: e.target.value })}
          className="field-input"
        >
          <option value="">{t("common.allManufacturers")}</option>
          <option value={UNSET_FILTER_VALUE}>{t("common.unsetManufacturer")}</option>
          {manufacturers.map((m) => (
            <option key={m.id} value={m.id}>
              {locale === "vi" && m.nameVi ? m.nameVi : m.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="field-label">{t("common.categoryFilterLabel")}</label>
        <select value={value.category} onChange={(e) => set({ category: e.target.value })} className="field-input">
          <option value="">{t("common.allCategories")}</option>
          <option value={UNSET_FILTER_VALUE}>{t("common.uncategorized")}</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <div>
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
      <div>
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
