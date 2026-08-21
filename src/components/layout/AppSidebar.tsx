"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { useNavSettings, type NavEntry } from "@/lib/store/NavSettingsProvider";

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({
  entry,
  active,
  onClick,
}: {
  entry: NavEntry;
  active: boolean;
  onClick: () => void;
}) {
  const Icon = entry.Icon;
  return (
    <Link
      href={entry.href}
      onClick={onClick}
      className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-[12.5px] text-foreground transition-colors ${
        active ? "bg-accent/15 font-semibold" : "font-medium hover:bg-surface-2"
      }`}
    >
      <Icon className={`h-4 w-4 shrink-0 ${active ? "text-accent" : "text-muted"}`} />
      <span className="truncate">{entry.label}</span>
    </Link>
  );
}

export function AppSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const { t } = useTranslation();
  const { visibleEntries } = useNavSettings();
  const settingsEntry = visibleEntries.find((e) => e.id === "settings");
  const mainEntries = visibleEntries.filter((e) => e.id !== "settings");

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
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
          <Link href="/search" className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-[12px] font-extrabold text-accent-foreground shadow-[0_1px_4px_rgba(79,143,240,0.4)]">
              O
            </span>
            <span className="flex items-baseline gap-1">
              <span className="text-[16px] font-extrabold tracking-tight text-accent">OKU</span>
              <span className="text-[11px] font-semibold tracking-tight text-foreground">pro</span>
            </span>
          </Link>
          <button onClick={onClose} className="text-muted hover:text-foreground md:hidden">
            <X className="h-4 w-4" />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-3">
          <ul className="flex flex-col gap-0.5">
            {mainEntries.map((entry) => (
              <li key={entry.id}>
                <NavLink
                  entry={entry}
                  active={isActive(pathname, entry.href)}
                  onClick={onClose}
                />
              </li>
            ))}
          </ul>
        </nav>
        {settingsEntry && (
          <div className="border-t border-border px-3 py-3">
            <NavLink
              entry={settingsEntry}
              active={isActive(pathname, settingsEntry.href)}
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
