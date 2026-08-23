"use client";

import { useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import {
  checkBreakingCapacity,
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
  const [shortCircuitKnown, setShortCircuitKnown] = useState<
    Partial<Record<ShortCircuitVar, number>>
  >({});
  const [breakerCapacityRaw, setBreakerCapacityRaw] = useState("");

  const actualIsc = useMemo(() => {
    if (result?.ok && result.target === "shortCircuitCurrentA") return result.value;
    return shortCircuitKnown.shortCircuitCurrentA;
  }, [result, shortCircuitKnown]);

  const breakerCapacity = Number(breakerCapacityRaw);
  const breakingCapacityCheck =
    subTool === "shortCircuit" &&
    actualIsc !== undefined &&
    breakerCapacityRaw.trim() !== "" &&
    Number.isFinite(breakerCapacity)
      ? checkBreakingCapacity(actualIsc, breakerCapacity)
      : null;

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
            <>
              <VariableSolverCard
                variables={SHORT_CIRCUIT_VARS}
                solve={solveSimplifiedShortCircuit}
                onResult={setResult}
                onValuesChange={setShortCircuitKnown}
                resetKey={subTool}
                defaultTarget="shortCircuitCurrentA"
              />

              <div className="rounded-lg border border-border-strong bg-surface-2 px-3 py-2.5">
                <label className="field-label">
                  {locale === "vi"
                    ? "Dòng cắt định mức của thiết bị bảo vệ [A/kA] (tự nhập theo銘板/仕様書)"
                    : "遮断器の定格遮断電流 [A/kA]（銘板・仕様書の値をご自身で入力）"}
                </label>
                <div className="relative w-32">
                  <input
                    type="number"
                    inputMode="decimal"
                    value={breakerCapacityRaw}
                    onChange={(e) => setBreakerCapacityRaw(e.target.value)}
                    placeholder="例: 25000"
                    className="field-input pr-10"
                  />
                  <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[12.5px] font-semibold text-muted-2">
                    A
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-muted-2">
                  {locale === "vi"
                    ? "Nhập theo đơn vị A (nếu銘板ghi kA, hãy tự đổi ×1000 trước khi nhập). Giá trị này phải lấy ở cùng điện áp định mức/điều kiện của thiết bị — không so sánh chéo với thiết bị hoặc điện áp khác."
                    : "A単位で入力してください（銘板がkA表記の場合は×1000して入力）。この値は必ず対象機器の同一定格電圧・同一条件で読み取った値を使用し、異なる機器・異なる電圧の値と混同しないでください。"}
                </p>

                {actualIsc !== undefined && breakingCapacityCheck && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px]">
                    <span
                      className={
                        breakingCapacityCheck.sufficient ? "badge-success" : "badge-warning"
                      }
                    >
                      {breakingCapacityCheck.sufficient
                        ? locale === "vi"
                          ? "Đủ so với Isc (簡易値)"
                          : "簡易Iscに対して定格遮断電流は足りている"
                        : locale === "vi"
                          ? "Không đủ so với Isc (簡易値)"
                          : "簡易Iscに対して定格遮断電流が不足（要確認）"}
                    </span>
                    <span className="text-muted">
                      {locale === "vi"
                        ? `Isc (ước tính) ${actualIsc.toFixed(1)}A / dòng cắt định mức ${breakingCapacityCheck.breakerRatedBreakingCapacityA}A`
                        : `簡易Isc ${actualIsc.toFixed(1)}A ／ 定格遮断電流 ${breakingCapacityCheck.breakerRatedBreakingCapacityA}A`}
                    </span>
                  </div>
                )}
                {actualIsc !== undefined && !breakingCapacityCheck && breakerCapacityRaw.trim() === "" && (
                  <p className="mt-2 text-[11px] text-muted-2">
                    {locale === "vi"
                      ? `Isc (ước tính) hiện tại: ${actualIsc.toFixed(1)}A — nhập dòng cắt định mức ở trên để so sánh.`
                      : `現在の簡易Isc: ${actualIsc.toFixed(1)}A — 上に定格遮断電流を入力すると比較できます。`}
                  </p>
                )}
                <p className="mt-2 border-t border-border pt-2 text-[11px] text-warning">
                  {locale === "vi"
                    ? "Đây chỉ là phép so sánh số học giữa Isc (giá trị đơn giản, chỉ dựa trên %Z máy biến áp) và dòng cắt định mức bạn tự nhập — không phải kết luận OK/NG chính thức. Isc đơn giản này chưa xét trở kháng hệ thống thượng nguồn/cáp/thanh cái/dòng góp động cơ, nên tuyệt đối không dùng riêng phép so sánh này để quyết định chọn thiết bị bảo vệ."
                    : "これは「変圧器%Zのみの簡易Isc」と、ご自身で入力した定格遮断電流との単純な数値比較であり、正式なOK/NG判定ではありません。この簡易Iscは上位系統・ケーブル/母線インピーダンス・電動機の逆流電流を考慮していないため、この比較結果だけで保護機器の選定を決定しないでください。"}
                </p>
              </div>
            </>
          )}
          {subTool === "baseConversion" && (
            <>
              <VariableSolverCard
                variables={BASE_CONVERSION_VARS}
                solve={solvePercentZBaseConversion}
                onResult={setResult}
                resetKey={subTool}
                defaultTarget="percentZNew"
              />
              <p className="text-[11px] text-muted-2">
                {locale === "vi"
                  ? "Công thức này chỉ đổi cơ sở dung lượng (kVA) ở CÙNG một điện áp cơ sở. Nếu điện áp cơ sở cũng thay đổi, cần thêm hệ số (V_cũ/V_mới)² — công cụ này chưa hỗ trợ trường hợp đó."
                  : "この換算式は同一の電圧ベース内での容量（kVA）ベース変更のみに対応しています。電圧ベースも同時に変わる場合は (V_old/V_new)² の項が別途必要であり、本ツールはその場合には対応していません。"}
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
          <ElectricalBasisPanel
            result={result}
            variables={
              subTool === "rated"
                ? RATED_CURRENT_VARS
                : subTool === "shortCircuit"
                  ? SHORT_CIRCUIT_VARS
                  : BASE_CONVERSION_VARS
            }
          />
        </div>
      </div>
    </div>
  );
}
