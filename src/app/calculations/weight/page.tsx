import { Suspense } from "react";
import { WeightCalculationView } from "./WeightCalculationView";

export default function WeightCalculationPage() {
  return (
    <Suspense fallback={null}>
      <WeightCalculationView />
    </Suspense>
  );
}
