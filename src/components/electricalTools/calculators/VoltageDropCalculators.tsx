"use client";

import { useState } from "react";
import { useTranslation } from "@/lib/i18n";
import {
  solveSimplifiedVoltageDrop,
  solveVoltageDrop,
  type SimplifiedVoltageDropVar,
  type SimplifiedVoltageDropWiring,
  type VoltageDropMode,
  type VoltageDropVar,
} from "@/lib/calc/electrical/voltageDrop";
import type { CalcVariableDef, SolveResult } from "@/lib/calc/electrical/types";
import { VariableSolverCard } from "@/components/electricalTools/VariableSolverCard";
import { ElectricalBasisPanel } from "@/components/electricalTools/ElectricalBasisPanel";
import { PillToggle } from "@/components/electricalTools/PillToggle";

const RX_VARS_AC: CalcVariableDef<VoltageDropVar>[] = [
  { key: "current", labelJa: "電流", labelVi: "Dòng điện", symbol: "I", unit: "A" },
  { key: "rOhmPerKm", labelJa: "抵抗（こう長あたり）", labelVi: "Điện trở/km", symbol: "r", unit: "Ω/km" },
  { key: "xOhmPerKm", labelJa: "リアクタンス（こう長あたり）", labelVi: "Điện kháng/km", symbol: "x", unit: "Ω/km" },
  { key: "pf", labelJa: "力率", labelVi: "Hệ số công suất", symbol: "cosφ", unit: "" },
  { key: "lengthM", labelJa: "こう長", labelVi: "Chiều dài", symbol: "L", unit: "m" },
  { key: "sourceVoltage", labelJa: "始端電圧", labelVi: "Điện áp đầu nguồn", symbol: "V0", unit: "V" },
  { key: "deltaV", labelJa: "電圧降下", labelVi: "Sụt áp", symbol: "ΔV", unit: "V" },
  { key: "deltaVPercent", labelJa: "電圧降下率", labelVi: "Tỷ lệ sụt áp", symbol: "ΔV%", unit: "%" },
  { key: "endVoltage", labelJa: "末端電圧", labelVi: "Điện áp cuối", symbol: "Ve", unit: "V" },
];
const RX_VARS_DC: CalcVariableDef<VoltageDropVar>[] = RX_VARS_AC.filter(
  (v) => v.key !== "xOhmPerKm" && v.key !== "pf",
);

const SIMPLIFIED_VARS: CalcVariableDef<SimplifiedVoltageDropVar>[] = [
  { key: "current", labelJa: "電流", labelVi: "Dòng điện", symbol: "I", unit: "A" },
  { key: "lengthM", labelJa: "こう長", labelVi: "Chiều dài", symbol: "L", unit: "m" },
  { key: "areaMm2", labelJa: "断面積", labelVi: "Tiết diện", symbol: "A", unit: "mm²" },
  { key: "deltaV", labelJa: "電圧降下", labelVi: "Sụt áp", symbol: "ΔV", unit: "V" },
];

type Method = "rx" | "simplified";

export function VoltageDropCalculators() {
  const { t, locale } = useTranslation();
  const [method, setMethod] = useState<Method>("rx");
  const [mode, setMode] = useState<VoltageDropMode>("three");
  const [wiring, setWiring] = useState<SimplifiedVoltageDropWiring>("three3wire");
  const [result, setResult] = useState<SolveResult | null>(null);

  return (
    <div className="calc-layout">
      <div className="calc-layout-input panel">
        <div className="panel-body flex flex-col gap-4">
          <PillToggle
            label={locale === "vi" ? "Phương pháp" : "計算方式"}
            value={method}
            onChange={setMethod}
            options={[
              { value: "rx", label: locale === "vi" ? "R/X (chính xác)" : "R/X法（回路理論）" },
              { value: "simplified", label: locale === "vi" ? "Hệ số đơn giản (要確認)" : "簡易係数法（要確認）" },
            ]}
          />

          {method === "rx" && (
            <VariableSolverCard
              variables={mode === "dc" ? RX_VARS_DC : RX_VARS_AC}
              solve={(known, target) => solveVoltageDrop(known, target, mode)}
              onResult={setResult}
              resetKey={`rx-${mode}`}
              defaultTarget="deltaV"
              extra={
                <PillToggle
                  label={locale === "vi" ? "Kiểu mạch" : "回路種別"}
                  value={mode}
                  onChange={setMode}
                  options={[
                    { value: "dc", label: locale === "vi" ? "DC" : "直流" },
                    { value: "single", label: locale === "vi" ? "1 pha 2 dây" : "単相2線式" },
                    { value: "three", label: locale === "vi" ? "3 pha 3 dây" : "三相3線式" },
                  ]}
                />
              }
            />
          )}

          {method === "simplified" && (
            <VariableSolverCard
              variables={SIMPLIFIED_VARS}
              solve={(known, target) => solveSimplifiedVoltageDrop(known, target, wiring)}
              onResult={setResult}
              resetKey={`simplified-${wiring}`}
              defaultTarget="deltaV"
              extra={
                <PillToggle
                  label={locale === "vi" ? "Kiểu mạch" : "回路種別"}
                  value={wiring}
                  onChange={setWiring}
                  options={[
                    { value: "single2wire", label: locale === "vi" ? "1 pha 2 dây (35.6)" : "単相2線式（35.6）" },
                    { value: "three3wire", label: locale === "vi" ? "3 pha 3 dây (30.8)" : "三相3線式（30.8）" },
                  ]}
                />
              }
            />
          )}

          <p className="text-[11px] text-muted-2">
            {locale === "vi"
              ? "Công cụ này chỉ hiển thị giá trị ΔV/ΔV% thực tế — không tự đưa ra phán định phù hợp/không phù hợp (2%/3%/5%...); vui lòng tự kiểm tra quy định nội tuyến (内線規程)/tiêu chuẩn kỹ thuật thiết bị điện hiện hành."
              : "本ツールはΔV・ΔV%の実数値のみを示し、適合/不適合（2%/3%/5%等）の判定は行いません。判定には内線規程・電気設備技術基準の該当条項をご自身でご確認ください。"}
          </p>
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
