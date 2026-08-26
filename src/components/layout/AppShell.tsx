"use client";

import { Menu, Moon, Sun } from "lucide-react";
import { Suspense, useState, type ReactNode } from "react";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { AppSidebar } from "./AppSidebar";
import { GlobalSearch } from "./GlobalSearch";

export function AppShell({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="flex h-full">
      <AppSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border bg-surface px-4 md:px-6">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-muted hover:text-foreground md:hidden"
            aria-label="open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Suspense fallback={<div className="h-9 w-full max-w-xl" />}>
            <GlobalSearch />
          </Suspense>
          <button
            type="button"
            onClick={toggleTheme}
            className="ml-auto flex shrink-0 items-center justify-center rounded-lg border border-border-strong bg-surface-2 p-2 text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
            title={theme === "light" ? "ダークモードに切替" : "ライトモードに切替"}
            aria-label="toggle theme"
          >
            {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </button>
        </header>
        <main className="min-w-0 flex-1 overflow-y-auto bg-background p-4 md:p-6">
          <div className="mx-auto w-full max-w-[1400px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
