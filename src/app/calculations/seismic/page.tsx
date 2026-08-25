import { Suspense } from "react";
import { SeismicCalculationView } from "@/components/calculation/seismic/SeismicCalculationView";

export default function SeismicCalculationPage() {
  return (
    <Suspense fallback={null}>
      <SeismicCalculationView />
    </Suspense>
  );
}
