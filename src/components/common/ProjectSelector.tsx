"use client";

import { Check, Plus, Search as SearchIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { designCaseService, projectService } from "@/lib/services/design";
import {
  buildProjectOptionLabel,
  groupCasesByProject,
  matchesProjectQuery,
  type ProjectWithCases,
} from "@/lib/utils/projectSearch";
import { NewProjectModal } from "@/components/common/NewProjectModal";
import type { Project } from "@/lib/types/design";

interface ProjectSelectorProps {
  projectId: string;
  onProjectChange: (projectId: string) => void;
}

/**
 * THE one Project picker shared by every Project-scoped area of the app
 * (設計管理, 部品製作, 重量/盤重量/風量/風圧/耐震/他計算) — same `projects` table,
 * same list, same UX everywhere, per spec. Collapsed by default to a plain
 * "現在のProject：…" line + 変更 button so it never crowds the page; expands
 * into a searchable list (matching against 図面番号/管理番号/工事番号/件名/盤名称 via
 * `projectSearch.ts`) only when the user asks to change it. "＋ 新規Project"
 * opens a real form (`NewProjectModal`) instead of an always-visible inline
 * input. Never auto-picks a Project on the user's behalf — leaving nothing
 * selected is a normal, expected state (see spec #16), not something to
 * paper over by silently choosing the first Project in the list.
 */
export function ProjectSelector({
  projectId,
  onProjectChange,
}: ProjectSelectorProps) {
  const { t } = useTranslation();
  const [options, setOptions] = useState<ProjectWithCases[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [picking, setPicking] = useState(!projectId);
  const [query, setQuery] = useState("");
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([projectService.list(), designCaseService.listAll()]).then(
      ([projects, allCases]) => {
        setOptions(groupCasesByProject(projects, allCases));
        setLoaded(true);
      },
    );
  }, []);

  // Once a Project becomes active (restored from shared state, or picked
  // just now), collapse back to the compact "現在のProject" display.
  useEffect(() => {
    if (projectId) setPicking(false);
  }, [projectId]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node) &&
        projectId
      ) {
        setPicking(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [projectId]);

  const current = options.find((o) => o.project.id === projectId) ?? null;

  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return options;
    return options.filter((o) => matchesProjectQuery(o, q));
  }, [options, query]);

  function handleSelect(option: ProjectWithCases) {
    onProjectChange(option.project.id);
    setQuery("");
    setPicking(false);
  }

  function handleCreated(created: Project) {
    setOptions((prev) => [...prev, { project: created, cases: [] }]);
    onProjectChange(created.id);
    setShowNewProjectModal(false);
    setPicking(false);
  }

  return (
    <div
      ref={containerRef}
      className="relative flex flex-col gap-2 rounded-lg border border-border bg-surface px-3 py-2.5"
    >
      {!picking ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold tracking-wide text-muted uppercase">
              {t("design.workspaceBar.currentProjectLabel")}
            </div>
            <div className="truncate text-[14px] font-bold text-foreground">
              {current
                ? buildProjectOptionLabel(current)
                : loaded
                  ? t("design.workspaceBar.projectNotFound")
                  : t("common.loading")}
            </div>
          </div>
          <button
            onClick={() => setPicking(true)}
            className="btn-secondary shrink-0"
          >
            {t("design.workspaceBar.changeProject")}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-2" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("design.workspaceBar.projectSearchPlaceholder")}
              className="field-input pl-8"
            />
          </div>
          <div className="max-h-64 overflow-y-auto rounded-md border border-border-strong bg-surface-2">
            {filtered.length === 0 ? (
              <div className="px-3 py-3 text-center text-[12.5px] text-muted-2">
                {loaded
                  ? t("design.workspaceBar.noProjects")
                  : t("common.loading")}
              </div>
            ) : (
              filtered.map((option) => (
                <button
                  key={option.project.id}
                  type="button"
                  onClick={() => handleSelect(option)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-foreground hover:bg-surface-hover"
                >
                  {option.project.id === projectId && (
                    <Check className="h-3.5 w-3.5 shrink-0 text-accent" />
                  )}
                  <span className="truncate">
                    {buildProjectOptionLabel(option)}
                  </span>
                </button>
              ))
            )}
          </div>
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() => setShowNewProjectModal(true)}
              className="btn-ghost"
            >
              <Plus className="h-3.5 w-3.5" />
              {t("design.workspaceBar.newProjectButton")}
            </button>
            {projectId && (
              <button onClick={() => setPicking(false)} className="btn-ghost">
                {t("common.cancel")}
              </button>
            )}
          </div>
        </div>
      )}

      {showNewProjectModal && (
        <NewProjectModal
          onClose={() => setShowNewProjectModal(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  );
}
