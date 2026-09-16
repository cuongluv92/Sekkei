import { requireSupabase } from "@/lib/supabase/client";

export type FlexibleSelectionScope = "branch" | "main";
export type FlexibleSelectionNodeRole = "input" | "output" | "calculated" | "group";
export type FlexibleSelectionValueType = "text" | "number" | "boolean" | "select";

export interface FlexibleSelectionTemplate {
  id: string;
  name: string;
  scope: FlexibleSelectionScope;
  manufacturerId?: string;
  phase: string;
  voltageClass: string;
  startMethod: string;
  sourceId?: string;
  config: Record<string, unknown>;
  isActive: boolean;
  order: number;
}

export interface FlexibleSelectionNode {
  id: string;
  templateId: string;
  parentId?: string;
  nodeKey: string;
  label: string;
  role: FlexibleSelectionNodeRole;
  valueType: FlexibleSelectionValueType;
  unit?: string;
  config: Record<string, unknown>;
  isActive: boolean;
  visibleDefault: boolean;
  order: number;
}

export interface FlexibleSelectionRuleRow {
  id: string;
  templateId: string;
  sourceId?: string;
  ruleKind: "lookup" | "aggregate" | "formula";
  inputUnit?: string;
  inputMin?: number;
  inputMax?: number;
  conditions: Record<string, unknown>;
  outputs: Record<string, unknown>;
  expression?: Record<string, unknown>;
  priority: number;
  order: number;
  remarks?: string;
}

export interface FlexibleSelectionTemplateDraft {
  name: string;
  scope?: FlexibleSelectionScope;
  manufacturerId?: string;
  phase: string;
  voltageClass: string;
  startMethod: string;
  sourceId?: string;
  config?: Record<string, unknown>;
  isActive?: boolean;
}

export interface FlexibleSelectionNodeDraft {
  templateId: string;
  parentId?: string;
  nodeKey: string;
  label: string;
  role: FlexibleSelectionNodeRole;
  valueType?: FlexibleSelectionValueType;
  unit?: string;
  config?: Record<string, unknown>;
  isActive?: boolean;
  visibleDefault?: boolean;
}

export interface FlexibleSelectionRuleDraft {
  templateId: string;
  sourceId?: string;
  inputUnit?: string;
  inputMin?: number;
  inputMax?: number;
  conditions?: Record<string, unknown>;
  outputs?: Record<string, unknown>;
  priority?: number;
  remarks?: string;
}

interface TemplateRow {
  id: string;
  name: string;
  scope: string;
  manufacturer_id: string | null;
  phase: string;
  voltage_class: string;
  start_method: string;
  source_id: string | null;
  config: Record<string, unknown> | null;
  is_active: boolean;
  sort_order: number;
}

interface NodeRow {
  id: string;
  template_id: string;
  parent_id: string | null;
  node_key: string;
  label: string;
  role: string;
  value_type: string;
  unit: string | null;
  config: Record<string, unknown> | null;
  is_active: boolean;
  visible_default: boolean;
  sort_order: number;
}

interface RuleRow {
  id: string;
  template_id: string;
  source_id: string | null;
  rule_kind: string;
  input_unit: string | null;
  input_min: number | null;
  input_max: number | null;
  conditions: Record<string, unknown> | null;
  outputs: Record<string, unknown> | null;
  expression: Record<string, unknown> | null;
  priority: number;
  sort_order: number;
  remarks: string | null;
}

function fromTemplate(row: TemplateRow): FlexibleSelectionTemplate {
  return {
    id: row.id,
    name: row.name,
    scope: row.scope as FlexibleSelectionScope,
    manufacturerId: row.manufacturer_id ?? undefined,
    phase: row.phase,
    voltageClass: row.voltage_class,
    startMethod: row.start_method,
    sourceId: row.source_id ?? undefined,
    config: row.config ?? {},
    isActive: row.is_active,
    order: row.sort_order,
  };
}

