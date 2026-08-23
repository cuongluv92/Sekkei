"use client";

import { Ruler, Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslation } from "@/lib/i18n";

/**
 * Always-visible top search bar. This is meant to become the entry point
 * for finding any technical data (parts, drawings, catalogs, ...) — for now
 * it simply forwards both fields to the 検索 page, which is the only page
 * wired up to actually search mock data. The dedicated 定格・仕様 field is a
 * separate box (not a toggle over the same text) so a keyword typed here and
 * an exact spec typed in the second box narrow results together — typing
 * only a partial 型番 in the main box alone tends to return too many hits.
 */
export function GlobalSearch() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useTranslation();
  const [value, setValue] = useState(searchParams.get("q") ?? "");
  const [specValue, setSpecValue] = useState(searchParams.get("spec") ?? "");

  useEffect(() => {
    setValue(searchParams.get("q") ?? "");
    setSpecValue(searchParams.get("spec") ?? "");
  }, [searchParams]);

  function submit() {
    const q = value.trim();
    const spec = specValue.trim();
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (spec) params.set("spec", spec);
    const qs = params.toString();
    router.push(qs ? `/search?${qs}` : "/search");
  }

  return (
    <div className="flex w-full max-w-xl items-center gap-1.5">
      <div className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-2" />
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          placeholder={t("common.globalSearchPlaceholder")}
          className="field-input pl-8"
          type="search"
        />
      </div>
      <div className="relative w-28 shrink-0 sm:w-40">
        <Ruler className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-2" />
        <input
          value={specValue}
          onChange={(e) => setSpecValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          placeholder={t("common.specification")}
          title={t("search.specFieldHint")}
          className="field-input pl-8"
          type="search"
        />
      </div>
    </div>
  );
}
