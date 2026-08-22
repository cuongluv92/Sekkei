import { requireSupabase } from "@/lib/supabase/client";
import {
  formatDrawingNumber,
  getNextSequenceForYear,
} from "@/lib/utils/designNumbering";
import type {
  CasePanel,
  CaseStatus,
  DesignCase,
  DesignCaseSearchQuery,
  DesignCaseWithPanels,
  IndexCategory,
  PanelNo,
} from "@/lib/types/design";

interface DesignCaseRow {
  id: string;
  year: number;
  sequence_no: number;
  drawing_number: string;
  request_type: string;
  management_number: string;
  construction_number: string;
  orderer: string;
  customer_contact: string;
  project_name: string;
  specs: DesignCase["specs"];
  design_remarks: string;
  index_category: IndexCategory;
  assignee: string;
  case_status: CaseStatus;
  manufacturing_complete: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

interface CasePanelRow {
  id: string;
  case_id: string;
  panel_no: number;
  panel_name: string;
  panel_structure: string;
  face_count: number | null;
  design_due_date: string | null;
  design_estimated_hours: number | null;
  design_actual_hours: number | null;
  production_estimated_hours: number | null;
  production_actual_hours: number | null;
  electrical_method: string;
  rated_voltage: string;
  rated_current: string;
  rated_breaking_capacity: string;
  frequency: string;
  control_voltage: string;
  protection_rating: string;
}

function caseFromRow(row: DesignCaseRow): DesignCase {
  return {
    id: row.id,
    year: row.year,
    sequenceNo: row.sequence_no,
    drawingNumber: row.drawing_number,
    requestType: row.request_type,
    managementNumber: row.management_number,
    constructionNumber: row.construction_number,
    orderer: row.orderer,
    customerContact: row.customer_contact,
    projectName: row.project_name,
    specs: row.specs ?? {},
    designRemarks: row.design_remarks,
    indexCategory: row.index_category,
    assignee: row.assignee,
    caseStatus: row.case_status,
    manufacturingComplete: row.manufacturing_complete,
    createdAt: row.created_at.slice(0, 10),
    updatedAt: row.updated_at.slice(0, 10),
    deletedAt: row.deleted_at,
  };
}

function panelFromRow(row: CasePanelRow): CasePanel {
  return {
    id: row.id,
    caseId: row.case_id,
    panelNo: row.panel_no as PanelNo,
    panelName: row.panel_name,
    panelStructure: row.panel_structure,
    faceCount: row.face_count,
    designDueDate: row.design_due_date,
    designEstimatedHours: row.design_estimated_hours,
    designActualHours: row.design_actual_hours,
    productionEstimatedHours: row.production_estimated_hours,
    productionActualHours: row.production_actual_hours,
    electricalMethod: row.electrical_method,
    ratedVoltage: row.rated_voltage,
    ratedCurrent: row.rated_current,
    ratedBreakingCapacity: row.rated_breaking_capacity,
    frequency: row.frequency,
    controlVoltage: row.control_voltage,
    protectionRating: row.protection_rating,
  };
}

function panelToRow(caseId: string, panel: CasePanel) {
  return {
    case_id: caseId,
    panel_no: panel.panelNo,
    panel_name: panel.panelName,
    panel_structure: panel.panelStructure,
    face_count: panel.faceCount,
    design_due_date: panel.designDueDate,
    design_estimated_hours: panel.designEstimatedHours,
    design_actual_hours: panel.designActualHours,
    production_estimated_hours: panel.productionEstimatedHours,
    production_actual_hours: panel.productionActualHours,
    electrical_method: panel.electricalMethod,
    rated_voltage: panel.ratedVoltage,
    rated_current: panel.ratedCurrent,
    rated_breaking_capacity: panel.ratedBreakingCapacity,
    frequency: panel.frequency,
    control_voltage: panel.controlVoltage,
    protection_rating: panel.protectionRating,
  };
}

async function panelsForCase(caseId: string): Promise<CasePanel[]> {
  const { data, error } = await requireSupabase()
    .from("case_panels")
    .select("*")
    .eq("case_id", caseId)
    .order("panel_no", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(panelFromRow);
}

async function panelsForCases(
  caseIds: string[],
): Promise<Map<string, CasePanel[]>> {
  const map = new Map<string, CasePanel[]>();
  if (caseIds.length === 0) return map;
  const { data, error } = await requireSupabase()
    .from("case_panels")
    .select("*")
    .in("case_id", caseIds)
    .order("panel_no", { ascending: true });
  if (error) throw error;
  for (const row of (data ?? []) as CasePanelRow[]) {
    const panel = panelFromRow(row);
    const list = map.get(panel.caseId) ?? [];
    list.push(panel);
    map.set(panel.caseId, list);
  }
  return map;
}

export interface CreateCaseInput {
  year: number;
  requestType: string;
  managementNumber: string;
  constructionNumber: string;
  orderer: string;
  customerContact: string;
  projectName: string;
  indexCategory: IndexCategory;
}

export const designCaseService = {
  /** Every 案件 across the whole app (excluding archived) — 案件 is the single root record, there is no per-module/per-Project scoping to list "within". Backs the system-wide ledger tables (図面管理台帳/目次/工程表/原価工数) and every 案件 picker/search. */
  async listAll(): Promise<DesignCaseWithPanels[]> {
    const { data, error } = await requireSupabase()
      .from("design_cases")
      .select("*")
      .is("deleted_at", null)
      .order("drawing_number", { ascending: false });
    if (error) throw error;
    const cases = (data ?? []).map(caseFromRow);
    const panelMap = await panelsForCases(cases.map((c) => c.id));
    return cases.map((c) => ({ case: c, panels: panelMap.get(c.id) ?? [] }));
  },

  async getDetail(caseId: string): Promise<DesignCaseWithPanels | null> {
    const { data, error } = await requireSupabase()
      .from("design_cases")
      .select("*")
      .eq("id", caseId)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const panels = await panelsForCase(caseId);
    return { case: caseFromRow(data as DesignCaseRow), panels };
  },

  /**
   * Free-text OR search across 図面番号/管理番号/工事番号/件名/担当/盤名称 for one
   * query string — backs the shared 案件 picker's quick search and Global
   * Search's 案件 provider. Runs each field as its own `ilike` (instead of
   * building one `.or(...)` filter string) so user input containing commas
   * or parentheses — which the label format itself uses, e.g. "（R123456）"
   * — can never be misread as PostgREST filter syntax.
   */
  async quickSearch(query: string): Promise<DesignCaseWithPanels[]> {
    const q = query.trim();
    if (!q) return [];
    const client = requireSupabase();
    const fields = [
      "drawing_number",
      "management_number",
      "construction_number",
      "project_name",
      "assignee",
    ] as const;
    const [byField, panelMatches] = await Promise.all([
      Promise.all(
        fields.map((f) =>
          client
            .from("design_cases")
            .select("*")
            .is("deleted_at", null)
            .ilike(f, `%${q}%`),
        ),
      ),
      client
        .from("case_panels")
        .select("case_id")
        .ilike("panel_name", `%${q}%`),
    ]);
    if (panelMatches.error) throw panelMatches.error;

    const rowsById = new Map<string, DesignCaseRow>();
    for (const result of byField) {
      if (result.error) throw result.error;
      for (const row of (result.data ?? []) as DesignCaseRow[])
        rowsById.set(row.id, row);
    }
    const panelCaseIds = Array.from(
      new Set((panelMatches.data ?? []).map((r) => r.case_id as string)),
    );
    if (panelCaseIds.length > 0) {
      const { data, error } = await client
        .from("design_cases")
        .select("*")
        .is("deleted_at", null)
        .in("id", panelCaseIds);
      if (error) throw error;
      for (const row of (data ?? []) as DesignCaseRow[])
        rowsById.set(row.id, row);
    }

    const cases = Array.from(rowsById.values()).map(caseFromRow);
    const panelMap = await panelsForCases(cases.map((c) => c.id));
    return cases
      .map((c) => ({ case: c, panels: panelMap.get(c.id) ?? [] }))
      .sort((a, b) =>
        a.case.drawingNumber.localeCompare(b.case.drawingNumber, "ja"),
      );
  },

  /** Preview only — does not reserve the number. The real number is assigned atomically by the `create_design_case` DB function. */
  async previewNextDrawingNumber(year: number): Promise<string> {
    const { data, error } = await requireSupabase()
      .from("design_cases")
      .select("sequence_no")
      .eq("year", year);
    if (error) throw error;
    const cases = (data ?? []).map((r) => ({
      year,
      sequenceNo: r.sequence_no,
    })) as DesignCase[];
    const seq = getNextSequenceForYear(cases, year);
    return formatDrawingNumber(year, seq);
  },

  /**
   * Atomic create via the `create_design_case` Postgres function: the next
   * sequence_no is computed and inserted inside one transaction, serialized
   * per-year with an advisory lock, so two concurrent creates for the same
   * year can never collide — the mock's known limitation, now closed.
   */
  async create(input: CreateCaseInput): Promise<DesignCase> {
    const { data, error } = await requireSupabase().rpc("create_design_case", {
      p_year: input.year,
      p_request_type: input.requestType,
      p_management_number: input.managementNumber,
      p_construction_number: input.constructionNumber,
      p_orderer: input.orderer,
      p_customer_contact: input.customerContact,
      p_project_name: input.projectName,
      p_index_category: input.indexCategory,
    });
    if (error) throw error;
    return caseFromRow(data as DesignCaseRow);
  },

  async update(
    caseId: string,
    patch: Partial<DesignCase>,
  ): Promise<DesignCase> {
    const row: Record<string, unknown> = {};
    if (patch.requestType !== undefined) row.request_type = patch.requestType;
    if (patch.managementNumber !== undefined)
      row.management_number = patch.managementNumber;
    if (patch.constructionNumber !== undefined)
      row.construction_number = patch.constructionNumber;
    if (patch.orderer !== undefined) row.orderer = patch.orderer;
    if (patch.customerContact !== undefined)
      row.customer_contact = patch.customerContact;
    if (patch.projectName !== undefined) row.project_name = patch.projectName;
    if (patch.specs !== undefined) row.specs = patch.specs;
    if (patch.designRemarks !== undefined)
      row.design_remarks = patch.designRemarks;
    if (patch.indexCategory !== undefined)
      row.index_category = patch.indexCategory;
    if (patch.assignee !== undefined) row.assignee = patch.assignee;
    if (patch.caseStatus !== undefined) row.case_status = patch.caseStatus;
    if (patch.manufacturingComplete !== undefined)
      row.manufacturing_complete = patch.manufacturingComplete;
    row.updated_at = new Date().toISOString();

    const { data, error } = await requireSupabase()
      .from("design_cases")
      .update(row)
      .eq("id", caseId)
      .select()
      .single();
    if (error) throw error;
    return caseFromRow(data as DesignCaseRow);
  },

  /** 保存済み案件's 削除 action — soft delete only (never a hard DELETE): sets `deleted_at`, which every listing/search filters out. Recoverable directly in the database if archived by mistake. */
  async archive(caseId: string): Promise<void> {
    const { error } = await requireSupabase()
      .from("design_cases")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", caseId);
    if (error) throw error;
  },

  /** Replaces the full panel set for a case (盤①～⑦ are edited together as one form): upsert every row in the new set, then delete any panel_no no longer present. */
  async savePanels(caseId: string, panels: CasePanel[]): Promise<CasePanel[]> {
    const client = requireSupabase();
    if (panels.length > 0) {
      const { error } = await client.from("case_panels").upsert(
        panels.map((p) => panelToRow(caseId, p)),
        { onConflict: "case_id,panel_no" },
      );
      if (error) throw error;
    }
    const keepNos = panels.map((p) => p.panelNo);
    const deleteQuery = client
      .from("case_panels")
      .delete()
      .eq("case_id", caseId);
    const { error: deleteError } =
      keepNos.length > 0
        ? await deleteQuery.not("panel_no", "in", `(${keepNos.join(",")})`)
        : await deleteQuery;
    if (deleteError) throw deleteError;
    return panelsForCase(caseId);
  },

  async search(query: DesignCaseSearchQuery): Promise<DesignCaseWithPanels[]> {
    const client = requireSupabase();
    let request = client
      .from("design_cases")
      .select("*")
      .is("deleted_at", null);

    if (query.year) request = request.eq("year", query.year);
    if (query.drawingNumber)
      request = request.ilike("drawing_number", `%${query.drawingNumber}%`);
    if (query.managementNumber)
      request = request.ilike(
        "management_number",
        `%${query.managementNumber}%`,
      );
    if (query.constructionNumber)
      request = request.ilike(
        "construction_number",
        `%${query.constructionNumber}%`,
      );
    if (query.orderer) request = request.ilike("orderer", `%${query.orderer}%`);
    if (query.customerContact)
      request = request.ilike("customer_contact", `%${query.customerContact}%`);
    if (query.projectName)
      request = request.ilike("project_name", `%${query.projectName}%`);

    if (query.panelName) {
      const { data: matchingPanels, error: panelError } = await client
        .from("case_panels")
        .select("case_id")
        .ilike("panel_name", `%${query.panelName}%`);
      if (panelError) throw panelError;
      const caseIds = Array.from(
        new Set((matchingPanels ?? []).map((r) => r.case_id as string)),
      );
      if (caseIds.length === 0) return [];
      request = request.in("id", caseIds);
    }

    const { data, error } = await request;
    if (error) throw error;
    const cases = (data ?? []).map(caseFromRow);
    const panelMap = await panelsForCases(cases.map((c) => c.id));
    return cases.map((c) => ({ case: c, panels: panelMap.get(c.id) ?? [] }));
  },
};
