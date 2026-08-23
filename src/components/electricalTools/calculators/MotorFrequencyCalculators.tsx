"use client";

import { useState } from "react";
import { useTranslation } from "@/lib/i18n";
import {
  compareSyncSpeed,
  solveMotorPower,
  solveSlip,
  solveSyncSpeed,
  type MotorPhase,
  type MotorPowerVar,
  type SlipVar,
  type SyncSpeedVar,
} from "@/lib/calc/electrical/motorFrequency";
import type { CalcVariableDef, SolveResult } from "@/lib/calc/electrical/types";
import { VariableSolverCard } from "@/components/electricalTools/VariableSolverCard";
import { ElectricalBasisPanel } from "@/components/electricalTools/ElectricalBasisPanel";
import { PillToggle } from "@/components/electricalTools/PillToggle";

const SYNC_VARS: CalcVariableDef<SyncSpeedVar>[] = [
  { key: "frequencyHz", labelJa: "周波数", labelVi: "Tần số", symbol: "f", unit: "Hz" },
  { key: "poles", labelJa: "極数", labelVi: "Số cực", symbol: "p", unit: "" },
  { key: "nsRpm", labelJa: "同期速度", labelVi: "Tốc độ đồng bộ", symbol: "ns", unit: "min⁻¹" },
];
const SLIP_VARS: CalcVariableDef<SlipVar>[] = [
  { key: "nsRpm", labelJa: "同期速度", labelVi: "Tốc độ đồng bộ", symbol: "ns", unit: "min⁻¹" },
  { key: "actualRpm", labelJa: "実回転数", labelVi: "Tốc độ thực", symbol: "nr", unit: "min⁻¹" },
  { key: "slip", labelJa: "すべり率", labelVi: "Hệ số trượt", symbol: "s", unit: "" },
];
const MOTOR_POWER_VARS: CalcVariableDef<MotorPowerVar>[] = [
  { key: "voltage", labelJa: "電圧", labelVi: "Điện áp", symbol: "V", unit: "V" },
  { key: "current", labelJa: "電流", labelVi: "Dòng điện", symbol: "I", unit: "A" },
  { key: "pf", labelJa: "力率", labelVi: "Hệ số công suất", symbol: "cosφ", unit: "" },
  { key: "eta", labelJa: "効率", labelVi: "Hiệu suất", symbol: "η", unit: "" },
  { key: "inputKw", labelJa: "入力電力", labelVi: "Công suất vào", symbol: "Pin", unit: "kW" },
  { key: "outputKw", labelJa: "出力（軸）電力", labelVi: "Công suất ra", symbol: "Pout", unit: "kW" },
];

type SubTool = "sync" | "slip" | "power" | "compare";

export function MotorFrequencyCalculators() {
  const { t, locale } = useTranslation();
  const [subTool, setSubTool] = useState<SubTool>("power");
  const [phase, setPhase] = useState<MotorPhase>("three");
  const [result, setResult] = useState<SolveResult | null>(null);
  const [comparePoles, setComparePoles] = useState("4");

  const comparison = compareSyncSpeed(Number(comparePoles));

  return (
    <div className="calc-layout">
      <div className="calc-layout-input panel">
        <div className="panel-body flex flex-col gap-4">
          <PillToggle
            label={locale === "vi" ? "Công cụ" : "ツール"}
            value={subTool}
            onChange={setSubTool}
            options={[
              { value: "sync", label: locale === "vi" ? "Tốc độ đồng bộ" : "同期速度" },
              { value: "slip", label: locale === "vi" ? "Hệ số trượt" : "すべり率" },
              { value: "power", label: locale === "vi" ? "Dòng/Công suất" : "電流・出力" },
              { value: "compare", label: "50Hz/60Hz" },
            ]}
          />

          {subTool === "sync" && (
            <VariableSolverCard
              variables={SYNC_VARS}
              solve={solveSyncSpeed}
              onResult={setResult}
              resetKey={subTool}
              defaultTarget="nsRpm"
            />
          )}
          {subTool === "slip" && (
            <VariableSolverCard
              variables={SLIP_VARS}
              solve={solveSlip}
              onResult={setResult}
              resetKey={subTool}
              defaultTarget="slip"
            />
          )}
          {subTool === "power" && (
            <VariableSolverCard
              variables={MOTOR_POWER_VARS}
              solve={(known, target) => solveMotorPower(known, target, phase)}
              onResult={setResult}
              resetKey={`power-${phase}`}
              defaultTarget="current"
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
          {subTool === "compare" && (
            <div className="flex flex-col gap-3">
              <div className="max-w-[160px]">
                <label className="field-label">{locale === "vi" ? "Số cực" : "極数"}</label>
                <input
                  type="number"
                  value={comparePoles}
                  onChange={(e) => setComparePoles(e.target.value)}
                  className="field-input"
                />
              </div>
              {comparison && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-border-strong bg-surface-2 px-4 py-3.5">
                    <div className="text-[11px] font-semibold text-muted uppercase">50Hz ns</div>
                    <div className="mt-1 text-[26px] font-extrabold text-foreground">
                      {comparison.ns50}
                      <span className="ml-1 text-[14px] font-semibold text-muted">min⁻¹</span>
                    </div>
                  </div>
                  <div className="rounded-lg border border-border-strong bg-surface-2 px-4 py-3.5">
                    <div className="text-[11px] font-semibold text-muted uppercase">60Hz ns</div>
                    <div className="mt-1 text-[26px] font-extrabold text-foreground">
                      {comparison.ns60}
                      <span className="ml-1 text-[14px] font-semibold text-muted">min⁻¹</span>
                    </div>
                  </div>
                </div>
              )}
              {comparison && (
                <div className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2.5">
                  <p className="text-[12px] text-warning">{comparison.note}</p>
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
          {subTool === "compare" ? (
            <p className="text-[12.5px] text-muted-2">
              {locale === "vi"
                ? "So sánh này chỉ là hiển thị tốc độ đồng bộ, không phải phép tính hai chiều."
                : "この比較は同期速度の表示のみで、双方向計算の対象ではありません。"}
            </p>
          ) : (
            <ElectricalBasisPanel result={result} />
          )}
        </div>
      </div>
    </div>
  );
}
