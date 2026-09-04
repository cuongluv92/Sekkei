"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { earthBarSizeService, earthWireSizeService } from "@/lib/services";
import { requiredEarthWireCrossSection } from "@/lib/calc/earthWire/requiredCrossSection";
import { findEarthWireCandidates } from "@/lib/calc/earthWire/candidateSearch";
import { EARTH_WIRE_0052_SOURCE, type GroundingType } from "@/lib/calc/earthWire/technicalSource";
import { findEarthBarCandidates } from "@/lib/calc/earthBar/candidateSearch";
import { JIS_C60364_5_54_ADIABATIC_SOURCE } from "@/lib/calc/earthBar/technicalSource";
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

  const copy = locale === "vi"
    ? {
        description: "Kết quả được hiển thị ngay trong Selection nhưng dùng lại logic kỹ thuật của mục Tính toán, không tạo công thức thứ hai.",
        earthWire: "Chọn dây tiếp địa",
        earthBar: "Chọn thanh đồng tiếp địa",
        current: "Dòng định mức In (A)",
        grounding: "Loại tiếp địa",
        choose: "Chọn",
        required: "Tiết diện yêu cầu",
        adopted: "Cỡ công ty phù hợp nhỏ nhất",
        noSize: "Chưa có cỡ công ty phù hợp trong cài đặt tab này.",
        unsupported: "Loại tiếp địa này chưa có công thức đã triển khai; không tự suy đoán.",
        source: "Nguồn / phạm vi áp dụng",
        fault: "Dòng ngắn mạch (kA)",
        time: "Thời gian cắt (s)",
        earthBarWarning: "Hiện công thức adiabatic đã được tham chiếu nhưng bảng k của JIS chưa được xác minh trực tiếp, vì vậy không tự kết luận OK/NG hoặc chọn một cỡ giả định. Các cỡ công ty vẫn hiện để tham khảo.",
        candidates: "Các cỡ thanh tiếp địa đã đăng ký",
      }
    : {
        description: "選定画面内で結果を返しますが、計算式は「計算」側の技術ロジックを共用します。同じ式を別実装しません。",
        earthWire: "接地線選定",
        earthBar: "アースバー選定",
        current: "定格電流 In (A)",
        grounding: "接地工事種別",
        choose: "選定する",
        required: "必要断面積",
        adopted: "社内登録サイズからの最小候補",
        noSize: "このタブの設定に適合する社内サイズが登録されていません。",
        unsupported: "この接地工事種別は現在の実装範囲外です。推測値は出しません。",
        source: "根拠・適用範囲",
        fault: "事故電流 (kA)",
        time: "遮断時間 (s)",
        earthBarWarning: "断熱法の考え方は参照済みですが、JIS原本のk値表を直接確認できていないため、自動でOK/NGや採用サイズを断定しません。社内登録サイズは候補としてこの場で確認できます。",
        candidates: "登録済みアースバー候補",
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

  const barCandidates = useMemo(() => {
    const fault = Number(faultRaw);
    const time = Number(timeRaw);
    return findEarthBarCandidates(
      barSizes,
      Number.isFinite(fault) && fault > 0 ? fault : null,
      Number.isFinite(time) && time > 0 ? time : null,
      1,
    );
  }, [barSizes, faultRaw, timeRaw]);

  function chooseWire() {
    const value = Number(currentRaw);
    if (Number.isFinite(value) && value > 0) setSelectedCurrent(value);
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="text-[12px] text-muted">{copy.description}</p>

      <section className="rounded-lg border border-border p-3.5">
        <div className="mb-3 panel-title">{copy.earthWire}</div>
        <div className="grid gap-2 md:grid-cols-[220px_180px_auto] md:items-end">
          <label><span className="field-label">{copy.current}</span><input className="field-input" type="number" min={0} step="any" value={currentRaw} onChange={(e) => setCurrentRaw(e.target.value)} onKeyDown={(e) => e.key === "Enter" && chooseWire()} /></label>
          <label><span className="field-label">{copy.grounding}</span><select className="field-input" value={groundingType} onChange={(e) => setGroundingType(e.target.value as GroundingType)}><option value="A">A種</option><option value="B">B種</option><option value="C">C種</option><option value="D">D種</option></select></label>
          <button type="button" className="btn-primary" onClick={chooseWire} disabled={Number(currentRaw) <= 0}>{copy.choose}</button>
        </div>

        {wireResult && (
          <div className="mt-3 data-table-wrap">
            <table className="data-table" style={{ minWidth: 760 }}>
              <thead><tr><th>{copy.required}</th><th>{copy.adopted}</th><th>{copy.source}</th></tr></thead>
              <tbody><tr>
                <td className="font-mono font-semibold">{wireResult.required.applicable ? `${wireResult.required.requiredAreaMm2.toFixed(2)} mm²` : copy.unsupported}</td>
                <td className="font-mono font-semibold">{wireResult.candidate ? `${wireResult.candidate.areaMm2} mm²` : copy.noSize}</td>
                <td className="text-[11px]"><div className="font-semibold">{EARTH_WIRE_0052_SOURCE.standard} {EARTH_WIRE_0052_SOURCE.edition}</div><div className="text-muted">{EARTH_WIRE_0052_SOURCE.applicability}</div></td>
              </tr></tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-border p-3.5">
        <div className="mb-3 panel-title">{copy.earthBar}</div>
        <div className="grid gap-2 md:grid-cols-2">
          <label><span className="field-label">{copy.fault}</span><input className="field-input" type="number" min={0} step="any" value={faultRaw} onChange={(e) => setFaultRaw(e.target.value)} /></label>
          <label><span className="field-label">{copy.time}</span><input className="field-input" type="number" min={0} step="any" value={timeRaw} onChange={(e) => setTimeRaw(e.target.value)} /></label>
        </div>
        <p className="mt-3 rounded-md border border-warning/30 bg-warning/5 px-3 py-2 text-[11px] text-muted">{copy.earthBarWarning}</p>
        <div className="mt-3 text-[11px] font-bold text-muted">{copy.candidates}</div>
        <div className="data-table-wrap mt-1">
          <table className="data-table" style={{ minWidth: 620 }}>
            <thead><tr><th>t × W</th><th>断面積</th><th>{copy.source}</th></tr></thead>
            <tbody>
              {barCandidates.length === 0 ? <tr><td colSpan={3} className="text-muted-2">{copy.noSize}</td></tr> : barCandidates.map((candidate) => (
                <tr key={`${candidate.sizeId}-${candidate.barsPerPhase}`}>
                  <td className="font-mono font-semibold">{candidate.thicknessMm} × {candidate.widthMm} mm</td>
                  <td className="font-mono">{candidate.totalAreaMm2} mm²</td>
                  <td className="text-[11px]"><div className="font-semibold">{JIS_C60364_5_54_ADIABATIC_SOURCE.standard} {JIS_C60364_5_54_ADIABATIC_SOURCE.edition}</div><div className="text-warning">短絡耐量：未検証</div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
