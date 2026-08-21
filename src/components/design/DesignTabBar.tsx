"use client";

import { useTranslation } from "@/lib/i18n";

export const DESIGN_TOP_TABS = [
  "designRequest",
  "productionRequest",
  "drawingRegister",
  "designIndexKeio",
  "designIndexOther",
  "schedule",
  "costLabor",
] as const;

export type DesignTopTab = (typeof DESIGN_TOP_TABS)[number];

export function isDesignTopTab(value: string | null): value is DesignTopTab {
  return !!value && (DESIGN_TOP_TABS as readonly string[]).includes(value);
}

/**
 * The single row of tabs shown as soon as 設計管理 opens — no numbering, no
 * card chrome, just a compact strip that scrolls horizontally on narrow
 * screens instead of wrapping or shrinking labels.
 */
export function DesignTabBar({
  active,
  onChange,
}: {
  active: DesignTopTab;
  onChange: (tab: DesignTopTab) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <div className="flex w-max min-w-full gap-1 border-b border-border pb-0">
        {DESIGN_TOP_TABS.map((key) => {
          const isActive = key === active;
          return (
            <button
              key={key}
              onClick={() => onChange(key)}
              className={
                isActive
                  ? "shrink-0 whitespace-nowrap border-b-2 border-accent px-3.5 py-2.5 text-[14px] font-bold text-accent"
                  : "shrink-0 whitespace-nowrap border-b-2 border-transparent px-3.5 py-2.5 text-[14px] font-semibold text-muted hover:text-foreground"
              }
            >
              {t(`design.topTabs.${key}`)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
