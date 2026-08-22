"use client";

import { Check, X } from "lucide-react";
import type { ToastState } from "@/lib/hooks/useToast";

/**
 * Floating, auto-dismissing confirmation — never a modal, never blocks the
 * next search/add action. Rendered once near the root of whatever page owns
 * a `useToast()` instance (see part-assembly/page.tsx).
 */
export function Toast({ toast }: { toast: ToastState | null }) {
  if (!toast) return null;
  const isError = toast.variant === "error";
  return (
    <div className="pointer-events-none fixed bottom-6 left-1/2 z-[60] -translate-x-1/2">
      <div
        key={toast.id}
        className={
          isError
            ? "animate-toast-in flex items-center gap-2 rounded-lg border border-danger/40 bg-surface px-4 py-2.5 text-[12.5px] font-medium text-danger shadow-2xl"
            : "animate-toast-in flex items-center gap-2 rounded-lg border border-success/40 bg-surface px-4 py-2.5 text-[12.5px] font-medium text-success shadow-2xl"
        }
      >
        {isError ? (
          <X className="h-4 w-4 shrink-0" />
        ) : (
          <Check className="h-4 w-4 shrink-0" />
        )}
        <span className="text-foreground">{toast.message}</span>
      </div>
    </div>
  );
}
