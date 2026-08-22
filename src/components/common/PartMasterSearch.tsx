"use client";

import { useMemo, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { listManufacturers } from "@/lib/mock/manufacturers";
import { distinctCategories, matchesPartFilters } from "@/lib/utils/partSearch";
import { PartFilterBar, type PartFilterBarValue } from "@/components/common/PartFilterBar";
import { SearchResultList } from "@/components/common/SearchResultList";
import type { SearchResultItem } from "@/lib/types";

const BLANK_FILTERS: PartFilterBarValue = { manufacturerId: "", category: "", keyword: "", specification: "" };

interface PartMasterSearchProps {
  items: SearchResultItem[];
  loading?: boolean;
  onDownload: (item: SearchResultItem, kind: "dwg" | "pdf") => void;
  /** Double click on a result row — the only way anything gets picked (see 部品製作 spec item 15). */
  onPick: (item: SearchResultItem) => void;
}

/**
 * The 部品データ browse-and-pick UI shared by 部品製作's top search bar and its
 * per-row "insert from master" action: the same PartFilterBar (メーカー/分類/
 * 品名・型式・記号/定格・仕様, all optional, all combined with AND) and the
 * same single-click-selects / double-click-picks table, so both entry
 * points behave identically instead of drifting apart.
 */
export function PartMasterSearch({ items, loading, onDownload, onPick }: PartMasterSearchProps) {
  const { t, locale } = useTranslation();
  const [filters, setFilters] = useState<PartFilterBarValue>(BLANK_FILTERS);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const categories = useMemo(() => distinctCategories(items), [items]);
  const hasAnyFilter = Object.values(filters).some((v) => v.trim() !== "");
  const filtered = useMemo(
    () => (hasAnyFilter ? items.filter((i) => matchesPartFilters(i, filters)) : []),
    [items, filters, hasAnyFilter],
  );

  return (
    <div className="flex flex-col gap-3">
      <PartFilterBar
        value={filters}
        onChange={setFilters}
        manufacturers={listManufacturers()}
        categories={categories}
        locale={locale}
      />
      {hasAnyFilter && (
        <>
          <p className="text-[11px] text-muted-2">{t("partAssembly.doubleClickHint")}</p>
          <div className="panel overflow-hidden">
            <SearchResultList
              results={filtered}
              loading={loading}
              selectedKey={selectedKey}
              onSelect={(item) => setSelectedKey(`${item.source}-${item.id}`)}
              onAdd={onPick}
              onDownload={onDownload}
              emptyMessage={t("common.noResults")}
            />
          </div>
        </>
      )}
    </div>
  );
}
