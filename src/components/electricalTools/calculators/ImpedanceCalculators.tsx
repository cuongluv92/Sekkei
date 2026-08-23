"use client";

import { useState } from "react";
import { useTranslation } from "@/lib/i18n";
import {
  solveCapacitiveReactance,
  solveImpedance,
  solveInductiveReactance,
  solveParallelComplexImpedance,
  solveParallelResistance,
  solveResonance,
  solveSeriesRX,
  type CapacitiveReactanceVar,
  type ImpedanceVar,
  type InductiveReactanceVar,
  type ParallelComplexImpedanceVar,
  type ParallelResistanceVar,
  type ResonanceVar,
  type SeriesVar,
} from "@/lib/calc/electrical/impedanceRLC";
import type { CalcVariableDef, SolveResult } from "@/lib/calc/electrical/types";
import { VariableSolverCard } from "@/components/electricalTools/VariableSolverCard";
import { ElectricalBasisPanel } from "@/components/electricalTools/ElectricalBasisPanel";
import { PillToggle } from "@/components/electricalTools/PillToggle";

const Z_VARS: CalcVariableDef<ImpedanceVar>[] = [
  { key: "R", labelJa: "抵抗", labelVi: "Điện trở", symbol: "R", unit: "Ω" },
  { key: "X", labelJa: "リアクタンス", labelVi: "Điện kháng", symbol: "X", unit: "Ω" },
  { key: "Z", labelJa: "インピーダンス", labelVi: "Tổng trở", symbol: "Z", unit: "Ω" },
];
const XL_VARS: CalcVariableDef<InductiveReactanceVar>[] = [
  { key: "f", labelJa: "周波数", labelVi: "Tần số", symbol: "f", unit: "Hz" },
  { key: "L", labelJa: "インダクタンス", labelVi: "Điện cảm", symbol: "L", unit: "H" },
  { key: "XL", labelJa: "誘導性リアクタンス", labelVi: "Điện kháng cảm", symbol: "XL", unit: "Ω" },
];
const XC_VARS: CalcVariableDef<CapacitiveReactanceVar>[] = [
  { key: "f", labelJa: "周波数", labelVi: "Tần số", symbol: "f", unit: "Hz" },
  { key: "C", labelJa: "静電容量", labelVi: "Điện dung", symbol: "C", unit: "F" },
  { key: "XC", labelJa: "容量性リアクタンス", labelVi: "Điện kháng dung", symbol: "XC", unit: "Ω" },
];
const RESONANCE_VARS: CalcVariableDef<ResonanceVar>[] = [
  { key: "L", labelJa: "インダクタンス", labelVi: "Điện cảm", symbol: "L", unit: "H" },
  { key: "C", labelJa: "静電容量", labelVi: "Điện dung", symbol: "C", unit: "F" },
  { key: "f0", labelJa: "共振周波数", labelVi: "Tần số cộng hưởng", symbol: "f0", unit: "Hz" },
];
const SERIES_VARS: CalcVariableDef<SeriesVar>[] = [
  { key: "R1", labelJa: "抵抗1", labelVi: "Điện trở 1", symbol: "R1", unit: "Ω" },
  { key: "R2", labelJa: "抵抗2", labelVi: "Điện trở 2", symbol: "R2", unit: "Ω" },
  { key: "Rtotal", labelJa: "合成抵抗", labelVi: "Điện trở tổng", symbol: "R_total", unit: "Ω" },
  { key: "X1", labelJa: "リアクタンス1", labelVi: "Điện kháng 1", symbol: "X1", unit: "Ω" },
  { key: "X2", labelJa: "リアクタンス2", labelVi: "Điện kháng 2", symbol: "X2", unit: "Ω" },
  { key: "Xtotal", labelJa: "合成リアクタンス", labelVi: "Điện kháng tổng", symbol: "X_total", unit: "Ω" },
];
const PARALLEL_VARS: CalcVariableDef<ParallelResistanceVar>[] = [
  { key: "R1", labelJa: "抵抗1", labelVi: "Điện trở 1", symbol: "R1", unit: "Ω" },
  { key: "R2", labelJa: "抵抗2", labelVi: "Điện trở 2", symbol: "R2", unit: "Ω" },
  { key: "Rtotal", labelJa: "合成抵抗", labelVi: "Điện trở tổng", symbol: "R_total", unit: "Ω" },
];
const PARALLEL_COMPLEX_VARS: CalcVariableDef<ParallelComplexImpedanceVar>[] = [
  {
    key: "R1",
    labelJa: "抵抗1",
    labelVi: "Điện trở 1",
    symbol: "R1",
    unit: "Ω",
  },
  {
    key: "X1",
    labelJa: "リアクタンス1（符号付き：+誘導性/−容量性）",
    labelVi: "Điện kháng 1 (có dấu: +cảm/−dung)",
    symbol: "X1",
    unit: "Ω",
  },
  {
    key: "R2",
    labelJa: "抵抗2",
    labelVi: "Điện trở 2",
    symbol: "R2",
    unit: "Ω",
  },
  {
    key: "X2",
    labelJa: "リアクタンス2（符号付き：+誘導性/−容量性）",
    labelVi: "Điện kháng 2 (có dấu: +cảm/−dung)",
    symbol: "X2",
    unit: "Ω",
  },
  {
    key: "Rtotal",
    labelJa: "合成インピーダンス実部",
    labelVi: "Phần thực tổng trở",
    symbol: "Rtotal",
    unit: "Ω",
  },
  {
    key: "Xtotal",
    labelJa: "合成インピーダンス虚部",
    labelVi: "Phần ảo tổng trở",
    symbol: "Xtotal",
    unit: "Ω",
  },
  {
    key: "Ztotal",
    labelJa: "合成インピーダンスの大きさ",
    labelVi: "Độ lớn tổng trở",
    symbol: "|Ztotal|",
    unit: "Ω",
  },
];

