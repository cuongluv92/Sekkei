import type { CasePanel, DesignCase } from "@/lib/types/design";

/**
 * Finds the next 図面番号 sequence for a given year from the cases that
 * already exist. Mirrors the real 図面管理台帳 (drawing number ledger):
 * year and sequence are separate numbers there (e.g. A3=26, B3=1), the
 * "26-001" string is only a display format — never a stored/parsed value.
 *
 * NOTE: this mock repository re-reads current state and computes+persists
 * the next number as one step (see designCaseService.create), which is
 * atomic within a single browser tab. A real backend MUST enforce this with
 * a DB unique constraint on (year, sequence_no) plus a transaction — two
 * concurrent users must never be able to claim the same number.
 */
export function getNextSequenceForYear(cases: DesignCase[], year: number): number {
  const used = cases.filter((c) => c.year === year).map((c) => c.sequenceNo);
  return used.length === 0 ? 1 : Math.max(...used) + 1;
}

/** "26-004" — 2-digit year, 3-digit zero-padded sequence. Never hard-code the year. */
export function formatDrawingNumber(year: number, sequenceNo: number): string {
  const yy = String(year % 100).padStart(2, "0");
  const seq = String(sequenceNo).padStart(3, "0");
  return `${yy}-${seq}`;
}

/**
 * 図面番号 ○ 管理番号 件名／盤名称1・盤名称2...
 * Display-only formatting — the database keeps each 盤 as its own row.
 */
export function buildCaseDisplayLabel(designCase: DesignCase, panels: CasePanel[]): string {
  const panelNames = panels
    .slice()
    .sort((a, b) => a.panelNo - b.panelNo)
    .map((p) => p.panelName.trim())
    .filter(Boolean);
  const panelPart = panelNames.length > 0 ? `／${panelNames.join("・")}` : "";
  return `${designCase.drawingNumber} ○ ${designCase.managementNumber} ${designCase.projectName}${panelPart}`;
}
