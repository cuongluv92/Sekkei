"use client";

import { useTranslation } from "@/lib/i18n";
import { CalculationPageView } from "@/components/calculation/CalculationPageView";

export default function SeismicCalculationPage() {
  const { t } = useTranslation();
  return (
    <CalculationPageView
      calculationKey="seismic"
      title={t("seismicCalc.title")}
      description={t("seismicCalc.description")}
    />
  );
}
