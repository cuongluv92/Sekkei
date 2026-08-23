"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useTranslation } from "@/lib/i18n";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
}

/**
 * Shared page title block, used at the top of every route — including the
 * "← 戻る" button, so every page gets the same browser-back-style
 * navigation for free rather than each screen inventing its own.
 * `router.back()` returns to whatever the user actually viewed previously
 * (in-app or not), same as the browser's own back button.
 */
export function PageHeader({ title, description, actions }: PageHeaderProps) {
  const router = useRouter();
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={() => router.back()}
        className="btn-ghost w-fit !px-2 !py-1 text-[12px]"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {t("common.back")}
      </button>
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
