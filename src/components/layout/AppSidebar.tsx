"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { navItems } from "@/lib/nav";
import { useTranslation } from "@/lib/i18n";

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const { t } = useTranslation();

  return (
    <>
      {open && (
        <button
          aria-label="close menu"
          onClick={onClose}
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
        />
      )}
      <aside
        className={`fixed z-40 flex h-full w-56 shrink-0 flex-col border-r border-border bg-surface
          transition-transform duration-150 md:static md:z-auto md:translate-x-0
          ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4">
          <Link href="/search" className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-xs border border-accent text-[10px] font-bold text-accent">
              S
            </span>
            <span className="text-[13px] font-semibold tracking-wide text-foreground">
              {t("app.name")}
            </span>
          </Link>
          <button onClick={onClose} className="text-muted hover:text-foreground md:hidden">
            <X className="h-4 w-4" />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto py-2">
          <ul className="flex flex-col gap-0.5 px-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onClose}
                    className={`flex items-center gap-2.5 rounded-sm px-2.5 py-2 text-[12.5px] transition-colors ${
                      active
                        ? "border-l-2 border-accent bg-surface-2 pl-[9px] font-medium text-foreground"
                        : "border-l-2 border-transparent text-muted hover:bg-surface-2 hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{t(`nav.${item.key}`)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="border-t border-border px-4 py-2.5 text-[11px] text-muted-2">
          {t("app.tagline")}
        </div>
      </aside>
    </>
  );
}
