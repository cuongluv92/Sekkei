"use client";

import { useMemo, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import {
  checkVoltageDropConformity,
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
  const [rxKnown, setRxKnown] = useState<Partial<Record<VoltageDropVar, number>>>({});
  const [allowedPercentRaw, setAllowedPercentRaw] = useState("");

  const actualDeltaVPercent = useMemo(() => {
    if (result?.ok && result.target === "deltaVPercent") return result.value;
    if (rxKnown.deltaVPercent !== undefined) return rxKnown.deltaVPercent;
    const deltaV =
      result?.ok && result.target === "deltaV" ? result.value : rxKnown.deltaV;
    const sourceVoltage = rxKnown.sourceVoltage;
    if (deltaV !== undefined && sourceVoltage !== undefined && sourceVoltage > 0) {
      return (deltaV / sourceVoltage) * 100;
    }
    return undefined;
  }, [result, rxKnown]);

  const allowedPercent = Number(allowedPercentRaw);
  const conformity =
    method === "rx" &&
    actualDeltaVPercent !== undefined &&
    allowedPercentRaw.trim() !== "" &&
    Number.isFinite(allowedPercent)
      ? checkVoltageDropConformity(actualDeltaVPercent, allowedPercent)
      : null;

  return (
    <div className="calc-layout">
      <div className="calc-layout-input panel">
        <div className="panel-body flex flex-col gap-4">
          <PillToggle
            label={locale === "vi" ? "Phương pháp" : "計算方式"}
            value={method}
            onChange={setMethod}
            options={[
              {
                value: "rx",
                label:
                  locale === "vi"
                    ? "R/X (theo hằng số đường dây r/x)"
                    : "R/X法（線路定数による計算）",
              },
              { value: "simplified", label: locale === "vi" ? "Hệ số đơn giản (要確認)" : "簡易係数法（要確認）" },
            ]}
          />

          {method === "rx" && (
            <>
              <VariableSolverCard
                variables={mode === "dc" ? RX_VARS_DC : RX_VARS_AC}
                solve={(known, target) => solveVoltageDrop(known, target, mode)}
                onResult={setResult}
                onValuesChange={setRxKnown}
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

              <div className="rounded-lg border border-border-strong bg-surface-2 px-3 py-2.5">
                <label className="field-label">
                  {locale === "vi"
                    ? "Ngưỡng ΔV% cho phép (tự nhập, tự kiểm tra theo quy định của bạn)"
                    : "許容電圧降下率（%）※ご自身で内線規程等を確認の上、入力してください"}
                </label>
                <div className="relative w-32">
                  <input
                    type="number"
                    inputMode="decimal"
                    value={allowedPercentRaw}
                    onChange={(e) => setAllowedPercentRaw(e.target.value)}
                    placeholder="例: 2"
                    className="field-input pr-8"
                  />
                  <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[12.5px] font-semibold text-muted-2">
                    %
                  </span>
                </div>

                {actualDeltaVPercent !== undefined && conformity && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px]">
                    <span className={conformity.conforms ? "badge-success" : "badge-warning"}>
                      {conformity.conforms
                        ? locale === "vi"
                          ? "Phù hợp với ngưỡng đã nhập"
                          : "入力した許容値以内（適合）"
                        : locale === "vi"
                          ? "Vượt ngưỡng đã nhập"
                          : "入力した許容値を超過（要確認）"}
                    </span>
                    <span className="text-muted">
                      {locale === "vi"
                        ? `ΔV% thực tế ${actualDeltaVPercent.toFixed(3)}% / cho phép ${conformity.allowedPercent}%`
                        : `実際のΔV% ${actualDeltaVPercent.toFixed(3)}% ／ 許容 ${conformity.allowedPercent}%`}
                    </span>
                  </div>
                )}
                {actualDeltaVPercent !== undefined && !conformity && allowedPercentRaw.trim() === "" && (
                  <p className="mt-2 text-[11px] text-muted-2">
                    {locale === "vi"
                      ? `ΔV% thực tế hiện tại: ${actualDeltaVPercent.toFixed(3)}% — nhập ngưỡng cho phép ở trên để so sánh.`
                      : `現在の実際のΔV%: ${actualDeltaVPercent.toFixed(3)}% — 上に許容値を入力すると比較できます。`}
                  </p>
                )}
                <p className="mt-2 border-t border-border pt-2 text-[11px] text-muted-2">
                  {locale === "vi"
                    ? "Đây chỉ là phép so sánh số học ΔV% tính được với ngưỡng bạn tự nhập — hệ thống không tự đưa ra hay suy đoán ngưỡng quy định (2%/3%/5%...)."
                    : "これは計算されたΔV%とご自身で入力した許容値との単純な数値比較です。許容値（2%/3%/5%等）自体を本システムが規定・推測することはありません。"}
                </p>
              </div>
            </>
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
              ? "Công cụ này chỉ hiển thị giá trị ΔV/ΔV% thực tế; hệ thống không tự đưa ra hay suy đoán ngưỡng quy định (2%/3%/5%...). Phần \"phù hợp/không phù hợp\" phía trên (chỉ có ở R/X) chỉ là so sánh số học với ngưỡng bạn tự nhập — hãy tự kiểm tra quy định nội tuyến (内線規程)/tiêu chuẩn kỹ thuật thiết bị điện hiện hành trước khi nhập ngưỡng đó."
              : "本ツールはΔV・ΔV%の実数値を示すのみで、許容値（2%/3%/5%等）そのものを規定・推測することはありません。上の「適合/要確認」表示（R/X法のみ）は、あくまでご自身が入力した許容値との単純な数値比較です。許容値の入力前に内線規程・電気設備技術基準の該当条項をご自身でご確認ください。"}
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
