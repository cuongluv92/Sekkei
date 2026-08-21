"use client";

import { Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslation } from "@/lib/i18n";

/**
 * Always-visible top search bar. This is meant to become the entry point
 * for finding any technical data (parts, drawings, catalogs, ...) — for now
 * it simply forwards the query to the 検索 page, which is the only page
 * wired up to actually search mock data.
 */
export function GlobalSearch() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useTranslation();
  const [value, setValue] = useState(searchParams.get("q") ?? "");

  useEffect(() => {
    setValue(searchParams.get("q") ?? "");
  }, [searchParams]);

  function submit() {
    const q = value.trim();
    router.push(q ? `/search?q=${encodeURIComponent(q)}` : "/search");
  }

  return (
    <div className="relative w-full max-w-xl">
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
  );
}
