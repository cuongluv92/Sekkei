import { Suspense } from "react";
import { DesignView } from "./DesignView";

export default function DesignPage() {
  return (
    <Suspense fallback={null}>
      <DesignView />
    </Suspense>
  );
}
