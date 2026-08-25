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
export function getNextSequenceForYear(
  cases: DesignCase[],
  year: number,
): number {
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
 * The one canonical 案件 display format, used everywhere a 案件 is shown
 * (現在の案件, the shared picker, 保存済み案件, ledger/index tables, exports,
 * Global Search results — never a bespoke format per screen):
 *
 *   図面番号〇管理番号（工事番号）　件名／盤名称
 *   例）26-0001〇A260101（R123456）　本社ビル電気設備改修／動力盤
 *
 * Rules: 図面番号/管理番号 join with "〇"; 工事番号 wraps in full-width "（）"
 * (omitted entirely when blank — never a stray "（）"); then a full-width
 * space "　"; then 件名/盤名称 join with "／" (also omitted entirely when
 * blank on either side — never a stray "／"). Never uses "|" or any other
 * separator. Display-only — the database keeps each 盤 as its own row.
 */
/** 件名／盤名称 だけの表示ラベル（図面番号・管理番号を別列で表示する場所、例: 工程表 の B列で使う）。 */
export function buildProjectPanelLabel(
  designCase: DesignCase,
  panels: CasePanel[],
): string {
  const panelNames = panels
    .slice()
    .sort((a, b) => a.panelNo - b.panelNo)
    .map((p) => p.panelName.trim())
    .filter(Boolean);

  return [designCase.projectName.trim(), panelNames.join("・")]
    .filter(Boolean)
    .join("／");
}

export function buildCaseDisplayLabel(
  designCase: DesignCase,
  panels: CasePanel[],
): string {
  const left = [
    designCase.drawingNumber.trim(),
    designCase.managementNumber.trim(),
  ]
    .filter(Boolean)
    .join("〇");
  const constructionPart = designCase.constructionNumber.trim()
    ? `（${designCase.constructionNumber.trim()}）`
    : "";
  const head = `${left}${constructionPart}`;
  const right = buildProjectPanelLabel(designCase, panels);

  if (head && right) return `${head}　${right}`;
  return head || right;
}
