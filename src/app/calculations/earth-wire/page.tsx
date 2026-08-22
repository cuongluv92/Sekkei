import { Suspense } from "react";
import { EarthWireCalculationView } from "@/components/calculation/earthWire/EarthWireCalculationView";

export default function EarthWireCalculationPage() {
  return (
    <Suspense fallback={null}>
      <EarthWireCalculationView />
    </Suspense>
  );
}
