"use client";

import { ExternalLink, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import {
  pickTerminalBlock,
  terminalBlockSelectionService,
  type TerminalBlockSelectionRow,
} from "@/lib/services";

export function TerminalBlockSelectionView() {
  const { locale } = useTranslation();
  const [rows, setRows] = useState<TerminalBlockSelectionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentRaw, setCurrentRaw] = useState("");
  const [selectedCurrent, setSelectedCurrent] = useState<number | null>(null);

  const copy = locale === "vi"
    ? {
        description: "Nhập dòng điện để chọn TB. Dữ liệu tham khảo dùng dòng AT của Toyogiken; cột công ty là giá trị nội bộ tự nhập trong cài đặt của tab TB.",
        current: "Dòng điện (A)",
        choose: "Chọn TB",
        result: "Kết quả chọn TB",
        source: "Tiêu chuẩn / tham khảo",
        company: "Tiêu chuẩn công ty",
        maker: "Hãng / series",
        model: "Model",
        rated: "Dòng định mức",
        maxWire: "Dây tối đa",
        screw: "Cỡ vít",
        basis: "Nguồn",
        none: "Không có TB phù hợp trong dữ liệu hiện tại.",
        noCompany: "Chưa nhập tiêu chuẩn công ty",
      }
    : {
        description: "電流(A)からTBを選定します。基準・参考は東洋技研 ATシリーズ公式値、社内基準はこのTBタブの設定で登録した採用値です。",
        current: "選定電流 (A)",
        choose: "TBを選定",
        result: "TB 選定結果",
        source: "基準・参考選定",
        company: "社内基準",
        maker: "メーカー / シリーズ",
        model: "型式",
        rated: "定格電流",
        maxWire: "適合電線 MAX",
        screw: "端子ねじ",
        basis: "根拠",
        none: "現在の登録データでは対応するTBがありません。",
        noCompany: "社内基準未登録",
      };

  useEffect(() => {
    let cancelled = false;
    terminalBlockSelectionService
      .list()
      .then((list) => {
        if (!cancelled) setRows(list);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const reference = useMemo(
    () => (selectedCurrent == null ? null : pickTerminalBlock(rows, selectedCurrent, "reference")),
    [rows, selectedCurrent],
  );
  const company = useMemo(
    () => (selectedCurrent == null ? null : pickTerminalBlock(rows, selectedCurrent, "company")),
    [rows, selectedCurrent],
  );

  function choose() {
    const value = Number(currentRaw);
    if (Number.isFinite(value) && value > 0) setSelectedCurrent(value);
  }

  function renderResult(row: TerminalBlockSelectionRow | null, companyMode = false) {
    if (!row) {
      return (
        <tr>
          <td colSpan={6} className={companyMode ? "text-warning" : "text-muted-2"}>
            {companyMode ? copy.noCompany : copy.none}
          </td>
        </tr>
      );
    }
    return (
      <tr>
        <td className="font-semibold">{row.manufacturer} / {row.series}</td>
        <td className="font-mono font-bold">{row.model}</td>
        <td className="font-mono">{row.ratedCurrentA} A</td>
        <td className="font-mono font-semibold">{row.maxWireMm2} mm²</td>
        <td className="font-mono font-semibold">{row.screwSize}</td>
        <td className="text-[11px]">
          {row.sourceUrl ? (
            <a href={row.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-accent hover:underline">
              {row.sourceTitle ?? copy.basis}
              <ExternalLink className="h-3 w-3" />
            </a>
          ) : (
            <span>{row.remarks || "—"}</span>
          )}
        </td>
      </tr>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[12px] text-muted">{copy.description}</p>
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

      <div className="flex items-center gap-2">
        <span className="panel-title">{copy.result}</span>
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-2" />}
        {selectedCurrent != null && <span className="rounded bg-accent/10 px-2 py-0.5 font-mono text-[11px] font-semibold text-accent">{selectedCurrent} A</span>}
      </div>

      {selectedCurrent != null && (
        <div className="flex flex-col gap-3">
          <div>
            <div className="mb-1 text-[11px] font-bold text-muted">{copy.source}</div>
            <div className="data-table-wrap">
              <table className="data-table" style={{ minWidth: 880 }}>
                <thead><tr><th>{copy.maker}</th><th>{copy.model}</th><th>{copy.rated}</th><th>{copy.maxWire}</th><th>{copy.screw}</th><th>{copy.basis}</th></tr></thead>
                <tbody>{renderResult(reference)}</tbody>
              </table>
            </div>
          </div>
          <div>
            <div className="mb-1 text-[11px] font-bold text-muted">{copy.company}</div>
            <div className="data-table-wrap">
              <table className="data-table" style={{ minWidth: 880 }}>
                <thead><tr><th>{copy.maker}</th><th>{copy.model}</th><th>{copy.rated}</th><th>{copy.maxWire}</th><th>{copy.screw}</th><th>{copy.basis}</th></tr></thead>
                <tbody>{renderResult(company, true)}</tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
