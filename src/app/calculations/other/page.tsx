"use client";

import { useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { CalculationPageView } from "@/components/calculation/CalculationPageView";

/**
 * Registry of 他計算 modules. Adding a new "other calculation" later means
 * appending one entry here plus a matching `CalculationDefinition` in
 * `lib/mock/calculationDefinitions.ts` — no other code changes.
 */
const OTHER_CALC_MODULES = [
  { key: "busbar", labelKey: "otherCalc.modules.busbar" as const },
  { key: "earth-wire", labelKey: "otherCalc.modules.earthWire" as const },
];

export default function OtherCalculationPage() {
  const { t } = useTranslation();
  const [active, setActive] = useState(OTHER_CALC_MODULES[0].key);
  const activeModule = OTHER_CALC_MODULES.find((m) => m.key === active) ?? OTHER_CALC_MODULES[0];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-[15px] font-semibold text-foreground">{t("otherCalc.title")}</h1>
        <p className="mt-0.5 text-[12px] text-muted">{t("otherCalc.description")}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-2">
        {OTHER_CALC_MODULES.map((m) => (
          <button
            key={m.key}
            onClick={() => setActive(m.key)}
            className={
              active === m.key
                ? "rounded-sm border border-accent bg-accent/10 px-3 py-1.5 text-[12.5px] font-medium text-accent"
                : "rounded-sm border border-transparent px-3 py-1.5 text-[12.5px] text-muted hover:bg-surface-2 hover:text-foreground"
            }
          >
            {t(m.labelKey)}
          </button>
        ))}
        <span className="ml-auto text-[11px] text-muted-2">{t("otherCalc.addModuleHint")}</span>
      </div>

      <CalculationPageView
        calculationKey={activeModule.key}
        title={t(activeModule.labelKey)}
        description=""
      />
    </div>
  );
}
