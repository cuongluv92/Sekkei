"use client";

import { useCallback, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import {
  CT_ACCURACY_CLASS_NOTE,
  CT_PURPOSE_NOTE,
  solveInstrumentTransformerRatio,
  type InstrumentTransformerKind,
  type InstrumentTransformerPurpose,
  type InstrumentTransformerVar,
} from "@/lib/calc/electrical/ctVt";
import type { CalcVariableDef, SolveResult } from "@/lib/calc/electrical/types";
import { VariableSolverCard } from "@/components/electricalTools/VariableSolverCard";
import { ElectricalBasisPanel } from "@/components/electricalTools/ElectricalBasisPanel";
import { PillToggle } from "@/components/electricalTools/PillToggle";

type Kind = InstrumentTransformerKind;

const CT_VARS: CalcVariableDef<InstrumentTransformerVar>[] = [
  { key: "primary", labelJa: "一次側電流（実際の値）", labelVi: "Dòng điện sơ cấp (giá trị thực)", symbol: "I1", unit: "A" },
  { key: "secondary", labelJa: "二次側電流（メーター読み値）", labelVi: "Dòng điện thứ cấp (giá trị đọc)", symbol: "I2", unit: "A" },
  { key: "ratio", labelJa: "変流比", labelVi: "Tỷ số biến dòng", symbol: "CT比", unit: "" },
];
const VT_VARS: CalcVariableDef<InstrumentTransformerVar>[] = [
  { key: "primary", labelJa: "一次側電圧（実際の値）", labelVi: "Điện áp sơ cấp (giá trị thực)", symbol: "V1", unit: "V" },
  { key: "secondary", labelJa: "二次側電圧（メーター読み値）", labelVi: "Điện áp thứ cấp (giá trị đọc)", symbol: "V2", unit: "V" },
  { key: "ratio", labelJa: "変圧比", labelVi: "Tỷ số biến áp", symbol: "VT比", unit: "" },
];

export function CtVtCalculator() {
  const { t, locale } = useTranslation();
  const [kind, setKind] = useState<Kind>("CT");
  const [purpose, setPurpose] = useState<InstrumentTransformerPurpose>("measurement");
  const [result, setResult] = useState<SolveResult | null>(null);
  const [accuracyClass, setAccuracyClass] = useState("");

  const solve = useCallback(
    (known: Partial<Record<InstrumentTransformerVar, number>>, target: InstrumentTransformerVar) =>
      solveInstrumentTransformerRatio(known, target, kind, purpose),
    [kind, purpose],
  );

  return (
    <div className="calc-layout">
      <div className="calc-layout-input panel">
        <div className="panel-body flex flex-col gap-4">
          <VariableSolverCard
            variables={kind === "CT" ? CT_VARS : VT_VARS}
            solve={solve}
            onResult={setResult}
            resetKey={kind}
            defaultTarget="primary"
            extra={
              <div className="flex flex-col gap-3">
                <PillToggle
                  label={locale === "vi" ? "Loại" : "種別"}
                  value={kind}
                  onChange={setKind}
                  options={[
                    { value: "CT", label: "CT（変流器）" },
                    { value: "VT", label: "VT（計器用変圧器）" },
                  ]}
                />
                <PillToggle
                  label={locale === "vi" ? "Mục đích" : "用途"}
                  value={purpose}
                  onChange={setPurpose}
                  options={[
                    { value: "measurement", label: locale === "vi" ? "Đo lường" : "計測用" },
                    { value: "protection", label: locale === "vi" ? "Bảo vệ" : "保護用" },
                  ]}
                />
              </div>
            }
          />
          <div className="rounded-lg border border-border-strong bg-surface-2 px-3 py-2.5 text-[11.5px] text-muted">
            {CT_PURPOSE_NOTE[purpose]}
          </div>

          {kind === "CT" && (
            <div className="rounded-lg border border-border-strong bg-surface-2 px-3 py-2.5">
              <label className="field-label">
                {locale === "vi"
                  ? "Cấp chính xác (ghi chú tham khảo, tự nhập theo銘板/仕様書)"
                  : "精度階級（参考メモ・銘板/仕様書の記載をそのまま入力）"}
              </label>
              <input
                type="text"
                value={accuracyClass}
                onChange={(e) => setAccuracyClass(e.target.value)}
                placeholder={purpose === "measurement" ? "例: 0.5級" : "例: 5P10"}
                className="field-input"
              />
              <p className="mt-2 border-t border-border pt-2 text-[11px] text-muted-2">
                {CT_ACCURACY_CLASS_NOTE[purpose]}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="calc-layout-basis panel">
        <div className="panel-header">
          <span className="panel-title">{t("electricalTools.basisSectionTitle")}</span>
        </div>
        <div className="panel-body">
          <ElectricalBasisPanel result={result} variables={kind === "CT" ? CT_VARS : VT_VARS} />
        </div>
      </div>
    </div>
  );
}
