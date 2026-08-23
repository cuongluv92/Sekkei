"use client";

import { Search as SearchIcon } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import {
  searchGlobal,
  type GroupedSearchResults,
} from "@/lib/search/globalSearchService";
import { preloadManufacturers } from "@/lib/mock/manufacturers";
import { PageHeader } from "@/components/common/PageHeader";
import type { SearchSourceKind } from "@/lib/search/types";

const SECTION_LABEL_KEY: Record<SearchSourceKind, string> = {
  case: "search.sections.case",
  "part-assembly": "search.sections.partAssembly",
  "part-data": "search.sections.partData",
  "part-drawing": "search.sections.partDrawing",
  catalog: "search.sections.catalog",
  calculation: "search.sections.calculation",
};

/**
 * Global Search — spans the whole app (案件/部品製作/部品データ/部品図/カタログ/計算,
 * spec #12-#16), not just 部品データ・部品図・カタログ. Results are grouped by
 * source with a real navigable target per hit (`SearchHit.href`) — clicking
 * a 案件 opens that 案件 in 設計管理, a 部品製作 hit opens 部品製作 with that 案件
 * active, a 計算 hit opens the right calculation module for the right 案件,
 * and 部品データ/部品図/カタログ hits open their own screen prefiltered by the
 * same query. All source-specific logic lives in `globalSearchService`'s
 * providers — this view only renders whatever comes back.
 */
export function SearchView() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") ?? "";
  const initialSpecOnly = searchParams.get("spec") === "1";

  const [inputValue, setInputValue] = useState(initialQuery);
  const [query, setQuery] = useState(initialQuery);
  const [specOnly, setSpecOnly] = useState(initialSpecOnly);
  const [groups, setGroups] = useState<GroupedSearchResults>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setInputValue(initialQuery);
    setQuery(initialQuery);
    setSpecOnly(initialSpecOnly);
  }, [initialQuery, initialSpecOnly]);

  useEffect(() => {
    if (!query) {
      setGroups([]);
      return;
    }
    let active = true;
    setLoading(true);
    Promise.all([
      preloadManufacturers(),
      searchGlobal(query, { specOnly }),
    ]).then(([, res]) => {
      if (!active) return;
      setGroups(res);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [query, specOnly]);

  function buildUrl(q: string, spec: boolean) {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (spec) params.set("spec", "1");
    const qs = params.toString();
    return qs ? `/search?${qs}` : "/search";
  }

  function submit() {
    const q = inputValue.trim();
    setQuery(q);
    router.replace(buildUrl(q, specOnly));
  }

  function toggleSpecOnly() {
    const next = !specOnly;
    setSpecOnly(next);
    router.replace(buildUrl(query, next));
  }

  const totalCount = groups.reduce((sum, g) => sum + g.hits.length, 0);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t("search.title")}
        description={t("search.description")}
      />

      <div className="flex gap-2">
        <div className="relative max-w-md flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-2" />
          <input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
            placeholder={t("search.placeholder")}
            className="field-input pl-8"
          />
        </div>
        <button onClick={submit} className="btn-primary">
          {t("search.button")}
        </button>
      </div>

      <label className="flex w-fit items-center gap-1.5 text-[12px] text-muted">
        <input
          type="checkbox"
          checked={specOnly}
          onChange={toggleSpecOnly}
          className="h-3.5 w-3.5 accent-accent"
        />
        {t("search.specOnlyToggle")}
      </label>

      {query && (
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-muted">
            {t("search.resultsFor", { query })}
          </span>
          <span className="text-[12px] text-muted-2">
            {t("search.resultCount", { count: totalCount })}
          </span>
        </div>
      )}

      {loading ? (
        <div className="panel">
          <div className="panel-body py-12 text-center text-[13px] text-muted-2">
            {t("common.loading")}
          </div>
        </div>
      ) : query && groups.length === 0 ? (
        <div className="panel">
          <div className="panel-body py-12 text-center text-[13px] text-muted-2">
            {t("common.noResults")}
          </div>
        </div>
      ) : !query ? (
        <div className="panel">
          <div className="panel-body py-12 text-center text-[13px] text-muted-2">
            {t("common.selectPrompt")}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map((group) => (
            <div key={group.kind} className="panel">
              <div className="panel-header">
                <span className="panel-title">
                  {t(SECTION_LABEL_KEY[group.kind])}
                </span>
                <span className="text-[11px] text-muted-2">
                  {group.hits.length}
                </span>
              </div>
              <ul className="divide-y divide-border">
                {group.hits.map((hit) => (
                  <li key={`${hit.kind}-${hit.id}`}>
                    <Link
                      href={hit.href}
                      className="flex flex-col gap-0.5 px-4 py-2.5 text-[13.5px] text-foreground transition-colors hover:bg-surface-2"
                    >
                      <span className="truncate font-medium">{hit.title}</span>
                      {hit.subtitle && (
                        <span className="truncate text-[11.5px] text-muted-2">
                          {hit.subtitle}
                        </span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
