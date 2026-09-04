"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { Check, Loader2, Plus, Trash2 } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { listManufacturers, preloadManufacturers } from "@/lib/mock/manufacturers";
import {
  calculationRecordService,
  flexibleSelectionService,
  matchFlexibleSelectionRule,
  type FlexibleSelectionNode,
  type FlexibleSelectionRuleRow,
  type FlexibleSelectionTemplate,
} from "@/lib/services";
import { MOTOR_SELECTION_BRANCH_CALCULATION_TYPE } from "./MotorBranchSelectionView";

interface Props {
  caseId: string;
}

interface SavedNodeSnapshot {
  key: string;
  label: string;
  unit?: string;
  parentKey?: string;
  order: number;
}

interface FlexibleSavedBranchItem {
  id: string;
  label: string;
  manufacturerId?: string;
  templateId: string;
  templateName: string;
  phase: string;
  voltageClass: string;
  startMethod: string;
  inputUnit: "kW" | "A";
  inputValue: number;
  matched: boolean;
  outputs: Record<string, unknown>;
  nodes: SavedNodeSnapshot[];
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

export function FlexibleMotorBranchSelectionView({ caseId }: Props) {
  const { locale } = useTranslation();
  const [, forceRerender] = useState(0);
  const [templates, setTemplates] = useState<FlexibleSelectionTemplate[]>([]);
  const [nodes, setNodes] = useState<FlexibleSelectionNode[]>([]);
  const [rules, setRules] = useState<FlexibleSelectionRuleRow[]>([]);
  const [items, setItems] = useState<FlexibleSavedBranchItem[]>([]);
  const [itemsLoaded, setItemsLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [manufacturerId, setManufacturerId] = useState("");
  const [phase, setPhase] = useState("");
  const [voltageClass, setVoltageClass] = useState("");
  const [startMethod, setStartMethod] = useState("");
  const [label, setLabel] = useState("");
  const [inputUnit, setInputUnit] = useState<"kW" | "A">("kW");
  const [inputRaw, setInputRaw] = useState("");
  const [matchedRule, setMatchedRule] = useState<FlexibleSelectionRuleRow | null | undefined>(undefined);
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());

  const copy = locale === "vi"
    ? {
        description: "Chọn cấu hình theo hãng → pha → điện áp → kiểu khởi động, sau đó nhập kW hoặc A. Kết quả được dựng theo cấu trúc xương cá đã tự thiết kế trong Cài đặt.",
        maker: "Hãng",
        phase: "Pha",
        voltage: "Điện áp",
        start: "Kiểu khởi động",
        circuitName: "Tên mạch / công dụng",
        input: "Đầu vào",
        calculate: "Chọn",
        add: "Thêm vào danh sách nhánh",
        display: "Mục hiển thị",
        result: "Kết quả xương cá",
        list: "Danh sách nhánh",
        noTemplates: "Chưa có cấu hình kW/A. Mở Cài đặt để tạo cấu hình và nhập dữ liệu chọn.",
        noCombination: "Không có template đúng tổ hợp đang chọn.",
        noRule: "Template có nhưng chưa có dòng dữ liệu phù hợp với giá trị này.",
        prompt: "Nhập kW/A rồi nhấn Chọn.",
        emptyList: "Chưa có mạch nào được thêm.",
        draft: "Không chọn 案件: danh sách chỉ là bản nháp trên màn hình và chưa lưu.",
        phaseSingle: "1 pha",
        phaseThree: "3 pha",
        direct: "Trực tiếp",
        starDelta: "Star-Delta",
        inverter: "INV",
        starDeltaInverter: "Star-Delta + INV",
        allHidden: "Bạn đang bỏ chọn toàn bộ mục hiển thị.",
      }
    : {
        description: "メーカー → 相数 → 電圧 → 始動方式を選び、kWまたはAを入力します。結果は設定で自由に作成したxương cá（系統樹）構造で表示します。",
        maker: "メーカー",
        phase: "相数",
        voltage: "電圧",
        start: "始動方式",
        circuitName: "回路名・用途",
        input: "入力",
        calculate: "選定する",
        add: "分岐リストへ追加",
        display: "表示項目",
        result: "xương cá選定結果",
        list: "分岐リスト",
        noTemplates: "kW/A選定テンプレートがありません。設定から回路テンプレートと選定データを登録してください。",
        noCombination: "選択した条件に一致するテンプレートがありません。",
        noRule: "テンプレートはありますが、この入力値に一致する選定データ行がありません。",
        prompt: "kW/Aを入力して「選定する」を押してください。",
        emptyList: "まだ回路が追加されていません。",
        draft: "案件未選択のため、この一覧は画面上の下書きで保存されません。",
        phaseSingle: "単相",
        phaseThree: "三相",
        direct: "直入れ",
        starDelta: "スター・デルタ",
        inverter: "インバーター",
        starDeltaInverter: "スター・デルタ + INV",
        allHidden: "表示項目がすべてOFFです。",
      };

  const manufacturers = listManufacturers();
  const activeTemplates = useMemo(() => templates.filter((t) => t.isActive), [templates]);
  const makerOptions = useMemo(() => unique(activeTemplates.map((t) => t.manufacturerId ?? "")), [activeTemplates]);
  const phaseOptions = useMemo(
    () => unique(activeTemplates.filter((t) => !manufacturerId || t.manufacturerId === manufacturerId).map((t) => t.phase)),
    [activeTemplates, manufacturerId],
  );
  const voltageOptions = useMemo(
    () => unique(activeTemplates.filter((t) => (!manufacturerId || t.manufacturerId === manufacturerId) && (!phase || t.phase === phase)).map((t) => t.voltageClass)),
    [activeTemplates, manufacturerId, phase],
  );
  const startOptions = useMemo(
    () => unique(activeTemplates.filter((t) => (!manufacturerId || t.manufacturerId === manufacturerId) && (!phase || t.phase === phase) && (!voltageClass || t.voltageClass === voltageClass)).map((t) => t.startMethod)),
    [activeTemplates, manufacturerId, phase, voltageClass],
  );

  const currentTemplate = useMemo(
    () => activeTemplates.find((t) =>
      (t.manufacturerId ?? "") === manufacturerId &&
      t.phase === phase &&
      t.voltageClass === voltageClass &&
      t.startMethod === startMethod,
    ),
    [activeTemplates, manufacturerId, phase, voltageClass, startMethod],
  );

  const outputNodes = useMemo(
    () => nodes.filter((n) => n.isActive && (n.role === "output" || n.role === "calculated")),
    [nodes],
  );

  function manufacturerName(id?: string): string {
    if (!id) return "—";
    const m = manufacturers.find((item) => item.id === id);
    if (!m) return id;
    return locale === "vi" && m.nameVi ? m.nameVi : m.name;
  }

  function phaseLabel(value: string): string {
    return value === "single" ? copy.phaseSingle : value === "three" ? copy.phaseThree : value;
  }

  function startLabel(value: string): string {
    if (value === "direct") return copy.direct;
    if (value === "starDelta") return copy.starDelta;
    if (value === "inverter") return copy.inverter;
    if (value === "starDeltaInverter") return copy.starDeltaInverter;
    return value;
  }

  useEffect(() => {
    preloadManufacturers().then(() => forceRerender((v) => v + 1));
    flexibleSelectionService.listTemplates("branch").then((list) => {
      setTemplates(list);
      const first = list.find((t) => t.isActive);
      if (first) {
        setManufacturerId(first.manufacturerId ?? "");
        setPhase(first.phase);
        setVoltageClass(first.voltageClass);
        setStartMethod(first.startMethod);
      }
    });
  }, []);

  useEffect(() => {
    if (!currentTemplate) {
      setNodes([]);
      setRules([]);
      setVisibleKeys(new Set());
      setMatchedRule(undefined);
      return;
    }
    let cancelled = false;
    Promise.all([
      flexibleSelectionService.listNodes(currentTemplate.id),
      flexibleSelectionService.listRules(currentTemplate.id),
    ]).then(([nextNodes, nextRules]) => {
      if (cancelled) return;
      setNodes(nextNodes);
      setRules(nextRules);
      setVisibleKeys(new Set(nextNodes.filter((n) => n.isActive && n.visibleDefault && (n.role === "output" || n.role === "calculated")).map((n) => n.nodeKey)));
      setMatchedRule(undefined);
    });
    return () => { cancelled = true; };
  }, [currentTemplate?.id]);

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
      const saved = (record?.result.items as FlexibleSavedBranchItem[] | undefined) ?? [];
      setItems(saved);
      setItemsLoaded(true);
    });
    return () => { cancelled = true; };
  }, [caseId]);

  useEffect(() => {
    if (phaseOptions.length > 0 && !phaseOptions.includes(phase)) setPhase(phaseOptions[0]);
  }, [phaseOptions, phase]);
  useEffect(() => {
    if (voltageOptions.length > 0 && !voltageOptions.includes(voltageClass)) setVoltageClass(voltageOptions[0]);
  }, [voltageOptions, voltageClass]);
  useEffect(() => {
    if (startOptions.length > 0 && !startOptions.includes(startMethod)) setStartMethod(startOptions[0]);
  }, [startOptions, startMethod]);

  async function persist(nextItems: FlexibleSavedBranchItem[]) {
    setItems(nextItems);
    if (!caseId) return;
    setSaving(true);
    try {
      await calculationRecordService.save(caseId, MOTOR_SELECTION_BRANCH_CALCULATION_TYPE, {}, { items: nextItems });
    } finally {
      setSaving(false);
    }
  }

  function calculate() {
    const value = Number(inputRaw);
    if (!currentTemplate || !Number.isFinite(value) || value <= 0) return;
    setMatchedRule(matchFlexibleSelectionRule(rules, inputUnit, value));
  }

  function addCurrent() {
    const value = Number(inputRaw);
    if (!currentTemplate || !matchedRule || !Number.isFinite(value) || value <= 0) return;
    const idByKey = new Map(nodes.map((node) => [node.id, node.nodeKey]));
    const snapshot: SavedNodeSnapshot[] = nodes
      .filter((node) => node.isActive && (node.role === "output" || node.role === "calculated"))
      .map((node) => ({
        key: node.nodeKey,
        label: node.label,
        unit: node.unit,
        parentKey: node.parentId ? idByKey.get(node.parentId) : undefined,
        order: node.order,
      }));
    const item: FlexibleSavedBranchItem = {
      id: crypto.randomUUID(),
      label: label.trim(),
      manufacturerId: currentTemplate.manufacturerId,
      templateId: currentTemplate.id,
      templateName: currentTemplate.name,
      phase: currentTemplate.phase,
      voltageClass: currentTemplate.voltageClass,
      startMethod: currentTemplate.startMethod,
      inputUnit,
      inputValue: value,
      matched: true,
      outputs: matchedRule.outputs,
      nodes: snapshot,
    };
    void persist([...items, item]);
    setLabel("");
    setInputRaw("");
    setMatchedRule(undefined);
  }

  function toggleVisible(key: string) {
    setVisibleKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  function nodeDepth(node: FlexibleSelectionNode): number {
    let depth = 0;
    let parentId = node.parentId;
    const visited = new Set<string>();
    while (parentId && depth < 8 && !visited.has(parentId)) {
      visited.add(parentId);
      depth += 1;
      parentId = nodes.find((candidate) => candidate.id === parentId)?.parentId;
    }
    return depth;
  }

  const canCalculate = Boolean(currentTemplate && inputRaw.trim() && Number(inputRaw) > 0);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[12px] text-muted">{copy.description}</p>
      {activeTemplates.length === 0 ? (
        <p className="rounded-md border border-warning/30 bg-warning/5 px-3 py-3 text-[12px] text-warning">{copy.noTemplates}</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-7 lg:items-end">
            <div><label className="field-label">{copy.circuitName}</label><input value={label} onChange={(e) => setLabel(e.target.value)} className="field-input" /></div>
            <div><label className="field-label">{copy.maker}</label><select value={manufacturerId} onChange={(e) => setManufacturerId(e.target.value)} className="field-input">{makerOptions.map((id) => <option key={id} value={id}>{manufacturerName(id)}</option>)}</select></div>
            <div><label className="field-label">{copy.phase}</label><select value={phase} onChange={(e) => setPhase(e.target.value)} className="field-input">{phaseOptions.map((value) => <option key={value}>{phaseLabel(value)}</option>)}</select></div>
            <div><label className="field-label">{copy.voltage}</label><select value={voltageClass} onChange={(e) => setVoltageClass(e.target.value)} className="field-input">{voltageOptions.map((value) => <option key={value}>{value}</option>)}</select></div>
            <div><label className="field-label">{copy.start}</label><select value={startMethod} onChange={(e) => setStartMethod(e.target.value)} className="field-input">{startOptions.map((value) => <option key={value} value={value}>{startLabel(value)}</option>)}</select></div>
            <div><label className="field-label">{copy.input}</label><div className="flex gap-1"><input type="number" min={0} step="any" value={inputRaw} onChange={(e) => setInputRaw(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") calculate(); }} className="field-input" /><select value={inputUnit} onChange={(e) => { setInputUnit(e.target.value as "kW" | "A"); setMatchedRule(undefined); }} className="field-input w-20"><option value="kW">kW</option><option value="A">A</option></select></div></div>
            <button type="button" onClick={calculate} disabled={!canCalculate} className="btn-primary">{copy.calculate}</button>
          </div>

          {!currentTemplate && <p className="text-[11px] text-warning">{copy.noCombination}</p>}

          {currentTemplate && outputNodes.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/5 px-3 py-2">
              <span className="mr-1 text-[11px] font-semibold text-muted">{copy.display}</span>
              {outputNodes.map((node) => (
                <button key={node.id} type="button" onClick={() => toggleVisible(node.nodeKey)} className={visibleKeys.has(node.nodeKey) ? "inline-flex items-center gap-1 rounded border border-accent bg-accent/10 px-2 py-1 text-[11px] font-semibold text-accent" : "inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-[11px] text-muted"}>
                  {visibleKeys.has(node.nodeKey) && <Check className="h-3 w-3" />}{node.label}
                </button>
              ))}
            </div>
          )}

          <div>
            <div className="flex items-center gap-2"><span className="panel-title">{copy.result}</span>{currentTemplate && <span className="rounded bg-surface-2 px-2 py-0.5 text-[10.5px] text-muted">{currentTemplate.name}</span>}</div>
            {matchedRule === undefined ? (
              <p className="mt-2 text-[12px] text-muted-2">{copy.prompt}</p>
            ) : matchedRule === null ? (
              <p className="mt-2 text-[12px] text-warning">{copy.noRule}</p>
            ) : visibleKeys.size === 0 ? (
              <p className="mt-2 text-[12px] text-muted-2">{copy.allHidden}</p>
            ) : (
              <div className="mt-3 rounded-lg border border-border bg-surface p-4">
                <div className="mb-3 flex items-center gap-2 text-[12px]"><span className="rounded border border-accent/40 bg-accent/10 px-3 py-1.5 font-semibold text-accent">{inputRaw} {inputUnit}</span><span className="h-px w-8 bg-border-strong" /></div>
                <div className="flex flex-col gap-1.5">
                  {outputNodes.filter((node) => visibleKeys.has(node.nodeKey) && matchedRule.outputs[node.nodeKey] != null).map((node) => {
                    const depth = nodeDepth(node);
                    return (
                      <div key={node.id} className="flex items-center" style={{ paddingLeft: `${depth * 26}px` }}>
                        {depth > 0 && <span className="mr-2 h-px w-5 bg-border-strong" />}
                        <div className="min-w-[170px] rounded-md border border-border bg-background px-3 py-2 text-[11.5px]">
                          <span className="text-muted">{node.label}</span>
                          <div className="font-mono text-[12px] font-semibold">{String(matchedRule.outputs[node.nodeKey])}{node.unit ? ` ${node.unit}` : ""}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <button type="button" onClick={addCurrent} className="btn-secondary mt-4"><Plus className="h-3.5 w-3.5" />{copy.add}</button>
              </div>
            )}
          </div>
        </>
      )}

      <div className="border-t border-border pt-4">
        <div className="flex items-center justify-between"><span className="panel-title">{copy.list}</span>{saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-2" />}</div>
        {!caseId && items.length > 0 && <p className="mt-1 text-[10.5px] text-warning">{copy.draft}</p>}
        <div className="data-table-wrap mt-2">
          <table className="data-table" style={{ minWidth: 1000 }}>
            <thead><tr><th style={{ width: 140 }}>{copy.circuitName}</th><th style={{ width: 120 }}>{copy.maker}</th><th style={{ width: 80 }}>{copy.phase}</th><th style={{ width: 80 }}>{copy.voltage}</th><th style={{ width: 120 }}>{copy.start}</th><th style={{ width: 90 }}>{copy.input}</th><th>{copy.result}</th><th style={{ width: 42 }} /></tr></thead>
            <tbody>
              {!itemsLoaded ? <tr><td colSpan={8} className="py-6 text-center text-muted">...</td></tr> : items.length === 0 ? <tr><td colSpan={8} className="py-6 text-center text-muted-2">{copy.emptyList}</td></tr> : items.map((item) => (
                <Fragment key={item.id}>
                  <tr>
                    <td>{item.label || "—"}</td><td>{manufacturerName(item.manufacturerId)}</td><td>{phaseLabel(item.phase)}</td><td>{item.voltageClass}</td><td>{startLabel(item.startMethod)}</td><td className="font-mono">{item.inputValue} {item.inputUnit}</td>
                    <td className="text-[11px]">{item.nodes.filter((node) => item.outputs[node.key] != null).map((node) => `${node.label}: ${String(item.outputs[node.key])}${node.unit ? ` ${node.unit}` : ""}`).join(" / ") || "—"}</td>
                    <td><button type="button" onClick={() => void persist(items.filter((row) => row.id !== item.id))} className="btn-ghost btn-icon text-danger"><Trash2 className="h-3.5 w-3.5" /></button></td>
                  </tr>
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
