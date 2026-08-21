"use client";

import { useTranslation } from "@/lib/i18n";
import { CalculationPageView } from "@/components/calculation/CalculationPageView";

export default function WeightCalculationPage() {
  const { t } = useTranslation();
  return (
    <CalculationPageView
      calculationKey="weight"
      title={t("weightCalc.title")}
      description={t("weightCalc.description")}
    />
  );
}