function fromNode(row: NodeRow): FlexibleSelectionNode {
  return {
    id: row.id,
    templateId: row.template_id,
    parentId: row.parent_id ?? undefined,
    nodeKey: row.node_key,
    label: row.label,
    role: row.role as FlexibleSelectionNodeRole,
    valueType: row.value_type as FlexibleSelectionValueType,
    unit: row.unit ?? undefined,
    config: row.config ?? {},
    isActive: row.is_active,
    visibleDefault: row.visible_default,
    order: row.sort_order,
  };
}

function fromRule(row: RuleRow): FlexibleSelectionRuleRow {
  return {
    id: row.id,
    templateId: row.template_id,
    sourceId: row.source_id ?? undefined,
    ruleKind: row.rule_kind as "lookup" | "aggregate" | "formula",
    inputUnit: row.input_unit ?? undefined,
    inputMin: row.input_min == null ? undefined : Number(row.input_min),
    inputMax: row.input_max == null ? undefined : Number(row.input_max),
    conditions: row.conditions ?? {},
    outputs: row.outputs ?? {},
    expression: row.expression ?? undefined,
    priority: row.priority,
    order: row.sort_order,
    remarks: row.remarks ?? undefined,
  };
}

async function nextOrder(table: string, filters: Record<string, string> = {}): Promise<number> {
  let query = requireSupabase().from(table).select("sort_order");
  for (const [key, value] of Object.entries(filters)) query = query.eq(key, value);
  const { data } = await query.order("sort_order", { ascending: false }).limit(1).maybeSingle();
  return data ? Number(data.sort_order) + 1 : 0;
}

export function matchFlexibleSelectionRule(
  rules: FlexibleSelectionRuleRow[],
  inputUnit: string,
  inputValue: number,
): FlexibleSelectionRuleRow | null {
  const normalizedUnit = inputUnit.trim().toLowerCase();
  const candidates = rules
    .filter((row) => {
      if (row.ruleKind !== "lookup") return false;
      if ((row.inputUnit ?? "").trim().toLowerCase() !== normalizedUnit) return false;
      if (row.inputMin != null && inputValue < row.inputMin) return false;
      if (row.inputMax != null && inputValue > row.inputMax) return false;
      return true;
    })
    .sort((a, b) => {
      if (a.priority !== b.priority) return b.priority - a.priority;
      const aMax = a.inputMax ?? Number.POSITIVE_INFINITY;
      const bMax = b.inputMax ?? Number.POSITIVE_INFINITY;
      if (aMax !== bMax) return aMax - bMax;
      return a.order - b.order;
    });
  return candidates[0] ?? null;
}

