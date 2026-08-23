"use client";

import { useCallback, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import {
  solveThreePhaseConnection,
  type ThreePhaseConnection,
  type ThreePhaseVar,
} from "@/lib/calc/electrical/threePhase";
import type { CalcVariableDef, SolveResult } from "@/lib/calc/electrical/types";
import { VariableSolverCard } from "@/components/electricalTools/VariableSolverCard";
import { ElectricalBasisPanel } from "@/components/electricalTools/ElectricalBasisPanel";
import { PillToggle } from "@/components/electricalTools/PillToggle";

const VOLTAGE_VARS: CalcVariableDef<ThreePhaseVar>[] = [
  { key: "phaseVoltage", labelJa: "相電圧", labelVi: "Điện áp pha", symbol: "Vp", unit: "V" },
  { key: "lineVoltage", labelJa: "線間電圧", labelVi: "Điện áp dây", symbol: "Vl", unit: "V" },
];
const CURRENT_VARS: CalcVariableDef<ThreePhaseVar>[] = [
  { key: "phaseCurrent", labelJa: "相電流", labelVi: "Dòng điện pha", symbol: "Ip", unit: "A" },
  { key: "lineCurrent", labelJa: "線電流", labelVi: "Dòng điện dây", symbol: "Il", unit: "A" },
];

type Quantity = "voltage" | "current";

export function ThreePhaseCalculator() {
  const { t, locale } = useTranslation();
  const [connection, setConnection] = useState<ThreePhaseConnection>("Y");
  const [quantity, setQuantity] = useState<Quantity>("voltage");
  const [result, setResult] = useState<SolveResult | null>(null);

  // Stabilized so VariableSolverCard's result-effect never sees a "new"
  // solve function on every render — an inline arrow here would loop
  // forever (setResult → re-render → new arrow → recompute → setResult…).
  const solveConnection = useCallback(
    (known: Partial<Record<ThreePhaseVar, number>>, target: ThreePhaseVar) =>
      solveThreePhaseConnection(known, target, connection),
    [connection],
  );

  return (
    <div className="calc-layout">
      <div className="calc-layout-input panel">
        <div className="panel-body flex flex-col gap-4">
          <PillToggle
            label={locale === "vi" ? "Đại lượng" : "対象"}
            value={quantity}
            onChange={setQuantity}
            options={[
              { value: "voltage", label: locale === "vi" ? "Điện áp" : "電圧" },
              { value: "current", label: locale === "vi" ? "Dòng điện" : "電流" },
            ]}
          />
          <VariableSolverCard
            variables={quantity === "voltage" ? VOLTAGE_VARS : CURRENT_VARS}
            solve={solveConnection}
            onResult={setResult}
            resetKey={`${connection}-${quantity}`}
            extra={
              <PillToggle
                label={locale === "vi" ? "Kiểu đấu nối" : "結線"}
                value={connection}
                onChange={setConnection}
                options={[
                  { value: "Y", label: "Y結線（スター）" },
                  { value: "Delta", label: "Δ結線（デルタ）" },
                ]}
              />
            }
          />
        </div>
      </div>

      <div className="calc-layout-basis panel">
        <div className="panel-header">
          <span className="panel-title">{t("electricalTools.basisSectionTitle")}</span>
        </div>
        <div className="panel-body">
          <ElectricalBasisPanel
            result={result}
            variables={quantity === "voltage" ? VOLTAGE_VARS : CURRENT_VARS}
          />
        </div>
      </div>
    </div>
  );
}
