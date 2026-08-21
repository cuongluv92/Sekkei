import { Suspense } from "react";
import { DesignSearchView } from "./DesignSearchView";

export default function DesignSearchPage() {
  return (
    <Suspense fallback={null}>
      <DesignSearchView />
    </Suspense>
  );
}
