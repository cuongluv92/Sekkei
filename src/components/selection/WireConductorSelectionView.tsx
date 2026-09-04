"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import {
  busbarSizeService,
  calculationRecordService,
  pickWireConductorSelection,
  wireConductorSelectionService,
  type WireConductorSelectionRow,
  type WireConductorWireType,
} from "@/lib/services";
import type { BusbarSize, MotorSelectionBranchItem } from "@/lib/types";
import { branchItemCurrentA, MOTOR_SELECTION_BRANCH_CALCULATION_TYPE } from "./MotorBranchSelectionView";
import { requiredCrossSectionArea } from "@/lib/calc/busbar/currentDensityRule";
import { findBusbarCandidates } from "@/lib/calc/busbar/candidateSearch";

interface Props {
  caseId: string;
}

interface ResultTarget {
  key: string;
  label: string;
  itemKind: "wire" | "busbar";
  wireType?: WireConductorWireType;
}

const TARGETS: ResultTarget[] = [
  { key: "iv", label: "IV", itemKind: "wire", wireType: "IV" },
  { key: "wl1", label: "WL1", itemKind: "wire", wireType: "WL1" },
  { key: "busbar", label: "銅帯", itemKind: "busbar" },
];

export function WireConductorSelectionView({ caseId }: Props) {
  const { locale } = useTranslation();
  const [rows, setRows] = useState<WireConductorSelectionRow[]>([]);
  const [busbarSizes, setBusbarSizes] = useState<BusbarSize[]>([]);
  const [loading, setLoading] = useState(true);
  const [branchTotal, setBranchTotal] = useState<number | null>(null);
  const [currentRaw, setCurrentRaw] = useState("");
  const [selectedCurrent, setSelectedCurrent] = useState<number | null>(null);

  const copy = locale === "vi"
    ? {
        description:
          "Nhập dòng điện A để chọn dây và thanh đồng. IV/WL1 dùng bảng tham khảo có nguồn; thanh đồng dùng trực tiếp logic tính ở mục Tính toán rồi trả kết quả ngay tại đây. Cột công ty là dữ liệu nội bộ tự nhập.",
        autoSum: "Tổng dòng từ danh sách nhánh",
        autoHint: "Có thể dùng trực tiếp tổng dòng đã lưu ở tab Nhánh (mạch động cơ).",
        use: "Dùng giá trị này",
        current: "Dòng điện cần chọn (A)",
        placeholder: "Ví dụ: 150",
        calculate: "Chọn",
        result: "Kết quả chọn dây / thanh đồng",
        item: "Loại",
        reference: "Tiêu chuẩn / dữ liệu tham khảo",
        company: "Tiêu chuẩn công ty",
        basis: "Nguồn và điều kiện",
        noReference: "Chưa có dữ liệu tham khảo",
        noCompany: "Chưa nhập tiêu chuẩn công ty",
        maxCurrent: "đến {value} A",
        prompt: "Nhập A để xem kết quả.",
        requiredArea: "Tiết diện yêu cầu",
        outOfRange: "Ngoài phạm vi bảng tham khảo hiện tại (>630A), không tự ngoại suy.",
        noBusbarSize: "Đã tính được tiết diện yêu cầu nhưng chưa có kích thước thanh đồng trong master để chọn kích thước thực.",
        note:
          "IV/WL1 phụ thuộc điều kiện lắp đặt và sản phẩm. Với thanh đồng, phần tính kỹ thuật được dùng chung từ mục Tính toán; master kích thước chỉ dùng ở bước chọn kích thước thực tế, không thay thế công thức kỹ thuật.",
      }
    : {
        description:
          "電流(A)から電線・銅帯を選定します。IV/WL1は出典付き参考表、銅帯は「計算」側の技術ロジックをそのまま共用し、この画面内で自動結果を返します。社内基準は会社登録値です。",
        autoSum: "分岐リストからの合計電流",
        autoHint: "分岐（電動機回路）に保存した電流合計をそのまま利用できます。",
        use: "この値を使う",
        current: "選定電流 (A)",
        placeholder: "例）150",
        calculate: "選定する",
        result: "電線・銅帯 選定結果",
        item: "種類",
        reference: "基準・参考選定",
        company: "社内基準",
        basis: "根拠・適用条件",
        noReference: "参考基準データ未登録",
        noCompany: "社内基準未登録",
        maxCurrent: "{value} Aまで",
        prompt: "電流(A)を入力して選定してください。",
        requiredArea: "必要断面積",
        outOfRange: "現在の参考計算範囲外（630A超）です。延長推定は行いません。",
        noBusbarSize: "必要断面積は計算済みですが、実サイズを選ぶための銅帯サイズマスタが未登録です。",
        note:
          "IV/WL1の許容電流は布設条件・周囲温度・製品メーカー等で変わります。銅帯は「計算」側の技術ロジックを共用し、サイズマスタは技術条件を満たした後の実サイズ選定にだけ使います。",
      };

  useEffect(() => {
    let cancelled = false;
    Promise.all([wireConductorSelectionService.list(), busbarSizeService.list()])
      .then(([list, sizes]) => {
        if (cancelled) return;
        setRows(list);
        setBusbarSizes(sizes);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setBranchTotal(null);
    if (!caseId) return;
    let cancelled = false;
    calculationRecordService.get(caseId, MOTOR_SELECTION_BRANCH_CALCULATION_TYPE).then((record) => {
      if (cancelled) return;
      const items = (record?.result.items as MotorSelectionBranchItem[] | undefined) ?? [];
      const sum = items.reduce((total, item) => {
        const current = branchItemCurrentA(item);
        return current == null ? total : total + current;
      }, 0);
      setBranchTotal(sum);
    });
    return () => {
      cancelled = true;
    };
  }, [caseId]);

  const results = useMemo(() => {
    if (selectedCurrent == null) return [];
    return TARGETS.map((target) => ({
      ...target,
      reference: pickWireConductorSelection(
        rows,
        selectedCurrent,
        "reference",
        target.itemKind,
        target.wireType,
      ),
      company: pickWireConductorSelection(
        rows,
        selectedCurrent,
        "company",
        target.itemKind,
        target.wireType,
      ),
    }));
  }, [rows, selectedCurrent]);

  const autoBusbar = useMemo(() => {
    if (selectedCurrent == null) return null;
    const required = requiredCrossSectionArea(selectedCurrent);
    if (!required.inRange) return { inRange: false as const };
    const candidate = findBusbarCandidates(
      busbarSizes,
      required.requiredAreaMm2,
      selectedCurrent,
      1,
    )[0] ?? null;
    return { inRange: true as const, required, candidate };
  }, [selectedCurrent, busbarSizes]);

  function choose() {
    const value = Number(currentRaw);
    if (!Number.isFinite(value) || value <= 0) return;
    setSelectedCurrent(value);
  }

  function useBranchTotal() {
    if (branchTotal == null || branchTotal <= 0) return;
    setCurrentRaw(String(Number(branchTotal.toFixed(2))));
    setSelectedCurrent(branchTotal);
  }

  function maxCurrentText(value: number): string {
    return copy.maxCurrent.replace("{value}", String(value));
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[12px] text-muted">{copy.description}</p>

      {caseId && branchTotal !== null && (
        <div className="flex flex-col gap-1 rounded-md border border-border bg-muted/10 px-3 py-2">
          <div className="flex items-center gap-2 text-[12px]">
            <span className="text-muted">{copy.autoSum}</span>
            <span className="font-mono font-semibold">{branchTotal.toFixed(1)} A</span>
            <button type="button" onClick={useBranchTotal} className="btn-ghost ml-auto">
              {copy.use}
            </button>
          </div>
          <p className="text-[11px] text-muted-2">{copy.autoHint}</p>
        </div>
      )}

      <div className="grid grid-cols-[minmax(180px,320px)_auto] items-end gap-2.5">
        <div>
          <label className="field-label">{copy.current}</label>
          <input
            type="number"
            min={0}
            step="any"
            value={currentRaw}
            onChange={(e) => setCurrentRaw(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") choose();
            }}
            placeholder={copy.placeholder}
            className="field-input"
          />
        </div>
        <button
          type="button"
          onClick={choose}
          disabled={!currentRaw.trim() || Number(currentRaw) <= 0}
          className="btn-primary"
        >
          {copy.calculate}
        </button>
      </div>

      <div>
        <div className="flex items-center gap-2">
          <span className="panel-title">{copy.result}</span>
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-2" />}
          {selectedCurrent != null && (
            <span className="rounded bg-accent/10 px-2 py-0.5 font-mono text-[11px] font-semibold text-accent">
              {selectedCurrent} A
            </span>
          )}
        </div>

        {selectedCurrent == null ? (
          <p className="mt-2 text-[12px] text-muted-2">{copy.prompt}</p>
        ) : (
          <div className="data-table-wrap mt-2">
            <table className="data-table" style={{ minWidth: 980 }}>
              <thead>
                <tr>
                  <th style={{ width: "100px" }}>{copy.item}</th>
                  <th style={{ width: "260px" }}>{copy.reference}</th>
                  <th style={{ width: "230px" }}>{copy.company}</th>
                  <th>{copy.basis}</th>
                </tr>
              </thead>
              <tbody>
                {results.map((row) => {
                  const isBusbar = row.key === "busbar";
                  return (
                    <tr key={row.key}>
                      <td className="font-semibold">{row.label}</td>
                      <td>
                        {isBusbar ? (
                          autoBusbar?.inRange ? (
                            <div className="flex flex-col gap-0.5">
                              <span className="font-mono font-semibold">
                                {autoBusbar.candidate
                                  ? `${autoBusbar.candidate.thicknessMm} × ${autoBusbar.candidate.widthMm} mm × ${autoBusbar.candidate.barsPerPhase}`
                                  : `${copy.requiredArea}: ${autoBusbar.required.requiredAreaMm2.toFixed(2)} mm²`}
                              </span>
                              {!autoBusbar.candidate && <span className="text-[10.5px] text-warning">{copy.noBusbarSize}</span>}
                              <span className="text-[10.5px] text-muted">{copy.requiredArea}: {autoBusbar.required.requiredAreaMm2.toFixed(2)} mm²</span>
                            </div>
                          ) : (
                            <span className="text-warning">{copy.outOfRange}</span>
                          )
                        ) : row.reference ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="font-mono font-semibold">{row.reference.resultValue}</span>
                            <span className="text-[10.5px] text-muted">{maxCurrentText(row.reference.currentA)}</span>
                          </div>
                        ) : (
                          <span className="text-muted-2">{copy.noReference}</span>
                        )}
                      </td>
                      <td>
                        {row.company ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="font-mono font-semibold">{row.company.resultValue}</span>
                            <span className="text-[10.5px] text-muted">{maxCurrentText(row.company.currentA)}</span>
                          </div>
                        ) : (
                          <span className="text-warning">{copy.noCompany}</span>
                        )}
                      </td>
                      <td className="text-[11px]">
                        {isBusbar && autoBusbar?.inRange ? (
                          <div className="flex flex-col gap-1">
                            <span className="font-semibold">{autoBusbar.required.source.standard} {autoBusbar.required.source.edition}</span>
                            <span className="text-muted">{autoBusbar.required.source.reference}</span>
                            {!autoBusbar.required.source.verified && <span className="text-warning">要確認 / 参考値</span>}
                          </div>
                        ) : row.reference ? (
                          <div className="flex flex-col gap-1">
                            {row.reference.source?.url ? (
                              <a
                                href={row.reference.source.url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 font-semibold text-accent hover:underline"
                              >
                                {row.reference.source.title}
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            ) : (
                              <span className="font-semibold">{row.reference.source?.title ?? "—"}</span>
                            )}
                            {row.reference.conditionLabel && (
                              <span className="text-muted">{row.reference.conditionLabel}</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-2">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="rounded-md border border-warning/30 bg-warning/5 px-3 py-2 text-[11px] text-muted">
        {copy.note}
      </p>
    </div>
  );
}
