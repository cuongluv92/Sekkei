"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * アースバー no longer has its own standalone page — it's a tab inside 他計算
 * (see `/calculations/other`). This route only redirects there (preserving
 * `case`/`mode`) so any existing bookmark or deep link still lands
 * somewhere useful instead of 404ing.
 */
function EarthBarRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("module", "earth-bar");
    router.replace(`/calculations/other?${params.toString()}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

export default function EarthBarCalculationPage() {
  return (
    <Suspense fallback={null}>
      <EarthBarRedirect />
    </Suspense>
  );
}
