/**
 * Shared Project-picker logic used by every module that lets the user
 * select/search the app-wide active Project (設計管理, 部品製作, and every
 * calculation module) — one label format, one search behavior, instead of
 * each module inventing its own.
 *
 * `Project` itself only stores `{id, name, createdAt}` — the richer
 * identifying fields the spec asks to prioritize (図面番号/管理番号/工事番号/
 * 件名/盤名称) live on its child `DesignCase`/`CasePanel` records (設計管理's
 * 案件/盤), reachable via `designCaseService.listAll()`.
 *
 * A Project can have MULTIPLE 案件 (e.g. 26-001, 26-002, 26-003 all filed
 * under the same Project) — each one is its own selectable/searchable
 * option here, not collapsed into a single "one label per Project" row.
 * Picking any of them resolves to that 案件's `projectId`, which is the
 * only thing the rest of the app (部品製作/calculations) actually keys off.
 * A Project with no 案件 yet (e.g. one just created from 重量計算/部品製作)
 * still gets exactly one option, labeled with its bare name.
 */
import { matchesAllTokens } from "@/lib/utils/partSearch";
import type { CasePanel, DesignCase, DesignCaseWithPanels, Project } from "@/lib/types/design";

export interface ProjectOption {
  /** The Project id this option resolves to when picked. */
  projectId: string;
  /** The bare Project name — used as the fallback label/search field for a Project with no 案件 yet. */
  projectName: string;
  /** The specific 案件 this row represents, or null for a Project that has none yet. */
  case: DesignCase | null;
  panels: CasePanel[];
}

/** One option per 案件 across every Project, plus one fallback option for any Project with zero 案件 — sorted so 図面番号 reads in ascending order (26-001, 26-002, 26-003, ...). */
export function buildProjectOptions(projects: Project[], allCases: DesignCaseWithPanels[]): ProjectOption[] {
  const casesByProject = new Map<string, DesignCaseWithPanels[]>();
  for (const entry of allCases) {
    const list = casesByProject.get(entry.case.projectId);
    if (list) list.push(entry);
    else casesByProject.set(entry.case.projectId, [entry]);
  }

  const options: ProjectOption[] = [];
  for (const project of projects) {
    const cases = casesByProject.get(project.id) ?? [];
    if (cases.length === 0) {
      options.push({ projectId: project.id, projectName: project.name, case: null, panels: [] });
    } else {
      for (const { case: c, panels } of cases) {
        options.push({ projectId: project.id, projectName: project.name, case: c, panels });
      }
    }
  }

  return options.sort((a, b) =>
    (a.case?.drawingNumber ?? a.projectName).localeCompare(b.case?.drawingNumber ?? b.projectName, "ja"),
  );
}

/**
 * e.g. "26-003〇A260103（R223344）　倉庫照明更新／照明盤" — falls back to the
 * bare Project name when this option has no 案件. Rules: 図面番号/管理番号
 * join with "〇"; 工事番号 wraps in "（）"; then a full-width space; then
 * 件名/盤名称 join with "／". Any blank field is dropped along with its
 * separator — never a stray "（）" or "／" with nothing on one side.
 */
export function buildProjectOptionLabel(option: ProjectOption): string {
  const c = option.case;
  if (!c) return option.projectName;

  const panelNames = option.panels
    .map((p) => p.panelName.trim())
    .filter(Boolean)
    .join("・");

  const left = [c.drawingNumber.trim(), c.managementNumber.trim()].filter(Boolean).join("〇");
  const constructionPart = c.constructionNumber.trim() ? `（${c.constructionNumber.trim()}）` : "";
  const head = `${left}${constructionPart}`;
  const right = [c.projectName.trim(), panelNames].filter(Boolean).join("／");

  if (head && right) return `${head}　${right}`;
  if (head) return head;
  if (right) return right;
  return option.projectName;
}

/** Matches a query against this option's own 図面番号/管理番号/工事番号/件名/盤名称 (or the bare Project name when it has no 案件). */
export function matchesProjectOptionQuery(option: ProjectOption, query: string): boolean {
  const fields = [
    option.projectName,
    option.case?.drawingNumber,
    option.case?.managementNumber,
    option.case?.constructionNumber,
    option.case?.projectName,
    ...option.panels.map((p) => p.panelName),
  ];
  return matchesAllTokens(fields, query);
}
