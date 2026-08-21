"use client";

import { Search as SearchIcon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { searchService, exportService } from "@/lib/services";
import { SearchResultList } from "@/components/common/SearchResultList";
import { FilePreview } from "@/components/common/FilePreview";
import { PageHeader } from "@/components/common/PageHeader";
import { useMockFeedback } from "@/lib/hooks/useMockFeedback";
import type { FileAsset, SearchResultItem } from "@/lib/types";

export function SearchView() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") ?? "";

  const [inputValue, setInputValue] = useState(initialQuery);
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<SearchResultItem | null>(null);
  const { message, show } = useMockFeedback();

  useEffect(() => {
    setInputValue(initialQuery);
    setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    if (!query) {
      setResults([]);
      setSelected(null);
      return;
    }
    let active = true;
    setLoading(true);
    searchService.search(query).then((res) => {
      if (!active) return;
      setResults(res);
      setSelected(null);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [query]);

  function submit() {
    const q = inputValue.trim();
    setQuery(q);
    router.replace(q ? `/search?q=${encodeURIComponent(q)}` : "/search");
  }

  async function handleDownload(item: SearchResultItem, kind: FileAsset["kind"]) {
    const { fileName } = await exportService.export(kind, item.model);
    show(`${fileName} をダウンロードしました（モック・元ファイルは未接続）`);
  }

  const selectedKey = selected ? `${selected.source}-${selected.id}` : null;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t("search.title")} description={t("search.description")} />

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

      {query && (
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-muted">{t("search.resultsFor", { query })}</span>
          <span className="text-[12px] text-muted-2">
            {t("search.resultCount", { count: results.length })}
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="panel overflow-hidden">
          <SearchResultList
            results={results}
            loading={loading}
            selectedKey={selectedKey}
            onSelect={setSelected}
            onDownload={handleDownload}
            emptyMessage={query ? t("common.noResults") : t("common.selectPrompt")}
          />
        </div>
        <FilePreview
          selectedKey={selectedKey}
          title={selected?.model}
          files={selected?.files ?? []}
          onDownload={(kind) => selected && handleDownload(selected, kind)}
        />
      </div>

      {message && <div className="text-[12px] text-success">{message}</div>}
    </div>
  );
}
