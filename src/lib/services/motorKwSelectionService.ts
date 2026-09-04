import { requireSupabase } from "@/lib/supabase/client";
import type { SelectionCircuitType, SelectionVoltageClass } from "@/lib/types";

export type MotorKwBasisKind = "mitsubishi" | "fuji" | "company";
export type MotorKwPhase = "single" | "three";

export interface MotorKwSelectionSource {
  id: string;
  title: string;
  url?: string;
  documentNo?: string;
  publishedLabel?: string;
  verifiedAt?: string;
  remarks?: string;
}

export interface MotorKwSelectionRow {
  id: string;
  basisKind: MotorKwBasisKind;
  manufacturerId?: string;
  phase: MotorKwPhase;
  voltageClass: SelectionVoltageClass;
  startMethod: SelectionCircuitType;
  motorKw: number;
  ratedCurrentA?: number;
  startingCurrentA?: number;
  breakerModel?: string;
  breakerRatedA?: number;
  breakerCondition?: string;
  contactorModel?: string;
  thermalModel?: string;
  thermalSettingA?: number;
  inverterModel?: string;
  wireSize?: string;
  ctModel?: string;
  amRange?: string;
  naisenBasis?: string;
  jisBasis?: string;
  associationBasis?: string;
  remarks?: string;
  sortOrder: number;
  source?: MotorKwSelectionSource;
}

export interface MotorKwSelectionDraft {
  manufacturerId: string;
  phase: MotorKwPhase;
  voltageClass: SelectionVoltageClass;
  startMethod: SelectionCircuitType;
  motorKw: number;
  ratedCurrentA?: number;
  startingCurrentA?: number;
  breakerModel?: string;
  breakerRatedA?: number;
  breakerCondition?: string;
  contactorModel?: string;
  thermalModel?: string;
  thermalSettingA?: number;
  inverterModel?: string;
  wireSize?: string;
  ctModel?: string;
  amRange?: string;
  naisenBasis?: string;
  jisBasis?: string;
  associationBasis?: string;
  remarks?: string;
}

interface SourceRow {
  id: string;
  title: string;
  url: string | null;
  document_no: string | null;
  published_label: string | null;
  verified_at: string | null;
  remarks: string | null;
}

interface Row {
  id: string;
  basis_kind: MotorKwBasisKind;
  manufacturer_id: string | null;
  phase: MotorKwPhase;
  voltage_class: SelectionVoltageClass;
  start_method: SelectionCircuitType;
  motor_kw: number;
  rated_current_a: number | null;
  starting_current_a: number | null;
  breaker_model: string | null;
  breaker_rated_a: number | null;
  breaker_condition: string | null;
  contactor_model: string | null;
  thermal_model: string | null;
  thermal_setting_a: number | null;
  inverter_model: string | null;
  wire_size: string | null;
  ct_model: string | null;
  am_range: string | null;
  naisen_basis: string | null;
  jis_basis: string | null;
  association_basis: string | null;
  remarks: string | null;
  sort_order: number;
  source: SourceRow | SourceRow[] | null;
}

function maybeNumber(value: number | null): number | undefined {
  return value == null ? undefined : Number(value);
}

function fromRow(row: Row): MotorKwSelectionRow {
  const sourceRaw = Array.isArray(row.source) ? row.source[0] : row.source;
  return {
    id: row.id,
    basisKind: row.basis_kind,
    manufacturerId: row.manufacturer_id ?? undefined,
    phase: row.phase,
    voltageClass: row.voltage_class,
    startMethod: row.start_method,
    motorKw: Number(row.motor_kw),
    ratedCurrentA: maybeNumber(row.rated_current_a),
    startingCurrentA: maybeNumber(row.starting_current_a),
    breakerModel: row.breaker_model ?? undefined,
    breakerRatedA: maybeNumber(row.breaker_rated_a),
    breakerCondition: row.breaker_condition ?? undefined,
    contactorModel: row.contactor_model ?? undefined,
    thermalModel: row.thermal_model ?? undefined,
    thermalSettingA: maybeNumber(row.thermal_setting_a),
    inverterModel: row.inverter_model ?? undefined,
    wireSize: row.wire_size ?? undefined,
    ctModel: row.ct_model ?? undefined,
    amRange: row.am_range ?? undefined,
    naisenBasis: row.naisen_basis ?? undefined,
    jisBasis: row.jis_basis ?? undefined,
    associationBasis: row.association_basis ?? undefined,
    remarks: row.remarks ?? undefined,
    sortOrder: Number(row.sort_order),
    source: sourceRaw
      ? {
          id: sourceRaw.id,
          title: sourceRaw.title,
          url: sourceRaw.url ?? undefined,
          documentNo: sourceRaw.document_no ?? undefined,
          publishedLabel: sourceRaw.published_label ?? undefined,
          verifiedAt: sourceRaw.verified_at ?? undefined,
          remarks: sourceRaw.remarks ?? undefined,
        }
      : undefined,
  };
}

