"use client";

import { Menu } from "lucide-react";
import { Suspense, useState, type ReactNode } from "react";
import { AppSidebar } from "./AppSidebar";
import { GlobalSearch } from "./GlobalSearch";

export function AppShell({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-full">
      <AppSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-surface px-4 md:px-6">
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
        </header>
        <main className="min-w-0 flex-1 overflow-y-auto bg-background p-4 md:p-6">
          <div className="mx-auto w-full max-w-[1400px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
