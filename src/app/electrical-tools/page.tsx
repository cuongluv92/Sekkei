"use client";

import { Suspense } from "react";
import { ElectricalToolsView } from "@/components/electricalTools/ElectricalToolsView";

export default function ElectricalToolsPage() {
  return (
    <Suspense fallback={null}>
      <ElectricalToolsView />
    </Suspense>
  );
}
