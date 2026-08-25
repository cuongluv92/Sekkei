"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useTranslation } from "@/lib/i18n";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  /**
   * Fallback route used only when there's no in-app history to go back to
   * (page opened directly via URL/bookmark). Defaults to the app root ("/").
   * Pass `null` to hide the back button entirely — for a view that's tab
   * content inside another page's own header rather than a route of its own
   * (e.g. 母線銅帯/接地線/アースバー inside 電気技術計算's category tabs, or
   * 検索 itself since "/" already redirects there).
   */
  backHref?: string | null;
}

function isEditableTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  return el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable;
}

/**
 * Shared page title block, used at the top of every route — including the
 * "← 戻る" button, so every page gets the same navigation for free rather
 * than each screen inventing its own. Behaves like an undo step (real
 * browser-history back, one step at a time), not a jump to a fixed page —
 * Ctrl+Z / Cmd+Z triggers the same action, unless focus is in a text field
 * (where Ctrl+Z should still do native text undo instead).
 */
export function PageHeader({ title, description, actions, backHref = "/" }: PageHeaderProps) {
  const { t } = useTranslation();
  const router = useRouter();

  function goBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else if (backHref) {
      router.push(backHref);
    }
  }

  useEffect(() => {
    if (backHref === null) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "z") return;
      if (isEditableTarget(e.target)) return;
      e.preventDefault();
      goBack();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backHref]);

  return (
    <div className="flex flex-col gap-2">
      {backHref !== null && (
        <button type="button" onClick={goBack} className="btn-ghost w-fit !px-2 !py-1 text-[12px]">
          <ArrowLeft className="h-3.5 w-3.5" />
          {t("common.back")}
        </button>
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
