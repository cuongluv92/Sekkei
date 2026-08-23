"use client";

import { useTranslation } from "@/lib/i18n";
import type { ElectricalToolCategory } from "./registry";

interface CategoryNavProps {
  categories: ElectricalToolCategory[];
  activeId: string;
  onSelect: (id: string) => void;
}

/**
 * Small category navigation for 電気技術計算 — a horizontal scrollable pill
 * row on narrow screens (same pattern as DesignTabBar/他計算's tab strip),
 * a slim vertical list from the lg breakpoint up (Bên trái... category
 * navigation nhỏ per spec).
 */
export function CategoryNav({ categories, activeId, onSelect }: CategoryNavProps) {
  const { locale } = useTranslation();

  return (
    <nav className="lg:w-48 lg:shrink-0">
      <div className="-mx-1 flex gap-1 overflow-x-auto px-1 lg:mx-0 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:px-0">
        {categories.map((c) => {
          const active = c.id === activeId;
          const label = locale === "vi" ? c.titleVi : c.titleJa;
          return (
            <button
              key={c.id}
              onClick={() => onSelect(c.id)}
              className={
                active
                  ? "shrink-0 rounded-lg bg-accent/15 px-3 py-2 text-left text-[13px] font-bold whitespace-nowrap text-accent lg:whitespace-normal"
                  : "shrink-0 rounded-lg px-3 py-2 text-left text-[13px] font-semibold whitespace-nowrap text-muted hover:bg-surface-2 hover:text-foreground lg:whitespace-normal"
              }
            >
              {label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
