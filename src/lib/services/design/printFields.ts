import { designCaseService } from "./designCaseService";
import { productionRequestService } from "./productionRequestService";
import { scheduleService } from "./scheduleService";
import type { CasePanel, CaseSchedule, DesignCase, ProductionRequest } from "@/lib/types/design";

/**
 * Single source of field data for BOTH the real-template Excel export and
 * the PDF export of 設計依頼書 — the two must never diverge, so both read
 * from this one loader instead of each fetching/shaping the case
 * independently.
 */
export interface DesignRequestPrintFields {
  case: DesignCase;
  panels: CasePanel[]; // sorted by panelNo
}

export async function loadDesignRequestPrintFields(caseId: string): Promise<DesignRequestPrintFields> {
  const detail = await designCaseService.getDetail(caseId);
  if (!detail) throw new Error("case-not-found");
  return {
    case: detail.case,
    panels: detail.panels.slice().sort((a, b) => a.panelNo - b.panelNo),
  };
}

/** Same principle for 製作依頼書 — Excel and PDF export both read this one loader. */
export interface ProductionRequestPrintFields {
  case: DesignCase;
  panels: CasePanel[];
  request: ProductionRequest;
  schedule: CaseSchedule;
}

/** "2026-08-08" -> "8/8", matching the real ⑧製作依頼書 template's own m/d cell format. */
export function formatShortDate(iso: string | null): string {
  if (!iso) return "";
  const [, month, day] = iso.split("-");
  if (!month || !day) return iso;
  return `${Number(month)}/${Number(day)}`;
}

export async function loadProductionRequestPrintFields(caseId: string): Promise<ProductionRequestPrintFields> {
  const [detail, request, schedule] = await Promise.all([
    designCaseService.getDetail(caseId),
    productionRequestService.getByCase(caseId),
    scheduleService.getByCase(caseId),
  ]);
  if (!detail) throw new Error("case-not-found");
  return {
    case: detail.case,
    panels: detail.panels.slice().sort((a, b) => a.panelNo - b.panelNo),
    request,
    schedule,
  };
}
