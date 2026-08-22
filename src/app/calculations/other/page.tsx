"use client";

import { useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { CalculationPageView } from "@/components/calculation/CalculationPageView";
import { PageHeader } from "@/components/common/PageHeader";

/**
 * Registry of 他計算 modules still on the generic mock calculation shell.
 * 母線銅帯 graduated out of this registry into its own real module (see
 * `/calculations/busbar`) — this now only holds modules without a real,
 * standard-backed formula yet. Adding another placeholder module means
 * appending one entry here plus a matching `CalculationDefinition` in
 * `lib/mock/calculationDefinitions.ts`; a module with a real formula should
 * follow 母線銅帯/重量計算's bespoke-component pattern instead.
 */
const OTHER_CALC_MODULES = [
  { key: "earth-wire", labelKey: "otherCalc.modules.earthWire" as const },
];

export default function OtherCalculationPage() {
  const { t } = useTranslation();
  const [active, setActive] = useState(OTHER_CALC_MODULES[0].key);
  const activeModule =
    OTHER_CALC_MODULES.find((m) => m.key === active) ?? OTHER_CALC_MODULES[0];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t("otherCalc.title")}
        description={t("otherCalc.description")}
      />

      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-2">
        {OTHER_CALC_MODULES.map((m) => (
          <button
            key={m.key}
            onClick={() => setActive(m.key)}
            className={
              active === m.key
                ? "rounded-md border border-accent bg-accent/10 px-3 py-1.5 text-[12.5px] font-medium text-accent"
                : "rounded-md border border-transparent px-3 py-1.5 text-[12.5px] text-muted hover:bg-surface-2 hover:text-foreground"
            }
          >
            {t(m.labelKey)}
          </button>
        ))}
        <span className="ml-auto text-[11px] text-muted-2">
          {t("otherCalc.addModuleHint")}
        </span>
      </div>

      <CalculationPageView
        calculationKey={activeModule.key}
        title={t(activeModule.labelKey)}
        description=""
      />
    </div>
  );
}
