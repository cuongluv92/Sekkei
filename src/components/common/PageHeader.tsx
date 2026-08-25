"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { useTranslation } from "@/lib/i18n";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  /**
   * Where "← 戻る" goes. Defaults to the app root ("/") — right for every
   * top-level sidebar page. Pass an explicit route for a page whose logical
   * parent isn't the root (e.g. "/design" for 設計管理検索, only ever reached
   * via a button inside 設計管理). Pass `null` to hide the back button
   * entirely — for a view that's tab content inside another page's own
   * header rather than a route of its own (e.g. 母線銅帯/接地線/アースバー
   * inside 電気技術計算's category tabs, or 検索 itself since "/" already
   * redirects there — "back" from home has nowhere useful to go).
   */
  backHref?: string | null;
}

/**
 * Shared page title block, used at the top of every route — including the
 * "← 戻る" button, so every page gets the same navigation for free rather
 * than each screen inventing its own. Always a fixed route (not browser
 * history/`router.back()`): history-based back could land on whatever page
 * the user happened to glance at last (e.g. a sidebar item merely hovered
 * into), which reads as random rather than "back to where this page lives".
 */
export function PageHeader({ title, description, actions, backHref = "/" }: PageHeaderProps) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-2">
      {backHref !== null && (
        <Link href={backHref} className="btn-ghost w-fit !px-2 !py-1 text-[12px]">
          <ArrowLeft className="h-3.5 w-3.5" />
          {t("common.back")}
        </Link>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-extrabold tracking-tight text-foreground">{title}</h1>
          {description && <p className="mt-1 text-[14px] text-muted">{description}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
