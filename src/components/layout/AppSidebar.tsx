"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { navItems, type NavItem } from "@/lib/nav";
import { useTranslation } from "@/lib/i18n";

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({
  item,
  label,
  active,
  onClick,
}: {
  item: NavItem;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={`flex items-center gap-2.5 rounded-lg px-3.5 py-2.5 text-[15px] text-foreground transition-colors ${
        active ? "bg-accent/15 font-semibold" : "font-medium hover:bg-surface-2"
      }`}
    >
      <Icon className={`h-[18px] w-[18px] shrink-0 ${active ? "text-accent" : "text-muted"}`} />
      <span className="truncate">{label}</span>
    </Link>
  );
}

export function AppSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const { t } = useTranslation();
  const settingsItem = navItems.find((i) => i.key === "settings");
  const mainItems = navItems.filter((i) => i.key !== "settings");

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
        <div className="flex h-20 shrink-0 items-center justify-between border-b border-border px-4">
          <Link href="/search" className="flex items-center gap-3">
            <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-accent text-[24px] font-extrabold text-accent-foreground shadow-[0_1px_4px_rgba(79,143,240,0.4)]">
              O
            </span>
            <span className="flex items-baseline gap-1.5">
              <span className="text-[32px] font-extrabold tracking-tight text-accent">OKU</span>
              <span className="text-[22px] font-semibold tracking-tight text-foreground">pro</span>
            </span>
          </Link>
          <button onClick={onClose} className="text-muted hover:text-foreground md:hidden">
            <X className="h-4 w-4" />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-3">
          <ul className="flex flex-col gap-0.5">
            {mainItems.map((item) => (
              <li key={item.key}>
                <NavLink
                  item={item}
                  label={t(`nav.${item.key}`)}
                  active={isActive(pathname, item.href)}
                  onClick={onClose}
                />
              </li>
            ))}
          </ul>
        </nav>
        {settingsItem && (
          <div className="border-t border-border px-3 py-3">
            <NavLink
              item={settingsItem}
              label={t(`nav.${settingsItem.key}`)}
              active={isActive(pathname, settingsItem.href)}
              onClick={onClose}
            />
          </div>
        )}
        <div className="border-t border-border px-4 py-3 text-[11px] text-muted-2">
          {t("app.tagline")}
        </div>
      </aside>
    </>
  );
}
