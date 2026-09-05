"use client";

import { Loader2, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { listManufacturers, preloadManufacturers } from "@/lib/mock/manufacturers";
import {
  calculationRecordService,
  matchMotorKwRows,
  motorKwSelectionService,
  type MotorKwBasisKind,
  type MotorKwPhase,
  type MotorKwSelectionRow,
} from "@/lib/services";
import type {
  MotorSelectionBranchItem,
  MotorStarterSelection,
  SelectionCircuitType,
  SelectionVoltageClass,
} from "@/lib/types";
import { MOTOR_SELECTION_BRANCH_CALCULATION_TYPE } from "./MotorBranchSelectionView";
import { CatalogComparison } from "./CatalogComparison";
import { STANDARD_KW } from "@/lib/calc/motorSelection/catalogSelection";
import { CORRECTION_PREFIX } from "@/lib/services/selectionCorrectionService";

interface Props { caseId: string; }

interface SavedMotorKwItem extends MotorSelectionBranchItem {
  circuitKind?: "motor" | "control" | "other";
  basisKind?: MotorKwBasisKind;
  sourceTitle?: string;
  sourceUrl?: string;
  breakerCondition?: string;
  naisenBasis?: string;
  jisBasis?: string;
  associationBasis?: string;
  sourceRemarks?: string;
}

const VOLTAGES: SelectionVoltageClass[] = ["100V", "200V", "400V"];
const METHODS: SelectionCircuitType[] = ["direct", "starDelta", "inverter"];
export function MotorKwSelectionView({ caseId }: Props) {
  const { locale } = useTranslation();
  const [, forceRerender] = useState(0);
  const [rows, setRows] = useState<MotorKwSelectionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<SavedMotorKwItem[]>([]);
  const [itemsLoaded, setItemsLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [label, setLabel] = useState("");
  const [phase, setPhase] = useState<MotorKwPhase>("three");
  const [voltage, setVoltage] = useState<SelectionVoltageClass>("200V");
  const [method, setMethod] = useState<SelectionCircuitType>("direct");
  const [kwRaw, setKwRaw] = useState("");
  const [selectedKw, setSelectedKw] = useState<number | null>(null);
  const [circuitCountRaw, setCircuitCountRaw] = useState("1");
  const [otherKind, setOtherKind] = useState<"control" | "other">("control");
  const [otherLabel, setOtherLabel] = useState("");
  const [otherCurrentRaw, setOtherCurrentRaw] = useState("");

  const copy = locale === "vi"
    ? {
        description: "Nhập công suất kW rồi so sánh Mitsubishi → Fuji → tiêu chuẩn công ty. Mitsubishi được đặt ưu tiên vì là hãng dùng chính. Chỉ hiện dữ liệu có nguồn; ô chưa xác minh sẽ ghi 要確認, không suy đoán.",
        name: "Tên mạch / công dụng",
        phase: "Pha",
        voltage: "Điện áp",
        method: "Kiểu khởi động",
        kw: "Công suất động cơ (kW)",
        choose: "Tra chọn",
        basis: "Nguồn chọn",
        maker: "Hãng",
        rated: "Dòng định mức",
        starting: "Dòng khởi động",
        breaker: "MCCB / NFB",
        breakerA: "Định mức MCCB",
        shortCircuit: "Điều kiện Icu / ngắn mạch",
        contactor: "MS / MC",
        thermal: "THR / OLR",
        heater: "Heater",
        inverter: "INV",
        wire: "Dây dẫn",
        ct: "CT",
        am: "AM",
        naisen: "Naisen / JEAC",
        jis: "JIS",
        association: "JSIA / JEMA",
        source: "Nguồn・ghi chú",
        adopt: "＋ Thêm phân nhánh",
        noData: "Chưa có dữ liệu chính thức đúng tổ hợp này — không tự suy đoán.",
        companyMissing: "Chưa có tiêu chuẩn công ty cho tổ hợp này.",
        result: "So sánh kết quả kW",
        saved: "Danh sách mạch đã chọn",
        empty: "Chưa có mạch nào.",
        draft: "Chưa chọn 案件: danh sách chỉ là bản nháp trên màn hình.",
        standards: "Nguồn quy định / tiêu chuẩn đang dùng",
        standardsNote: "JIS/JEAC/JSIA/JEMA dùng để xác định phạm vi và yêu cầu thiết bị; không lấy một tiêu chuẩn chung để tự bịa model. MCCB vẫn phải theo khả năng cắt yêu cầu và điều kiện thực tế.",
        mitsubishi: "Mitsubishi (ưu tiên)",
        fuji: "Fuji",
        company: "Công ty",
        otherTitle: "Mạch điều khiển・phân nhánh khác",
        otherHint: "Nhập trực tiếp dòng thiết kế A. Dòng này được cộng vào 主幹; breaker chỉ tự chọn khi có bảng breaker riêng đã xác minh.",
        control: "Mạch điều khiển",
        other: "Phân nhánh khác",
        currentA: "Dòng thiết kế (A)",
        addCircuit: "＋ Thêm mạch",
        circuitCount: "Số mạch",
        naisenColumn: "Tiêu chuẩn nội tuyến",
      }
    : {
        description: "電動機kWから三菱 → 富士 → 社内基準を比較します。通常使用の多い三菱を先頭に表示します。公開一次資料で直接確認できない欄は推定せず要確認にします。",
        name: "回路名・用途",
        phase: "相数",
        voltage: "電圧",
        method: "始動方式",
        kw: "電動機出力 (kW)",
        choose: "選定する",
        basis: "選定基準",
        maker: "メーカー",
        rated: "全負荷/定格電流",
        starting: "始動電流",
        breaker: "MCCB / NFB",
        breakerA: "MCCB定格",
        shortCircuit: "Icu・短絡容量条件",
        contactor: "MS / MC",
        thermal: "THR / OLR",
        heater: "ヒータ",
        inverter: "インバータ",
        wire: "接続電線",
        ct: "CT",
        am: "AM",
        naisen: "内線規程 / JEAC",
        jis: "JIS",
        association: "JSIA / JEMA",
        source: "根拠・備考",
        adopt: "＋ 分岐回路を追加",
        noData: "この組合せの確認済み公式データは未登録です。推定値は表示しません。",
        companyMissing: "この組合せの社内基準は未登録です。",
        result: "kW選定 比較結果",
        saved: "採用済み分岐リスト",
        empty: "まだ回路が追加されていません。",
        draft: "案件未選択のため、この一覧は画面上の下書きです。",
        standards: "参照中の国内規程・規格・公式選定資料",
        standardsNote: "JIS/JEAC/JSIA/JEMAは適用範囲・機器要求の根拠として表示します。単一規格から型式を推定しません。MCCBは必要遮断容量と実設備条件を確認して最終決定してください。",
        mitsubishi: "三菱（優先）",
        fuji: "富士",
        company: "社内基準",
        otherTitle: "制御回路・その他分岐",
        otherHint: "設計電流(A)を直接入力します。この電流は主幹合計に加算され、ブレーカは確認済みの専用選定表がある場合だけ自動選定します。",
        control: "制御回路",
        other: "その他分岐",
        currentA: "設計電流 (A)",
        addCircuit: "＋ 回路を追加",
        circuitCount: "回路数",
        naisenColumn: "内線基準",
      };

  const manufacturers = listManufacturers();
  const kw = selectedKw;
  const matchedRows = useMemo(
    () => kw == null ? [] : matchMotorKwRows(rows, phase, voltage, method, kw),
    [rows, phase, voltage, method, kw],
  );

  const rowByBasis = useMemo(() => ({
    company: matchedRows.find((row) => row.basisKind === "company" && !row.remarks?.startsWith(CORRECTION_PREFIX)) ?? null,
    mitsubishi: matchedRows.find((row) => row.basisKind === "mitsubishi") ?? null,
    fuji: matchedRows.find((row) => row.basisKind === "fuji") ?? null,
  }), [matchedRows]);
  function makerName(id?: string) {
    if (!id) return "—";
    const m = manufacturers.find((item) => item.id === id);
    if (!m) return id;
    return locale === "vi" && m.nameVi ? m.nameVi : m.name;
  }

  function basisLabel(value: MotorKwBasisKind) {
    return value === "mitsubishi" ? copy.mitsubishi : value === "fuji" ? copy.fuji : copy.company;
  }

  function methodLabel(value: SelectionCircuitType) {
    if (value === "direct") return locale === "vi" ? "Trực tiếp" : "直入れ";
    if (value === "starDelta") return locale === "vi" ? "Star-Delta" : "スター・デルタ";
    return locale === "vi" ? "Biến tần" : "インバータ";
  }

  useEffect(() => {
    preloadManufacturers().then(() => forceRerender((v) => v + 1));
    motorKwSelectionService.list().then(setRows).catch(() => setRows([])).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setItemsLoaded(false);
    if (!caseId) {
      setItems([]);
      setItemsLoaded(true);
      return;
    }
    let cancelled = false;
    calculationRecordService.get(caseId, MOTOR_SELECTION_BRANCH_CALCULATION_TYPE).then((record) => {
      if (cancelled) return;
      setItems((record?.result.items as SavedMotorKwItem[] | undefined) ?? []);
      setItemsLoaded(true);
    });
    return () => { cancelled = true; };
  }, [caseId]);

  async function persist(next: SavedMotorKwItem[]) {
    setItems(next);
    window.dispatchEvent(new CustomEvent("motor-branches-updated", { detail: { caseId, items: next } }));
    if (!caseId) return;
    setSaving(true);
    try {
      await calculationRecordService.save(caseId, MOTOR_SELECTION_BRANCH_CALCULATION_TYPE, {}, { items: next });
      window.dispatchEvent(new CustomEvent("motor-branches-updated", { detail: { caseId, items: next } }));
    } finally {
      setSaving(false);
    }
  }

  function choose() {
    const value = Number(kwRaw);
    if (!Number.isFinite(value) || value < 0.1) return;
    setSelectedKw(value);
  }

  function adopt(row: MotorKwSelectionRow) {
    if (!row.manufacturerId) return;
    const matchedRow: MotorStarterSelection = {
      id: row.id,
      manufacturerId: row.manufacturerId,
      voltageClass: row.voltageClass,
      circuitType: row.startMethod,
      motorKw: row.motorKw,
      ratedCurrent: row.ratedCurrentA ?? 0,
      breakerModel: row.breakerModel,
      breakerRatedCurrent: row.breakerRatedA,
      ctModel: row.ctModel,
      amRange: row.amRange,
      contactorModel: row.contactorModel,
      inverterModel: row.inverterModel,
      wireSize: row.wireSize,
      remarks: row.remarks,
      order: row.sortOrder,
    };
    const count = Math.max(1, Math.min(100, Math.floor(Number(circuitCountRaw) || 1)));
    const baseLabel = label.trim();
    const additions: SavedMotorKwItem[] = Array.from({ length: count }, (_, index) => ({
      id: crypto.randomUUID(),
      label: count > 1 && baseLabel ? `${baseLabel} #${index + 1}` : baseLabel,
      manufacturerId: row.manufacturerId!,
      voltageClass: row.voltageClass,
      circuitType: row.startMethod,
      inputUnit: "kW" as const,
      inputValue: row.motorKw,
      matched: true,
      matchedRow,
      circuitKind: "motor" as const,
      basisKind: row.basisKind,
      sourceTitle: row.source?.title,
      sourceUrl: row.source?.url,
      breakerCondition: row.breakerCondition,
      naisenBasis: row.naisenBasis,
      jisBasis: row.jisBasis,
      associationBasis: row.associationBasis,
      sourceRemarks: row.source?.remarks,
    }));
    void persist([...items, ...additions]);
    setLabel("");
    setCircuitCountRaw("1");
  }

  function addOtherCircuit() {
    const current = Number(otherCurrentRaw);
    if (!Number.isFinite(current) || current <= 0) return;
    const item: SavedMotorKwItem = {
      id: crypto.randomUUID(),
      label: otherLabel.trim() || (otherKind === "control" ? copy.control : copy.other),
      manufacturerId: "",
      voltageClass: voltage,
      circuitType: "direct",
      inputUnit: "A",
      inputValue: current,
      matched: false,
      circuitKind: otherKind,
      sourceRemarks: locale === "vi" ? "Chưa tự chọn breaker: cần bảng riêng đã xác minh." : "ブレーカ未自動選定：確認済み専用表が必要。",
    };
    void persist([...items, item]);
    setOtherLabel("");
    setOtherCurrentRaw("");
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="text-[12px] text-muted">{copy.description}</p>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-[1.2fr_.55fr_.65fr_.75fr_1fr_.8fr_auto] lg:items-end">
        <label><span className="field-label">{copy.name}</span><input className="field-input" value={label} onChange={(e) => setLabel(e.target.value)} /></label>
        <label><span className="field-label">{copy.circuitCount}</span><input className="field-input font-mono" type="number" min={1} max={100} step={1} value={circuitCountRaw} onChange={(e) => setCircuitCountRaw(e.target.value)} /></label>
        <label><span className="field-label">{copy.phase}</span><select className="field-input" value={phase} onChange={(e) => { setPhase(e.target.value as MotorKwPhase); setSelectedKw(null); }}><option value="three">{locale === "vi" ? "3 pha" : "三相"}</option><option value="single">{locale === "vi" ? "1 pha" : "単相"}</option></select></label>
        <label><span className="field-label">{copy.voltage}</span><select className="field-input" value={voltage} onChange={(e) => { setVoltage(e.target.value as SelectionVoltageClass); setSelectedKw(null); }}>{VOLTAGES.map((v) => <option key={v} value={v}>{v}</option>)}</select></label>
        <label><span className="field-label">{copy.method}</span><select className="field-input" value={method} onChange={(e) => { setMethod(e.target.value as SelectionCircuitType); setSelectedKw(null); }}>{METHODS.map((m) => <option key={m} value={m}>{methodLabel(m)}</option>)}</select></label>
        <label><span className="field-label">{copy.kw}</span><input className="field-input font-mono" type="number" min={0.1} step="any" list="selection-kw" value={kwRaw} onChange={(e) => setKwRaw(e.target.value)} onKeyDown={(e) => e.key === "Enter" && choose()} placeholder="例）0.1" /><datalist id="selection-kw">{[...new Set([...STANDARD_KW, ...rows.map(r => r.motorKw)])].sort((a,b)=>a-b).map(n=><option key={n} value={n}/>)}</datalist></label>
        <button type="button" className="btn-primary" onClick={choose} disabled={!Number.isFinite(Number(kwRaw)) || Number(kwRaw) < 0.1}>{copy.choose}</button>
      </div>

      <section className="rounded-lg border border-border bg-muted/5 p-3">
        <div className="text-[12px] font-bold">{copy.otherTitle}</div>
        <p className="mt-1 text-[10.5px] text-muted">{copy.otherHint}</p>
        <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:items-end">
          <label><span className="field-label">{copy.name}</span><input className="field-input" value={otherLabel} onChange={(e) => setOtherLabel(e.target.value)} /></label>
          <label><span className="field-label">{copy.basis}</span><select className="field-input" value={otherKind} onChange={(e) => setOtherKind(e.target.value as "control" | "other")}><option value="control">{copy.control}</option><option value="other">{copy.other}</option></select></label>
          <label><span className="field-label">{copy.currentA}</span><input className="field-input font-mono" type="number" min={0} step="any" value={otherCurrentRaw} onChange={(e) => setOtherCurrentRaw(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addOtherCircuit()} /></label>
          <button type="button" className="btn-secondary" onClick={addOtherCircuit} disabled={Number(otherCurrentRaw) <= 0}>{copy.addCircuit}</button>
        </div>
      </section>

      <section>
        <div className="flex items-center gap-2"><span className="panel-title">{copy.result}</span>{loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-2" />}{selectedKw != null && <span className="rounded bg-accent/10 px-2 py-0.5 font-mono text-[11px] font-semibold text-accent">{selectedKw} kW</span>}</div>
        {selectedKw == null ? (
          <p className="mt-2 text-[11px] text-muted-2">{locale === "vi" ? "Nhập kW và nhấn Tra chọn." : "kWを入力して「選定する」を押してください。"}</p>
        ) : (
          <CatalogComparison kw={selectedKw} voltage={voltage} method={method} phase={phase} company={rowByBasis.company} makerId={maker=>manufacturers.find(m=>m.name===(maker==='mitsubishi'?'三菱電機':'富士電機'))?.id} onAdopt={adopt} />
        )}
      </section>

      <section className="border-t border-border pt-4">
        <div className="flex items-center justify-between"><span className="panel-title">{copy.saved}</span>{saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-2" />}</div>
        {!caseId && items.length > 0 && <p className="mt-1 text-[10.5px] text-warning">{copy.draft}</p>}
        <div className="data-table-wrap mt-2">
          <table className="data-table" style={{ minWidth: 1250 }}>
            <thead><tr><th>{copy.name}</th><th>{copy.basis}</th><th>{copy.maker}</th><th>{copy.voltage}</th><th>{copy.method}</th><th>{copy.kw}</th><th>{copy.rated}</th><th>{copy.breaker}</th><th>{copy.contactor}</th><th>{copy.inverter}</th><th>{copy.source}</th><th /></tr></thead>
            <tbody>
              {!itemsLoaded ? <tr><td colSpan={12} className="py-6 text-center text-muted">...</td></tr> : items.length === 0 ? <tr><td colSpan={12} className="py-6 text-center text-muted-2">{copy.empty}</td></tr> : items.map((item) => (
                <tr key={item.id}>
                  <td>{item.label || "—"}</td><td>{item.basisKind ? basisLabel(item.basisKind) : item.circuitKind === "control" ? copy.control : copy.other}</td><td>{makerName(item.manufacturerId)}</td><td>{item.voltageClass}</td><td>{item.inputUnit === "A" ? "—" : methodLabel(item.circuitType)}</td><td className="font-mono">{item.inputValue} {item.inputUnit}</td><td className="font-mono">{item.matchedRow?.ratedCurrent ? `${item.matchedRow.ratedCurrent} A` : item.inputUnit === "A" ? `${item.inputValue} A` : "—"}</td><td>{item.matchedRow?.breakerModel ?? "要確認"}</td><td>{item.matchedRow?.contactorModel ?? "—"}</td><td>{item.matchedRow?.inverterModel ?? "—"}</td><td className="text-[10.5px]">{item.sourceUrl ? <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="text-accent hover:underline">{item.sourceTitle ?? "source"}</a> : item.sourceRemarks ?? "—"}</td><td><button type="button" className="btn-ghost btn-icon text-danger" onClick={() => void persist(items.filter((row) => row.id !== item.id))}><Trash2 className="h-3.5 w-3.5" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
