"use client";

import { useTranslation } from "@/lib/i18n";
import { CalculationPageView } from "@/components/calculation/CalculationPageView";

export default function VentilationCalculationPage() {
  const { t } = useTranslation();
  return (
    <CalculationPageView
      calculationKey="ventilation"
      title={t("ventilationCalc.title")}
      description={t("ventilationCalc.description")}
    />
  );
}
