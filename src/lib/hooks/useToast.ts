"use client";

import { useCallback, useRef, useState } from "react";

export type ToastVariant = "success" | "error";

export interface ToastState {
  id: number;
  message: string;
  variant: ToastVariant;
}

/**
 * A single transient toast (not a queue/stack) for quick add/remove-style
 * feedback — e.g. "NF250-CV を部品リストに追加しました" after double-clicking a
 * 部品製作 search result. Distinct from `useMockFeedback` (a plain inline
 * text line used elsewhere in the app): this renders as a floating,
 * self-dismissing `<Toast>` so it never interrupts the search/add flow.
 */
export function useToast(timeoutMs = 1800) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idRef = useRef(0);

  const showToast = useCallback(
    (message: string, variant: ToastVariant = "success") => {
      if (timer.current) clearTimeout(timer.current);
      const id = ++idRef.current;
      setToast({ id, message, variant });
      timer.current = setTimeout(() => {
        setToast((current) => (current?.id === id ? null : current));
      }, timeoutMs);
    },
    [timeoutMs],
  );

  return { toast, showToast };
}
