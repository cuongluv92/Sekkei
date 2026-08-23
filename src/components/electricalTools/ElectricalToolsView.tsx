"use client";

import { Search as SearchIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { PageHeader } from "@/components/common/PageHeader";
import { CategoryNav } from "./CategoryNav";
import {
  ELECTRICAL_TOOL_CATEGORIES,
  searchElectricalToolCategories,
} from "./registry";

/**
 * 電気技術計算 top-level view — search box at top (kw/電流/変圧器/YΔ/電圧降下/
 * CT... jump straight to the matching category), a small category nav on
 * the left, and the selected calculator (which itself lays out as
 * calculator/計算根拠 via `.calc-layout`, stacking on mobile) filling the
 * rest.
 */
export function ElectricalToolsView() {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState(ELECTRICAL_TOOL_CATEGORIES[0].id);

  const filtered = useMemo(() => searchElectricalToolCategories(query), [query]);

  useEffect(() => {
    if (filtered.length > 0 && !filtered.some((c) => c.id === activeId)) {
      setActiveId(filtered[0].id);
    }
  }, [filtered, activeId]);

  const active =
    ELECTRICAL_TOOL_CATEGORIES.find((c) => c.id === activeId) ??
    ELECTRICAL_TOOL_CATEGORIES[0];
  const ActiveComponent = active.component;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t("electricalTools.title")}
        description={t("electricalTools.description")}
      />

      <div className="relative max-w-md">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-2" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("electricalTools.searchPlaceholder")}
          className="field-input pl-8"
        />
      </div>

      <div className="flex flex-col gap-4 lg:flex-row">
        <CategoryNav categories={filtered} activeId={activeId} onSelect={setActiveId} />
        <div className="min-w-0 flex-1">
          {filtered.length === 0 ? (
            <div className="panel">
              <div className="panel-body py-12 text-center text-[13px] text-muted-2">
                {t("electricalTools.searchEmpty")}
              </div>
            </div>
          ) : (
            <ActiveComponent />
          )}
        </div>
      </div>
    </div>
  );
}
