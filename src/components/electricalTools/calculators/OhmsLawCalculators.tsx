"use client";

import { useState } from "react";
import { useTranslation } from "@/lib/i18n";
import {
  solveAcPower,
  solveDcCircuit,
  solveEfficiency,
  type AcPhase,
  type AcPowerVar,
  type DcVar,
  type EfficiencyVar,
} from "@/lib/calc/electrical/ohmsLaw";
import type { CalcVariableDef, SolveResult } from "@/lib/calc/electrical/types";
import { VariableSolverCard } from "@/components/electricalTools/VariableSolverCard";
import { ElectricalBasisPanel } from "@/components/electricalTools/ElectricalBasisPanel";
import { PillToggle } from "@/components/electricalTools/PillToggle";

const DC_VARS: CalcVariableDef<DcVar>[] = [
  { key: "V", labelJa: "電圧", labelVi: "Điện áp", symbol: "V", unit: "V" },
  { key: "I", labelJa: "電流", labelVi: "Dòng điện", symbol: "I", unit: "A" },
  { key: "R", labelJa: "抵抗", labelVi: "Điện trở", symbol: "R", unit: "Ω" },
  { key: "P", labelJa: "電力", labelVi: "Công suất", symbol: "P", unit: "W" },
];

const AC_VARS: CalcVariableDef<AcPowerVar>[] = [
  { key: "V", labelJa: "電圧（線間）", labelVi: "Điện áp (dây)", symbol: "V", unit: "V" },
  { key: "I", labelJa: "電流", labelVi: "Dòng điện", symbol: "I", unit: "A" },
  { key: "S", labelJa: "皮相電力", labelVi: "Công suất biểu kiến", symbol: "S", unit: "kVA" },
  { key: "P", labelJa: "有効電力", labelVi: "Công suất hữu công", symbol: "P", unit: "kW" },
  { key: "Q", labelJa: "無効電力", labelVi: "Công suất vô công", symbol: "Q", unit: "kvar" },
  { key: "pf", labelJa: "力率", labelVi: "Hệ số công suất", symbol: "cosφ", unit: "" },
];

const EFFICIENCY_VARS: CalcVariableDef<EfficiencyVar>[] = [
  { key: "inputKw", labelJa: "入力電力", labelVi: "Công suất đầu vào", symbol: "Pin", unit: "kW" },
  { key: "outputKw", labelJa: "出力電力", labelVi: "Công suất đầu ra", symbol: "Pout", unit: "kW" },
  { key: "eta", labelJa: "効率", labelVi: "Hiệu suất", symbol: "η", unit: "" },
];

type SubTool = "dc" | "ac" | "efficiency";

export function OhmsLawCalculators() {
  const { t, locale } = useTranslation();
  const [subTool, setSubTool] = useState<SubTool>("ac");
  const [phase, setPhase] = useState<AcPhase>("three");
  const [result, setResult] = useState<SolveResult | null>(null);

  return (
    <div className="calc-layout">
      <div className="calc-layout-input panel">
        <div className="panel-body flex flex-col gap-4">
          <PillToggle
            label={locale === "vi" ? "Công cụ" : "ツール"}
            value={subTool}
            onChange={(v) => setSubTool(v)}
            options={[
              { value: "dc", label: locale === "vi" ? "DC (Ohm)" : "直流（オームの法則）" },
              { value: "ac", label: locale === "vi" ? "AC 1φ/3φ" : "交流（単相/三相）" },
              { value: "efficiency", label: locale === "vi" ? "Hiệu suất η" : "効率η" },
            ]}
          />

          {subTool === "dc" && (
            <VariableSolverCard
              variables={DC_VARS}
              solve={solveDcCircuit}
              onResult={setResult}
              resetKey={subTool}
            />
          )}

          {subTool === "ac" && (
            <VariableSolverCard
              variables={AC_VARS}
              solve={(known, target) => solveAcPower(known, target, phase)}
              onResult={setResult}
              resetKey={`ac-${phase}`}
              extra={
                <PillToggle
                  label={locale === "vi" ? "Pha" : "相"}
                  value={phase}
                  onChange={setPhase}
                  options={[
                    { value: "single", label: locale === "vi" ? "1 pha" : "単相" },
                    { value: "three", label: locale === "vi" ? "3 pha" : "三相" },
                  ]}
                />
              }
            />
          )}

          {subTool === "efficiency" && (
            <VariableSolverCard
              variables={EFFICIENCY_VARS}
              solve={solveEfficiency}
              onResult={setResult}
              resetKey={subTool}
            />
          )}
        </div>
      </div>

      <div className="calc-layout-basis panel">
        <div className="panel-header">
          <span className="panel-title">{t("electricalTools.basisSectionTitle")}</span>
        </div>
        <div className="panel-body">
          <ElectricalBasisPanel result={result} />
        </div>
      </div>
    </div>
  );
}
