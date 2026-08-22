import { Suspense } from "react";
import { BusbarCalculationView } from "@/components/calculation/busbar/BusbarCalculationView";

export default function BusbarCalculationPage() {
  return (
    <Suspense fallback={null}>
      <BusbarCalculationView />
    </Suspense>
  );
}
