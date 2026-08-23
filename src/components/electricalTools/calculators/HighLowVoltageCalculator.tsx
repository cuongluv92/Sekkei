"use client";

import { useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { solveAcPower, type AcPhase, type AcPowerVar } from "@/lib/calc/electrical/ohmsLaw";
import {
  classifyVoltage,
  isHighVoltageReceivingContext,
  JEAC8011_HIGH_VOLTAGE_RECEIVING_SOURCE,
  JIS_C4620_CUBICLE_SOURCE,
  VOLTAGE_CLASS_LABEL_JA,
  VOLTAGE_CLASS_SOURCE,
  type CurrentType,
} from "@/lib/calc/electrical/highLowVoltage";
import type { CalcVariableDef, SolveResult } from "@/lib/calc/electrical/types";
import { VariableSolverCard } from "@/components/electricalTools/VariableSolverCard";
import { ElectricalBasisPanel } from "@/components/electricalTools/ElectricalBasisPanel";
import { PillToggle } from "@/components/electricalTools/PillToggle";

const POWER_VARS: CalcVariableDef<AcPowerVar>[] = [
  { key: "V", labelJa: "電圧（線間）", labelVi: "Điện áp (dây)", symbol: "V", unit: "V" },
  { key: "I", labelJa: "電流", labelVi: "Dòng điện", symbol: "I", unit: "A" },
  { key: "S", labelJa: "皮相電力", labelVi: "Công suất biểu kiến", symbol: "S", unit: "kVA" },
  { key: "P", labelJa: "有効電力", labelVi: "Công suất hữu công", symbol: "P", unit: "kW" },
  { key: "Q", labelJa: "無効電力", labelVi: "Công suất vô công", symbol: "Q", unit: "kvar" },
  { key: "pf", labelJa: "力率", labelVi: "Hệ số công suất", symbol: "cosφ", unit: "" },
];

type SubTool = "classify" | "power";

export function HighLowVoltageCalculator() {
  const { t, locale } = useTranslation();
  const [subTool, setSubTool] = useState<SubTool>("power");
  const [phase, setPhase] = useState<AcPhase>("three");
  const [currentType, setCurrentType] = useState<CurrentType>("AC");
  const [classifyInput, setClassifyInput] = useState("6600");
  const [result, setResult] = useState<SolveResult | null>(null);

  const voltageClass = classifyVoltage(Number(classifyInput), currentType);
  const cubicleContext = isHighVoltageReceivingContext(Number(classifyInput));

  return (
    <div className="calc-layout">
      <div className="calc-layout-input panel">
        <div className="panel-body flex flex-col gap-4">
          <PillToggle
            label={locale === "vi" ? "Công cụ" : "ツール"}
            value={subTool}
            onChange={setSubTool}
            options={[
              { value: "power", label: locale === "vi" ? "kVA/A/V" : "容量・電流・電圧" },
              { value: "classify", label: locale === "vi" ? "Phân loại điện áp" : "電圧区分判定" },
            ]}
          />

          {subTool === "power" && (
            <VariableSolverCard
              variables={POWER_VARS}
              solve={(known, target) => solveAcPower(known, target, phase)}
              onResult={setResult}
              resetKey={`power-${phase}`}
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

          {subTool === "classify" && (
            <div className="flex flex-col gap-3">
              <PillToggle
                label={locale === "vi" ? "Loại dòng điện" : "電流種別"}
                value={currentType}
                onChange={setCurrentType}
                options={[
                  { value: "AC", label: "AC" },
                  { value: "DC", label: "DC" },
                ]}
              />
              <div className="max-w-[200px]">
                <label className="field-label">{locale === "vi" ? "Điện áp" : "電圧"}</label>
                <div className="relative">
                  <input
                    type="number"
                    value={classifyInput}
                    onChange={(e) => setClassifyInput(e.target.value)}
                    className="field-input pr-10"
                  />
                  <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[12.5px] font-semibold text-muted-2">
                    V
                  </span>
                </div>
              </div>
              {voltageClass && (
                <div className="rounded-lg border border-accent/40 bg-accent/10 px-4 py-3.5">
                  <div className="text-[11px] font-semibold tracking-wide text-muted uppercase">
                    {locale === "vi" ? "Phân loại" : "電圧区分"}
                  </div>
                  <div className="mt-1 text-[30px] font-extrabold tracking-tight text-foreground">
                    {VOLTAGE_CLASS_LABEL_JA[voltageClass]}
                  </div>
                </div>
              )}
              {cubicleContext && (
                <div className="rounded-lg border border-border-strong bg-surface-2 px-3 py-2.5 text-[11.5px] text-muted">
                  <p className="mb-1 font-bold text-foreground">
                    {locale === "vi" ? "6.6kV — tiêu chuẩn thiết bị nhận điện cao áp (tham khảo)" : "6.6kV級 — 高圧受電設備の適用規格（参考）"}
                  </p>
                  <p>
                    {JEAC8011_HIGH_VOLTAGE_RECEIVING_SOURCE.standard}:
                    {JEAC8011_HIGH_VOLTAGE_RECEIVING_SOURCE.edition} — {JEAC8011_HIGH_VOLTAGE_RECEIVING_SOURCE.reference}
                  </p>
                  <p>
                    {JIS_C4620_CUBICLE_SOURCE.standard}:{JIS_C4620_CUBICLE_SOURCE.edition} —{" "}
                    {JIS_C4620_CUBICLE_SOURCE.reference}
                  </p>
                  <p className="mt-1.5 border-t border-border pt-1.5 text-warning">
                    {JEAC8011_HIGH_VOLTAGE_RECEIVING_SOURCE.verificationNote}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="calc-layout-basis panel">
        <div className="panel-header">
          <span className="panel-title">{t("electricalTools.basisSectionTitle")}</span>
        </div>
        <div className="panel-body">
          {subTool === "classify" ? (
            <div className="rounded-lg border border-border-strong bg-surface px-3 py-2.5 text-[11.5px]">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold text-foreground">
                  {VOLTAGE_CLASS_SOURCE.standard}
                </span>
                <span className={VOLTAGE_CLASS_SOURCE.verified ? "badge-success" : "badge-warning"}>
                  {VOLTAGE_CLASS_SOURCE.verified
                    ? t("electricalTools.basis.verifiedBadge")
                    : t("electricalTools.basis.unverifiedBadge")}
                </span>
              </div>
              <div className="mt-1.5 grid grid-cols-1 gap-1 text-muted sm:grid-cols-[100px_1fr]">
                <span className="text-muted-2">{t("electricalTools.basis.referenceLabel")}</span>
                <span>{VOLTAGE_CLASS_SOURCE.reference}</span>
                <span className="text-muted-2">{t("electricalTools.basis.applicabilityLabel")}</span>
                <span>{VOLTAGE_CLASS_SOURCE.applicability}</span>
              </div>
              <p className="mt-1.5 border-t border-border pt-1.5 text-[11px] text-warning">
                {VOLTAGE_CLASS_SOURCE.verificationNote}
              </p>
            </div>
          ) : (
            <ElectricalBasisPanel result={result} />
          )}
        </div>
      </div>
    </div>
  );
}
