"use client";

import { Ruler, Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslation } from "@/lib/i18n";

/**
 * Always-visible top search bar. This is meant to become the entry point
 * for finding any technical data (parts, drawings, catalogs, ...) — for now
 * it simply forwards the query to the 検索 page, which is the only page
 * wired up to actually search mock data. The 定格・仕様 toggle carries the
 * same `spec=1` mode 検索's own toggle uses, so a query typed here can jump
 * straight into strict 定格・仕様 technical-token matching without first
 * landing on 検索 and re-enabling it there.
 */
export function GlobalSearch() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useTranslation();
  const [value, setValue] = useState(searchParams.get("q") ?? "");
  const [specOnly, setSpecOnly] = useState(searchParams.get("spec") === "1");

  useEffect(() => {
    setValue(searchParams.get("q") ?? "");
    setSpecOnly(searchParams.get("spec") === "1");
  }, [searchParams]);

  function submit() {
    const q = value.trim();
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (specOnly) params.set("spec", "1");
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
      <button
        type="button"
        onClick={() => setSpecOnly((v) => !v)}
        title={t("search.specOnlyToggle")}
        aria-pressed={specOnly}
        className={
          specOnly
            ? "btn-secondary shrink-0 !border-accent !text-accent"
            : "btn-secondary shrink-0"
        }
      >
        <Ruler className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
