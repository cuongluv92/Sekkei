"use client";

import { ExternalLink } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { earthWireSizeService } from "@/lib/services";
import { requiredEarthWireCrossSection } from "@/lib/calc/earthWire/requiredCrossSection";
import { findEarthWireCandidates } from "@/lib/calc/earthWire/candidateSearch";
import { EARTH_WIRE_0052_SOURCE, type GroundingType } from "@/lib/calc/earthWire/technicalSource";
import type { EarthWireSize } from "@/lib/types";

interface Props {
  currentA?: number | null;
  hideCurrentInput?: boolean;
}

const JSA_EARTH_URL =
  "https://webdesk.jsa.or.jp/books/W11M0090/index/?bunsyo_id=JIS+C+60364-5-54%3A2023";
const JEEA_SHORT_CIRCUIT_URL = "https://jeea.or.jp/course/contents/12151/";
const MITSUBISHI_TRIP_CURVE_URL =
  "https://fa-faq.mitsubishielectric.co.jp/faq/show/39634";

export function GroundingSelectionView({ currentA, hideCurrentInput = false }: Props) {
  const { locale } = useTranslation();
  const [wireSizes, setWireSizes] = useState<EarthWireSize[]>([]);
  const [currentRaw, setCurrentRaw] = useState("");
  const [groundingType, setGroundingType] = useState<GroundingType>("D");
  const [selectedCurrent, setSelectedCurrent] = useState<number | null>(null);

  const copy = locale === "vi"
    ? {
        description: "Dùng chung dòng A ở đầu tab. Mặc định D, có thể đổi sang C.",
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
        shortCircuitRequired: "Cần điều kiện ngắn mạch",
        shortCircuitNote: "Không thể suy ra dòng ngắn mạch và thời gian cắt chỉ từ dòng A tải. App sẽ không tự bịa giá trị.",
        fault: "Dòng ngắn mạch",
        faultHow: "Tính từ điện áp nguồn và tổng trở (%Z) từ nguồn/biến áp/dây dẫn đến điểm sự cố.",
        trip: "Thời gian cắt",
        tripHow: "Lấy từ đường đặc tính tác động chính thức của đúng model CB phía trên.",
        earthBarHow: "Tiết diện thanh tiếp địa",
        earthBarRule: "Dùng JIS C 60364-5-54 sau khi có đủ điều kiện ngắn mạch và hệ số k đã xác minh từ bản JIS chính thức.",
      }
    : {
        description: "タブ上部の共通選定電流(A)を使用します。接地工事種別はD種を既定とし、C種へ切替できます。",
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
        shortCircuitRequired: "短絡条件が必要",
        shortCircuitNote: "負荷の選定電流(A)だけから事故電流・遮断時間を決めることはできません。推測値は使用しません。",
        fault: "事故電流",
        faultHow: "電源電圧と、電源・変圧器・配線から事故点までの合成インピーダンス（%Z等）から算出します。",
        trip: "遮断時間",
        tripHow: "実際に採用する上位遮断器の型式ごとの公式動作特性曲線から取得します。",
        earthBarHow: "アースバー必要断面積",
        earthBarRule: "短絡条件と、JIS原本で確認したk係数条件が揃った時点で JIS C 60364-5-54 に基づき自動計算します。",
      };

  const externalCurrent =
    currentA != null && Number.isFinite(currentA) && currentA > 0 ? currentA : null;
  const effectiveCurrent = externalCurrent ?? selectedCurrent;

  useEffect(() => {
    earthWireSizeService.list().then(setWireSizes);
  }, []);

  const wireResult = useMemo(() => {
    if (effectiveCurrent == null) return null;
    const required = requiredEarthWireCrossSection(effectiveCurrent, groundingType);
    if (!required.applicable) return { required, candidate: null };
    const candidate = findEarthWireCandidates(wireSizes, required.requiredAreaMm2)[0] ?? null;
    return { required, candidate };
  }, [effectiveCurrent, groundingType, wireSizes]);

  function chooseWire() {
    const value = Number(currentRaw);
    if (Number.isFinite(value) && value > 0) setSelectedCurrent(value);
  }

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
            <div className="data-table-wrap">
              <table className="data-table" style={{ minWidth: 620 }}>
                <thead><tr><th>{copy.required}</th><th>{copy.adopted}</th><th>{copy.source}</th></tr></thead>
                <tbody><tr>
                  <td className="font-mono font-semibold">
                    {wireResult.required.applicable ? `${wireResult.required.requiredAreaMm2.toFixed(2)} mm²` : "—"}
                  </td>
                  <td className="font-mono font-semibold">
                    {wireResult.candidate ? `${wireResult.candidate.areaMm2} mm²` : copy.noSize}
                  </td>
                  <td className="text-[11px]">
                    <div className="font-semibold">{EARTH_WIRE_0052_SOURCE.standard} {EARTH_WIRE_0052_SOURCE.edition}</div>
                    <div className="text-muted">{EARTH_WIRE_0052_SOURCE.applicability}</div>
                    {!EARTH_WIRE_0052_SOURCE.verified && <div className="text-warning">原本条項の直接確認待ち</div>}
                  </td>
                </tr></tbody>
              </table>
            </div>
          ) : (
            <p className="text-[11px] text-muted-2">{copy.prompt}</p>
          )}
        </section>

        <section className="rounded-lg border border-border bg-surface p-3.5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <span className="panel-title">{copy.earthBar}</span>
            <span className="rounded bg-warning/10 px-2 py-0.5 text-[10.5px] font-bold text-warning">
              {copy.shortCircuitRequired}
            </span>
          </div>

          <p className="rounded-md border border-warning/30 bg-warning/5 px-3 py-2 text-[11px] text-muted">
            {copy.shortCircuitNote}
          </p>

          <div className="data-table-wrap mt-3">
            <table className="data-table" style={{ minWidth: 720 }}>
              <thead><tr><th style={{ width: 150 }}>項目</th><th>取得・計算方法</th><th style={{ width: 170 }}>国内根拠</th></tr></thead>
              <tbody>
                <tr>
                  <td className="font-semibold">{copy.fault}</td>
                  <td className="text-[11px]">{copy.faultHow}</td>
                  <td>
                    <a href={JEEA_SHORT_CIRCUIT_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent hover:underline">
                      日本電気技術者協会<ExternalLink className="h-3 w-3" />
                    </a>
                  </td>
                </tr>
                <tr>
                  <td className="font-semibold">{copy.trip}</td>
                  <td className="text-[11px]">{copy.tripHow}</td>
                  <td>
                    <a href={MITSUBISHI_TRIP_CURVE_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent hover:underline">
                      三菱電機FA<ExternalLink className="h-3 w-3" />
                    </a>
                  </td>
                </tr>
                <tr>
                  <td className="font-semibold">{copy.earthBarHow}</td>
                  <td className="text-[11px]">{copy.earthBarRule}</td>
                  <td>
                    <a href={JSA_EARTH_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent hover:underline">
                      日本規格協会 JIS<ExternalLink className="h-3 w-3" />
                    </a>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
