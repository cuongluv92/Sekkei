"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * 母線銅帯 no longer has its own standalone page — it's a category inside
 * 電気技術計算 (see `/electrical-tools`), and no longer 案件-scoped (a
 * stateless calculator like V/I/A/U, so there's nothing left to deep-link
 * into). This route only redirects there so any existing bookmark still
 * lands somewhere useful instead of 404ing.
 */
export default function BusbarCalculationPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/electrical-tools?category=busbar");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