export const flexibleSelectionService = {
  async listTemplates(scope: FlexibleSelectionScope = "branch"): Promise<FlexibleSelectionTemplate[]> {
    const { data, error } = await requireSupabase()
      .from("selection_templates")
      .select("*")
      .eq("scope", scope)
      .order("sort_order", { ascending: true });
    if (error) throw error;
    return ((data ?? []) as TemplateRow[]).map(fromTemplate);
  },

  async createTemplate(draft: FlexibleSelectionTemplateDraft): Promise<FlexibleSelectionTemplate> {
    const order = await nextOrder("selection_templates", { scope: draft.scope ?? "branch" });
    const { data, error } = await requireSupabase()
      .from("selection_templates")
      .insert({
        name: draft.name.trim(),
        scope: draft.scope ?? "branch",
        manufacturer_id: draft.manufacturerId || null,
        phase: draft.phase.trim(),
        voltage_class: draft.voltageClass.trim(),
        start_method: draft.startMethod.trim(),
        source_id: draft.sourceId || null,
        config: draft.config ?? {},
        is_active: draft.isActive ?? true,
        sort_order: order,
      })
      .select()
      .single();
    if (error) throw error;
    return fromTemplate(data as TemplateRow);
  },

  async updateTemplate(id: string, draft: FlexibleSelectionTemplateDraft): Promise<FlexibleSelectionTemplate> {
    const { data, error } = await requireSupabase()
      .from("selection_templates")
      .update({
        name: draft.name.trim(),
        manufacturer_id: draft.manufacturerId || null,
        phase: draft.phase.trim(),
        voltage_class: draft.voltageClass.trim(),
        start_method: draft.startMethod.trim(),
        source_id: draft.sourceId || null,
        config: draft.config ?? {},
        is_active: draft.isActive ?? true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return fromTemplate(data as TemplateRow);
  },

  async removeTemplate(id: string): Promise<void> {
    const { error } = await requireSupabase().from("selection_templates").delete().eq("id", id);
    if (error) throw error;
  },

  async listNodes(templateId: string): Promise<FlexibleSelectionNode[]> {
    const { data, error } = await requireSupabase()
      .from("selection_nodes")
      .select("*")
      .eq("template_id", templateId)
      .order("sort_order", { ascending: true });
    if (error) throw error;
    return ((data ?? []) as NodeRow[]).map(fromNode);
  },

  async createNode(draft: FlexibleSelectionNodeDraft): Promise<FlexibleSelectionNode> {
    const order = await nextOrder("selection_nodes", { template_id: draft.templateId });
    const { data, error } = await requireSupabase()
      .from("selection_nodes")
      .insert({
        template_id: draft.templateId,
        parent_id: draft.parentId || null,
        node_key: draft.nodeKey,
        label: draft.label.trim(),
        role: draft.role,
        value_type: draft.valueType ?? "text",
        unit: draft.unit?.trim() || null,
        config: draft.config ?? {},
        is_active: draft.isActive ?? true,
        visible_default: draft.visibleDefault ?? true,
        sort_order: order,
      })
      .select()
      .single();
    if (error) throw error;
    return fromNode(data as NodeRow);
  },

  async updateNode(id: string, draft: FlexibleSelectionNodeDraft): Promise<FlexibleSelectionNode> {
    const { data, error } = await requireSupabase()
      .from("selection_nodes")
      .update({
        parent_id: draft.parentId || null,
        label: draft.label.trim(),
        role: draft.role,
        value_type: draft.valueType ?? "text",
        unit: draft.unit?.trim() || null,
        config: draft.config ?? {},
        is_active: draft.isActive ?? true,
        visible_default: draft.visibleDefault ?? true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return fromNode(data as NodeRow);
  },

  async removeNode(id: string): Promise<void> {
    const { error } = await requireSupabase().from("selection_nodes").delete().eq("id", id);
    if (error) throw error;
  },

  async listRules(templateId: string): Promise<FlexibleSelectionRuleRow[]> {
    const { data, error } = await requireSupabase()
      .from("selection_rule_rows")
      .select("*")
      .eq("template_id", templateId)
      .order("priority", { ascending: false })
      .order("sort_order", { ascending: true });
    if (error) throw error;
    return ((data ?? []) as RuleRow[]).map(fromRule);
  },

  async createRule(draft: FlexibleSelectionRuleDraft): Promise<FlexibleSelectionRuleRow> {
    const order = await nextOrder("selection_rule_rows", { template_id: draft.templateId });
    const { data, error } = await requireSupabase()
      .from("selection_rule_rows")
      .insert({
        template_id: draft.templateId,
        source_id: draft.sourceId || null,
        rule_kind: "lookup",
        input_unit: draft.inputUnit?.trim() || null,
        input_min: draft.inputMin ?? null,
        input_max: draft.inputMax ?? null,
        conditions: draft.conditions ?? {},
        outputs: draft.outputs ?? {},
        priority: draft.priority ?? 0,
        sort_order: order,
        remarks: draft.remarks?.trim() || null,
      })
      .select()
      .single();
    if (error) throw error;
    return fromRule(data as RuleRow);
  },

  async updateRule(id: string, draft: FlexibleSelectionRuleDraft): Promise<FlexibleSelectionRuleRow> {
    const { data, error } = await requireSupabase()
      .from("selection_rule_rows")
      .update({
        source_id: draft.sourceId || null,
        input_unit: draft.inputUnit?.trim() || null,
        input_min: draft.inputMin ?? null,
        input_max: draft.inputMax ?? null,
        conditions: draft.conditions ?? {},
        outputs: draft.outputs ?? {},
        priority: draft.priority ?? 0,
        remarks: draft.remarks?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return fromRule(data as RuleRow);
  },

  async removeRule(id: string): Promise<void> {
    const { error } = await requireSupabase().from("selection_rule_rows").delete().eq("id", id);
    if (error) throw error;
  },
};
