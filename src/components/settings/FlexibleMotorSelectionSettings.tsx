"use client";

import { Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { listManufacturers, preloadManufacturers } from "@/lib/mock/manufacturers";
import {
  flexibleSelectionService,
  type FlexibleSelectionNode,
  type FlexibleSelectionNodeDraft,
  type FlexibleSelectionRuleDraft,
  type FlexibleSelectionRuleRow,
  type FlexibleSelectionTemplate,
  type FlexibleSelectionTemplateDraft,
} from "@/lib/services";

const PHASES = ["single", "three"] as const;
const VOLTAGES = ["100V", "200V", "400V"] as const;
const START_METHODS = ["direct", "starDelta", "inverter", "starDeltaInverter"] as const;

function templateDraft(): FlexibleSelectionTemplateDraft {
  return {
    name: "",
    scope: "branch",
    manufacturerId: "",
    phase: "three",
    voltageClass: "200V",
    startMethod: "direct",
    isActive: true,
  };
}

function nodeDraft(templateId: string): FlexibleSelectionNodeDraft {
  return {
    templateId,
    parentId: "",
    nodeKey: `node_${crypto.randomUUID().slice(0, 8)}`,
    label: "",
    role: "output",
    valueType: "text",
    unit: "",
    isActive: true,
    visibleDefault: true,
  };
}

function ruleDraft(templateId: string): FlexibleSelectionRuleDraft {
  return {
    templateId,
    inputUnit: "kW",
    inputMin: undefined,
    inputMax: undefined,
    outputs: {},
    priority: 0,
    remarks: "",
  };
}

export function FlexibleMotorSelectionSettings() {
  const { locale } = useTranslation();
  const [, forceRerender] = useState(0);
  const [templates, setTemplates] = useState<FlexibleSelectionTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [nodes, setNodes] = useState<FlexibleSelectionNode[]>([]);
  const [rules, setRules] = useState<FlexibleSelectionRuleRow[]>([]);
  const [newTemplate, setNewTemplate] = useState<FlexibleSelectionTemplateDraft>(templateDraft());
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [newNode, setNewNode] = useState<FlexibleSelectionNodeDraft>(nodeDraft(""));
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [newRule, setNewRule] = useState<FlexibleSelectionRuleDraft>(ruleDraft(""));
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [outputDraft, setOutputDraft] = useState<Record<string, string>>({});

  const copy = locale === "vi"
    ? {
        description: "Thiết kế bảng chọn kW/A theo cấu trúc nhánh. Có thể tạo riêng theo hãng, pha, điện áp, kiểu khởi động; thêm/đổi tên nhánh và tự chọn mục mặc định hiển thị.",
        templates: "1. Cấu hình mạch",
        templateName: "Tên cấu hình",
        maker: "Hãng",
        phase: "Pha",
        voltage: "Điện áp",
        start: "Kiểu khởi động",
        addTemplate: "Thêm cấu hình",
        update: "Cập nhật",
        cancel: "Hủy sửa",
        nodes: "2. Cấu trúc nhánh / hạng mục kết quả",
        parent: "Nhánh cha",
        root: "Gốc",
        label: "Tên mục",
        role: "Loại node",
        unit: "Đơn vị",
        showDefault: "Mặc định hiển thị",
        addNode: "Thêm mục",
        rules: "3. Bảng dữ liệu chọn",
        inputUnit: "Đầu vào",
        min: "Từ",
        max: "Đến / ngưỡng chọn",
        values: "Giá trị kết quả",
        remarks: "Ghi chú",
        addRule: "Thêm dòng dữ liệu",
        emptyTemplate: "Chưa có cấu hình. Tạo cấu hình đầu tiên ở trên.",
        selectTemplate: "Chọn một cấu hình để thiết kế cấu trúc nhánh và nhập dữ liệu.",
        phaseSingle: "1 pha",
        phaseThree: "3 pha",
        direct: "Trực tiếp",
        starDelta: "Star-Delta",
        inverter: "INV",
        starDeltaInverter: "Star-Delta + INV",
        group: "Nhóm / nhánh",
        output: "Kết quả",
        calculated: "Tính toán",
        hint: "node_key được giữ cố định khi đổi tên, nên đổi tên mục không làm mất dữ liệu đã nhập.",
      }
    : {
        description: "kW/A選定を系統ツリーとして設計します。メーカー・相数・電圧・始動方式ごとに分け、枝の追加・名称変更・既定表示を自由に設定できます。",
        templates: "1. 回路テンプレート",
        templateName: "テンプレート名",
        maker: "メーカー",
        phase: "相数",
        voltage: "電圧",
        start: "始動方式",
        addTemplate: "テンプレート追加",
        update: "更新",
        cancel: "編集解除",
        nodes: "2. 系統ツリー / 出力項目",
        parent: "親ノード",
        root: "ルート",
        label: "項目名",
        role: "ノード種別",
        unit: "単位",
        showDefault: "既定表示",
        addNode: "項目追加",
        rules: "3. 選定データ表",
        inputUnit: "入力",
        min: "下限",
        max: "上限 / 選定しきい値",
        values: "選定結果",
        remarks: "備考",
        addRule: "データ行追加",
        emptyTemplate: "テンプレートがありません。上で最初のテンプレートを作成してください。",
        selectTemplate: "テンプレートを選択すると系統ツリーと選定データを編集できます。",
        phaseSingle: "単相",
        phaseThree: "三相",
        direct: "直入れ",
        starDelta: "スター・デルタ",
        inverter: "インバーター",
        starDeltaInverter: "スター・デルタ + INV",
        group: "グループ / 枝",
        output: "出力",
        calculated: "計算値",
        hint: "名称変更してもnode_keyは固定のため、登録済み選定データとの紐付けは失われません。",
      };

  const manufacturers = listManufacturers();
  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);
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

  function phaseLabel(value: string) {
    return value === "single" ? copy.phaseSingle : value === "three" ? copy.phaseThree : value;
  }

  function startLabel(value: string) {
    if (value === "direct") return copy.direct;
    if (value === "starDelta") return copy.starDelta;
    if (value === "inverter") return copy.inverter;
    if (value === "starDeltaInverter") return copy.starDeltaInverter;
    return value;
  }

  async function loadTemplates(preferId?: string) {
    const list = await flexibleSelectionService.listTemplates("branch");
    setTemplates(list);
    const next = preferId && list.some((t) => t.id === preferId)
      ? preferId
      : selectedTemplateId && list.some((t) => t.id === selectedTemplateId)
        ? selectedTemplateId
        : list[0]?.id ?? "";
    setSelectedTemplateId(next);
  }

  async function loadDetail(templateId: string) {
    if (!templateId) {
      setNodes([]);
      setRules([]);
      setNewNode(nodeDraft(""));
      setNewRule(ruleDraft(""));
      setOutputDraft({});
      return;
    }
    const [nextNodes, nextRules] = await Promise.all([
      flexibleSelectionService.listNodes(templateId),
      flexibleSelectionService.listRules(templateId),
    ]);
    setNodes(nextNodes);
    setRules(nextRules);
    setNewNode(nodeDraft(templateId));
    setNewRule(ruleDraft(templateId));
    setOutputDraft({});
  }

  useEffect(() => {
    preloadManufacturers().then(() => forceRerender((v) => v + 1));
    void loadTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void loadDetail(selectedTemplateId);
  }, [selectedTemplateId]);

  async function saveTemplate() {
    if (!newTemplate.name.trim() || !newTemplate.phase.trim() || !newTemplate.voltageClass.trim() || !newTemplate.startMethod.trim()) return;
    const saved = editingTemplateId
      ? await flexibleSelectionService.updateTemplate(editingTemplateId, newTemplate)
      : await flexibleSelectionService.createTemplate(newTemplate);
    setEditingTemplateId(null);
    setNewTemplate(templateDraft());
    await loadTemplates(saved.id);
  }

  function editTemplate(template: FlexibleSelectionTemplate) {
    setEditingTemplateId(template.id);
    setNewTemplate({
      name: template.name,
      scope: "branch",
      manufacturerId: template.manufacturerId ?? "",
      phase: template.phase,
      voltageClass: template.voltageClass,
      startMethod: template.startMethod,
      sourceId: template.sourceId,
      config: template.config,
      isActive: template.isActive,
    });
  }

  async function removeTemplate(id: string) {
    await flexibleSelectionService.removeTemplate(id);
    if (editingTemplateId === id) {
      setEditingTemplateId(null);
      setNewTemplate(templateDraft());
    }
    await loadTemplates();
  }

  async function saveNode() {
    if (!selectedTemplateId || !newNode.label.trim()) return;
    if (editingNodeId) await flexibleSelectionService.updateNode(editingNodeId, newNode);
    else await flexibleSelectionService.createNode(newNode);
    setEditingNodeId(null);
    await loadDetail(selectedTemplateId);
  }

  function editNode(node: FlexibleSelectionNode) {
    setEditingNodeId(node.id);
    setNewNode({
      templateId: node.templateId,
      parentId: node.parentId ?? "",
      nodeKey: node.nodeKey,
      label: node.label,
      role: node.role,
      valueType: node.valueType,
      unit: node.unit ?? "",
      config: node.config,
      isActive: node.isActive,
      visibleDefault: node.visibleDefault,
    });
  }

  async function removeNode(id: string) {
    await flexibleSelectionService.removeNode(id);
    if (editingNodeId === id) setEditingNodeId(null);
    await loadDetail(selectedTemplateId);
  }

  function cancelNodeEdit() {
    setEditingNodeId(null);
    setNewNode(nodeDraft(selectedTemplateId));
  }

  async function saveRule() {
    if (!selectedTemplateId || !newRule.inputUnit?.trim() || newRule.inputMax == null || newRule.inputMax <= 0) return;
    const outputs = Object.fromEntries(
      Object.entries(outputDraft)
        .map(([key, value]) => [key, value.trim()])
        .filter(([, value]) => value !== ""),
    );
    const draft = { ...newRule, templateId: selectedTemplateId, outputs };
    if (editingRuleId) await flexibleSelectionService.updateRule(editingRuleId, draft);
    else await flexibleSelectionService.createRule(draft);
    setEditingRuleId(null);
    await loadDetail(selectedTemplateId);
  }

  function editRule(rule: FlexibleSelectionRuleRow) {
    setEditingRuleId(rule.id);
    setNewRule({
      templateId: rule.templateId,
      sourceId: rule.sourceId,
      inputUnit: rule.inputUnit ?? "kW",
      inputMin: rule.inputMin,
      inputMax: rule.inputMax,
      conditions: rule.conditions,
      priority: rule.priority,
      remarks: rule.remarks ?? "",
    });
    setOutputDraft(
      Object.fromEntries(Object.entries(rule.outputs).map(([key, value]) => [key, String(value ?? "")])),
    );
  }

  async function removeRule(id: string) {
    await flexibleSelectionService.removeRule(id);
    if (editingRuleId === id) setEditingRuleId(null);
    await loadDetail(selectedTemplateId);
  }

  function cancelRuleEdit() {
    setEditingRuleId(null);
    setNewRule(ruleDraft(selectedTemplateId));
    setOutputDraft({});
  }

  function parentLabel(node: FlexibleSelectionNode): string {
    if (!node.parentId) return copy.root;
    return nodes.find((item) => item.id === node.parentId)?.label ?? copy.root;
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="text-[12px] text-muted">{copy.description}</p>

      <section className="flex flex-col gap-3">
        <span className="panel-title">{copy.templates}</span>
        {templates.length === 0 ? (
          <p className="text-[11px] text-muted-2">{copy.emptyTemplate}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {templates.map((template) => (
              <div key={template.id} className={`flex items-center rounded-md border ${selectedTemplateId === template.id ? "border-accent bg-accent/5" : "border-border"}`}>
                <button type="button" onClick={() => setSelectedTemplateId(template.id)} className="px-3 py-2 text-left text-[11.5px]">
                  <span className="font-semibold">{template.name}</span>
                  <span className="ml-2 text-muted">{manufacturerName(template.manufacturerId)} · {phaseLabel(template.phase)} · {template.voltageClass} · {startLabel(template.startMethod)}</span>
                </button>
                <button type="button" onClick={() => editTemplate(template)} className="btn-ghost btn-icon"><Pencil className="h-3.5 w-3.5" /></button>
                <button type="button" onClick={() => removeTemplate(template.id)} className="btn-ghost btn-icon text-danger"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-[1.3fr_1.1fr_.7fr_.8fr_1fr_auto_auto] lg:items-end">
          <div>
            <label className="field-label">{copy.templateName}</label>
            <input value={newTemplate.name} onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })} className="field-input" placeholder="例）富士 3φ 200V 直入" />
          </div>
          <div>
            <label className="field-label">{copy.maker}</label>
            <select value={newTemplate.manufacturerId ?? ""} onChange={(e) => setNewTemplate({ ...newTemplate, manufacturerId: e.target.value })} className="field-input">
              <option value="">—</option>
              {manufacturers.map((m) => <option key={m.id} value={m.id}>{locale === "vi" && m.nameVi ? m.nameVi : m.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">{copy.phase}</label>
            <select value={newTemplate.phase} onChange={(e) => setNewTemplate({ ...newTemplate, phase: e.target.value })} className="field-input">
              {PHASES.map((p) => <option key={p} value={p}>{phaseLabel(p)}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">{copy.voltage}</label>
            <select value={newTemplate.voltageClass} onChange={(e) => setNewTemplate({ ...newTemplate, voltageClass: e.target.value })} className="field-input">
              {VOLTAGES.map((v) => <option key={v}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">{copy.start}</label>
            <select value={newTemplate.startMethod} onChange={(e) => setNewTemplate({ ...newTemplate, startMethod: e.target.value })} className="field-input">
              {START_METHODS.map((s) => <option key={s} value={s}>{startLabel(s)}</option>)}
            </select>
          </div>
          <button type="button" onClick={saveTemplate} className="btn-secondary"><Plus className="h-3.5 w-3.5" />{editingTemplateId ? copy.update : copy.addTemplate}</button>
          {editingTemplateId && <button type="button" onClick={() => { setEditingTemplateId(null); setNewTemplate(templateDraft()); }} className="btn-ghost"><RotateCcw className="h-3.5 w-3.5" />{copy.cancel}</button>}
        </div>
      </section>

      {!selectedTemplate ? (
        <p className="border-t border-border pt-4 text-[12px] text-muted-2">{copy.selectTemplate}</p>
      ) : (
        <>
          <section className="flex flex-col gap-3 border-t border-border pt-4">
            <div className="flex items-center justify-between gap-3">
              <span className="panel-title">{copy.nodes}</span>
              <span className="text-[10.5px] text-muted-2">{copy.hint}</span>
            </div>
            <div className="data-table-wrap max-h-[28vh]">
              <table className="data-table" style={{ minWidth: 760 }}>
                <thead><tr><th>{copy.label}</th><th>{copy.parent}</th><th>{copy.role}</th><th>{copy.unit}</th><th>{copy.showDefault}</th><th style={{ width: 82 }} /></tr></thead>
                <tbody>
                  {nodes.length === 0 ? <tr><td colSpan={6} className="py-5 text-center text-muted-2">—</td></tr> : nodes.map((node) => (
                    <tr key={node.id} className={editingNodeId === node.id ? "bg-accent/5" : undefined}>
                      <td className="font-semibold">{node.label}</td><td className="text-muted">{parentLabel(node)}</td><td>{node.role === "group" ? copy.group : node.role === "calculated" ? copy.calculated : copy.output}</td><td>{node.unit || "—"}</td><td>{node.visibleDefault ? "✓" : "—"}</td>
                      <td><div className="flex justify-end gap-1"><button type="button" onClick={() => editNode(node)} className="btn-ghost btn-icon"><Pencil className="h-3.5 w-3.5" /></button><button type="button" onClick={() => removeNode(node.id)} className="btn-ghost btn-icon text-danger"><Trash2 className="h-3.5 w-3.5" /></button></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-[1.2fr_1fr_.8fr_.6fr_.8fr_auto_auto] lg:items-end">
              <div><label className="field-label">{copy.label}</label><input value={newNode.label} onChange={(e) => setNewNode({ ...newNode, label: e.target.value })} className="field-input" placeholder="例）電磁開閉器" /></div>
              <div><label className="field-label">{copy.parent}</label><select value={newNode.parentId ?? ""} onChange={(e) => setNewNode({ ...newNode, parentId: e.target.value })} className="field-input"><option value="">{copy.root}</option>{nodes.filter((n) => n.id !== editingNodeId).map((n) => <option key={n.id} value={n.id}>{n.label}</option>)}</select></div>
              <div><label className="field-label">{copy.role}</label><select value={newNode.role} onChange={(e) => setNewNode({ ...newNode, role: e.target.value as FlexibleSelectionNodeDraft["role"] })} className="field-input"><option value="group">{copy.group}</option><option value="output">{copy.output}</option><option value="calculated">{copy.calculated}</option></select></div>
              <div><label className="field-label">{copy.unit}</label><input value={newNode.unit ?? ""} onChange={(e) => setNewNode({ ...newNode, unit: e.target.value })} className="field-input" placeholder="A / mm²" /></div>
              <label className="flex items-center gap-2 pb-2 text-[11px]"><input type="checkbox" checked={newNode.visibleDefault ?? true} onChange={(e) => setNewNode({ ...newNode, visibleDefault: e.target.checked })} />{copy.showDefault}</label>
              <button type="button" onClick={saveNode} disabled={!newNode.label.trim()} className="btn-secondary"><Plus className="h-3.5 w-3.5" />{editingNodeId ? copy.update : copy.addNode}</button>
              {editingNodeId && <button type="button" onClick={cancelNodeEdit} className="btn-ghost"><RotateCcw className="h-3.5 w-3.5" />{copy.cancel}</button>}
            </div>
          </section>

          <section className="flex flex-col gap-3 border-t border-border pt-4">
            <span className="panel-title">{copy.rules}</span>
            <div className="data-table-wrap max-h-[30vh]">
              <table className="data-table" style={{ minWidth: Math.max(820, 360 + outputNodes.length * 150) }}>
                <thead><tr><th style={{ width: 70 }}>{copy.inputUnit}</th><th style={{ width: 90 }}>{copy.min}</th><th style={{ width: 110 }}>{copy.max}</th>{outputNodes.map((node) => <th key={node.id}>{node.label}</th>)}<th>{copy.remarks}</th><th style={{ width: 82 }} /></tr></thead>
                <tbody>
                  {rules.length === 0 ? <tr><td colSpan={5 + outputNodes.length} className="py-5 text-center text-muted-2">—</td></tr> : rules.map((rule) => (
                    <tr key={rule.id} className={editingRuleId === rule.id ? "bg-accent/5" : undefined}>
                      <td>{rule.inputUnit || "—"}</td><td className="font-mono">{rule.inputMin ?? "—"}</td><td className="font-mono">{rule.inputMax ?? "—"}</td>{outputNodes.map((node) => <td key={node.id} className="font-mono text-[11px]">{rule.outputs[node.nodeKey] == null ? "—" : String(rule.outputs[node.nodeKey])}</td>)}<td className="text-muted">{rule.remarks || "—"}</td>
                      <td><div className="flex justify-end gap-1"><button type="button" onClick={() => editRule(rule)} className="btn-ghost btn-icon"><Pencil className="h-3.5 w-3.5" /></button><button type="button" onClick={() => removeRule(rule.id)} className="btn-ghost btn-icon text-danger"><Trash2 className="h-3.5 w-3.5" /></button></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 lg:grid-cols-5">
              <div><label className="field-label">{copy.inputUnit}</label><select value={newRule.inputUnit ?? "kW"} onChange={(e) => setNewRule({ ...newRule, inputUnit: e.target.value })} className="field-input"><option value="kW">kW</option><option value="A">A</option></select></div>
              <div><label className="field-label">{copy.min}</label><input type="number" step="any" value={newRule.inputMin ?? ""} onChange={(e) => setNewRule({ ...newRule, inputMin: e.target.value === "" ? undefined : Number(e.target.value) })} className="field-input" /></div>
              <div><label className="field-label">{copy.max}</label><input type="number" min={0} step="any" value={newRule.inputMax ?? ""} onChange={(e) => setNewRule({ ...newRule, inputMax: e.target.value === "" ? undefined : Number(e.target.value) })} className="field-input" /></div>
              {outputNodes.map((node) => <div key={node.id}><label className="field-label">{node.label}{node.unit ? ` (${node.unit})` : ""}</label><input value={outputDraft[node.nodeKey] ?? ""} onChange={(e) => setOutputDraft({ ...outputDraft, [node.nodeKey]: e.target.value })} className="field-input" /></div>)}
              <div className="md:col-span-2"><label className="field-label">{copy.remarks}</label><input value={newRule.remarks ?? ""} onChange={(e) => setNewRule({ ...newRule, remarks: e.target.value })} className="field-input" /></div>
            </div>
            <div className="flex gap-2"><button type="button" onClick={saveRule} disabled={!newRule.inputUnit || !newRule.inputMax || newRule.inputMax <= 0} className="btn-secondary"><Plus className="h-3.5 w-3.5" />{editingRuleId ? copy.update : copy.addRule}</button>{editingRuleId && <button type="button" onClick={cancelRuleEdit} className="btn-ghost"><RotateCcw className="h-3.5 w-3.5" />{copy.cancel}</button>}</div>
          </section>
        </>
      )}
    </div>
  );
}
