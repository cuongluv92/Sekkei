"use client";

import { useCallback, useRef, useState } from "react";

/**
 * Small helper for showing a transient inline message after a mock action
 * (export button, DWG/PDF download, import confirm, ...). Centralizes the
 * "show for a few seconds then clear" behavior instead of repeating a
 * useState+setTimeout pair on every page.
 */
export function useMockFeedback(timeoutMs = 2500) {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(
    (msg: string) => {
      if (timer.current) clearTimeout(timer.current);
      setMessage(msg);
      timer.current = setTimeout(() => setMessage(null), timeoutMs);
    },
    [timeoutMs],
  );

  return { message, show };
}
