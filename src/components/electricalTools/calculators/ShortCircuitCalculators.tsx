"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import {
  solvePercentZBaseConversion,
  solveSimplifiedShortCircuit,
  solveTransformerRatedCurrent,
  type PercentZBaseVar,
  type RatedCurrentVar,
  type ShortCircuitVar,
} from "@/lib/calc/electrical/shortCircuit";
import type { AcPhase } from "@/lib/calc/electrical/ohmsLaw";
import type { CalcVariableDef, SolveResult } from "@/lib/calc/electrical/types";
import { VariableSolverCard } from "@/components/electricalTools/VariableSolverCard";
import { ElectricalBasisPanel } from "@/components/electricalTools/ElectricalBasisPanel";
import { PillToggle } from "@/components/electricalTools/PillToggle";

const RATED_CURRENT_VARS: CalcVariableDef<RatedCurrentVar>[] = [
  { key: "kva", labelJa: "容量", labelVi: "Công suất", symbol: "S", unit: "kVA" },
  { key: "voltage", labelJa: "電圧", labelVi: "Điện áp", symbol: "V", unit: "V" },
  { key: "current", labelJa: "定格電流", labelVi: "Dòng điện định mức", symbol: "In", unit: "A" },
];
const SHORT_CIRCUIT_VARS: CalcVariableDef<ShortCircuitVar>[] = [
  { key: "ratedCurrentA", labelJa: "定格電流", labelVi: "Dòng điện định mức", symbol: "In", unit: "A" },
  { key: "percentZ", labelJa: "%インピーダンス", labelVi: "%Trở kháng", symbol: "%Z", unit: "%" },
  { key: "shortCircuitCurrentA", labelJa: "短絡電流（簡易値）", labelVi: "Dòng ngắn mạch (ước tính)", symbol: "Isc", unit: "A" },
];
const BASE_CONVERSION_VARS: CalcVariableDef<PercentZBaseVar>[] = [
  { key: "percentZOld", labelJa: "%Z（変換前ベース）", labelVi: "%Z (cơ sở cũ)", symbol: "%Z_old", unit: "%" },
  { key: "kvaOld", labelJa: "ベース容量（変換前）", labelVi: "Công suất cơ sở cũ", symbol: "kVA_old", unit: "kVA" },
  { key: "percentZNew", labelJa: "%Z（変換後ベース）", labelVi: "%Z (cơ sở mới)", symbol: "%Z_new", unit: "%" },
  { key: "kvaNew", labelJa: "ベース容量（変換後）", labelVi: "Công suất cơ sở mới", symbol: "kVA_new", unit: "kVA" },
];

type SubTool = "rated" | "shortCircuit" | "baseConversion";

export function ShortCircuitCalculators() {
  const { t, locale } = useTranslation();
  const [subTool, setSubTool] = useState<SubTool>("shortCircuit");
  const [phase, setPhase] = useState<AcPhase>("three");
  const [result, setResult] = useState<SolveResult | null>(null);

  return (
    <div className="calc-layout">
      <div className="calc-layout-input panel">
        <div className="panel-body flex flex-col gap-4">
          <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2.5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <p className="text-[12px] text-warning">
              {locale === "vi"
                ? "Đây là công cụ tính toán đơn giản (簡易計算) chỉ dựa trên %Z của máy biến áp — không tính đến trở kháng hệ thống thượng nguồn, cáp/thanh cái, hay dòng góp từ động cơ. Không dùng kết quả này để kết luận OK/NG cho khả năng cắt của thiết bị bảo vệ."
                : "本ツールは変圧器の%Zのみによる簡易計算です。上位系統・ケーブル/母線インピーダンス・電動機の逆流電流は考慮していません。遮断器の遮断容量OK/NG判定にこの値だけを使わないでください。"}
            </p>
          </div>

          <PillToggle
            label={locale === "vi" ? "Công cụ" : "ツール"}
            value={subTool}
            onChange={setSubTool}
            options={[
              { value: "rated", label: locale === "vi" ? "Dòng định mức" : "定格電流" },
              { value: "shortCircuit", label: locale === "vi" ? "Dòng ngắn mạch" : "簡易短絡電流" },
              { value: "baseConversion", label: locale === "vi" ? "Đổi cơ sở %Z" : "%Zベース換算" },
            ]}
          />

          {subTool === "rated" && (
            <VariableSolverCard
              variables={RATED_CURRENT_VARS}
              solve={(known, target) => solveTransformerRatedCurrent(known, target, phase)}
              onResult={setResult}
              resetKey={`rated-${phase}`}
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
          {subTool === "shortCircuit" && (
            <VariableSolverCard
              variables={SHORT_CIRCUIT_VARS}
              solve={solveSimplifiedShortCircuit}
              onResult={setResult}
              resetKey={subTool}
              defaultTarget="shortCircuitCurrentA"
            />
          )}
          {subTool === "baseConversion" && (
            <VariableSolverCard
              variables={BASE_CONVERSION_VARS}
              solve={solvePercentZBaseConversion}
              onResult={setResult}
              resetKey={subTool}
              defaultTarget="percentZNew"
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
