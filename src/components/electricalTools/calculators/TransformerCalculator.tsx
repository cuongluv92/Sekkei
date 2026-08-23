"use client";

import { useState } from "react";
import { useTranslation } from "@/lib/i18n";
import {
  computeLineVoltageRatio,
  JIS_C4304_DISTRIBUTION_TRANSFORMER_SOURCE,
  JIS_C4306_DISTRIBUTION_TRANSFORMER_SOURCE,
  solveTransformer,
  TRANSFORMER_VECTOR_GROUPS,
  TRANSFORMER_VECTOR_GROUP_SOURCE,
  type TransformerPhase,
  type TransformerVar,
} from "@/lib/calc/electrical/transformer";
import type { CalcVariableDef, SolveResult } from "@/lib/calc/electrical/types";
import { VariableSolverCard } from "@/components/electricalTools/VariableSolverCard";
import { ElectricalBasisPanel } from "@/components/electricalTools/ElectricalBasisPanel";
import { PillToggle } from "@/components/electricalTools/PillToggle";

const SINGLE_VARS: CalcVariableDef<TransformerVar>[] = [
  { key: "v1", labelJa: "一次電圧", labelVi: "Điện áp sơ cấp", symbol: "V1", unit: "V" },
  { key: "i1", labelJa: "一次電流", labelVi: "Dòng điện sơ cấp", symbol: "I1", unit: "A" },
  { key: "v2", labelJa: "二次電圧", labelVi: "Điện áp thứ cấp", symbol: "V2", unit: "V" },
  { key: "i2", labelJa: "二次電流", labelVi: "Dòng điện thứ cấp", symbol: "I2", unit: "A" },
  { key: "kva", labelJa: "容量", labelVi: "Công suất", symbol: "S", unit: "kVA" },
  { key: "turnsRatio", labelJa: "巻数比", labelVi: "Tỷ số vòng dây", symbol: "a", unit: "" },
];
const THREE_VARS: CalcVariableDef<TransformerVar>[] = SINGLE_VARS.filter(
  (v) => v.key !== "turnsRatio",
);

export function TransformerCalculator() {
  const { t, locale } = useTranslation();
  const [phase, setPhase] = useState<TransformerPhase>("three");
  const [result, setResult] = useState<SolveResult | null>(null);
  const [known, setKnown] = useState<Partial<Record<TransformerVar, number>>>({});

  const lineRatio =
    phase === "three" && known.v1 !== undefined && known.v2 !== undefined
      ? computeLineVoltageRatio(known.v1, known.v2)
      : null;
  const kvaInJisScope =
    known.kva !== undefined &&
    (phase === "single" ? known.kva >= 10 && known.kva <= 500 : known.kva >= 20 && known.kva <= 2000);
  const showSixSixKvNote =
    kvaInJisScope &&
    ((known.v1 !== undefined && known.v1 >= 6000 && known.v1 <= 7000) ||
      (known.v2 !== undefined && known.v2 >= 6000 && known.v2 <= 7000));

  return (
    <div className="calc-layout">
      <div className="calc-layout-input panel">
        <div className="panel-body flex flex-col gap-4">
          <VariableSolverCard
            variables={phase === "single" ? SINGLE_VARS : THREE_VARS}
            solve={(k, target) => solveTransformer(k, target, phase)}
            onResult={setResult}
            onValuesChange={setKnown}
            resetKey={phase}
            defaultTarget="kva"
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

          {lineRatio && (
            <div className="rounded-lg border border-info/40 bg-info/10 px-3 py-2.5 text-[12px]">
              <p className="font-bold text-foreground">
                {locale === "vi" ? "Tỷ số điện áp dây (tham khảo)" : "線間電圧比（参考値）"}: a ≈{" "}
                {lineRatio.ratio.toFixed(3)}
              </p>
              <p className="mt-1 text-muted">{lineRatio.note}</p>
            </div>
          )}

          {showSixSixKvNote && (
            <div className="rounded-lg border border-border-strong bg-surface-2 px-3 py-2.5 text-[11.5px] text-muted">
              <p className="mb-1 font-bold text-foreground">
                {locale === "vi" ? "6.6kV — tiêu chuẩn áp dụng (tham khảo)" : "6.6kV級 — 適用規格（参考）"}
              </p>
              <p>
                {JIS_C4304_DISTRIBUTION_TRANSFORMER_SOURCE.standard}:
                {JIS_C4304_DISTRIBUTION_TRANSFORMER_SOURCE.edition} —{" "}
                {JIS_C4304_DISTRIBUTION_TRANSFORMER_SOURCE.applicability}
              </p>
              <p>
                {JIS_C4306_DISTRIBUTION_TRANSFORMER_SOURCE.standard}:
                {JIS_C4306_DISTRIBUTION_TRANSFORMER_SOURCE.edition} —{" "}
                {JIS_C4306_DISTRIBUTION_TRANSFORMER_SOURCE.applicability}
              </p>
            </div>
          )}

          <div className="rounded-lg border border-border-strong bg-surface-2 px-3 py-2.5 text-[11.5px] text-muted">
            <p className="mb-1.5 font-bold text-foreground">
              {locale === "vi" ? "Nhóm vector (tham khảo)" : "ベクトル群（参考情報）"}
            </p>
            <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
              {TRANSFORMER_VECTOR_GROUPS.map((g) => (
                <div key={g.code} className="flex items-center gap-2">
                  <span className="font-mono font-bold text-foreground">{g.code}</span>
                  <span>{g.descriptionJa}</span>
                </div>
              ))}
            </div>
            <p className="mt-1.5 border-t border-border pt-1.5 text-warning">
              {TRANSFORMER_VECTOR_GROUP_SOURCE.verificationNote}
            </p>
          </div>
        </div>
      </div>

      <div className="calc-layout-basis panel">
        <div className="panel-header">
          <span className="panel-title">{t("electricalTools.basisSectionTitle")}</span>
        </div>
        <div className="panel-body">
          <ElectricalBasisPanel
            result={result}
            variables={phase === "single" ? SINGLE_VARS : THREE_VARS}
          />
        </div>
      </div>
    </div>
  );
}
