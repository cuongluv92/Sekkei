"use client";

import { useState } from "react";
import { useTranslation } from "@/lib/i18n";
import {
  solveCapacitorCorrection,
  solvePowerTriangle,
  type CapacitorCorrectionVar,
  type PowerTriangleVar,
} from "@/lib/calc/electrical/powerFactor";
import type { CalcVariableDef, SolveResult } from "@/lib/calc/electrical/types";
import { VariableSolverCard } from "@/components/electricalTools/VariableSolverCard";
import { ElectricalBasisPanel } from "@/components/electricalTools/ElectricalBasisPanel";
import { PillToggle } from "@/components/electricalTools/PillToggle";

const TRIANGLE_VARS: CalcVariableDef<PowerTriangleVar>[] = [
  { key: "activeP", labelJa: "有効電力", labelVi: "Công suất hữu công", symbol: "P", unit: "kW" },
  { key: "reactiveQ", labelJa: "無効電力の大きさ", labelVi: "Độ lớn công suất vô công", symbol: "|Q|", unit: "kvar" },
  { key: "apparentS", labelJa: "皮相電力", labelVi: "Công suất biểu kiến", symbol: "S", unit: "kVA" },
  { key: "pf", labelJa: "力率", labelVi: "Hệ số công suất", symbol: "cosφ", unit: "" },
];
const CAPACITOR_VARS: CalcVariableDef<CapacitorCorrectionVar>[] = [
  { key: "activePowerKw", labelJa: "有効電力", labelVi: "Công suất hữu công", symbol: "P", unit: "kW" },
  { key: "pfBefore", labelJa: "改善前の力率", labelVi: "Hệ số công suất trước", symbol: "cosφ1", unit: "" },
  { key: "pfAfter", labelJa: "目標力率", labelVi: "Hệ số công suất mục tiêu", symbol: "cosφ2", unit: "" },
  { key: "qcKvar", labelJa: "必要コンデンサ容量", labelVi: "Dung lượng tụ cần thiết", symbol: "Qc", unit: "kvar" },
];

type SubTool = "triangle" | "capacitor";

export function PowerFactorCalculators() {
  const { t, locale } = useTranslation();
  const [subTool, setSubTool] = useState<SubTool>("capacitor");
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
              { value: "triangle", label: locale === "vi" ? "Tam giác P/Q/S" : "電力三角形（P/Q/S）" },
              { value: "capacitor", label: locale === "vi" ? "Tụ bù (kvar)" : "進相コンデンサ容量" },
            ]}
          />

          {subTool === "triangle" && (
            <VariableSolverCard
              variables={TRIANGLE_VARS}
              solve={solvePowerTriangle}
              onResult={setResult}
              resetKey={subTool}
              defaultTarget="apparentS"
            />
          )}

          {subTool === "capacitor" && (
            <VariableSolverCard
              variables={CAPACITOR_VARS}
              solve={solveCapacitorCorrection}
              onResult={setResult}
              resetKey={subTool}
              defaultTarget="qcKvar"
            />
          )}

          {subTool === "capacitor" && (
            <p className="text-[11px] text-muted-2">
              {locale === "vi"
                ? "Đây chỉ là công thức cơ bản để tính dung lượng kvar cần thiết — không bao gồm việc lựa chọn thiết bị tụ bù thực tế (dung lượng tiêu chuẩn, đóng cắt, phối hợp bảo vệ...). Vui lòng tham khảo tiêu chuẩn JEMA/JIS/JEAC hiện hành khi chọn thiết bị."
                : "これは必要kvarを求める基本式のみです。実機コンデンサの規格容量選定・開閉装置・保護協調などの機器選定は対象外です。機器選定の際は最新のJEMA/JIS/JEAC規格をご確認ください。"}
            </p>
          )}
        </div>
      </div>

      <div className="calc-layout-basis panel">
        <div className="panel-header">
          <span className="panel-title">{t("electricalTools.basisSectionTitle")}</span>
        </div>
        <div className="panel-body">
          <ElectricalBasisPanel
            result={result}
            variables={subTool === "triangle" ? TRIANGLE_VARS : CAPACITOR_VARS}
          />
        </div>
      </div>
    </div>
  );
}
