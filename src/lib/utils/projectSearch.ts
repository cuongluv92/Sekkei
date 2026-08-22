/**
 * Shared Project-picker logic used by every module that lets the user
 * select/search the app-wide active Project (設計管理, 部品製作, and every
 * calculation module) — one label format, one search behavior, instead of
 * each module inventing its own.
 *
 * `Project` itself only stores `{id, name, createdAt}` — the richer
 * identifying fields the spec asks to prioritize (図面番号/管理番号/工事番号/
 * 件名/盤名称) live on its child `DesignCase`/`CasePanel` records (設計管理's
 * 案件/盤), reachable via `designCaseService.listAll()`. This module never
 * invents or duplicates those fields onto Project — it just enriches the
 * picker's label/search using whatever 案件 data already exists for that
 * Project, and falls back to the bare Project name when none exists yet
 * (e.g. a Project created directly from 重量計算/部品製作, before any 設計管理
 * 案件 is attached to it).
 */
import { matchesAllTokens } from "@/lib/utils/partSearch";
import type { DesignCaseWithPanels, Project } from "@/lib/types/design";

export interface ProjectWithCases {
  project: Project;
  cases: DesignCaseWithPanels[];
}

/** Groups every 設計案件 by its Project so the picker can enrich each Project's label/search without a per-Project fetch. */
export function groupCasesByProject(
  projects: Project[],
  allCases: DesignCaseWithPanels[],
): ProjectWithCases[] {
  const byProject = new Map<string, DesignCaseWithPanels[]>();
  for (const entry of allCases) {
    const list = byProject.get(entry.case.projectId);
    if (list) list.push(entry);
    else byProject.set(entry.case.projectId, [entry]);
  }
  return projects.map((project) => ({
    project,
    cases: byProject.get(project.id) ?? [],
  }));
}

/** e.g. "26-001｜A260101｜本社ビル電気設備｜動力盤" — falls back to the bare Project name when it has no 案件 yet. */
export function buildProjectOptionLabel({
  project,
  cases,
}: ProjectWithCases): string {
  if (cases.length === 0) return project.name;
  const primary = cases[0].case;
  const panelNames = cases[0].panels
    .map((p) => p.panelName.trim())
    .filter(Boolean)
    .join("・");
  const parts = [
    primary.drawingNumber,
    primary.managementNumber,
    primary.constructionNumber,
    primary.projectName,
    panelNames,
  ].filter((v) => v.trim() !== "");
  const label = parts.length > 0 ? parts.join("｜") : project.name;
  return cases.length > 1 ? `${label}（他${cases.length - 1}件）` : label;
}

/** Matches a query against the Project's own name plus every one of its 案件's identifying fields (図面番号/管理番号/工事番号/件名/盤名称) — so searching e.g. a 管理番号 finds the right Project even though that field lives on a child 案件, not the Project record itself. */
export function matchesProjectQuery(
  { project, cases }: ProjectWithCases,
  query: string,
): boolean {
  const fields = [
    project.name,
    ...cases.flatMap(({ case: c, panels }) => [
      c.drawingNumber,
      c.managementNumber,
      c.constructionNumber,
      c.projectName,
      ...panels.map((p) => p.panelName),
    ]),
  ];
  return matchesAllTokens(fields, query);
}
