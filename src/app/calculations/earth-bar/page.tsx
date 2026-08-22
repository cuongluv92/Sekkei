import { Suspense } from "react";
import { EarthBarCalculationView } from "@/components/calculation/earthBar/EarthBarCalculationView";

export default function EarthBarCalculationPage() {
  return (
    <Suspense fallback={null}>
      <EarthBarCalculationView />
    </Suspense>
  );
}
