/**
 * Shared 案件-picker logic used by every module that lets the user
 * select/search the app-wide active 案件 (設計管理, 部品製作, and every
 * calculation module) — one label format, one search behavior, instead of
 * each module inventing its own. 案件 (design_cases) is the root record —
 * there is no separate Project layer grouping several 案件 together, so
 * every 案件 is simply its own independently searchable/selectable option
 * (e.g. 26-0001/26-0002/26-0003 are three separate options, never collapsed
 * into one).
 */
import { matchesAllTokens } from "@/lib/utils/partSearch";
import { buildCaseDisplayLabel } from "@/lib/utils/designNumbering";
import type {
  CasePanel,
  DesignCase,
  DesignCaseWithPanels,
} from "@/lib/types/design";

export interface CaseOption {
  caseId: string;
  case: DesignCase;
  panels: CasePanel[];
}

/** One option per 案件, sorted so 図面番号 reads in ascending order (26-0001, 26-0002, 26-0003, ...). */
export function buildCaseOptions(
  allCases: DesignCaseWithPanels[],
): CaseOption[] {
  return allCases
    .map(({ case: c, panels }) => ({ caseId: c.id, case: c, panels }))
    .sort((a, b) =>
      a.case.drawingNumber.localeCompare(b.case.drawingNumber, "ja"),
    );
}

/** e.g. "26-0003〇A260103（R223344）　倉庫照明更新／照明盤" — the one canonical format (designNumbering.buildCaseDisplayLabel), reused here rather than reimplemented. */
export function buildCaseOptionLabel(option: CaseOption): string {
  return buildCaseDisplayLabel(option.case, option.panels);
}

/** Matches a query against this option's own 図面番号/管理番号/工事番号/件名/盤名称. */
export function matchesCaseOptionQuery(
  option: CaseOption,
  query: string,
): boolean {
  const fields = [
    option.case.drawingNumber,
    option.case.managementNumber,
    option.case.constructionNumber,
    option.case.projectName,
    ...option.panels.map((p) => p.panelName),
  ];
  return matchesAllTokens(fields, query);
}
