"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * 母線銅帯 no longer has its own standalone page — it's a category inside
 * 電気技術計算 (see `/electrical-tools`). This route only redirects there
 * (preserving `case`/`mode`) so any existing bookmark or deep link still
 * lands somewhere useful instead of 404ing.
 */
function BusbarRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("category", "busbar");
    router.replace(`/electrical-tools?${params.toString()}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

export default function BusbarCalculationPage() {
  return (
    <Suspense fallback={null}>
      <BusbarRedirect />
    </Suspense>
  );
}
