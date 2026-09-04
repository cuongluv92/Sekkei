"use client";

import { ExternalLink, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import {
  pickTerminalBlock,
  terminalBlockSelectionService,
  type TerminalBlockSelectionRow,
  type TerminalBlockSeries,
} from "@/lib/services";

interface Props {
  currentA?: number | null;
  hideInput?: boolean;
}

const SERIES: TerminalBlockSeries[] = ["CT", "PT"];

export function TerminalBlockSelectionView({ currentA, hideInput = false }: Props) {
  const { locale } = useTranslation();
  const [rows, setRows] = useState<TerminalBlockSelectionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentRaw, setCurrentRaw] = useState("");
  const [selectedCurrent, setSelectedCurrent] = useState<number | null>(null);

  const copy = locale === "vi"
    ? {
        description: "TB chỉ chọn hai dòng CT và PT của Toyogiken. Dùng chung dòng A ở đầu tab.",
        current: "Dòng điện (A)",
        choose: "Chọn TB",
        result: "Kết quả TB CT / PT",
        series: "Series",
        reference: "Tiêu chuẩn / tham khảo",
        company: "Tiêu chuẩn công ty",
        rated: "Dòng định mức",
        maxWire: "Dây tối đa",
        screw: "Cỡ vít",
        basis: "Nguồn",
        none: "Không có model phù hợp.",
        noCompany: "Chưa nhập tiêu chuẩn công ty",
        prompt: "Nhập A ở đầu tab để xem CT và PT cùng lúc.",
      }
    : {
        description: "TBは東洋技研のCTシリーズ・PTシリーズだけを対象とし、タブ上部の共通選定電流(A)から両方を同時に選定します。",
        current: "選定電流 (A)",
        choose: "TBを選定",
        result: "TB CT / PT 選定結果",
        series: "シリーズ",
        reference: "基準・参考選定",
        company: "社内基準",
        rated: "定格通電電流",
        maxWire: "適合電線 MAX",
        screw: "端子ねじ",
        basis: "根拠",
        none: "対応する型式がありません。",
        noCompany: "社内基準未登録",
        prompt: "タブ上部の選定電流(A)を入力するとCT・PTを同時に表示します。",
      };

  const externalCurrent =
    currentA != null && Number.isFinite(currentA) && currentA > 0 ? currentA : null;
  const effectiveCurrent = externalCurrent ?? selectedCurrent;

  useEffect(() => {
    let cancelled = false;
    terminalBlockSelectionService
      .list()
      .then((list) => {
        if (!cancelled) setRows(list.filter((row) => row.series === "CT" || row.series === "PT"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const results = useMemo(() => {
    if (effectiveCurrent == null) return [];
    return SERIES.map((series) => ({
      series,
      reference: pickTerminalBlock(rows, effectiveCurrent, "reference", series),
      company: pickTerminalBlock(rows, effectiveCurrent, "company", series),
    }));
  }, [rows, effectiveCurrent]);

  function choose() {
    const value = Number(currentRaw);
    if (Number.isFinite(value) && value > 0) setSelectedCurrent(value);
  }

  function resultSummary(row: TerminalBlockSelectionRow | null, companyMode = false) {
    if (!row) return <span className={companyMode ? "text-warning" : "text-muted-2"}>{companyMode ? copy.noCompany : copy.none}</span>;
    return (
      <div className="flex flex-col gap-0.5">
        <span className="font-mono font-bold">{row.model}</span>
        <span className="text-[10.5px] text-muted">{row.manufacturer} / {row.series}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[12px] text-muted">{copy.description}</p>

      {!hideInput && (
        <div className="grid grid-cols-[minmax(180px,320px)_auto] items-end gap-2.5">
          <div>
            <label className="field-label">{copy.current}</label>
            <input
              className="field-input"
              type="number"
              min={0}
              step="any"
              value={currentRaw}
              onChange={(e) => setCurrentRaw(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && choose()}
              placeholder="例）42"
            />
          </div>
          <button type="button" onClick={choose} disabled={Number(currentRaw) <= 0} className="btn-primary">
            {copy.choose}
          </button>
        </div>
      )}

      <div className="flex items-center gap-2">
        <span className="panel-title">{copy.result}</span>
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-2" />}
        {effectiveCurrent != null && (
          <span className="rounded bg-accent/10 px-2 py-0.5 font-mono text-[11px] font-semibold text-accent">
            {effectiveCurrent} A
          </span>
        )}
      </div>

      {effectiveCurrent == null ? (
        <p className="text-[11px] text-muted-2">{copy.prompt}</p>
      ) : (
        <div className="data-table-wrap">
          <table className="data-table" style={{ minWidth: 980 }}>
            <thead>
              <tr>
                <th style={{ width: 80 }}>{copy.series}</th>
                <th style={{ width: 190 }}>{copy.reference}</th>
                <th style={{ width: 120 }}>{copy.rated}</th>
                <th style={{ width: 120 }}>{copy.maxWire}</th>
                <th style={{ width: 100 }}>{copy.screw}</th>
                <th style={{ width: 190 }}>{copy.company}</th>
                <th>{copy.basis}</th>
              </tr>
            </thead>
            <tbody>
              {results.map(({ series, reference, company }) => (
                <tr key={series}>
                  <td className="font-bold">{series}</td>
                  <td>{resultSummary(reference)}</td>
                  <td className="font-mono">{reference ? `${reference.ratedCurrentA} A` : "—"}</td>
                  <td className="font-mono font-semibold">{reference ? `${reference.maxWireMm2} mm²` : "—"}</td>
                  <td className="font-mono font-semibold">{reference?.screwSize ?? "—"}</td>
                  <td>{resultSummary(company, true)}</td>
                  <td className="text-[11px]">
                    {reference?.sourceUrl ? (
                      <a
                        href={reference.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 font-semibold text-accent hover:underline"
                      >
                        {reference.sourceTitle ?? "東洋技研 公式製品情報"}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <span className="text-muted-2">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
