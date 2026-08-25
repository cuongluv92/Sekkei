import { Suspense } from "react";
import { VentilationCalculationView } from "@/components/calculation/ventilation/VentilationCalculationView";

export default function VentilationCalculationPage() {
  return (
    <Suspense fallback={null}>
      <VentilationCalculationView />
    </Suspense>
  );
}
