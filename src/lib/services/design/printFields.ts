import type { CasePanel, CaseSchedule, DesignCase, ProductionRequest } from "@/lib/types/design";

/**
 * Single source of field-data shape for BOTH the real-template Excel export
 * and the PDF export of 設計依頼書 — the two must never diverge. Callers
 * (the form components) build this directly from their own already-loaded
 * (possibly unsaved-yet) state, never by re-fetching from the DB — so what
 * the form shows on screen is exactly what prints/exports, with no risk of
 * a stale DB read overriding an edit the user hasn't saved yet.
 */
export interface DesignRequestPrintFields {
  case: DesignCase;
  panels: CasePanel[]; // sorted by panelNo
}

/** Same principle for 製作依頼書 — Excel and PDF export both read this one shape. */
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