function toCompanyPayload(draft: MotorKwSelectionDraft) {
  return {
    basis_kind: "company" as const,
    manufacturer_id: draft.manufacturerId || null,
    phase: draft.phase,
    voltage_class: draft.voltageClass,
    start_method: draft.startMethod,
    motor_kw: draft.motorKw,
    rated_current_a: draft.ratedCurrentA ?? null,
    starting_current_a: draft.startingCurrentA ?? null,
    breaker_model: draft.breakerModel?.trim() || null,
    breaker_rated_a: draft.breakerRatedA ?? null,
    breaker_condition: draft.breakerCondition?.trim() || null,
    contactor_model: draft.contactorModel?.trim() || null,
    thermal_model: draft.thermalModel?.trim() || null,
    thermal_setting_a: draft.thermalSettingA ?? null,
    inverter_model: draft.inverterModel?.trim() || null,
    wire_size: draft.wireSize?.trim() || null,
    ct_model: draft.ctModel?.trim() || null,
    am_range: draft.amRange?.trim() || null,
    naisen_basis: draft.naisenBasis?.trim() || null,
    jis_basis: draft.jisBasis?.trim() || null,
    association_basis: draft.associationBasis?.trim() || null,
    remarks: draft.remarks?.trim() || null,
  };
}

export function matchMotorKwRows(
  rows: MotorKwSelectionRow[],
  phase: MotorKwPhase,
  voltageClass: SelectionVoltageClass,
  startMethod: SelectionCircuitType,
  motorKw: number,
): MotorKwSelectionRow[] {
  if (!Number.isFinite(motorKw) || motorKw <= 0) return [];
  const basisOrder: Record<MotorKwBasisKind, number> = { mitsubishi: 0, fuji: 1, company: 2 };
  return rows
    .filter(
      (row) =>
        row.phase === phase &&
        row.voltageClass === voltageClass &&
        row.startMethod === startMethod &&
        Math.abs(row.motorKw - motorKw) < 1e-6,
    )
    .sort((a, b) => basisOrder[a.basisKind] - basisOrder[b.basisKind] || a.sortOrder - b.sortOrder);
}

export const motorKwSelectionService = {
  async list(): Promise<MotorKwSelectionRow[]> {
    const { data, error } = await requireSupabase()
      .from("motor_kw_selection_rows")
      .select("*, source:selection_sources(id,title,url,document_no,published_label,verified_at,remarks)")
      .order("sort_order", { ascending: true });
    if (error) throw error;
    return (data ?? []).map((row) => fromRow(row as Row));
  },

  async createCompany(draft: MotorKwSelectionDraft): Promise<MotorKwSelectionRow> {
    const client = requireSupabase();
    const { data: maxRow } = await client
      .from("motor_kw_selection_rows")
      .select("sort_order")
      .eq("basis_kind", "company")
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const sortOrder = maxRow ? Number(maxRow.sort_order) + 1 : 10000;
    const { data, error } = await client
      .from("motor_kw_selection_rows")
      .insert({ ...toCompanyPayload(draft), sort_order: sortOrder })
      .select("*, source:selection_sources(id,title,url,document_no,published_label,verified_at,remarks)")
      .single();
    if (error) throw error;
    return fromRow(data as Row);
  },

  async updateCompany(id: string, draft: MotorKwSelectionDraft): Promise<MotorKwSelectionRow> {
    const { data, error } = await requireSupabase()
      .from("motor_kw_selection_rows")
      .update({ ...toCompanyPayload(draft), updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("basis_kind", "company")
      .select("*, source:selection_sources(id,title,url,document_no,published_label,verified_at,remarks)")
      .single();
    if (error) throw error;
    return fromRow(data as Row);
  },

  async removeCompany(id: string): Promise<void> {
    const { error } = await requireSupabase()
      .from("motor_kw_selection_rows")
      .delete()
      .eq("id", id)
      .eq("basis_kind", "company");
    if (error) throw error;
  },
};
