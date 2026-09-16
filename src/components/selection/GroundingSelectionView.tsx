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
  calculateEarthBarAdiabaticArea,
  findEarthBarAutoCandidates,
} from "@/lib/calc/earthBar/adiabaticSelection";
import type { EarthBarSize, EarthWireSize } from "@/lib/types";

interface Props {
  currentA?: number | null;
  hideCurrentInput?: boolean;
}

const JEA_INNER_WIRING_URL =
  "https://store.denki.or.jp/products/%E5%86%85%E7%B7%9A%E8%A6%8F%E7%A8%8B-%E7%AC%AC14%E7%89%88";
const METI_EARTHING_URL =
  "https://www.meti.go.jp/policy/safety_security/industrial_safety/law/files/dengikaishaku.pdf";
const METI_SHORT_CIRCUIT_URL =
  "https://www.meti.go.jp/policy/safety_security/industrial_safety/law/denjikokuji.html";
const MITSUBISHI_TRIP_CURVE_URL =
  "https://fa-faq.mitsubishielectric.co.jp/faq/show/39634";

export function GroundingSelectionView({ currentA, hideCurrentInput = false }: Props) {
  const { locale } = useTranslation();
  const [wireSizes, setWireSizes] = useState<EarthWireSize[]>([]);
  const [barSizes, setBarSizes] = useState<EarthBarSize[]>([]);
  const [currentRaw, setCurrentRaw] = useState("");
  const [groundingType, setGroundingType] = useState<GroundingType>("D");
  const [selectedCurrent, setSelectedCurrent] = useState<number | null>(null);
  const [faultRaw, setFaultRaw] = useState("");
  const [timeRaw, setTimeRaw] = useState("");
  const [kRaw, setKRaw] = useState("");

  const copy = locale === "vi"
    ? {
        description: "Dùng chung dòng A ở đầu tab. Có thể chọn A/B/C/D; công thức tự động chỉ áp dụng khi nguồn hiện có xác nhận phạm vi.",
        earthWire: "Dây tiếp địa",
        earthBar: "Thanh đồng tiếp địa",
        current: "Dòng định mức In (A)",
        grounding: "Loại tiếp địa",
        choose: "Chọn",
        required: "Tiết diện yêu cầu",
        adopted: "Cỡ công ty phù hợp nhỏ nhất",
        noSize: "Chưa có cỡ phù hợp trong dữ liệu công ty.",
        source: "Nguồn / phạm vi áp dụng",
        prompt: "Nhập A ở đầu tab để xem kết quả.",
        unsupportedA: "A種 không dùng công thức 0.052×In. Cần chọn theo điều kiện của A種/tiêu chuẩn áp dụng.",
        unsupportedB: "B種 không dùng công thức 0.052×In. Cần tính theo dòng chạm đất của hệ thống và điều kiện B種.",
        fault: "Dòng sự cố (kA)",
        time: "Thời gian cắt (s)",
        k: "Hệ số k",
        calculateHint: "Không suy ra hai giá trị này từ dòng tải A. Nếu bạn biết giá trị thực tế, nhập vào đây để tính trực tiếp.",
        kHint: "k phải lấy từ JIS gốc hoặc tiêu chuẩn công ty đã xác minh theo vật liệu và điều kiện nhiệt.",
        formula: "Công thức tham khảo",
        result: "Kết quả tính thanh tiếp địa",
        candidate: "Cỡ công ty đề xuất",
        margin: "Dư tiết diện",
        needInputs: "Nhập dòng sự cố, thời gian cắt và k để nhận kết quả.",
        officialSources: "Nguồn chính thức Nhật Bản",
      }
    : {
        description: "タブ上部の共通選定電流(A)を使用します。接地工事種別はA・B・C・D種から選択できますが、自動式は根拠の適用範囲内だけで使用します。",
        earthWire: "接地線選定",
        earthBar: "アースバー選定",
        current: "定格電流 In (A)",
        grounding: "接地工事種別",
        choose: "選定する",
        required: "必要断面積",
        adopted: "社内登録サイズからの最小候補",
        noSize: "適合する社内登録サイズがありません。",
        source: "根拠・適用範囲",
        prompt: "タブ上部の選定電流(A)を入力してください。",
        unsupportedA: "A種は0.052×In式の適用対象外です。A種の施設条件・適用規程に基づき選定してください。",
        unsupportedB: "B種は0.052×In式の適用対象外です。系統の1線地絡電流等に基づく別条件で選定します。",
        fault: "事故電流 (kA)",
        time: "遮断時間 (s)",
        k: "k係数",
        calculateHint: "事故電流・遮断時間は負荷電流(A)から推定しません。実設備で確認できた値を入力すれば、この画面で計算結果を返します。",
        kHint: "kは導体材料・絶縁状態・初期/最終温度に対応する値を、JIS原本または確認済み社内基準から入力してください。",
        formula: "参考計算式",
        result: "アースバー計算結果",
        candidate: "社内登録サイズ候補",
        margin: "断面積余裕",
        needInputs: "事故電流・遮断時間・k係数を入力すると結果を表示します。",
        officialSources: "国内公式根拠",
      };

  const externalCurrent =
    currentA != null && Number.isFinite(currentA) && currentA > 0 ? currentA : null;
  const effectiveCurrent = externalCurrent ?? selectedCurrent;

  useEffect(() => {
    Promise.all([earthWireSizeService.list(), earthBarSizeService.list()]).then(([w, b]) => {
      setWireSizes(w);
      setBarSizes(b);
    });
  }, []);

  const wireResult = useMemo(() => {
    if (effectiveCurrent == null) return null;
    const required = requiredEarthWireCrossSection(effectiveCurrent, groundingType);
    if (!required.applicable) return { required, candidate: null };
    const candidate = findEarthWireCandidates(wireSizes, required.requiredAreaMm2)[0] ?? null;
    return { required, candidate };
  }, [effectiveCurrent, groundingType, wireSizes]);

  const barResult = useMemo(() => {
    const fault = Number(faultRaw);
    const time = Number(timeRaw);
    const k = Number(kRaw);
    const required = calculateEarthBarAdiabaticArea(fault, time, k);
    if (!required) return null;
    const candidate = findEarthBarAutoCandidates(barSizes, required.requiredAreaMm2)[0] ?? null;
    return { required, candidate };
  }, [faultRaw, timeRaw, kRaw, barSizes]);

  function chooseWire() {
    const value = Number(currentRaw);
    if (Number.isFinite(value) && value > 0) setSelectedCurrent(value);
  }

  const unsupportedText =
    groundingType === "A" ? copy.unsupportedA : groundingType === "B" ? copy.unsupportedB : null;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[12px] text-muted">{copy.description}</p>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-lg border border-border bg-surface p-3.5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <span className="panel-title">{copy.earthWire}</span>
            <label className="flex items-center gap-2 text-[11px]">
              <span className="text-muted">{copy.grounding}</span>
              <select
                className="field-input w-[92px]"
                value={groundingType}
                onChange={(e) => setGroundingType(e.target.value as GroundingType)}
              >
                <option value="D">D種</option>
                <option value="C">C種</option>
                <option value="A">A種</option>
                <option value="B">B種</option>
              </select>
            </label>
          </div>

          {!hideCurrentInput && (
            <div className="grid gap-2 sm:grid-cols-[minmax(160px,1fr)_auto] sm:items-end">
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
                />
              </label>
              <button type="button" className="btn-primary" onClick={chooseWire} disabled={Number(currentRaw) <= 0}>
                {copy.choose}
              </button>
            </div>
          )}

          {wireResult ? (
            wireResult.required.applicable ? (
              <div className="data-table-wrap">
                <table className="data-table" style={{ minWidth: 620 }}>
                  <thead><tr><th>{copy.required}</th><th>{copy.adopted}</th><th>{copy.source}</th></tr></thead>
                  <tbody><tr>
                    <td className="font-mono font-semibold">{wireResult.required.requiredAreaMm2.toFixed(2)} mm²</td>
                    <td className="font-mono font-semibold">
                      {wireResult.candidate ? `${wireResult.candidate.areaMm2} mm²` : copy.noSize}
                    </td>
                    <td className="text-[11px]">
                      <div className="font-semibold">{EARTH_WIRE_0052_SOURCE.standard} {EARTH_WIRE_0052_SOURCE.edition}</div>
                      <div className="text-muted">{EARTH_WIRE_0052_SOURCE.applicability}</div>
                      <a href={JEA_INNER_WIRING_URL} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 font-semibold text-accent hover:underline">
                        日本電気協会 公式<ExternalLink className="h-3 w-3" />
                      </a>
                      {!EARTH_WIRE_0052_SOURCE.verified && <div className="text-warning">係数の原本条項は直接確認待ち</div>}
                    </td>
                  </tr></tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-md border border-warning/30 bg-warning/5 px-3 py-2.5 text-[11px] text-muted">
                <p>{unsupportedText}</p>
                <a href={METI_EARTHING_URL} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 font-semibold text-accent hover:underline">
                  経済産業省 電気設備技術基準の解釈<ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )
          ) : (
            <p className="text-[11px] text-muted-2">{copy.prompt}</p>
          )}
        </section>

        <section className="rounded-lg border border-border bg-surface p-3.5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <span className="panel-title">{copy.earthBar}</span>
            <span className="rounded bg-warning/10 px-2 py-0.5 text-[10.5px] font-bold text-warning">入力値による参考計算</span>
          </div>

          <p className="mb-3 rounded-md border border-warning/30 bg-warning/5 px-3 py-2 text-[11px] text-muted">
            {copy.calculateHint}
          </p>

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
              <span className="field-label">{copy.k}</span>
              <input className="field-input" type="number" min={0} step="any" value={kRaw} onChange={(e) => setKRaw(e.target.value)} placeholder="JIS/社内確認値" />
            </label>
          </div>
          <p className="mt-1.5 text-[10.5px] text-muted-2">{copy.kHint}</p>

          <div className="mt-3">
            <div className="mb-1 panel-title">{copy.result}</div>
            {barResult ? (
              <div className="data-table-wrap">
                <table className="data-table" style={{ minWidth: 720 }}>
                  <thead><tr><th>{copy.formula}</th><th>{copy.required}</th><th>{copy.candidate}</th><th>{copy.margin}</th></tr></thead>
                  <tbody><tr>
                    <td className="font-mono">S = I√t / k</td>
                    <td className="font-mono font-bold">{barResult.required.requiredAreaMm2.toFixed(2)} mm²</td>
                    <td className="font-mono font-bold">
                      {barResult.candidate
                        ? `${barResult.candidate.size.thicknessMm} × ${barResult.candidate.size.widthMm} mm`
                        : copy.noSize}
                    </td>
                    <td className="font-mono">
                      {barResult.candidate ? `${barResult.candidate.marginPercent.toFixed(1)} %` : "—"}
                    </td>
                  </tr></tbody>
                </table>
              </div>
            ) : (
              <p className="text-[11px] text-muted-2">{copy.needInputs}</p>
            )}
          </div>

          <div className="mt-3 rounded-md border border-border px-3 py-2 text-[11px] text-muted">
            <div className="font-semibold text-foreground">{copy.officialSources}</div>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
              <a href={EARTH_BAR_JSA_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-accent hover:underline">
                日本規格協会 {EARTH_BAR_ADIABATIC_REFERENCE_SOURCE.standard}<ExternalLink className="h-3 w-3" />
              </a>
              <a href={METI_SHORT_CIRCUIT_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-accent hover:underline">
                経済産業省 電気設備技術基準<ExternalLink className="h-3 w-3" />
              </a>
              <a href={MITSUBISHI_TRIP_CURVE_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-accent hover:underline">
                三菱電機 遮断器動作特性<ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