type SubTool = "z" | "xl" | "xc" | "resonance" | "series" | "parallel" | "parallelComplex";

export function ImpedanceCalculators() {
  const { t, locale } = useTranslation();
  const [subTool, setSubTool] = useState<SubTool>("z");
  const [result, setResult] = useState<SolveResult | null>(null);

  return (
    <div className="calc-layout">
      <div className="calc-layout-input panel">
        <div className="panel-body flex flex-col gap-4">
          <PillToggle
            label={locale === "vi" ? "Công cụ" : "ツール"}
            value={subTool}
            onChange={setSubTool}
            options={[
              { value: "z", label: "R・X・Z" },
              { value: "xl", label: "XL⇔L⇔f" },
              { value: "xc", label: "XC⇔C⇔f" },
              { value: "resonance", label: locale === "vi" ? "Cộng hưởng" : "共振周波数" },
              { value: "series", label: locale === "vi" ? "Nối tiếp" : "直列合成" },
              { value: "parallel", label: locale === "vi" ? "Song song (R)" : "並列合成（純抵抗）" },
              {
                value: "parallelComplex",
                label: locale === "vi" ? "Song song (R+jX)" : "並列合成（複素R+jX）",
              },
            ]}
          />

          {subTool === "z" && (
            <VariableSolverCard variables={Z_VARS} solve={solveImpedance} onResult={setResult} resetKey={subTool} defaultTarget="Z" />
          )}
          {subTool === "xl" && (
            <VariableSolverCard variables={XL_VARS} solve={solveInductiveReactance} onResult={setResult} resetKey={subTool} defaultTarget="XL" />
          )}
          {subTool === "xc" && (
            <VariableSolverCard variables={XC_VARS} solve={solveCapacitiveReactance} onResult={setResult} resetKey={subTool} defaultTarget="XC" />
          )}
          {subTool === "resonance" && (
            <VariableSolverCard variables={RESONANCE_VARS} solve={solveResonance} onResult={setResult} resetKey={subTool} defaultTarget="f0" />
          )}
          {subTool === "series" && (
            <VariableSolverCard variables={SERIES_VARS} solve={solveSeriesRX} onResult={setResult} resetKey={subTool} defaultTarget="Rtotal" />
          )}
          {subTool === "parallel" && (
            <VariableSolverCard variables={PARALLEL_VARS} solve={solveParallelResistance} onResult={setResult} resetKey={subTool} defaultTarget="Rtotal" />
          )}
          {subTool === "parallelComplex" && (
            <>
              <VariableSolverCard
                variables={PARALLEL_COMPLEX_VARS}
                solve={solveParallelComplexImpedance}
                onResult={setResult}
                resetKey={subTool}
                defaultTarget="Ztotal"
              />
              <p className="text-[11px] text-muted-2">
                {locale === "vi"
                  ? "Công cụ này chỉ tính theo một chiều: từ R1/X1/R2/X2 → Rtotal/Xtotal/Ztotal (phép chia số phức đầy đủ). Chiều ngược lại không xác định duy nhất nên không được hỗ trợ."
                  : "本ツールはR1/X1/R2/X2 → Rtotal/Xtotal/Ztotalの一方向のみ計算します（複素数の除算による厳密解）。逆方向（合成値から個々のR1/X1/R2/X2を求める）は解が一意に定まらないため対応していません。"}
              </p>
            </>
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
