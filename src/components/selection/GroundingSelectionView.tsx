"use client";

import { ExternalLink } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { earthBarSizeService, earthWireSizeService } from "@/lib/services";
import { requiredEarthWireCrossSection } from "@/lib/calc/earthWire/requiredCrossSection";
import { findEarthWireCandidates } from "@/lib/calc/earthWire/candidateSearch";
import { EARTH_WIRE_0052_SOURCE, type GroundingType } from "@/lib/calc/earthWire/technicalSource";
import {
  EARTH_BAR_ADIABATIC_REFERENCE_SOURCE,
  EARTH_BAR_JSA_URL,
  EARTH_BAR_K_OPTIONS,
  EARTH_BAR_SCHNEIDER_URL,
  calculateEarthBarAdiabaticArea,
  findEarthBarAutoCandidates,
  type EarthBarKKey,
} from "@/lib/calc/earthBar/adiabaticSelection";
import type { EarthBarSize, EarthWireSize } from "@/lib/types";

export function GroundingSelectionView() {
  const { locale } = useTranslation();
  const [wireSizes, setWireSizes] = useState<EarthWireSize[]>([]);
  const [barSizes, setBarSizes] = useState<EarthBarSize[]>([]);
  const [currentRaw, setCurrentRaw] = useState("");
  const [groundingType, setGroundingType] = useState<GroundingType>("D");
  const [selectedCurrent, setSelectedCurrent] = useState<number | null>(null);
  const [faultRaw, setFaultRaw] = useState("");
  const [timeRaw, setTimeRaw] = useState("");
  const [kKey, setKKey] = useState<EarthBarKKey>("cu_pvc_external");

  const copy = locale === "vi"
    ? {
        description: "Kết quả tiếp địa trả ngay trong Selection, dùng chung logic kỹ thuật của mục Tính toán.",
        earthWire: "Dây tiếp địa",
        earthBar: "Thanh đồng tiếp địa",
        current: "Dòng định mức In (A)",
        grounding: "Loại tiếp địa",
        choose: "Chọn",
        required: "Tiết diện yêu cầu",
        adopted: "Cỡ công ty phù hợp nhỏ nhất",
        noSize: "Chưa có cỡ phù hợp trong dữ liệu công ty.",
        source: "Nguồn / phạm vi áp dụng",
        fault: "Dòng ngắn mạch (kA)",
        time: "Thời gian cắt (s)",
        kCondition: "Điều kiện hệ số k",
        referenceAuto: "Tự động tính tham khảo",
        autoCandidate: "Cỡ thanh tự động đề xuất",
        margin: "Dư tiết diện",
        enterFaultTime: "Nhập dòng ngắn mạch và thời gian cắt để tự động tính.",
        warning: "Kết quả thanh tiếp địa là giá trị tham khảo theo phương pháp adiabatic. Phải xác nhận điều kiện k phù hợp với cấu tạo thực tế trước khi dùng làm giá trị thiết kế chính thức.",
        jisSource: "Nguồn JIS",
        guideSource: "Bảng k tham khảo",
      }
    : {
        description: "接地線・アースバーも選定画面内で結果を返し、計算ロジックは電気技術計算側と共通化しています。",
        earthWire: "接地線選定",
        earthBar: "アースバー選定",
        current: "定格電流 In (A)",
        grounding: "接地工事種別",
        choose: "選定する",
        required: "必要断面積",
        adopted: "社内登録サイズからの最小候補",
        noSize: "適合する社内登録サイズがありません。",
        source: "根拠・適用範囲",
        fault: "事故電流 (kA)",
        time: "遮断時間 (s)",
        kCondition: "k係数条件",
        referenceAuto: "参考自動計算",
        autoCandidate: "自動候補",
        margin: "断面積余裕",
        enterFaultTime: "事故電流と遮断時間を入力すると自動計算します。",
        warning: "アースバーは断熱法 S = I√t/k による参考自動計算です。実際の採用前に、裸導体/絶縁状態・初期/最終温度などk係数の適用条件が実構造と一致することを確認してください。",
        jisSource: "JIS根拠",
        guideSource: "k値参考",
      };

  useEffect(() => {
    Promise.all([earthWireSizeService.list(), earthBarSizeService.list()]).then(([w, b]) => {
      setWireSizes(w);
      setBarSizes(b);
    });
  }, []);

  const wireResult = useMemo(() => {
    if (selectedCurrent == null) return null;
    const required = requiredEarthWireCrossSection(selectedCurrent, groundingType);
    if (!required.applicable) return { required, candidate: null };
    const candidate = findEarthWireCandidates(wireSizes, required.requiredAreaMm2)[0] ?? null;
    return { required, candidate };
  }, [selectedCurrent, groundingType, wireSizes]);

  const selectedK = EARTH_BAR_K_OPTIONS.find((option) => option.key === kKey) ?? EARTH_BAR_K_OPTIONS[0];
  const barAuto = useMemo(() => {
    const fault = Number(faultRaw);
    const time = Number(timeRaw);
    const required = calculateEarthBarAdiabaticArea(fault, time, selectedK.k);
    if (!required) return null;
    const candidates = findEarthBarAutoCandidates(barSizes, required.requiredAreaMm2);
    return { required, candidates, candidate: candidates[0] ?? null };
  }, [barSizes, faultRaw, timeRaw, selectedK.k]);

  function chooseWire() {
    const value = Number(currentRaw);
    if (Number.isFinite(value) && value > 0) setSelectedCurrent(value);
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[12px] text-muted">{copy.description}</p>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-lg border border-border bg-surface p-3.5">
          <div className="mb-3 panel-title">{copy.earthWire}</div>
          <div className="grid gap-2 sm:grid-cols-[minmax(150px,1fr)_130px_auto] sm:items-end">
            <label>
              <span className="field-label">{copy.current}</span>
              <input
                className="field-input"
                type="number"
                min={0}
                step="any"
                value={currentRaw}
                onChange={(e) => setCurrentRaw(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && chooseWire()}
                placeholder="例）100"
              />
            </label>
            <label>
              <span className="field-label">{copy.grounding}</span>
              <select
                className="field-input"
                value={groundingType}
                onChange={(e) => setGroundingType(e.target.value as GroundingType)}
              >
                <option value="D">D種</option>
                <option value="C">C種</option>
              </select>
            </label>
            <button type="button" className="btn-primary" onClick={chooseWire} disabled={Number(currentRaw) <= 0}>
              {copy.choose}
            </button>
          </div>

          {wireResult && (
            <div className="mt-3 data-table-wrap">
              <table className="data-table" style={{ minWidth: 620 }}>
                <thead>
                  <tr><th>{copy.required}</th><th>{copy.adopted}</th><th>{copy.source}</th></tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="font-mono font-semibold">
                      {wireResult.required.applicable ? `${wireResult.required.requiredAreaMm2.toFixed(2)} mm²` : "—"}
                    </td>
                    <td className="font-mono font-semibold">
                      {wireResult.candidate ? `${wireResult.candidate.areaMm2} mm²` : copy.noSize}
                    </td>
                    <td className="text-[11px]">
                      <div className="font-semibold">{EARTH_WIRE_0052_SOURCE.standard} {EARTH_WIRE_0052_SOURCE.edition}</div>
                      <div className="text-muted">{EARTH_WIRE_0052_SOURCE.applicability}</div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-lg border border-border bg-surface p-3.5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <span className="panel-title">{copy.earthBar}</span>
            <span className="rounded bg-warning/10 px-2 py-0.5 text-[10.5px] font-bold text-warning">{copy.referenceAuto}</span>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <label>
              <span className="field-label">{copy.fault}</span>
              <input className="field-input" type="number" min={0} step="any" value={faultRaw} onChange={(e) => setFaultRaw(e.target.value)} placeholder="例）10" />
            </label>
            <label>
              <span className="field-label">{copy.time}</span>
              <input className="field-input" type="number" min={0} step="any" value={timeRaw} onChange={(e) => setTimeRaw(e.target.value)} placeholder="例）0.2" />
            </label>
            <label>
              <span className="field-label">{copy.kCondition}</span>
              <select className="field-input" value={kKey} onChange={(e) => setKKey(e.target.value as EarthBarKKey)}>
                {EARTH_BAR_K_OPTIONS.map((option) => (
                  <option key={option.key} value={option.key}>{option.labelJa}</option>
                ))}
              </select>
            </label>
          </div>

          {barAuto ? (
            <div className="mt-3 data-table-wrap">
              <table className="data-table" style={{ minWidth: 660 }}>
                <thead>
                  <tr><th>{copy.required}</th><th>{copy.autoCandidate}</th><th>{copy.margin}</th><th>{copy.source}</th></tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="font-mono font-bold">{barAuto.required.requiredAreaMm2.toFixed(2)} mm²</td>
                    <td className="font-mono font-bold">
                      {barAuto.candidate
                        ? `${barAuto.candidate.size.thicknessMm} × ${barAuto.candidate.size.widthMm} mm`
                        : copy.noSize}
                    </td>
                    <td className="font-mono">
                      {barAuto.candidate ? `${barAuto.candidate.marginPercent.toFixed(1)} %` : "—"}
                    </td>
                    <td className="text-[11px]">
                      <div className="font-semibold">{EARTH_BAR_ADIABATIC_REFERENCE_SOURCE.standard}</div>
                      <div className="text-muted">{selectedK.conditionJa}</div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-3 text-[11px] text-muted-2">{copy.enterFaultTime}</p>
          )}

          <div className="mt-3 rounded-md border border-warning/30 bg-warning/5 px-3 py-2 text-[11px] text-muted">
            <p>{copy.warning}</p>
            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
              <a href={EARTH_BAR_JSA_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-accent hover:underline">
                {copy.jisSource}<ExternalLink className="h-3 w-3" />
              </a>
              <a href={EARTH_BAR_SCHNEIDER_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-accent hover:underline">
                {copy.guideSource}<ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
